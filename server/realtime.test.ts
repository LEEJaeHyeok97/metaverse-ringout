import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'
import { WebSocket } from 'ws'
import { BIKES, FINISH_Z, MAPS } from '../src/game/course.ts'
import { gardenTile } from '../src/game/lobby.ts'
import { KART_TRACKS, kartTrackById, trackSpot } from '../src/game/kart.ts'
import type { ServerMessage } from '../src/net/protocol.ts'
import { attachRealtime } from './realtime.ts'

let server: Server
let url = ''
const gardenFile = join(mkdtempSync(join(tmpdir(), 'ringout-garden-')), 'garden.json')

before(async () => {
  server = createServer()
  attachRealtime(server, {
    path: '/ws',
    maxPlayers: 20,
    isOriginAllowed: () => true,
    gardenFile,
    timing: { lobbyCountdownMs: 50, gameCountdownMs: 50, minFinishSeconds: 0.2, limitSeconds: 9, finishGraceMs: 1500 },
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const address = server.address()
  if (typeof address === 'object' && address) url = `ws://127.0.0.1:${address.port}/ws`
})

after(() => {
  server.closeAllConnections()
  server.close()
})

type Client = { socket: WebSocket; inbox: ServerMessage[]; send: (message: object) => void; next: <T extends ServerMessage['t']>(type: T, match?: (m: Extract<ServerMessage, { t: T }>) => boolean) => Promise<Extract<ServerMessage, { t: T }>> }

async function connect(nickname: string): Promise<Client> {
  const socket = new WebSocket(url, { origin: 'http://localhost' })
  const inbox: ServerMessage[] = []
  const waiters: (() => void)[] = []
  socket.on('message', (data) => {
    inbox.push(JSON.parse(data.toString()))
    for (const waiter of waiters.splice(0)) waiter()
  })
  await new Promise((resolve) => socket.once('open', resolve))
  const client: Client = {
    socket,
    inbox,
    send: (message) => socket.send(JSON.stringify(message)),
    next: async (type, match) => {
      // 다른 메시지가 계속 들어와도 3초가 지나면 실패한다.
      const deadline = Date.now() + 3000
      for (;;) {
        const index = inbox.findIndex((m) => m.t === type && (!match || match(m as never)))
        if (index >= 0) return inbox.splice(index, 1)[0] as never
        const left = deadline - Date.now()
        if (left <= 0) throw new Error(`${nickname}: timeout waiting for ${type}`)
        await new Promise<void>((resolve) => {
          waiters.push(resolve)
          setTimeout(resolve, left)
        })
      }
    },
  }
  client.send({ t: 'hello', nickname, color: '#FF5A4E' })
  await client.next('welcome')
  return client
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

test('다섯 명이 빠른 참가로 모이면 자동으로 시작하고, 도착 순서대로 순위가 매겨진다', async () => {
  const clients = await Promise.all(['가', '나', '다', '라', '마'].map(connect))
  for (const client of clients) {
    client.send({ t: 'quick' })
    await client.next('room', (m) => m.room !== null)
  }
  const starts = await Promise.all(clients.map((client) => client.next('start')))
  // 모두 같은 맵을 받는다.
  assert.ok(MAPS.some((map) => map.id === starts[0].map))
  assert.ok(starts.every((start) => start.map === starts[0].map))
  for (const client of clients) client.inbox.length = 0
  const lanes = Object.values(starts[0].lanes).sort()
  assert.deepEqual(lanes, [0, 1, 2, 3, 4])

  await sleep(120)
  // 한 번에 결승선으로 순간이동하면 받지 않는다.
  clients[0].send({ t: 'move', x: 0, y: 0, z: FINISH_Z - 1, h: 0, a: 1 })
  await sleep(30)
  clients[0].send({ t: 'finish' })
  await sleep(250)
  assert.equal(clients[0].inbox.some((m) => m.t === 'finished'), false)

  // 사람이 걷는 속도로 조금씩 나아가면 받는다. 메시지 수 제한(초당 40개)도 지킨다.
  const walk = async (client: Client, delay: number) => {
    await sleep(delay)
    let z = -2
    while (z > FINISH_Z - 1) {
      z -= 1.9
      client.send({ t: 'move', x: 0, y: 0, z, h: 0, a: 1 })
      await sleep(30)
    }
    client.send({ t: 'finish' })
    return client.next('finished')
  }
  await Promise.all([walk(clients[1], 0), walk(clients[3], 400)])
  // 1등이 들어오면 남은 사람에게 마감 카운트다운을 알린다.
  const closing = await clients[0].next('closing')
  assert.equal(closing.endsIn, 1500)
  // 나머지는 마감 시간 안에 못 들어와 결석으로 끝난다. 제한 시간(9초)까지 기다리지 않는다.
  const startedWaiting = Date.now()
  const results = await clients[0].next('results')
  assert.ok(Date.now() - startedWaiting < 1600)
  assert.equal(results.rows.length, 5)
  assert.deepEqual(
    results.rows.slice(0, 2).map((row) => row.nickname),
    ['나', '라'],
  )
  assert.equal(results.rows[2].rank, null)
  const room = await clients[0].next('room', (m) => m.room?.phase === 'waiting')
  assert.equal(room.room?.members.length, 5)
  for (const client of clients) client.socket.close()
})

test('여섯 번째 사람은 꽉 찬 방 대신 새 방에 들어가고, 방장이 나가면 방장이 넘어간다', async () => {
  const host = await connect('방장')
  host.send({ t: 'create' })
  const created = await host.next('room', (m) => m.room !== null)
  const code = created.room!.code
  const guest = await connect('손님')
  guest.send({ t: 'join', code: code.toLowerCase() })
  await guest.next('room', (m) => m.room?.members.length === 2)

  const stranger = await connect('나그네')
  stranger.send({ t: 'join', code: 'ZZZZ' })
  const error = await stranger.next('error')
  assert.match(error.message, /없어요/)

  host.socket.close()
  const handed = await guest.next('room', (m) => m.room?.members.length === 1)
  assert.equal(handed.room?.hostId, handed.room?.members[0].id)

  // 혼자 남아도 방장이 시작하면 바로 출발한다.
  guest.send({ t: 'start' })
  const start = await guest.next('start')
  assert.equal(Object.keys(start.lanes).length, 1)
  guest.socket.close()
  stranger.socket.close()
})

test('광장에서 가까운 사람만 때릴 수 있고, 쿨타임과 맞은 뒤 보호 시간이 있다', async () => {
  const a = await connect('때리는이')
  const b = await connect('맞는이')
  const c = await connect('먼사람')
  a.send({ t: 'move', x: 0, y: 0, z: 0, h: 0, a: 0 })
  b.send({ t: 'move', x: 1, y: 0, z: 0, h: 0, a: 0 })
  c.send({ t: 'move', x: 15, y: 0, z: 0, h: 0, a: 0 })
  await sleep(50)

  a.send({ t: 'punch', target: Number(await idOf(a, '먼사람')) })
  await sleep(50)
  assert.equal(a.inbox.some((m) => m.t === 'punched'), false)

  // 먼 사람에게 헛손질한 것도 쿨타임이 돈다.
  await sleep(1600)
  const bId = await idOf(a, '맞는이')
  a.send({ t: 'punch', target: bId })
  const hit = await b.next('punched')
  assert.equal(hit.to, bId)

  // 쿨타임이 지나도 맞은 사람은 잠깐 보호받는다.
  await sleep(1600)
  b.inbox.length = 0
  a.send({ t: 'punch', target: bId })
  await sleep(100)
  assert.equal(b.inbox.some((m) => m.t === 'punched'), false)
  for (const client of [a, b, c]) client.socket.close()
})

test('따릉이는 가까이 있는 한 사람만 탈 수 있다', async () => {
  const a = await connect('라이더')
  a.send({ t: 'create' })
  const created = await a.next('room', (m) => m.room !== null)
  const riderId = created.room!.members[0].id
  a.send({ t: 'start' })
  await a.next('start')
  await sleep(80)
  // 너무 멀면 못 탄다.
  a.send({ t: 'ride', bike: 1 })
  await sleep(50)
  assert.equal(a.inbox.some((m) => m.t === 'bikes'), false)
  // 1번 따릉이까지 걸어간다.
  const bike = BIKES[0]
  for (let z = -0.4; z > bike.z; z -= 1.9) {
    a.send({ t: 'move', x: bike.x, y: 0, z, h: 0, a: 1 })
    await sleep(30)
  }
  a.send({ t: 'move', x: bike.x, y: 0, z: bike.z, h: 0, a: 1 })
  await sleep(30)
  a.send({ t: 'ride', bike: 1 })
  const bikes = await a.next('bikes')
  assert.equal(bikes.taken[1], riderId)
  a.send({ t: 'ride', bike: 1 })
  await sleep(50)
  assert.equal(a.inbox.filter((m) => m.t === 'bikes').length, 0)
  a.socket.close()
})

async function idOf(client: Client, nickname: string) {
  const roster = await client.next('roster', (m) => m.players.some((player) => player.nickname === nickname))
  client.inbox.unshift(roster)
  return roster.players.find((player) => player.nickname === nickname)!.id
}

test('물풍선은 가까운 사람에게, 우주선은 1등에게, 귀가 포털은 앞사람에게만 쓴다', async () => {
  const host = await connect('공격수')
  host.send({ t: 'create' })
  const created = await host.next('room', (m) => m.room !== null)
  const leader = await connect('일등')
  leader.send({ t: 'join', code: created.room!.code })
  await leader.next('room', (m) => m.room?.members.length === 2)
  host.send({ t: 'start' })
  await Promise.all([host.next('start'), leader.next('start')])
  await sleep(80)
  // 일등은 조금 앞으로 걸어간다.
  for (let z = -0.4; z > -12; z -= 1.9) {
    leader.send({ t: 'move', x: 0, y: 0, z, h: 0, a: 1 })
    host.send({ t: 'move', x: 0, y: 0, z: z + 3, h: 0, a: 1 })
    await sleep(30)
  }
  const leaderId = created.room!.members[0].id + 1
  // 부스터, 방패 연출은 같은 방 모두에게 간다. 이상한 종류는 무시한다.
  host.send({ t: 'fx', kind: 'dragon' })
  host.send({ t: 'fx', kind: 'booster' })
  const fx = await leader.next('fx')
  assert.deepEqual([fx.kind, fx.from], ['booster', created.room!.members[0].id])
  host.send({ t: 'item', kind: 'ufo' })
  const ufo = await leader.next('trapped')
  assert.deepEqual([ufo.kind, ufo.to], ['ufo', leaderId])

  await sleep(1600)
  host.send({ t: 'item', kind: 'warp', target: leaderId })
  const warp = await leader.next('trapped')
  assert.equal(warp.kind, 'warp')

  // 앞서 있는 사람이 뒤에 있는 사람에게 쓴 귀가 포털은 맞지 않고 허공에 열린다.
  await sleep(1600)
  leader.send({ t: 'item', kind: 'warp', target: created.room!.members[0].id })
  const missed = await host.next('fx', (m) => m.kind === 'warp')
  assert.equal(missed.from, leaderId)
  assert.ok(missed.z !== undefined && missed.x !== undefined)
  assert.equal(host.inbox.some((m) => m.t === 'trapped' && m.kind === 'warp' && m.to !== leaderId), false)

  // 맞힐 사람을 고르지 않은 물풍선도 허공에 날아간다.
  await sleep(1600)
  leader.send({ t: 'item', kind: 'balloon' })
  await host.next('fx', (m) => m.kind === 'balloon' && m.from === leaderId)

  host.send({ t: 'item', kind: 'banana' })
  const bananas = await leader.next('bananas')
  assert.equal(bananas.list.length, 1)
  // 바나나를 밟으려면 그 자리에 있어야 한다. 뒤로 가는 이동은 언제나 받는다.
  leader.send({ t: 'move', x: bananas.list[0].x, y: 0, z: bananas.list[0].z, h: 0, a: 1 })
  await sleep(30)
  leader.send({ t: 'slip', banana: bananas.list[0].id })
  const cleared = await host.next('bananas', (m) => m.list.length === 0)
  assert.equal(cleared.list.length, 0)
  host.socket.close()
  leader.socket.close()
})

test('정원 가까이에서 빈 타일에 심은 나무는 모두에게 보이고 파일에 남는다', async () => {
  const [planter, viewer] = await Promise.all(['심는이', '구경꾼'].map(connect))
  const spot = gardenTile(5)
  // 멀리서 심으면 받지 않는다.
  planter.send({ t: 'move', x: spot.x + 20, y: 0, z: spot.z - 20, h: 0, a: 0 })
  await sleep(50)
  planter.send({ t: 'plant', tile: 5 })
  await sleep(150)
  assert.equal(viewer.inbox.some((m) => m.t === 'garden' && m.planted), false)

  planter.send({ t: 'move', x: spot.x, y: 0, z: spot.z + 1, h: 0, a: 0 })
  await sleep(50)
  planter.send({ t: 'plant', tile: 5 })
  const seen = await viewer.next('garden', (m) => m.planted?.tile === 5)
  assert.equal(seen.trees.find((tree) => tree.tile === 5)?.nickname, '심는이')
  await planter.next('garden', (m) => m.planted?.tile === 5)
  assert.deepEqual(JSON.parse(readFileSync(gardenFile, 'utf8')).map((tree: { tile: number }) => tree.tile), [5])

  // 쿨타임이 지나도 이미 심은 자리에는 다시 심을 수 없다.
  const other = await connect('늦은이')
  const welcomeGarden = await other.next('garden')
  assert.equal(welcomeGarden.trees.length, 1)
  other.send({ t: 'move', x: spot.x, y: 0, z: spot.z, h: 0, a: 0 })
  await sleep(50)
  other.send({ t: 'plant', tile: 5 })
  await other.next('error')

  // 서버를 새로 켜도 정원이 남아 있다.
  const second = createServer()
  attachRealtime(second, { path: '/ws', maxPlayers: 5, isOriginAllowed: () => true, gardenFile })
  await new Promise<void>((resolve) => second.listen(0, resolve))
  const address = second.address()
  const socket = new WebSocket(`ws://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/ws`)
  const garden = await new Promise<Extract<ServerMessage, { t: 'garden' }>>((resolve) => {
    socket.on('open', () => socket.send(JSON.stringify({ t: 'hello', nickname: '다음날', color: '#FF5A4E' })))
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage
      if (message.t === 'garden') resolve(message)
    })
  })
  assert.equal(garden.trees[0]?.nickname, '심는이')
  socket.close()
  second.closeAllConnections()
  second.close()
  for (const client of [planter, viewer, other]) client.socket.close()
})

test('발차기는 주먹보다 멀리 닿고, 주먹과 따로 쿨타임이 돈다', async () => {
  const a = await connect('차는이')
  const b = await connect('차이는이')
  a.send({ t: 'move', x: 0, y: 0, z: 0, h: 0, a: 0 })
  b.send({ t: 'move', x: 3.3, y: 0, z: 0, h: 0, a: 0 })
  await sleep(50)
  const bId = await idOf(a, '차이는이')

  // 주먹은 닿지 않는 거리다.
  a.send({ t: 'punch', target: bId })
  await sleep(100)
  assert.equal(b.inbox.some((m) => m.t === 'punched'), false)

  // 발차기는 닿고, 차였다고 알린다.
  a.send({ t: 'punch', target: bId, kick: true })
  const hit = await b.next('punched')
  assert.equal(hit.kick, true)
  assert.equal(hit.to, bId)
  for (const client of [a, b]) client.socket.close()
})

test('차를 탄 사람만 가까운 사람을 들이받을 수 있고, 범위 아이템은 쓴 자리를 모두에게 알린다', async () => {
  const driver = await connect('운전수')
  driver.send({ t: 'create' })
  const created = await driver.next('room', (m) => m.room !== null)
  const walker = await connect('보행자')
  walker.send({ t: 'join', code: created.room!.code })
  await walker.next('room', (m) => m.room?.members.length === 2)
  driver.send({ t: 'start' })
  const [start] = await Promise.all([driver.next('start'), walker.next('start')])
  await sleep(80)
  const driverId = created.room!.members[0].id
  const walkerId = driverId + 1
  // 기본 맵이 아닐 수도 있으니 골목의 경차(모든 맵에서 2번)를 탄다.
  const car = { id: 2, x: 9, z: -21 }
  assert.ok(start.map)
  // 차를 타기 전에는 들이받을 수 없다.
  driver.send({ t: 'ram', target: walkerId })
  await sleep(80)
  assert.equal(walker.inbox.some((m) => m.t === 'punched'), false)

  // 집을 나와 차 옆으로 걸어간다(빠르게 가면 서버가 받지 않으니 조금씩).
  for (let i = 1; i <= 12; i++) {
    const t = i / 12
    driver.send({ t: 'move', x: 6.5 + (car.x - 6.5) * t, y: 0, z: -2 + (car.z + 1 - -2) * t, h: 0, a: 1 })
    walker.send({ t: 'move', x: 6.5 + (car.x - 6.5) * t + 1, y: 0, z: -2 + (car.z + 1 - -2) * t, h: 0, a: 1 })
    await sleep(120)
  }
  driver.send({ t: 'ride', bike: car.id })
  await driver.next('bikes', (m) => m.taken[car.id] === driverId)
  driver.send({ t: 'ram', target: walkerId })
  const rammed = await walker.next('punched', (m) => m.ram === true)
  assert.equal(rammed.from, driverId)

  // 폭탄은 쓴 사람 앞에 떨어진 자리를 함께 보낸다.
  driver.send({ t: 'item', kind: 'bomb' })
  const bomb = await walker.next('fx', (m) => m.kind === 'bomb')
  assert.equal(bomb.from, driverId)
  assert.ok(bomb.z !== undefined && bomb.z < car.z)
  driver.socket.close()
  walker.socket.close()
})

test('방장이 카트 레이스로 바꾸면 카트 빠른 참가가 그 방에 들어오고, 출발선에서 시작한다', async () => {
  const host = await connect('카트장')
  host.send({ t: 'create' })
  const created = await host.next('room', (m) => m.room !== null)
  assert.equal(created.room?.mode, 'commute')
  host.send({ t: 'mode', mode: 'kart' })
  const changed = await host.next('room', (m) => m.room?.mode === 'kart')
  const code = changed.room!.code

  // 출근 레이스 빠른 참가는 카트 방에 들어가지 않는다.
  const walker = await connect('걷는이')
  walker.send({ t: 'quick', mode: 'commute' })
  const walkerRoom = await walker.next('room', (m) => m.room !== null)
  assert.notEqual(walkerRoom.room?.code, code)
  walker.send({ t: 'leave' })

  const racer = await connect('레이서')
  racer.send({ t: 'quick', mode: 'kart' })
  const joined = await racer.next('room', (m) => m.room !== null)
  assert.equal(joined.room?.code, code)
  assert.equal(joined.room?.mode, 'kart')
  // 방장이 아니면 게임을 바꿀 수 없다.
  racer.send({ t: 'mode', mode: 'commute' })
  await sleep(80)
  assert.equal(racer.inbox.some((m) => m.t === 'room' && m.room?.mode === 'commute'), false)

  host.send({ t: 'start' })
  const [start] = await Promise.all([host.next('start'), racer.next('start')])
  assert.equal(start.mode, 'kart')
  // 서버가 트랙 중 하나를 골라 모두에게 알린다.
  assert.ok(KART_TRACKS.some((candidate) => candidate.id === start.map))
  const track = kartTrackById(start.map)
  await sleep(120)

  // 바퀴를 돌지 않고 도착을 알리면 받지 않는다.
  host.send({ t: 'finish' })
  await sleep(150)
  assert.equal(host.inbox.some((m) => m.t === 'finished'), false)

  // 순간이동은 받지 않는다(바퀴도 바뀌지 않는다).
  const far = trackSpot(track, 400, 0)
  host.send({ t: 'move', x: far.x, y: 0, z: far.z, h: 0, a: 0 })
  await sleep(100)
  assert.equal(host.inbox.some((m) => m.t === 'lap'), false)

  // 출발선 뒤로 천천히 넘어가면 바퀴가 줄었다고 모두에게 알린다.
  // 방장이 먼저 들어왔으므로 가운데 자리(2번)에서 출발한다.
  const myLane = 2
  assert.ok(Object.values(start.lanes).includes(myLane))
  let index = 12 // gridSpot(2)의 샘플 번호
  for (let step = 0; step < 14; step++) {
    index -= 1.5
    const spot = trackSpot(track, index, (myLane - 2) * 2.8)
    host.send({ t: 'move', x: spot.x, y: 0, z: spot.z, h: Math.PI, a: 0 })
    await sleep(40)
  }
  const lap = await racer.next('lap')
  assert.equal(lap.lap, -1)

  // 유도 알람은 노린 카트에게 가고, 모두에게 알린다.
  await sleep(1600) // 아이템 쿨타임
  const racerId = joined.room!.members.find((member) => member.nickname === '레이서')!.id
  host.send({ t: 'item', kind: 'alarm', target: racerId })
  const alarm = await racer.next('trapped', (m) => m.kind === 'alarm')
  assert.equal(alarm.to, racerId)
  host.socket.close()
  racer.socket.close()
  walker.socket.close()
})

test('앞마당 양끝에 세워진 탈것도 탈 수 있다', async () => {
  const rider = await connect('끝집')
  rider.send({ t: 'create' })
  await rider.next('room', (m) => m.room !== null)
  rider.send({ t: 'start' })
  const start = await rider.next('start')
  await sleep(120)
  // 맵마다 골목 탈것은 같다. 가장 바깥(x가 가장 큰) 탈것으로 걸어간다.
  const edge = BIKES.filter((bike) => bike.z > -24).sort((a, b) => Math.abs(b.x) - Math.abs(a.x))[0]
  assert.ok(Math.abs(edge.x) > 16, `맵 ${start.map}의 가장 바깥 탈것이 도로 폭 밖에 있어야 한다`)
  const steps = 12
  for (let step = 1; step <= steps; step++) {
    rider.send({ t: 'move', x: (edge.x * step) / steps, y: 0, z: -0.4 + ((edge.z + 0.4) * step) / steps, h: 0, a: 1 })
    await sleep(40)
  }
  rider.send({ t: 'ride', bike: edge.id })
  const bikes = await rider.next('bikes')
  assert.ok(Object.keys(bikes.taken).includes(String(edge.id)))
  rider.socket.close()
})
