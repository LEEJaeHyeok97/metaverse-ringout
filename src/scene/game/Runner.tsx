import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BALLOON_RANGE,
  BALLOON_SECONDS,
  BANANA_RADIUS,
  BANANA_SLIP_SECONDS,
  bedSpot,
  BIKE_REACH,
  BIKES,
  BODY_RADIUS,
  BOOST_FACTOR,
  BOOST_SECONDS,
  BOOSTER_FACTOR,
  BOOSTER_SECONDS,
  circleHitsBox,
  COFFEE_REACH,
  COFFEE_SECONDS,
  COFFEES,
  confine,
  DESK_REACH,
  deskSpot,
  FINISH_Z,
  GRAVITY,
  HURDLE_HALF_DEPTH,
  HURDLE_HEIGHT,
  HURDLE_ZS,
  ITEM_BOX_REACH,
  ITEM_BOX_XS,
  ITEM_INFO,
  ITEM_RESPAWN_MS,
  ITEM_ROWS,
  JUMP_SPEED,
  laneX,
  LATE_SECONDS,
  LIGHT_GRACE,
  lightAt,
  LIGHT_ZONE,
  pigeonsAt,
  PIGEON_RADIUS,
  PROPS,
  PUDDLE_FACTOR,
  PUDDLES,
  PUNCH_STUN_SECONDS,
  pushOutOfBox,
  pushOutOfCircle,
  RIDE_FACTOR,
  RIDE_SECONDS,
  ringIndex,
  rollItem,
  SHIELD_SECONDS,
  subwayWalls,
  UFO_SECONDS,
  vehiclesAt,
  WAKE_DECAY_PER_SECOND,
  WAKE_PRESSES,
  wakeSpot,
  WALK_SPEED,
  WARP_Z,
} from '../../game/course'
import { growth, recordArrival } from '../../data/garden'
import { gameSeconds, run, toast } from '../../game/run'
import { audio } from '../../lib/audio'
import { connection, type HitEvent } from '../../net/connection'
import { animIndex, type Anim, type PlayerInfo } from '../../net/protocol'
import { nicknameOf, tryPunch } from '../combat'
import { input, moveVector, overlay, self, setOverlayOpen } from '../input'
import { Label } from '../Label'
import { NameAndBubble } from '../Players'
import { BouncySeed } from '../Seed'
import { StickFigure, type Motion } from '../StickFigure'
import { boxKey } from './Items'
import { placeOnCourse } from './onCourse'

const SEND_INTERVAL = 1 / 15
const BED_HEIGHT = 0.45
/** 맞고 일어난 뒤 곧바로 또 맞지 않게 잠깐 봐준다. */
const IMMUNE_MS = 900
const OVERVIEW_UNTIL = -1.2
const CAMERA_HEIGHT = 11
const CAMERA_DISTANCE = 8.5
const CAMERA_LOOK = 5
/** 물풍선에 갇혔을 때 스페이스 한 번에 줄어드는 시간 */
const BALLOON_ESCAPE_MS = 260

type Stun = { anim: Anim; seconds: number }

const HITS = {
  car: { anim: 'down', seconds: 1.8 },
  pigeon: { anim: 'stumble', seconds: 0.9 },
  hurdle: { anim: 'down', seconds: 1.2 },
  light: { anim: 'stumble', seconds: 1.2 },
  banana: { anim: 'stumble', seconds: BANANA_SLIP_SECONDS },
} satisfies Record<string, Stun>

const overviewCamera = new THREE.Vector3(0, 26, 22)
const overviewLook = new THREE.Vector3(0, 0, -5)
const cameraGoal = new THREE.Vector3()
const lookGoal = new THREE.Vector3()

/** 나보다 앞선 사람 수. 도착한 사람도 앞선 것으로 친다. */
function rankOf(z: number) {
  const { myId, game, match } = connection.getState()
  const finished = new Set(match?.finishes.map((finish) => finish.id))
  let ahead = 0
  for (const player of game) {
    if (player.id === myId) continue
    const other = connection.positions.get(player.id)
    if (finished.has(player.id) || (other && other.z < z)) ahead += 1
  }
  return { rank: ahead, total: Math.max(game.length, 1) }
}

/** 아이템을 쓸 수 있는 상대들(아직 달리는 사람). 코스 좌표다. */
function rivals() {
  const { myId, game, match } = connection.getState()
  const finished = new Set(match?.finishes.map((finish) => finish.id))
  return game
    .filter((player) => player.id !== myId && !finished.has(player.id))
    .map((player) => ({ id: player.id, position: connection.positions.get(player.id) }))
    .filter((rival): rival is { id: number; position: NonNullable<typeof rival.position> } => rival.position !== undefined)
}

export function Runner({ me }: { me: PlayerInfo | null }) {
  const group = useRef<THREE.Group>(null)
  const motion = useRef<Motion>({ anim: 'sleep', speed: 0 })
  /** 코스 좌표의 내 위치. 화면에는 휘어진 도로 위로 옮겨 그린다. */
  const pos = useRef(new THREE.Vector3(bedSpot(run.lane).x, BED_HEIGHT, bedSpot(run.lane).z))
  const heading = useRef(Math.PI)
  const velocity = useRef(new THREE.Vector2())
  const jump = useRef({ y: 0, speed: 0 })
  const lastAction = useRef(input.actionCount)
  const lastPunch = useRef(input.punchCount)
  const lastItem = useRef(input.itemCount)
  const lastRing = useRef(-1)
  const stunAnim = useRef<Anim>('down')
  const immuneUntil = useRef(0)
  const inPuddle = useRef(false)
  const warnedLate = useRef(false)
  const sendTimer = useRef(0)
  const slipped = useRef(new Set<number>())
  const [reward, setReward] = useState<ReturnType<typeof growth> | null>(null)
  const size = useThree((state) => state.size)
  const portrait = size.height > size.width

  // 맞거나 아이템에 당하면 다음 프레임을 기다리지 않고 바로 반응한다.
  useEffect(
    () =>
      connection.onPunch((hit: HitEvent) => {
        const myId = connection.getState().myId
        if (hit.from === myId && hit.to !== myId) {
          const done = { punch: '퍽!', balloon: '💧 물풍선 명중!', ufo: '🛸 우주선이 붙잡았어요!', warp: '🌀 집으로 보내 버렸어요!' }[hit.kind]
          audio.effect('hit')
          toast(`${done} (${nicknameOf(hit.to)})`, 'info')
        }
        if (hit.to !== myId || run.phase !== 'running') return
        const now = performance.now()
        if (now < run.shieldUntil) {
          run.shieldUntil = 0
          audio.effect('wake')
          toast(`🛡️ 방패로 막았어요! (${nicknameOf(hit.from)})`, 'good')
          return
        }
        const stun = (anim: Anim, seconds: number) => {
          run.stunUntil = now + seconds * 1000
          immuneUntil.current = run.stunUntil + IMMUNE_MS
          stunAnim.current = anim
          velocity.current.set(0, 0)
          run.rideUntil = 0
        }
        const who = nicknameOf(hit.from)
        audio.effect('hit')
        if (hit.kind === 'punch') {
          stun('down', PUNCH_STUN_SECONDS)
          toast(`${who}님에게 맞았어요!`)
        } else if (hit.kind === 'balloon') {
          stun('trapped', BALLOON_SECONDS)
          toast(`💧 ${who}님의 물풍선! 스페이스 연타로 탈출`)
        } else if (hit.kind === 'ufo') {
          stun('ufo', UFO_SECONDS)
          toast(`🛸 1등이라 우주선에 붙잡혔어요! (${who})`)
        } else {
          pos.current.set(laneX(run.lane), 0, WARP_Z)
          jump.current.y = 0
          stun('stumble', 0.6)
          toast(`🌀 ${who}님의 귀가 포털! 집 앞으로 돌아왔어요`)
        }
      }),
    [],
  )

  /** 아이템 칸의 아이템을 쓴다. 쓸 대상이 없으면 아이템을 남겨 둔다. */
  const useItem = (p: THREE.Vector3, now: number) => {
    const kind = run.item
    if (!kind) return
    const info = ITEM_INFO[kind]
    const others = rivals()
    const keep = (message: string) => toast(`${info.icon} ${message}`, 'info')
    switch (kind) {
      case 'booster':
        run.boosterUntil = now + BOOSTER_SECONDS * 1000
        audio.effect('go')
        toast('🚀 부스터! 슈웅~', 'good')
        break
      case 'shield':
        run.shieldUntil = now + SHIELD_SECONDS * 1000
        audio.effect('wake')
        toast(`🛡️ 방패! ${SHIELD_SECONDS}초 동안 공격 한 번을 막아요`, 'good')
        break
      case 'banana':
        connection.send({ t: 'item', kind: 'banana' })
        toast('🍌 바나나를 떨어뜨렸어요', 'info')
        break
      case 'balloon': {
        // 앞쪽에서 가장 가까운 사람을 노린다. 앞에 없으면 가까운 아무나.
        const distance = (other: (typeof others)[number]) => Math.hypot(other.position.x - p.x, other.position.z - p.z)
        const inRange = others.filter((other) => distance(other) <= BALLOON_RANGE)
        const ahead = inRange.filter((other) => other.position.z < p.z + 1)
        const target = (ahead.length ? ahead : inRange).sort((a, b) => distance(a) - distance(b))[0]
        if (!target) return keep('물풍선을 맞힐 사람이 근처에 없어요')
        connection.send({ t: 'item', kind: 'balloon', target: target.id })
        break
      }
      case 'ufo':
        if (others.length === 0) return keep('혼자라서 우주선을 쓸 데가 없어요')
        connection.send({ t: 'item', kind: 'ufo' })
        break
      case 'warp': {
        const ahead = others.filter((other) => other.position.z < p.z).sort((a, b) => b.position.z - a.position.z)[0]
        if (!ahead) return keep('앞에 아무도 없어요. 당신이 1등!')
        connection.send({ t: 'item', kind: 'warp', target: ahead.id })
        break
      }
    }
    run.item = null
  }

  useFrame(({ camera }, rawDelta) => {
    const node = group.current
    if (!node) return
    const delta = Math.min(rawDelta, 0.05)
    const now = performance.now()
    const t = gameSeconds(now)
    const p = pos.current
    const myId = connection.getState().myId

    const blocked = overlay.open || now < overlay.ignoreActionsUntil
    const pressed = input.actionCount !== lastAction.current && !blocked
    lastAction.current = input.actionCount
    const punched = input.punchCount !== lastPunch.current && !blocked
    lastPunch.current = input.punchCount
    const itemPressed = input.itemCount !== lastItem.current && !blocked
    lastItem.current = input.itemCount

    // 링아웃은 도착하기 전까지 주기마다 다시 울린다.
    const ring = ringIndex(t)
    const newRing = ring !== lastRing.current && ring >= 0
    lastRing.current = ring
    if (newRing && run.phase !== 'finished') {
      audio.alarm()
      if (run.phase === 'running') {
        run.boostUntil = now + BOOST_SECONDS * 1000
        if (now < run.stunUntil && stunAnim.current !== 'ufo') {
          run.stunUntil = now
          toast('알람 소리에 벌떡! 다시 출발', 'good')
        } else if (ring > 0 && run.appSet) {
          toast('링아웃이 또 울려요! 정신이 번쩍, 잠깐 빨라져요', 'info')
        }
      }
    }

    let anim: Anim = 'idle'

    if (run.phase === 'countdown' || run.phase === 'sleeping') {
      const bed = bedSpot(run.lane)
      p.set(bed.x, BED_HEIGHT, bed.z)
      heading.current = Math.PI
      anim = 'sleep'
      if (run.phase === 'countdown' && t >= 0) run.phase = 'sleeping'
      if (run.phase === 'sleeping') {
        if (pressed) {
          run.wake += 1
          audio.effect('pop')
        }
        run.wake = Math.max(0, run.wake - WAKE_DECAY_PER_SECOND * delta)
        if (run.wake >= WAKE_PRESSES) {
          run.phase = 'running'
          const spot = wakeSpot(run.lane)
          p.set(spot.x, 0, spot.z)
          audio.effect('wake')
          toast('일어났다! 책상 위에서 울리는 휴대폰을 들어요', 'good')
          immuneUntil.current = now
        }
      }
    } else if (run.phase === 'running') {
      const stunned = now < run.stunUntil
      const prev = { x: p.x, z: p.z }
      const bikes = connection.getState().bikes

      // 링아웃 앱: 책상 위 휴대폰을 들어 목적지를 정해야 현관이 열린다.
      const desk = deskSpot(run.lane)
      run.nearDesk = !run.appSet && Math.hypot(desk.x - p.x, desk.z - p.z) < DESK_REACH

      // 따릉이: 서버가 내게 줬다고 알려 오면 탄다.
      if (run.pendingBike !== null && bikes[run.pendingBike] !== undefined) {
        if (bikes[run.pendingBike] === myId && !stunned) {
          run.rideUntil = now + RIDE_SECONDS * 1000
          audio.effect('go')
          toast(`🚲 따릉이 출발! ${RIDE_SECONDS}초 동안 쌩쌩`, 'good')
        } else if (bikes[run.pendingBike] !== myId) {
          toast('앗, 다른 사람이 먼저 탔어요', 'info')
        }
        run.pendingBike = null
      }
      const wasRiding = run.rideUntil > 0
      const riding = now < run.rideUntil
      if (wasRiding && !riding) {
        run.rideUntil = 0
        toast('따릉이 반납! 다시 걸어요', 'info')
      }
      run.nearBike = riding ? null : (BIKES.find((bike) => bikes[bike.id] === undefined && Math.hypot(bike.x - p.x, bike.z - p.z) < BIKE_REACH)?.id ?? null)

      // 커피는 사람마다 하나씩 따로 먹는다.
      for (const coffee of COFFEES) {
        if (run.coffees.has(coffee.id) || Math.hypot(coffee.x - p.x, coffee.z - p.z) > COFFEE_REACH) continue
        run.coffees.add(coffee.id)
        run.boostUntil = Math.max(run.boostUntil, now + COFFEE_SECONDS * 1000)
        audio.effect('pop')
        toast('☕ 커피 한 잔! 정신이 번쩍, 잠깐 빨라져요', 'good')
      }

      // 아이템 상자: 깨면 아이템 칸이 비어 있을 때만 하나 받는다.
      ITEM_ROWS.forEach((rowZ, row) => {
        if (Math.abs(p.z - rowZ) > ITEM_BOX_REACH) return
        ITEM_BOX_XS.forEach((boxX, slot) => {
          const key = boxKey(row, slot)
          const takenAt = run.boxesTaken.get(key)
          if (Math.abs(p.x - boxX) > ITEM_BOX_REACH || (takenAt !== undefined && now - takenAt < ITEM_RESPAWN_MS)) return
          run.boxesTaken.set(key, now)
          audio.effect('pop')
          if (run.item) return
          const { rank, total } = rankOf(p.z)
          run.item = rollItem(rank, total)
          const info = ITEM_INFO[run.item]
          toast(`🎁 ${info.icon} ${info.name}! E로 사용 · ${info.help}`, 'good')
        })
      })

      if (itemPressed && run.item && !stunned) useItem(p, now)

      if (punched && !stunned && tryPunch(p.x, p.z, heading.current)) run.punchUntil = now + 300

      // 물풍선에 갇혔으면 스페이스를 연타해 빨리 빠져나온다.
      if (pressed && stunned && stunAnim.current === 'trapped') run.stunUntil -= BALLOON_ESCAPE_MS

      const puddle = PUDDLES.some((circle) => Math.hypot(p.x - circle.x, p.z - circle.z) < circle.r * 0.9)
      if (puddle && !inPuddle.current) audio.effect('splash')
      inPuddle.current = puddle
      // 따릉이, 부스터, 알람 부스트는 겹치지 않고 가장 빠른 쪽을 쓴다. 따릉이는 웅덩이에서도 느려지지 않는다.
      const factor = Math.max(riding ? RIDE_FACTOR : 1, now < run.boostUntil ? BOOST_FACTOR : 1, now < run.boosterUntil ? BOOSTER_FACTOR : 1)
      const speed = stunned || overlay.open ? 0 : WALK_SPEED * factor * (puddle && !riding && jump.current.y === 0 ? PUDDLE_FACTOR : 1)
      const move = moveVector()
      const blend = 1 - Math.exp(-delta * 12)
      velocity.current.x += (move.x * speed - velocity.current.x) * blend
      velocity.current.y += (-move.y * speed - velocity.current.y) * blend
      p.x += velocity.current.x * delta
      p.z += velocity.current.y * delta

      if (pressed && !stunned && !riding) {
        if (run.nearDesk) {
          run.appOpen = true
          setOverlayOpen(true)
          audio.effect('pop')
        } else if (run.nearBike !== null && run.pendingBike === null) {
          run.pendingBike = run.nearBike
          connection.send({ t: 'ride', bike: run.nearBike })
        } else if (jump.current.y === 0) {
          jump.current.speed = JUMP_SPEED
          audio.effect('jump')
        }
      }
      if (jump.current.y > 0 || jump.current.speed > 0) {
        jump.current.speed -= GRAVITY * delta
        jump.current.y = Math.max(0, jump.current.y + jump.current.speed * delta)
        if (jump.current.y === 0) jump.current.speed = 0
      }
      p.y = jump.current.y

      if (!run.appSet && prev.z > -13.9 && p.z <= -13.9) toast('📱 먼저 책상 위 휴대폰으로 링아웃 목적지를 정해요', 'info')
      confine(p, prev, !run.appSet)
      for (const prop of PROPS) pushOutOfCircle(p, prop)
      for (const wall of subwayWalls(t)) pushOutOfBox(p, wall)

      const hit = (kind: keyof typeof HITS, message: string, effect: Parameters<typeof audio.effect>[0], resetZ?: number) => {
        const stun = HITS[kind]
        run.stunUntil = now + stun.seconds * 1000
        immuneUntil.current = run.stunUntil + IMMUNE_MS
        stunAnim.current = stun.anim
        velocity.current.set(0, 0)
        if (resetZ !== undefined) p.z = resetZ
        audio.effect(effect)
        toast(riding ? `${message} (따릉이에서 떨어졌어요)` : message)
        run.rideUntil = 0
      }

      if (!stunned && now >= immuneUntil.current) {
        const car = vehiclesAt(t).find((vehicle) => circleHitsBox(p.x, p.z, BODY_RADIUS, vehicle))
        const hurdle = HURDLE_ZS.find((z) => Math.abs(p.z - z) < HURDLE_HALF_DEPTH + BODY_RADIUS && p.y < HURDLE_HEIGHT)
        const moving = velocity.current.length() > 1
        const caught = p.z <= LIGHT_ZONE.from && p.z >= LIGHT_ZONE.to && moving && lightAt(t) === 'red' && lightAt(t - LIGHT_GRACE) === 'red'
        const banana = connection.getState().bananas.find((item) => !slipped.current.has(item.id) && Math.hypot(item.x - p.x, item.z - p.z) < BANANA_RADIUS + BODY_RADIUS && p.y < 0.3)
        if (car) {
          hit('car', car.kind === 'scooter' ? '킥보드랑 쾅! 잠깐 기절' : '빵빵! 차에 부딪혀 넘어졌어요', 'hit', car.z + car.hz + 1.4)
        } else if (hurdle !== undefined) {
          hit('hurdle', '허들에 걸려 꽈당! 스페이스로 뛰어넘어요', 'hit', hurdle + 1.3)
        } else if (caught) {
          hit('light', '삐익! 빨간불에 움직여서 처음으로', 'whistle', LIGHT_ZONE.from + 1.5)
        } else if (banana) {
          slipped.current.add(banana.id)
          connection.send({ t: 'slip', banana: banana.id })
          hit('banana', banana.owner === myId ? '내 바나나에 미끄러졌어요…' : `🍌 ${nicknameOf(banana.owner)}님의 바나나에 쭉!`, 'stumble')
        } else if (pigeonsAt(t).some((pigeon) => Math.hypot(pigeon.x - p.x, pigeon.z - p.z) < PIGEON_RADIUS + BODY_RADIUS)) {
          hit('pigeon', '구구구! 비둘기에 걸려 휘청', 'stumble')
        }
      }

      const planar = velocity.current.length()
      if (planar > 0.3 && now >= run.stunUntil) {
        const target = Math.atan2(velocity.current.x, velocity.current.y)
        let turn = target - heading.current
        turn = Math.atan2(Math.sin(turn), Math.cos(turn))
        heading.current += turn * (1 - Math.exp(-delta * 14))
      }
      if (now < run.stunUntil) anim = stunAnim.current
      else if (now < run.punchUntil) anim = 'punch'
      else if (now < run.rideUntil) anim = 'ride'
      else if (p.y > 0) anim = 'jump'
      else if (planar > 0.5) anim = 'walk'
      motion.current.speed = planar

      if (!warnedLate.current && t >= LATE_SECONDS) {
        warnedLate.current = true
        audio.effect('late')
        toast('09:00이 넘었어요… 지각이에요! 그래도 끝까지!')
      }

      if (p.z <= FINISH_Z) {
        run.phase = 'finished'
        run.finishedAt = now
        run.item = null
        connection.send({ t: 'finish' })
        audio.effect('arrive')
        toast('도착! 링아웃 알람이 꺼졌어요', 'good')
        // 알람 리워드: 도착할 때마다 씨앗이 자란다.
        run.reward = growth(recordArrival().arrivals)
        setReward(run.reward)
      }
    } else {
      anim = 'cheer'
      p.y = 0
    }

    motion.current.anim = anim
    run.x = p.x
    run.z = p.z
    self.x = p.x
    self.y = p.y
    self.z = p.z

    const angle = placeOnCourse(node, p.x, p.y, p.z, heading.current)

    // 카메라: 출발 전에는 다섯 집을 내려다보고, 그 뒤로는 도로 방향을 따라 뒤에서 쫓아간다.
    if (t <= OVERVIEW_UNTIL) {
      camera.position.lerp(overviewCamera, 1 - Math.exp(-delta * 4))
      camera.lookAt(overviewLook)
    } else {
      const scale = portrait ? 1.35 : 1
      const forwardX = Math.sin(angle)
      const forwardZ = -Math.cos(angle)
      cameraGoal.set(node.position.x - forwardX * CAMERA_DISTANCE * scale, CAMERA_HEIGHT * scale, node.position.z - forwardZ * CAMERA_DISTANCE * scale)
      lookGoal.set(node.position.x + forwardX * CAMERA_LOOK, 1, node.position.z + forwardZ * CAMERA_LOOK)
      camera.position.lerp(cameraGoal, 1 - Math.exp(-delta * 5))
      camera.lookAt(lookGoal)
    }

    sendTimer.current += delta
    if (sendTimer.current >= SEND_INTERVAL) {
      sendTimer.current = 0
      connection.send({ t: 'move', x: p.x, y: p.y, z: p.z, h: heading.current, a: animIndex(anim) })
    }
  })

  const bed = bedSpot(run.lane)
  return (
    <group ref={group} position={[bed.x, BED_HEIGHT, bed.z]} rotation={[0, Math.PI, 0]}>
      <StickFigure motion={motion} color={me?.color ?? '#FF5A36'} />
      <NameAndBubble id={me?.id ?? null} nickname={me ? `${me.nickname} (나)` : '나'} color={me?.color ?? '#1A1A1A'} />
      {reward && (
        // 캐릭터는 결승선 쪽을 보고 있으니 씨앗은 돌려 세워 카메라를 보게 한다.
        <group position={[-1.4, 0, 0.2]} rotation={[0, Math.PI, 0]}>
          <BouncySeed stage={reward.stage} scale={1.6} appearAt={() => run.finishedAt + 500} />
          <Label text={`🌱 ${reward.title}`} position={[0, 2.9, 0]} size={0.38} background="#FDE4D8" />
        </group>
      )}
    </group>
  )
}
