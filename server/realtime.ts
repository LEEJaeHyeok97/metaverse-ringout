import type { Server } from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import {
  bedSpot,
  COUNTDOWN_MS,
  FINISH_Z,
  GAME_LIMIT_SECONDS,
  MAX_ROOM_PLAYERS,
  MIN_FINISH_SECONDS,
  STREET_HALF_W,
  WALK_SPEED,
  RIDE_FACTOR,
  BIKES,
  BIKE_REACH,
  PUNCH_RANGE,
  PUNCH_COOLDOWN_MS,
  PUNCH_STUN_SECONDS,
  PUNCH_IMMUNE_MS,
  BALLOON_RANGE,
  ITEM_COOLDOWN_MS,
  WORLD_MIN_Z,
  HOUSE_BACK_Z,
} from '../src/game/course.ts'
import {
  ANIMS,
  MAX_CHAT_LENGTH,
  MAX_NICKNAME_LENGTH,
  PLAYER_COLORS,
  type PlayerInfo,
  type ResultRow,
  type RoomView,
  type ServerMessage,
  type SnapshotEntry,
} from '../src/net/protocol.ts'
import { LOBBY_HALF } from '../src/game/lobby.ts'

const SNAPSHOT_INTERVAL_MS = 100
const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_PAYLOAD_BYTES = 1024
const MAX_MESSAGES_PER_SECOND = 40
const MAX_BUFFERED_BYTES = 64 * 1024
const CHAT_WINDOW_MS = 10_000
const MAX_CHATS_PER_WINDOW = 5
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const ROOM_CODE_LENGTH = 4
/** 방이 꽉 차거나 방장이 시작을 누른 뒤 집으로 옮겨 가기 전까지 */
const LOBBY_COUNTDOWN_MS = 3000
// 화면의 위치는 서버보다 조금 늦게 오므로 앞으로 나아간 거리에 여유를 둔다.
const PROGRESS_SLACK = 1.5
const MAX_SPEED = WALK_SPEED * RIDE_FACTOR * 1.25
// 서버의 위치는 화면보다 조금 늦으므로 닿는 거리에 여유를 둔다.
const REACH_SLACK = 1
const FINISH_SLACK = 3
const LINK_PATTERN = /(https?:\/\/|www\.)/i
const INVISIBLE_CHARS = /[\u0000-\u001F\u007F​-‏‪-‮⁠-⁩﻿]/g

/** 서버가 가득 찼을 때의 종료 코드. 클라이언트는 이 코드면 재접속하지 않는다. */
export const CLOSE_FULL = 4001
/** 재배포로 서버가 바뀔 때의 종료 코드. 클라이언트는 바로 다시 붙는다. */
export const CLOSE_RESTART = 1012

export type RealtimeOptions = {
  path: string
  maxPlayers: number
  isOriginAllowed: (origin: string | undefined) => boolean
  /** 테스트에서 기다리는 시간을 줄일 때만 바꾼다. */
  timing?: { lobbyCountdownMs?: number; gameCountdownMs?: number; minFinishSeconds?: number; limitSeconds?: number }
}

type Player = {
  id: number
  socket: WebSocket
  ready: boolean
  nickname: string
  color: string
  room: Room | null
  /** 게임 화면에 있으면 true. 결과가 나오면 로비로 돌아간다. */
  inGame: boolean
  x: number
  y: number
  z: number
  h: number
  a: number
  lastMoveAt: number
  alive: boolean
  windowStart: number
  windowCount: number
  chatWindowStart: number
  chatCount: number
  lastPunchAt: number
  immuneUntil: number
  lastItemAt: number
}

type Room = {
  code: string
  hostId: number
  members: Player[]
  phase: RoomView['phase']
  startAt: number
  lanes: Map<number, number>
  finished: Map<number, number>
  /** 게임에 참가한 사람. 중간에 나간 사람도 결과표에 남긴다. */
  entrants: Map<number, PlayerInfo & { lane: number }>
  /** 자전거 번호 → 탄 사람 */
  bikes: Map<number, number>
  bananas: { id: number; x: number; z: number; owner: number }[]
  nextBanana: number
  timers: ReturnType<typeof setTimeout>[]
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== 'string') return ''
  return [...value.normalize('NFC').replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ').trim()].slice(0, max).join('')
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function lobbySpawn() {
  const angle = Math.random() * Math.PI * 2
  const radius = 4 + Math.random() * 4
  return { x: Math.cos(angle) * radius, z: 10 + Math.sin(angle) * radius }
}

/**
 * 로비 광장과 5인 게임 방의 실시간 서버.
 * 로비에서는 방에 있든 없든 광장에 있는 모든 사람의 위치를 주고받고, 게임이 시작되면 같은 방 사람끼리만 주고받는다.
 * 출발 시각, 도착 순위, 제한 시간은 서버가 정하고, 너무 빨리 앞으로 나아간 위치와 이른 도착 신고는 받지 않는다.
 */
export function attachRealtime(server: Server, { path, maxPlayers, isOriginAllowed, timing = {} }: RealtimeOptions) {
  const lobbyCountdownMs = timing.lobbyCountdownMs ?? LOBBY_COUNTDOWN_MS
  const gameCountdownMs = timing.gameCountdownMs ?? COUNTDOWN_MS
  const minFinishSeconds = timing.minFinishSeconds ?? MIN_FINISH_SECONDS
  const limitSeconds = timing.limitSeconds ?? GAME_LIMIT_SECONDS

  const sockets = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES })
  const players = new Map<WebSocket, Player>()
  const rooms = new Map<string, Room>()
  let nextId = 1
  let lobbyRosterDirty = false

  const send = (player: Player, message: ServerMessage) => {
    const { socket } = player
    if (socket.readyState === socket.OPEN && socket.bufferedAmount < MAX_BUFFERED_BYTES) socket.send(JSON.stringify(message))
  }

  const info = (player: Player): PlayerInfo => ({ id: player.id, nickname: player.nickname, color: player.color })

  const lobbyPlayers = () => [...players.values()].filter((player) => player.ready && !player.inGame)

  const roomView = (room: Room): RoomView => ({ code: room.code, hostId: room.hostId, phase: room.phase, members: room.members.map(info) })

  const broadcastRoom = (room: Room) => {
    const view = roomView(room)
    for (const member of room.members) send(member, { t: 'room', room: view })
  }

  const sendGameRoster = (room: Room) => {
    const list = room.members.filter((member) => member.inGame).map(info)
    for (const member of room.members) if (member.inGame) send(member, { t: 'roster', channel: 'game', players: list })
  }

  const clearTimers = (room: Room) => {
    for (const timer of room.timers) clearTimeout(timer)
    room.timers = []
  }

  const newCode = () => {
    for (;;) {
      let code = ''
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
      if (!rooms.has(code)) return code
    }
  }

  const backToLobby = (player: Player) => {
    player.inGame = false
    const spot = lobbySpawn()
    player.x = spot.x
    player.y = 0
    player.z = spot.z
    player.a = 0
  }

  const endGame = (room: Room) => {
    if (room.phase !== 'playing') return
    clearTimers(room)
    const ordered = [...room.finished.entries()].sort((a, b) => a[1] - b[1])
    const rank = new Map(ordered.map(([id], index) => [id, index + 1]))
    const rows: ResultRow[] = [...room.entrants.values()]
      .map((entrant) => ({ ...entrant, ms: room.finished.get(entrant.id) ?? null, rank: rank.get(entrant.id) ?? null }))
      .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.lane - b.lane)
    room.phase = 'waiting'
    room.finished.clear()
    room.entrants.clear()
    room.lanes.clear()
    for (const member of room.members) {
      backToLobby(member)
      send(member, { t: 'results', rows })
    }
    broadcastRoom(room)
    lobbyRosterDirty = true
  }

  const startGame = (room: Room) => {
    if (room.phase !== 'countdown') return
    if (room.members.length === 0) return
    room.phase = 'playing'
    room.startAt = Date.now() + gameCountdownMs
    room.lanes.clear()
    room.finished.clear()
    room.entrants.clear()
    room.bikes.clear()
    room.bananas = []
    // 다섯 집 중 가운데부터 채워서 혼자 해도 화면 가운데 집에서 시작한다.
    const order = [2, 1, 3, 0, 4]
    room.members.forEach((member, index) => {
      const lane = order[index]
      room.lanes.set(member.id, lane)
      room.entrants.set(member.id, { ...info(member), lane })
      member.inGame = true
      const bed = bedSpot(lane)
      member.x = bed.x
      member.y = 0.45 // 침대 높이
      member.z = bed.z
      member.h = Math.PI
      member.a = ANIMS.indexOf('sleep')
    })
    const lanes = Object.fromEntries(room.lanes)
    for (const member of room.members) send(member, { t: 'start', startIn: gameCountdownMs, lanes })
    sendGameRoster(room)
    broadcastRoom(room)
    lobbyRosterDirty = true
    room.timers.push(setTimeout(() => endGame(room), gameCountdownMs + limitSeconds * 1000))
  }

  const beginCountdown = (room: Room) => {
    if (room.phase !== 'waiting') return
    room.phase = 'countdown'
    for (const member of room.members) send(member, { t: 'countdown', startIn: lobbyCountdownMs })
    broadcastRoom(room)
    room.timers.push(setTimeout(() => startGame(room), lobbyCountdownMs))
  }

  const leaveRoom = (player: Player) => {
    const room = player.room
    if (!room) return
    player.room = null
    room.members = room.members.filter((member) => member !== player)
    if (player.inGame) {
      backToLobby(player)
      lobbyRosterDirty = true
    }
    send(player, { t: 'room', room: null })
    if (room.members.length === 0) {
      clearTimers(room)
      rooms.delete(room.code)
      return
    }
    if (room.hostId === player.id) room.hostId = room.members[0].id
    if (room.phase === 'playing') {
      sendGameRoster(room)
      // 남은 사람이 모두 도착했다면 더 기다릴 필요가 없다.
      if (room.members.every((member) => room.finished.has(member.id))) endGame(room)
    }
    broadcastRoom(room)
  }

  const joinRoom = (player: Player, room: Room) => {
    if (player.room === room) return
    leaveRoom(player)
    room.members.push(player)
    player.room = room
    broadcastRoom(room)
    if (room.members.length >= MAX_ROOM_PLAYERS) beginCountdown(room)
  }

  const createRoom = (player: Player) => {
    leaveRoom(player)
    const room: Room = {
      code: newCode(),
      hostId: player.id,
      members: [],
      phase: 'waiting',
      startAt: 0,
      lanes: new Map(),
      finished: new Map(),
      entrants: new Map(),
      bikes: new Map(),
      bananas: [],
      nextBanana: 1,
      timers: [],
    }
    rooms.set(room.code, room)
    joinRoom(player, room)
  }

  const acceptMove = (player: Player, x: number, y: number, z: number, h: number, a: number) => {
    const now = Date.now()
    const room = player.room
    if (player.inGame && room?.phase === 'playing') {
      // 출발 전에는 침대에 누워 있어야 한다.
      if (now < room.startAt || room.finished.has(player.id)) return
      const dt = Math.min((now - player.lastMoveAt) / 1000, 1)
      const progress = player.z - z
      if (progress > MAX_SPEED * dt + PROGRESS_SLACK) return
      x = Math.min(Math.max(x, -STREET_HALF_W - 2), STREET_HALF_W + 2)
      z = Math.min(Math.max(z, WORLD_MIN_Z), HOUSE_BACK_Z)
    } else {
      x = Math.min(Math.max(x, -LOBBY_HALF), LOBBY_HALF)
      z = Math.min(Math.max(z, -LOBBY_HALF), LOBBY_HALF)
    }
    player.x = x
    player.y = Math.min(Math.max(y, 0), 3)
    player.z = z
    player.h = h
    player.a = Number.isInteger(a) && a >= 0 && a < ANIMS.length ? a : 0
    player.lastMoveAt = now
  }

  const handleFinish = (player: Player) => {
    const room = player.room
    if (!room || room.phase !== 'playing' || !player.inGame || room.finished.has(player.id)) return
    const ms = Date.now() - room.startAt
    if (ms < minFinishSeconds * 1000) return
    if (player.z > FINISH_Z + FINISH_SLACK) return
    room.finished.set(player.id, ms)
    const rank = room.finished.size
    for (const member of room.members) if (member.inGame) send(member, { t: 'finished', id: player.id, ms, rank })
    if (room.members.every((member) => room.finished.has(member.id))) endGame(room)
  }

  /** 같은 공간(광장, 또는 같은 방의 게임)에 있는 사람들 */
  const audienceOf = (player: Player) => (player.inGame && player.room ? player.room.members.filter((member) => member.inGame) : lobbyPlayers())

  const handlePunch = (player: Player, targetId: unknown) => {
    const now = Date.now()
    if (now - player.lastPunchAt < PUNCH_COOLDOWN_MS) return
    const audience = audienceOf(player)
    const target = audience.find((member) => member.id === targetId)
    if (!target || target === player) return
    if (player.inGame && (player.room?.phase !== 'playing' || now < player.room.startAt)) return
    if (Math.hypot(target.x - player.x, target.z - player.z) > PUNCH_RANGE + REACH_SLACK) return
    player.lastPunchAt = now
    // 기절해 있는 동안과 일어난 직후에는 다시 맞지 않는다.
    if (now < target.immuneUntil) return
    target.immuneUntil = now + PUNCH_STUN_SECONDS * 1000 + PUNCH_IMMUNE_MS
    for (const member of audience) send(member, { t: 'punched', from: player.id, to: target.id })
  }

  const handleRide = (player: Player, bikeId: unknown) => {
    const room = player.room
    if (!room || room.phase !== 'playing' || !player.inGame || Date.now() < room.startAt) return
    const bike = BIKES.find((candidate) => candidate.id === bikeId)
    if (!bike || room.bikes.has(bike.id)) return
    if (Math.hypot(bike.x - player.x, bike.z - player.z) > BIKE_REACH + REACH_SLACK) return
    room.bikes.set(bike.id, player.id)
    const taken = Object.fromEntries(room.bikes)
    for (const member of room.members) if (member.inGame) send(member, { t: 'bikes', taken })
  }

  const broadcastGame = (room: Room, message: ServerMessage) => {
    for (const member of room.members) if (member.inGame) send(member, message)
  }

  /**
   * 남에게 쓰는 아이템. 아이템 상자는 각자 화면에서 줍기 때문에 서버는 쓰는 간격과 거리, 대상만 확인한다.
   * 방패는 맞는 사람 화면이 스스로 막는다.
   */
  const handleItem = (player: Player, kind: unknown, targetId: unknown) => {
    const room = player.room
    const now = Date.now()
    if (!room || room.phase !== 'playing' || !player.inGame || now < room.startAt || room.finished.has(player.id)) return
    if (now - player.lastItemAt < ITEM_COOLDOWN_MS) return
    const rivals = room.members.filter((member) => member.inGame && member !== player && !room.finished.has(member.id))
    if (kind === 'banana') {
      player.lastItemAt = now
      // 내 바로 뒤(출발 쪽)에 놓는다.
      room.bananas.push({ id: room.nextBanana++, x: player.x, z: player.z + 1.6, owner: player.id })
      if (room.bananas.length > 12) room.bananas.shift()
      broadcastGame(room, { t: 'bananas', list: room.bananas })
      return
    }
    if (kind === 'ufo') {
      // 가장 앞선 사람을 노린다. 내가 1등이면 2등을 노린다.
      const leader = rivals.sort((a, b) => a.z - b.z)[0]
      player.lastItemAt = now
      if (leader) broadcastGame(room, { t: 'trapped', from: player.id, to: leader.id, kind: 'ufo' })
      return
    }
    if (kind === 'balloon' || kind === 'warp') {
      const target = rivals.find((member) => member.id === targetId)
      if (!target) return
      // 물풍선은 닿는 거리 안에서, 귀가 포털은 나보다 앞선 사람에게만 쓸 수 있다.
      if (kind === 'balloon' && Math.hypot(target.x - player.x, target.z - player.z) > BALLOON_RANGE + REACH_SLACK * 3) return
      if (kind === 'warp' && target.z > player.z) return
      player.lastItemAt = now
      broadcastGame(room, { t: 'trapped', from: player.id, to: target.id, kind })
    }
  }

  const handleSlip = (player: Player, bananaId: unknown) => {
    const room = player.room
    if (!room || room.phase !== 'playing' || !player.inGame) return
    const banana = room.bananas.find((item) => item.id === bananaId)
    if (!banana || Math.hypot(banana.x - player.x, banana.z - player.z) > 4) return
    room.bananas = room.bananas.filter((item) => item !== banana)
    broadcastGame(room, { t: 'bananas', list: room.bananas })
  }

  const handleChat = (player: Player, raw: unknown) => {
    const text = cleanText(raw, MAX_CHAT_LENGTH)
    if (!text || LINK_PATTERN.test(text)) return
    const now = Date.now()
    if (now - player.chatWindowStart > CHAT_WINDOW_MS) {
      player.chatWindowStart = now
      player.chatCount = 0
    }
    if (++player.chatCount > MAX_CHATS_PER_WINDOW) return
    const message: ServerMessage = { t: 'chat', id: player.id, nickname: player.nickname, text }
    for (const member of audienceOf(player)) send(member, message)
  }

  const handleMessage = (player: Player, raw: string) => {
    const now = Date.now()
    if (now - player.windowStart > 1000) {
      player.windowStart = now
      player.windowCount = 0
    }
    if (++player.windowCount > MAX_MESSAGES_PER_SECOND) return

    let message: Record<string, unknown>
    try {
      message = JSON.parse(raw)
    } catch {
      return
    }
    if (typeof message !== 'object' || message === null) return

    if (message.t === 'hello') {
      player.nickname = cleanText(message.nickname, MAX_NICKNAME_LENGTH) || `졸라맨${player.id}`
      player.color = PLAYER_COLORS.includes(message.color as (typeof PLAYER_COLORS)[number]) ? (message.color as string) : PLAYER_COLORS[player.id % PLAYER_COLORS.length]
      if (!player.ready) {
        player.ready = true
        send(player, { t: 'welcome', id: player.id })
      }
      lobbyRosterDirty = true
      if (player.room) broadcastRoom(player.room)
      return
    }
    if (!player.ready) return

    switch (message.t) {
      case 'move':
        if (finite(message.x) && finite(message.y) && finite(message.z) && finite(message.h) && finite(message.a)) {
          acceptMove(player, message.x, message.y, message.z, message.h, message.a)
        }
        return
      case 'chat':
        handleChat(player, message.text)
        return
      case 'quick': {
        if (player.room) return
        const open = [...rooms.values()]
          .filter((room) => room.phase === 'waiting' && room.members.length < MAX_ROOM_PLAYERS)
          .sort((a, b) => b.members.length - a.members.length)[0]
        if (open) joinRoom(player, open)
        else createRoom(player)
        return
      }
      case 'create':
        if (player.room?.phase === 'playing') return
        createRoom(player)
        return
      case 'join': {
        const code = cleanText(message.code, ROOM_CODE_LENGTH).toUpperCase()
        const room = rooms.get(code)
        if (!room) send(player, { t: 'error', message: '그런 방이 없어요. 코드를 다시 확인해 주세요.' })
        else if (room.phase !== 'waiting') send(player, { t: 'error', message: '이미 출근길에 나선 방이에요.' })
        else if (room.members.length >= MAX_ROOM_PLAYERS) send(player, { t: 'error', message: '방이 꽉 찼어요. (최대 5명)' })
        else joinRoom(player, room)
        return
      }
      case 'leave':
        leaveRoom(player)
        return
      case 'start':
        if (player.room && player.room.hostId === player.id) beginCountdown(player.room)
        return
      case 'finish':
        handleFinish(player)
        return
      case 'punch':
        handlePunch(player, message.target)
        return
      case 'ride':
        handleRide(player, message.bike)
        return
      case 'item':
        handleItem(player, message.kind, message.target)
        return
      case 'slip':
        handleSlip(player, message.banana)
        return
      case 'lobby':
        // 결과 화면을 닫고 광장으로 돌아왔다. 서버는 이미 로비에 두었으니 명단만 다시 보낸다.
        lobbyRosterDirty = true
        return
    }
  }

  sockets.on('connection', (socket: WebSocket) => {
    if (players.size >= maxPlayers) {
      socket.close(CLOSE_FULL, 'full')
      return
    }
    const spot = lobbySpawn()
    const player: Player = {
      id: nextId++,
      socket,
      ready: false,
      nickname: '',
      color: PLAYER_COLORS[0],
      room: null,
      inGame: false,
      x: spot.x,
      y: 0,
      z: spot.z,
      h: 0,
      a: 0,
      lastMoveAt: Date.now(),
      alive: true,
      windowStart: 0,
      windowCount: 0,
      chatWindowStart: 0,
      chatCount: 0,
      lastPunchAt: 0,
      immuneUntil: 0,
      lastItemAt: 0,
    }
    players.set(socket, player)
    socket.on('pong', () => {
      player.alive = true
    })
    socket.on('message', (data, isBinary) => {
      if (!isBinary) handleMessage(player, data.toString())
    })
    socket.on('close', () => {
      leaveRoom(player)
      players.delete(socket)
      lobbyRosterDirty = true
    })
    socket.on('error', () => socket.terminate())
  })

  const handleUpgrade: Parameters<Server['on']>[1] = (request, socket, head) => {
    const { pathname } = new URL(request.url ?? '/', 'http://localhost')
    if (pathname !== path) return // Vite HMR처럼 다른 경로는 건드리지 않는다.
    if (!isOriginAllowed(request.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
      socket.destroy()
      return
    }
    sockets.handleUpgrade(request, socket, head, (client) => sockets.emit('connection', client, request))
  }
  server.on('upgrade', handleUpgrade)

  const entry = (player: Player): SnapshotEntry => [player.id, round(player.x), round(player.y), round(player.z), round(player.h), player.a]

  const snapshotTimer = setInterval(() => {
    const lobby = lobbyPlayers()
    if (lobbyRosterDirty) {
      lobbyRosterDirty = false
      const list = lobby.map(info)
      for (const player of lobby) send(player, { t: 'roster', channel: 'lobby', players: list })
    }
    if (lobby.length > 1) {
      const p = lobby.map(entry)
      for (const player of lobby) send(player, { t: 'snap', p })
    }
    for (const room of rooms.values()) {
      if (room.phase !== 'playing') continue
      const members = room.members.filter((member) => member.inGame)
      if (members.length < 2) continue
      const p = members.map(entry)
      for (const member of members) send(member, { t: 'snap', p })
    }
  }, SNAPSHOT_INTERVAL_MS)

  const heartbeatTimer = setInterval(() => {
    for (const player of players.values()) {
      if (!player.alive) {
        player.socket.terminate()
        continue
      }
      player.alive = false
      player.socket.ping()
    }
  }, HEARTBEAT_INTERVAL_MS)

  snapshotTimer.unref()
  heartbeatTimer.unref()

  const close = () => {
    clearInterval(snapshotTimer)
    clearInterval(heartbeatTimer)
    for (const room of rooms.values()) clearTimers(room)
    server.off('upgrade', handleUpgrade)
    for (const client of sockets.clients) client.close(CLOSE_RESTART, 'restart')
    sockets.close()
  }
  server.once('close', close)

  return { close, playerCount: () => players.size, roomCount: () => rooms.size }
}

/** 개발 서버와 로컬 미리보기에서만 쓰는 판별 함수. 같은 와이파이의 휴대폰으로 확인할 수 있게 사설 IP도 받는다. */
export function isLocalOrigin(origin: string | undefined) {
  if (!origin) return false
  try {
    const { hostname } = new URL(origin)
    return (
      ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ||
      /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)\d+\.\d+/.test(hostname)
    )
  } catch {
    return false
  }
}
