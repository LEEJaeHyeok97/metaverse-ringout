import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  advanceTracker,
  ALARM_SPIN_SECONDS,
  BANANA_SPIN_SECONDS,
  FALL_EDGE,
  FALL_SECONDS,
  KART_GHOST_SECONDS,
  KART_GIANT_BUMP,
  KART_GIANT_SCALE,
  KART_GIANT_SECONDS,
  KART_SHIELD_SECONDS,
  KART_SNAIL_FACTOR,
  KART_SNAIL_SECONDS,
  DRIFT_COLORS,
  DRIFT_MIN_SPEED,
  DRIFT_TURBO_SECONDS,
  driftLevel,
  KART_ACCEL,
  KART_BOOST_FACTOR,
  KART_BOOSTER_SECONDS,
  CROSSER_SIZE,
  crosserLateral,
  DITCH_SPEED,
  KART_BOX_LATERALS,
  KART_BOX_REACH,
  KART_BOX_RESPAWN_MS,
  KART_BRAKE,
  KART_COAST,
  KART_GRASS_FACTOR,
  KART_GRAVITY,
  KART_HALF_WIDTH,
  KART_ITEM_INFO,
  KART_MAX_SPEED,
  KART_PAD_RADIUS,
  KART_PAD_SECONDS,
  KART_RADIUS,
  KART_REVERSE_SPEED,
  KART_TURN,
  KART_WALL,
  lateralOf,
  nearestTrack,
  RAMP_MIN_SPEED,
  ROCKET_SECONDS,
  ROCKET_WINDOW,
  rollKartItem,
  trackerProgress,
  trackPoint,
  trackSpot,
  ZAP_SPIN_SECONDS,
} from '../../game/kart'
import { kart, kartSeconds } from '../../game/kartRun'
import { run, shake, toast } from '../../game/run'
import { audio } from '../../lib/audio'
import { connection } from '../../net/connection'
import { animIndex, type Anim, type PlayerInfo } from '../../net/protocol'
import { nicknameOf } from '../combat'
import { input, moveVector, self } from '../input'
import { NameAndBubble } from '../Players'
import { StickFigure, type Motion } from '../StickFigure'
import { boxKey } from './KartTrack'

const SEND_INTERVAL = 1 / 15
const CAMERA_DISTANCE = 7.5
const CAMERA_HEIGHT = 3.6
const CAMERA_LOOK = 6
/** 다른 카트와 부딪히는 거리 */
const BUMP_DISTANCE = KART_RADIUS * 2
/** 드리프트에서 몸이 미끄러지는 방향이 따라붙는 빠르기. 낮을수록 더 옆으로 미끄러진다. */
const DRIFT_GRIP = 3.2
const GRIP = 14

/** 휴대폰처럼 손가락으로 조작하면 엑셀을 저절로 밟는다. */
const COARSE = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

const cameraGoal = new THREE.Vector3()
const lookGoal = new THREE.Vector3()

function wrapAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

/** 아직 들어오지 않은 다른 카트들의 앞으로 간 거리. 바퀴 수는 서버가 알려 준 값을 쓴다. */
function rivalProgress() {
  const track = kart.track
  const { myId, game, match } = connection.getState()
  const finished = new Set(match?.finishes.map((finish) => finish.id))
  const result: { id: number; progress: number; finished: boolean }[] = []
  for (const player of game) {
    if (player.id === myId) continue
    const position = connection.positions.get(player.id)
    if (!position && !finished.has(player.id)) continue
    const index = position ? nearestTrack(track, position.x, position.z).index : 0
    result.push({ id: player.id, progress: (match?.laps[player.id] ?? 0) * track.length + index, finished: finished.has(player.id) })
  }
  return result
}

/** 내 카트. 엑셀, 브레이크, 핸들, 드리프트(누른 채 꺾고 놓으면 터보), 아이템을 다룬다. */
export function KartDriver({ me }: { me: PlayerInfo | null }) {
  const group = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const flame = useRef<THREE.Group>(null)
  const sparks = useRef<THREE.Group>(null)
  const sparkMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: DRIFT_COLORS[1] }), [])
  const motion = useRef<Motion>({ anim: 'kart', speed: 0 })
  /** 몸이 실제로 미끄러져 가는 방향. 드리프트 중에는 바라보는 방향보다 늦게 따라온다. */
  const moveAngle = useRef(kart.h)
  const cameraAngle = useRef(kart.h)
  const lastItem = useRef(input.itemCount)
  const throttleSince = useRef<number | null>(null)
  const launched = useRef(false)
  const lastTick = useRef(-99)
  const hop = useRef(0)
  const spinAngle = useRef(0)
  const padUsedAt = useRef(new Map<number, number>())
  const slipped = useRef(new Set<number>())
  const wrongWayFor = useRef(0)
  const wallHitAt = useRef(0)
  const onWall = useRef(false)
  /** 점프대에서 뜬 높이와 위로 가는 빠르기, 뜬 시각 */
  const air = useRef({ y: 0, vy: 0, since: 0 })
  const bumpedAt = useRef(0)
  const ditchTold = useRef(false)
  const rankTimer = useRef(0)
  const sendTimer = useRef(0)
  const finishSentAt = useRef(0)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const portrait = size.height > size.width

  useEffect(
    () => () => {
      const perspective = camera as THREE.PerspectiveCamera
      perspective.fov = 50
      perspective.updateProjectionMatrix()
    },
    [camera],
  )

  // 남이 쓴 아이템: 번개는 나머지 모두, 달팽이 저주는 쓴 사람보다 앞선 카트만 맞는다.
  useEffect(
    () =>
      connection.onFx((fx) => {
        const myId = connection.getState().myId
        if (kart.phase !== 'racing' || fx.from === myId) return
        if (fx.kind === 'zap') spin(ZAP_SPIN_SECONDS, `⚡ ${nicknameOf(fx.from)}님의 번개!`)
        if (fx.kind === 'snail') {
          const user = rivalProgress().find((rival) => rival.id === fx.from)
          if (user && trackerProgress(kart.track, kart.tracker) > user.progress) {
            if (blocked()) return
            kart.slowUntil = performance.now() + KART_SNAIL_SECONDS * 1000
            audio.effect('stumble')
            toast(`🐌 ${nicknameOf(fx.from)}님의 달팽이 저주… 느릿느릿`)
          }
        }
      }),
    [],
  )

  // 유도 알람은 노린 카트에게만 온다.
  useEffect(
    () =>
      connection.onPunch((hit) => {
        const myId = connection.getState().myId
        if (hit.kind !== 'alarm') return
        if (hit.from === myId) toast(`⏰ ${nicknameOf(hit.to)}님에게 알람 명중!`, 'good')
        else if (hit.to === myId) spin(ALARM_SPIN_SECONDS, `⏰ ${nicknameOf(hit.from)}님의 유도 알람!`)
      }),
    [],
  )

  /** 유령이면 통과하고, 방패가 있으면 한 번 막는다. 막았으면 true */
  const blocked = () => {
    const now = performance.now()
    if (now < kart.ghostUntil) return true
    if (now < kart.shieldUntil) {
      kart.shieldUntil = 0
      audio.effect('wake')
      toast('🛡️ 방패로 막았어요!', 'good')
      return true
    }
    return false
  }

  const spin = (seconds: number, message: string) => {
    const now = performance.now()
    if (now < kart.spinUntil || now < kart.giantUntil || blocked()) return
    kart.spinUntil = now + seconds * 1000
    kart.driftDir = 0
    kart.driftCharge = 0
    kart.boostUntil = 0
    audio.effect('stumble')
    shake(0.5, 300)
    toast(message)
  }

  const boost = (seconds: number, now: number) => {
    kart.boostUntil = Math.max(kart.boostUntil, now + seconds * 1000)
    kart.speed = Math.max(kart.speed, KART_MAX_SPEED * 1.15)
    audio.effect('turbo')
  }

  useFrame(({ camera: cam }, rawDelta) => {
    const node = group.current
    if (!node) return
    const track = kart.track
    const delta = Math.min(rawDelta, 0.05)
    const now = performance.now()
    const t = kartSeconds(now)
    const myId = connection.getState().myId
    const move = moveVector()
    // 휴대폰에서는 조이스틱을 아래로 당기지 않으면 저절로 엑셀을 밟는다.
    const throttle = COARSE ? (move.y < -0.35 ? -1 : 1) : move.y
    const steer = move.x
    let anim: Anim = 'kart'

    if (kart.phase === 'countdown') {
      // 3, 2, 1 소리. 신호 직전에 엑셀을 밟으면 로켓 스타트, 너무 일찍 밟으면 헛바퀴.
      const tick = Math.ceil(t)
      if (t < 0 && tick !== lastTick.current && tick >= -2) {
        lastTick.current = tick
        audio.effect('tick')
      }
      if (throttle > 0.3) throttleSince.current ??= t
      else throttleSince.current = null
      if (t >= 0) {
        kart.phase = 'racing'
        kart.lapStartedAt = kart.startAt
        audio.effect('go')
        const since = throttleSince.current
        if (!launched.current && since !== null) {
          launched.current = true
          if (since >= -ROCKET_WINDOW) {
            boost(ROCKET_SECONDS, now)
            toast('🚀 로켓 스타트!', 'good')
          } else {
            kart.spinUntil = now + 800
            toast('너무 일찍 밟아서 헛바퀴…')
          }
        }
      }
    } else if (kart.phase === 'racing' && kart.fallUntil > 0) {
      // 우주로 떨어지는 중: 아래로 빙글빙글 떨어진 뒤 떨어진 곳 조금 뒤 길 가운데로 돌아온다.
      kart.y -= delta * 9
      spinAngle.current += delta * 6
      if (now >= kart.fallUntil) {
        const back = trackSpot(track, kart.tracker.index - 4, 0)
        kart.x = back.x
        kart.z = back.z
        kart.h = back.h
        kart.y = 0
        kart.speed = 0
        kart.fallUntil = 0
        moveAngle.current = back.h
        spinAngle.current = 0
        kart.spinUntil = 0
        toast('🛸 구조선이 길 위로 데려다줬어요', 'info')
      }
    } else if (kart.phase === 'racing') {
      const spinning = now < kart.spinUntil
      const boosting = now < kart.boostUntil
      const near = nearestTrack(track, kart.x, kart.z, kart.tracker.index)
      const airborne = air.current.y > 0
      kart.onGrass = near.distance > KART_HALF_WIDTH && !airborne
      const giant = now < kart.giantUntil
      const ghost = now < kart.ghostUntil
      const slowed = now < kart.slowUntil
      const baseTop = boosting ? KART_MAX_SPEED * KART_BOOST_FACTOR : kart.onGrass && !giant ? KART_MAX_SPEED * KART_GRASS_FACTOR : KART_MAX_SPEED * (giant ? 1.15 : 1)
      const top = slowed ? baseTop * KART_SNAIL_FACTOR : baseTop

      // 드리프트: 스페이스를 누른 채 꺾으면 시작하고, 놓으면 모은 만큼 터보가 나간다.
      const held = input.actionHeld
      if (kart.driftDir === 0 && held && !spinning && Math.abs(steer) > 0.25 && kart.speed > DRIFT_MIN_SPEED) {
        kart.driftDir = Math.sign(steer)
        kart.driftCharge = 0
        hop.current = 0.22
        audio.effect('jump')
      } else if (kart.driftDir !== 0 && (!held || kart.speed < DRIFT_MIN_SPEED * 0.6 || spinning)) {
        const level = spinning ? 0 : driftLevel(kart.driftCharge)
        if (level > 0) {
          boost(DRIFT_TURBO_SECONDS[level], now)
          if (level === 3) toast('💜 울트라 터보!', 'good')
        }
        kart.driftDir = 0
        kart.driftCharge = 0
      }
      const drifting = kart.driftDir !== 0

      // 빠르기. 최고 속도를 넘으면(잔디에 들어가거나 부스트가 끝나면) 천천히 줄어든다.
      const cap = drifting ? top * 0.97 : top
      if (spinning) kart.speed *= Math.exp(-delta * 3)
      else if (throttle > 0.1) {
        if (kart.speed < cap) kart.speed = Math.min(cap, kart.speed + KART_ACCEL * (boosting ? 2 : 1) * throttle * delta)
      } else if (throttle < -0.1) kart.speed -= (kart.speed > 0 ? KART_BRAKE : KART_ACCEL * 0.6) * -throttle * delta
      else kart.speed -= Math.sign(kart.speed) * Math.min(Math.abs(kart.speed), KART_COAST * delta)
      if (kart.speed > cap) kart.speed = Math.max(cap, kart.speed - 22 * delta)
      kart.speed = Math.max(kart.speed, -KART_REVERSE_SPEED)

      // 구덩이: 점프대에서 날지 못하면 빠져서 엉금엉금 기어 나온다.
      const ramp = track.ramps.find((candidate) => near.index > candidate.index + 1 && near.index <= candidate.gapTo)
      const inDitch = ramp !== undefined && !airborne && near.distance < KART_HALF_WIDTH + 1
      if (inDitch && track.open) {
        // 우주 길의 끊긴 곳: 날지 못하면 그대로 떨어진다.
        kart.fallUntil = now + FALL_SECONDS * 1000
        kart.driftDir = 0
        kart.boostUntil = 0
        audio.effect('late')
        toast('🌌 끊긴 길에서 떨어졌어요! 점프대는 빠르게')
      } else if (inDitch) {
        kart.speed = Math.min(kart.speed, DITCH_SPEED)
        if (!ditchTold.current) {
          ditchTold.current = true
          audio.effect('stumble')
          shake(0.4, 250)
          toast('🕳️ 구덩이에 빠졌어요! 점프대는 빠르게 밟아요')
        }
      } else ditchTold.current = false

      // 핸들. 공중에서는 덜 꺾인다.
      const steerScale = airborne ? 0.4 : 1
      if (!spinning) {
        if (drifting) {
          const into = Math.max(-1, Math.min(1, steer * kart.driftDir))
          kart.h -= kart.driftDir * (1.25 + 0.85 * into) * steerScale * delta
          if (!kart.onGrass) kart.driftCharge += delta * (0.7 + 0.5 * Math.max(0, into))
        } else {
          const grip = Math.max(-1, Math.min(1, kart.speed / 8))
          const highSpeed = 1 - 0.25 * Math.min(1, Math.abs(kart.speed) / KART_MAX_SPEED)
          kart.h -= KART_TURN * steer * grip * highSpeed * steerScale * delta
        }
      }
      // 얼음 맵은 몸이 바라보는 방향을 늦게 따라와 쭉 미끄러진다.
      moveAngle.current += wrapAngle(kart.h - moveAngle.current) * (1 - Math.exp(-delta * (drifting ? DRIFT_GRIP : GRIP) * track.grip))
      kart.x += Math.sin(moveAngle.current) * kart.speed * delta
      kart.z += Math.cos(moveAngle.current) * kart.speed * delta

      // 점프대: 빠르게 밟으면 날아올라 구덩이를 넘는다. 오래 날았으면 착지 부스트
      const a = air.current
      if (a.y > 0 || a.vy > 0) {
        a.y += a.vy * delta
        a.vy -= KART_GRAVITY * delta
        if (a.y <= 0) {
          a.y = 0
          a.vy = 0
          audio.effect('hit')
          shake(0.25, 150)
          if (now - a.since > 600) {
            boost(0.5, now)
            toast('🛬 착지 부스트!', 'good')
          }
        }
      }

      // 타이어 벽: 넘어가면 안쪽으로 밀어내고 느려진다.
      const after = nearestTrack(track, kart.x, kart.z, near.index)
      for (const candidate of track.ramps) {
        const crossed = near.index < candidate.index && after.index >= candidate.index && after.index - near.index < 20
        if (!crossed || a.y > 0 || after.distance > KART_HALF_WIDTH || kart.speed < RAMP_MIN_SPEED) continue
        a.vy = 6 + kart.speed * 0.15
        a.y = 0.01
        a.since = now
        audio.effect('jump')
      }
      const limit = KART_WALL - KART_RADIUS
      if (track.open) {
        // 벽 없는 우주 길: 공중이 아닐 때 길 밖으로 나가면 떨어진다.
        if (after.distance > FALL_EDGE && a.y <= 0) {
          kart.fallUntil = now + FALL_SECONDS * 1000
          kart.driftDir = 0
          kart.driftCharge = 0
          kart.boostUntil = 0
          audio.effect('late')
          toast('🌌 으아아 우주로 떨어진다!')
        }
      } else if (after.distance > limit) {
        const center = track.points[after.index]
        const scale = limit / after.distance
        kart.x = center.x + (kart.x - center.x) * scale
        kart.z = center.z + (kart.z - center.z) * scale
        // 처음 부딪힐 때만 크게 느려지고, 벽을 긁으며 가는 동안은 반쯤 빠르기로 미끄러져 간다.
        if (!onWall.current) kart.speed *= 0.6
        kart.speed = Math.min(kart.speed, KART_MAX_SPEED * 0.6)
        if (!onWall.current && now - wallHitAt.current > 500) {
          wallHitAt.current = now
          audio.effect('hit')
          shake(0.35, 200)
        }
        onWall.current = true
      } else onWall.current = false

      // 다른 카트와 부딪히면 서로 밀려난다(내 화면에서는 나만 밀린다).
      for (const player of connection.getState().game) {
        if (player.id === myId) continue
        const other = connection.positions.get(player.id)
        if (!other) continue
        const dx = kart.x - other.x
        const dz = kart.z - other.z
        const distance = Math.hypot(dx, dz)
        if (ghost || connection.isGhost(player.id)) continue
        // 거인이 된 카트에 부딪히면 내가 튕겨 나며 빙글 돈다.
        if (connection.isGiant(player.id) && !giant && distance < KART_GIANT_BUMP) {
          spin(1, `🍄 거인 ${nicknameOf(player.id)}님에게 튕겨 나갔어요!`)
          if (distance > 0.01) {
            kart.x = other.x + (dx / distance) * KART_GIANT_BUMP
            kart.z = other.z + (dz / distance) * KART_GIANT_BUMP
          }
          continue
        }
        if (distance > 0.01 && distance < BUMP_DISTANCE) {
          kart.x = other.x + (dx / distance) * BUMP_DISTANCE
          kart.z = other.z + (dz / distance) * BUMP_DISTANCE
          kart.speed *= giant ? 1 : 0.92
        }
      }

      // 서 있는 장애물(눈사람, 바위, 소화전, 콘): 튕겨 나며 느려진다. 공중에서는 넘는다.
      if (a.y < 0.8 && !ghost && !giant) {
        for (const obstacle of track.obstacles) {
          const dx = kart.x - obstacle.x
          const dz = kart.z - obstacle.z
          const distance = Math.hypot(dx, dz)
          const minimum = obstacle.r + KART_RADIUS
          if (distance >= minimum || distance < 0.001) continue
          kart.x = obstacle.x + (dx / distance) * minimum
          kart.z = obstacle.z + (dz / distance) * minimum
          if (now - bumpedAt.current > 600) {
            bumpedAt.current = now
            kart.speed *= 0.4
            audio.effect('smack')
            shake(0.45, 220)
          }
        }
      }

      // 가로지르는 버스, 굴러오는 덤불, 펭귄: 부딪히면 빙글
      if (a.y < 1 && now >= kart.spinUntil && !ghost && !giant) {
        for (const crosser of track.crossers) {
          const size = CROSSER_SIZE[crosser.kind]
          const lateral = crosserLateral(crosser, t)
          const point = trackPoint(track, crosser.index)
          const along = (kart.x - point.x) * Math.sin(point.h) + (kart.z - point.z) * Math.cos(point.h)
          const side = lateralOf(track, crosser.index, kart.x, kart.z) - lateral
          if (Math.abs(side) < size.hx + KART_RADIUS * 0.8 && Math.abs(along) < size.hz + KART_RADIUS * 0.8) {
            const label = { bus: '🚌 버스에 쾅!', tumbleweed: '🌵 굴러온 덤불에 휘감겼어요!', penguin: '🐧 펭귄이랑 부딪혔어요!', meteor: '☄️ 운석에 쾅!' }[crosser.kind]
            spin(crosser.kind === 'bus' ? 1.4 : 0.9, label)
            break
          }
        }
      }

      // 부스터 발판
      track.pads.forEach((pad, index) => {
        if (a.y > 0.5 || Math.hypot(pad.x - kart.x, pad.z - kart.z) > KART_PAD_RADIUS) return
        if (now - (padUsedAt.current.get(index) ?? 0) < 1000) return
        padUsedAt.current.set(index, now)
        boost(KART_PAD_SECONDS, now)
      })

      // 아이템 상자: 들고 있는 게 없을 때만 받는다.
      track.boxRows.forEach((row, rowIndex) => {
        KART_BOX_LATERALS.forEach((lateral, slot) => {
          const key = boxKey(rowIndex, slot)
          const takenAt = kart.boxesTaken.get(key)
          if (takenAt !== undefined && now - takenAt < KART_BOX_RESPAWN_MS) return
          const spot = trackSpot(track, row, lateral)
          if (Math.hypot(spot.x - kart.x, spot.z - kart.z) > KART_BOX_REACH) return
          kart.boxesTaken.set(key, now)
          audio.effect('pop')
          if (kart.item) return
          kart.item = rollKartItem(kart.rank > 0 ? kart.rank - 1 : 0, kart.total)
          toast(`${KART_ITEM_INFO[kart.item].icon} ${KART_ITEM_INFO[kart.item].name}! E로 사용`, 'info')
        })
      })

      // 아이템 쓰기
      if (input.itemCount !== lastItem.current) {
        lastItem.current = input.itemCount
        const item = kart.item
        if (item && !spinning) {
          let used = true
          if (item === 'booster') {
            boost(KART_BOOSTER_SECONDS, now)
            connection.send({ t: 'fx', kind: 'booster' })
          } else if (item === 'shield') {
            kart.shieldUntil = now + KART_SHIELD_SECONDS * 1000
            connection.send({ t: 'fx', kind: 'shield' })
            toast('🛡️ 방패! 공격 한 번을 막아요', 'good')
          } else if (item === 'alarm') {
            // 바로 앞 카트(없으면 1등)를 노린다. 내가 1등이면 쓸 데가 없어 아껴 둔다.
            const mine = trackerProgress(track, kart.tracker)
            const ahead = rivalProgress()
              .filter((rival) => !rival.finished && rival.progress > mine)
              .sort((x, y) => x.progress - y.progress)[0]
            if (ahead) connection.send({ t: 'item', kind: 'alarm', target: ahead.id })
            else {
              used = false
              toast('앞에 아무도 없어요. 알람은 아껴 둬요', 'info')
            }
          } else {
            if (item === 'ghost') kart.ghostUntil = now + KART_GHOST_SECONDS * 1000
            if (item === 'giant') {
              kart.giantUntil = now + KART_GIANT_SECONDS * 1000
              kart.speed = Math.max(kart.speed, KART_MAX_SPEED)
            }
            connection.send({ t: 'item', kind: item })
          }
          if (used) kart.item = null
        }
      }

      // 바나나
      for (const banana of connection.getState().bananas) {
        if (ghost || slipped.current.has(banana.id) || Math.hypot(banana.x - kart.x, banana.z - kart.z) > (giant ? 2.4 : 1.5)) continue
        slipped.current.add(banana.id)
        connection.send({ t: 'slip', banana: banana.id })
        if (giant) continue
        spin(BANANA_SPIN_SECONDS, banana.owner === myId ? '내 바나나에 빙글…' : `🍌 ${nicknameOf(banana.owner)}님의 바나나!`)
      }

      // 바퀴 세기. 출발선을 앞으로 넘을 때마다 한 바퀴.
      const before = kart.tracker.laps
      advanceTracker(track, kart.tracker, kart.x, kart.z)
      if (kart.tracker.laps > before && kart.tracker.laps > kart.lapTimes.length) {
        kart.lapTimes.push(now - kart.lapStartedAt)
        kart.lapStartedAt = now
        if (kart.tracker.laps >= track.laps) {
          kart.phase = 'finished'
          kart.finishedAt = now
          kart.item = null
          kart.driftDir = 0
          // 서버가 바퀴 수를 확인할 수 있게 위치를 먼저 보낸다.
          connection.send({ t: 'move', x: kart.x, y: 0, z: kart.z, h: kart.h, a: animIndex('kart') })
          connection.send({ t: 'finish' })
          finishSentAt.current = now
          audio.effect('arrive')
          toast('🏁 완주!', 'good')
        } else {
          audio.effect('wake')
          toast(kart.tracker.laps === track.laps - 1 ? '🔔 마지막 바퀴!' : `🏁 ${kart.tracker.laps + 1}바퀴째!`, 'good')
        }
      }

      // 역주행 알림
      const tangent = track.points[kart.tracker.index].h
      const backwards = Math.cos(wrapAngle(moveAngle.current - tangent)) * kart.speed < -3
      wrongWayFor.current = backwards ? wrongWayFor.current + delta : 0
      kart.wrongWay = wrongWayFor.current > 0.8

      // 순위: 바퀴 수와 트랙 위 자리로 센다. 먼저 들어온 사람은 앞선다.
      rankTimer.current += delta
      if (rankTimer.current > 0.25) {
        rankTimer.current = 0
        const mine = trackerProgress(track, kart.tracker)
        const rivals = rivalProgress()
        kart.rank = 1 + rivals.filter((rival) => rival.finished || rival.progress > mine).length
        kart.total = rivals.length + 1
      }

      if (spinning) {
        spinAngle.current += delta * 14
        anim = 'kart'
      } else {
        spinAngle.current = 0
        anim = drifting ? 'drift' : 'kart'
      }
      kart.y = inDitch ? -0.5 : air.current.y
    } else {
      // 완주한 뒤에는 천천히 멈춘다. 서버가 도착을 못 받았으면 다시 알린다.
      kart.speed *= Math.exp(-delta * 1.2)
      kart.x += Math.sin(kart.h) * kart.speed * delta
      kart.z += Math.cos(kart.h) * kart.speed * delta
      const done = connection.getState().match?.finishes.some((finish) => finish.id === myId)
      if (!done && now - finishSentAt.current > 1500) {
        finishSentAt.current = now
        connection.send({ t: 'finish' })
      }
      anim = 'kart'
    }

    // 모형
    hop.current = Math.max(0, hop.current - delta)
    const hopY = hop.current > 0 ? Math.sin((hop.current / 0.22) * Math.PI) * 0.35 : 0
    node.position.set(kart.x, hopY + kart.y, kart.z)
    const size = now < kart.giantUntil ? KART_GIANT_SCALE : 1
    node.scale.setScalar(node.scale.x + (size - node.scale.x) * (1 - Math.exp(-delta * 6)))
    motion.current.ghost = now < kart.ghostUntil
    // 공중에서는 앞이 살짝 들린다.
    if (body.current) body.current.rotation.x = air.current.y > 0 ? Math.max(-0.35, -air.current.vy * 0.03) : 0
    node.rotation.y = kart.h + spinAngle.current
    if (body.current) body.current.rotation.z = kart.driftDir * 0.08
    const level = driftLevel(kart.driftCharge)
    if (sparks.current) {
      sparks.current.visible = kart.driftDir !== 0 && level > 0
      sparks.current.children.forEach((child, index) => child.scale.setScalar(0.7 + Math.abs(Math.sin(now / 30 + index)) * (0.5 + level * 0.3)))
    }
    sparkMaterial.color.set(DRIFT_COLORS[level])
    if (flame.current) {
      flame.current.visible = now < kart.boostUntil
      flame.current.scale.set(1, 1, 0.8 + Math.random() * 0.6)
    }
    motion.current.anim = anim
    motion.current.speed = Math.abs(kart.speed)
    self.x = kart.x
    self.y = 0
    self.z = kart.z

    // 카메라: 카트 뒤에서 따라가고, 부스트 중에는 시야가 넓어진다.
    cameraAngle.current += wrapAngle(moveAngle.current - cameraAngle.current) * (1 - Math.exp(-delta * 4))
    const scale = portrait ? 1.3 : 1
    const forwardX = Math.sin(cameraAngle.current)
    const forwardZ = Math.cos(cameraAngle.current)
    const lift = Math.max(0, kart.y) * 0.7
    cameraGoal.set(kart.x - forwardX * CAMERA_DISTANCE * scale, CAMERA_HEIGHT * scale + lift, kart.z - forwardZ * CAMERA_DISTANCE * scale)
    lookGoal.set(kart.x + forwardX * CAMERA_LOOK, 1 + lift, kart.z + forwardZ * CAMERA_LOOK)
    cam.position.lerp(cameraGoal, 1 - Math.exp(-delta * 8))
    cam.lookAt(lookGoal)
    const perspective = cam as THREE.PerspectiveCamera
    const fov = now < kart.boostUntil ? 74 : 60 + Math.min(8, Math.abs(kart.speed) / 4)
    if (Math.abs(perspective.fov - fov) > 0.1) {
      perspective.fov += (fov - perspective.fov) * (1 - Math.exp(-delta * 5))
      perspective.updateProjectionMatrix()
    }
    if (now < run.shakeUntil) {
      const power = run.shakePower * Math.min(1, (run.shakeUntil - now) / 300)
      cam.position.x += (Math.random() - 0.5) * power
      cam.position.y += (Math.random() - 0.5) * power
    }

    sendTimer.current += delta
    if (sendTimer.current >= SEND_INTERVAL && kart.phase === 'racing' && kart.fallUntil === 0) {
      sendTimer.current = 0
      connection.send({ t: 'move', x: kart.x, y: Math.max(0, kart.y), z: kart.z, h: kart.h, a: animIndex(anim) })
    }
  })

  return (
    <group ref={group} position={[kart.x, 0, kart.z]} rotation={[0, kart.h, 0]}>
      <group ref={body}>
        <StickFigure motion={motion} color={me?.color ?? '#FF5A36'} />
      </group>
      {/* 부스터 불꽃 */}
      <group ref={flame} visible={false} position={[0, 0.55, -1.45]}>
        {[-0.25, 0.25].map((x) => (
          <mesh key={x} position={[x, 0, -0.35]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.18, 0.9, 8]} />
            <meshBasicMaterial color="#FF9A2E" />
          </mesh>
        ))}
      </group>
      {/* 드리프트 터보가 모일수록 파랑 → 주황 → 보라 불꽃 */}
      <group ref={sparks} visible={false}>
        {[-0.9, 0.9, -0.7, 0.7].map((x, index) => (
          <mesh key={index} position={[x, 0.2, -1 - (index > 1 ? 0.35 : 0)]} material={sparkMaterial}>
            <octahedronGeometry args={[0.2]} />
          </mesh>
        ))}
      </group>
      <NameAndBubble id={me?.id ?? null} nickname={me ? `${me.nickname} (나)` : '나'} color={me?.color ?? '#1A1A1A'} />
    </group>
  )
}
