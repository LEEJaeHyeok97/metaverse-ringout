import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CATCHUP_FACTOR,
  CATCHUP_GAP,
  DASH_FACTOR,
  DASH_SECONDS,
  PAD_JUMP_FORWARD,
  PAD_JUMP_SPEED,
  PAD_RADIUS,
  PADS,
  SHORTCUT_REACH,
  SHORTCUT_TRAVEL_MS,
  SHORTCUTS,
  shortcutDoorX,
  shortcutState,
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
  activeMap,
  specialAt,
  gustAt,
  GUST_SPEED,
  lightningAt,
  LIGHTNING_RADIUS,
  acornsAt,
  ACORN_RADIUS,
  ACORN_CLEAR_HEIGHT,
  LEAF_PILES,
  LEAF_BOUNCE_SPEED,
  ICE_GRIP,
  plowsAt,
  DOUBLE_JUMP_SPEED,
  MAX_JUMPS,
  KICK_PUSH,
  KICK_PUSH_SECONDS,
  KICK_STUN_SECONDS,
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
  RIDES,
  RAM_PUSH,
  ZAP_STUN_SECONDS,
  BOMB_FUSE_SECONDS,
  BOMB_RADIUS,
  BOMB_STUN_SECONDS,
  TORNADO_SECONDS,
  TORNADO_RADIUS,
  TORNADO_STUN_SECONDS,
  tornadoAt,
  GIANT_FACTOR,
  GIANT_SCALE,
  GIANT_BUMP,
  SNAIL_SECONDS,
  SNAIL_FACTOR,
  QUIZ,
  quizWalls,
  quizDoorAt,
  QUIZ_WRONG_STUN,
  groundAt,
  onSlide,
  SLIDE_SPEED,
  SLIDE_STEER,
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
import { gameSeconds, run, shake, showGuide, toast } from '../../game/run'
import { pickQuiz } from '../../data/quiz'
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
  lightning: { anim: 'down', seconds: 1.3 },
  acorn: { anim: 'stumble', seconds: 1 },
  quiz: { anim: 'down', seconds: QUIZ_WRONG_STUN },
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
  const jump = useRef({ y: 0, speed: 0, count: 0 })
  /** 발차기에 맞아 날아가는 속도(코스 좌표)와 끝나는 시각 */
  const knock = useRef({ x: 0, z: 0, until: 0 })
  const lastAction = useRef(input.actionCount)
  const lastPunch = useRef(input.punchCount)
  const lastKick = useRef(input.kickCount)
  const lastItem = useRef(input.itemCount)
  const lastRing = useRef(-1)
  const stunAnim = useRef<Anim>('down')
  const immuneUntil = useRef(0)
  const inPuddle = useRef(false)
  const warnedLate = useRef(false)
  /** 맵만의 구간에 처음 들어갈 때 한 번만 알려 준다. */
  const specialTold = useRef(false)
  const plowTold = useRef(false)
  const slideTold = useRef(false)
  const sendTimer = useRef(0)
  const slipped = useRef(new Set<number>())
  /** 아직 터지지 않았거나 지나가는 중인 범위 아이템(폭탄, 회오리) */
  const areas = useRef<{ kind: 'bomb' | 'tornado'; from: number; x: number; z: number; at: number; done: boolean }[]>([])
  /** 들이받기와 거인 부딪힘은 같은 사람에게 연달아 일어나지 않게 한다. */
  const lastBump = useRef(new Map<number, number>())
  const scale = useRef(1)
  const [reward, setReward] = useState<ReturnType<typeof growth> | null>(null)
  const size = useThree((state) => state.size)
  const sceneCamera = useThree((state) => state.camera)
  // 게임이 끝나 광장으로 돌아갈 때 미끄럼틀에서 넓혀 둔 시야를 되돌린다.
  useEffect(
    () => () => {
      const perspective = sceneCamera as THREE.PerspectiveCamera
      perspective.fov = 50
      perspective.updateProjectionMatrix()
    },
    [sceneCamera],
  )
  const portrait = size.height > size.width

  /** 이 자리에서 멀어지는 쪽으로 distance만큼 날아간다. 자리를 모르면 뒤(집 쪽)로 날아간다. */
  const pushAway = (from: { x: number; z: number } | undefined | null, distance: number, now = performance.now()) => {
    const p = pos.current
    let dx = from ? p.x - from.x : 0
    let dz = from ? p.z - from.z : 1
    const length = Math.hypot(dx, dz) || 1
    dx /= length
    dz /= length
    const speed = distance / KICK_PUSH_SECONDS
    knock.current = { x: dx * speed, z: dz * speed, until: now + KICK_PUSH_SECONDS * 1000 }
  }

  /** 범위 아이템에 맞았다. 방패가 있으면 막는다. 막았으면 false */
  const areaStun = (anim: Anim, seconds: number, message: string) => {
    const now = performance.now()
    const myId = connection.getState().myId
    if (run.phase !== 'running' || now < run.stunUntil || (myId !== null && connection.isGhost(myId))) return false
    if (now < run.shieldUntil) {
      run.shieldUntil = 0
      audio.effect('wake')
      toast('🛡️ 방패로 막았어요!', 'good')
      return false
    }
    run.stunUntil = now + seconds * 1000
    immuneUntil.current = run.stunUntil + IMMUNE_MS
    stunAnim.current = anim
    velocity.current.set(0, 0)
    run.rideUntil = 0
    audio.effect('smack')
    shake(0.8, 400)
    toast(message)
    return true
  }

  // 개발 서버에서만: 브라우저 자동 점검이 코스의 원하는 곳으로 바로 옮겨 볼 수 있게 한다.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const hook = (window as unknown as { __ringout?: Record<string, unknown> }).__ringout
    if (hook) hook.teleport = (x: number, z: number) => pos.current.set(x, 0, z)
  }, [])

  // 범위 아이템: 서버는 쓴 자리와 시각만 알려 주고, 맞았는지는 내 화면이 정한다.
  useEffect(
    () =>
      connection.onFx((fx) => {
        const myId = connection.getState().myId
        if (fx.from === myId || run.phase !== 'running') return
        const who = nicknameOf(fx.from)
        if (fx.kind === 'zap') {
          areaStun('down', ZAP_STUN_SECONDS, `⚡ ${who}님의 번개! 찌릿`)
        } else if (fx.kind === 'snail') {
          // 쓴 사람보다 앞선 사람만 느려진다.
          if (fx.z !== undefined && pos.current.z < fx.z) {
            if (performance.now() < run.shieldUntil) {
              run.shieldUntil = 0
              toast('🛡️ 방패로 달팽이 저주를 막았어요!', 'good')
            } else {
              run.slowUntil = performance.now() + SNAIL_SECONDS * 1000
              toast(`🐌 ${who}님의 달팽이 저주! ${SNAIL_SECONDS}초 동안 느릿느릿`)
            }
          }
        } else if ((fx.kind === 'bomb' || fx.kind === 'tornado') && fx.x !== undefined && fx.z !== undefined) {
          areas.current.push({ kind: fx.kind, from: fx.from, x: fx.x, z: fx.z, at: fx.at, done: false })
        }
      }),
    [],
  )

  // 맞거나 아이템에 당하면 다음 프레임을 기다리지 않고 바로 반응한다.
  useEffect(
    () =>
      connection.onPunch((hit: HitEvent) => {
        const myId = connection.getState().myId
        if (hit.from === myId && hit.to !== myId) {
          const done = { punch: '퍽!', kick: '👟 뻥!', ram: '💥 쾅!', balloon: '💧 물풍선 명중!', ufo: '🛸 우주선이 붙잡았어요!', warp: '🌀 집으로 보내 버렸어요!', alarm: '⏰ 유도 알람 명중!' }[hit.kind]
          audio.effect('smack')
          // 때린 쪽 화면도 짧고 세게 흔들어 손맛을 낸다.
          if (hit.kind === 'punch' || hit.kind === 'kick' || hit.kind === 'ram') shake(hit.kind === 'punch' ? 0.25 : 0.4, 160)
          toast(`${done} (${nicknameOf(hit.to)})`, 'info')
        }
        if (hit.to !== myId || run.phase !== 'running') return
        const now = performance.now()
        if (myId !== null && connection.isGhost(myId)) return
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
        audio.effect('smack')
        const from = connection.positions.get(hit.from)
        if (hit.kind === 'punch') {
          stun('down', PUNCH_STUN_SECONDS)
          pushAway(from, 1.2)
          shake(0.6, 300)
          toast(`${who}님에게 맞았어요!`)
        } else if (hit.kind === 'kick') {
          stun('down', KICK_STUN_SECONDS)
          pushAway(from, KICK_PUSH)
          shake(0.8, 380)
          toast(`👟 ${who}님의 발차기에 날아갔어요!`)
        } else if (hit.kind === 'ram') {
          stun('down', RIDES.car.ram!.stun)
          pushAway(from, RAM_PUSH)
          shake(1, 450)
          toast(`💥 ${who}님의 차에 치였어요!`)
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

  /** 바닥 발판: 대시 발판은 쌩 빨라지고, 점프 발판은 높이 튀어 앞으로 날아간다. */
  const lastPad = useRef({ index: -1, at: 0 })
  const padStep = (p: THREE.Vector3, now: number, stunned: boolean) => {
    if (stunned || run.shortcut || jump.current.y > 0.3) return
    const index = PADS.findIndex((pad) => Math.hypot(pad.x - p.x, pad.z - p.z) < PAD_RADIUS)
    if (index < 0 || (index === lastPad.current.index && now - lastPad.current.at < 2000)) return
    lastPad.current = { index, at: now }
    if (PADS[index].kind === 'dash') {
      run.dashUntil = now + DASH_SECONDS * 1000
      audio.effect('go')
      shake(0.2, 200)
      toast('💨 대시 발판! 쌩~', 'good')
    } else {
      jump.current.speed = PAD_JUMP_SPEED
      jump.current.count = MAX_JUMPS
      const air = (2 * PAD_JUMP_SPEED) / GRAVITY
      knock.current = { x: 0, z: -PAD_JUMP_FORWARD, until: now + air * 1000 }
      audio.effect('ultimate')
      shake(0.3, 250)
      toast('🦘 점프 발판! 날아올라~', 'good')
    }
  }

  /**
   * 순위가 바뀌면 바로 알려 주고, 1등에게 많이 뒤처지면 따라잡기 부스트를 준다.
   * 도착한 사람은 앞에 있는 것으로 센다.
   */
  const rankTold = useRef({ rank: 0, at: 0 })
  const rankStep = (p: THREE.Vector3, now: number) => {
    const others = rivals()
    const finished = connection.getState().match?.finishes.length ?? 0
    const ahead = others.filter((other) => other.position.z < p.z)
    const rank = finished + ahead.length + 1
    const leaderZ = finished > 0 ? FINISH_Z : Math.min(p.z, ...others.map((other) => other.position.z))
    const catchup = others.length + finished > 0 && p.z - leaderZ > CATCHUP_GAP
    if (catchup && !run.catchup) toast('🔥 따라잡기 부스트! 조금 빨라져요', 'good')
    run.catchup = catchup
    run.rank = rank
    // 집과 골목에서는 다들 엎치락뒤치락하니 큰길에 나와서부터 알린다.
    if (p.z > -20 || run.phase !== 'running') {
      rankTold.current = { rank, at: now }
      return
    }
    if (rankTold.current.rank === 0) rankTold.current = { rank, at: now }
    if (rank === rankTold.current.rank || now - rankTold.current.at < 1500) return
    const passed = rank < rankTold.current.rank
    rankTold.current = { rank, at: now }
    if (passed) {
      toast(rank === 1 ? '👑 1등으로 올라섰어요!' : `🔥 역전! ${rank}등으로 올라섰어요`, 'good')
      audio.effect('pop')
    } else {
      const by = others.find((other) => other.position.z < p.z && other.position.z > p.z - 6)
      toast(by ? `😱 ${nicknameOf(by.id)}님에게 추월당했어요! (${rank}등)` : `😱 ${rank}등으로 밀려났어요`)
    }
  }

  /**
   * 지름길 골목: 열린 문 앞에 가면 골목으로 쏙 들어가 잠깐 뒤 앞쪽 문으로 나온다.
   * 닫힌 문 앞에서는 언제 열리는지 알려 준다.
   */
  const shortcutTold = useRef(new Set<number>())
  const shortcutStep = (p: THREE.Vector3, now: number, t: number, stunned: boolean) => {
    if (run.shortcut) {
      velocity.current.set(0, 0)
      if (now - run.shortcut.at < SHORTCUT_TRAVEL_MS) {
        p.set(run.shortcut.x, p.y, p.z)
        return
      }
      const skipped = Math.round(p.z - run.shortcut.z)
      p.set(run.shortcut.x * 0.88, 0, run.shortcut.z)
      jump.current.y = 0
      jump.current.speed = 0
      audio.effect('pop')
      shake(0.3, 250)
      toast(`🏃 ${run.shortcut.name} 통과! ${skipped}m 앞질렀어요`, 'good')
      run.shortcut = null
      return
    }
    if (stunned) return
    for (const shortcut of SHORTCUTS) {
      const doorX = shortcutDoorX(shortcut)
      if (Math.abs(p.z - shortcut.from) > SHORTCUT_REACH || Math.abs(p.x - doorX) > SHORTCUT_REACH) continue
      const door = shortcutState(shortcut, t)
      if (!door.open) {
        if (!shortcutTold.current.has(shortcut.id)) {
          shortcutTold.current.add(shortcut.id)
          toast(`🚪 ${shortcut.name} 문이 닫혀 있어요. ${Math.ceil(door.left)}초 뒤에 열려요`, 'info')
        }
        continue
      }
      run.shortcut = { x: doorX, z: shortcut.to, at: now, name: shortcut.name }
      run.rideUntil = 0
      audio.effect('whistle')
      toast(`🚪 ${shortcut.name}에 쏙! 골목을 지나는 중…`, 'good')
      return
    }
  }

  /**
   * 링아웃 스핑크스: 구간에 들어오면 문제를 내고, 벽을 지날 때 고른 통로가 정답인지 본다.
   * 오답 통로는 바닥이 열려 구간 처음으로 떨어지고 새 문제를 받는다.
   */
  const quizStep = (prev: { x: number; z: number }, p: THREE.Vector3, now: number) => {
    if (!QUIZ) return
    if (!run.quiz && p.z <= QUIZ.from && p.z > QUIZ.wallZ) {
      run.quiz = pickQuiz()
      audio.effect('pop')
    }
    if (!(prev.z > QUIZ.wallZ && p.z <= QUIZ.wallZ) || !run.quiz) return
    const door = quizDoorAt(p.x)
    // 통로가 아닌 곳으로 지나왔다면 유령이 벽을 뚫은 것이다. 그냥 통과한다.
    if (door === null) {
      run.quiz = null
      return
    }
    if (door === run.quiz.correct) {
      toast(`⭕ 정답! 「${run.quiz.options[door]}」 통과!`, 'good')
      audio.effect('arrive')
      run.quiz = null
      return
    }
    const answer = run.quiz.options[run.quiz.correct]
    run.quizWrong += 1
    run.quiz = pickQuiz(run.quiz.question)
    p.set(0, 0, QUIZ.from - 1.5)
    jump.current.y = 0
    jump.current.speed = 0
    run.stunUntil = now + QUIZ_WRONG_STUN * 1000
    immuneUntil.current = run.stunUntil + IMMUNE_MS
    stunAnim.current = 'down'
    velocity.current.set(0, 0)
    run.rideUntil = 0
    audio.effect('boom')
    shake(0.7, 400)
    toast(`❌ 땡! 바닥이 열렸어요. 정답은 「${answer}」 · 새 문제!`)
  }

  /** 아이템 칸의 아이템을 쓴다. 쓸 대상이 없으면 아이템을 남겨 둔다. */
  const useItem = (p: THREE.Vector3, now: number) => {
    const kind = run.item
    if (!kind) return
    const others = rivals()
    switch (kind) {
      case 'booster':
        run.boosterUntil = now + BOOSTER_SECONDS * 1000
        connection.send({ t: 'fx', kind: 'booster' })
        audio.effect('go')
        break
      case 'shield':
        run.shieldUntil = now + SHIELD_SECONDS * 1000
        connection.send({ t: 'fx', kind: 'shield' })
        audio.effect('wake')
        toast(`🛡️ ${SHIELD_SECONDS}초 동안 공격 한 번을 막아요`, 'good')
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
        // 맞힐 사람이 없으면 앞쪽 허공으로 날린다.
        connection.send(target ? { t: 'item', kind: 'balloon', target: target.id } : { t: 'item', kind: 'balloon' })
        if (!target) toast('💧 허공에 물풍선을 날렸어요!', 'info')
        break
      }
      case 'ufo':
        connection.send({ t: 'item', kind: 'ufo' })
        if (others.length === 0) toast('🛸 노릴 사람이 없어 모선이 앞길을 훑고 갔어요', 'info')
        break
      case 'zap':
      case 'bomb':
      case 'tornado':
      case 'giant':
      case 'ghost':
      case 'snail':
        connection.send({ t: 'item', kind })
        if (kind === 'giant') toast('🍄 거인이 됐어요! 부딪히면 튕겨 나가요', 'good')
        if (kind === 'ghost') toast('👻 유령이 됐어요! 장애물과 공격을 통과해요', 'good')
        break
      case 'warp': {
        const ahead = others.filter((other) => other.position.z < p.z).sort((a, b) => b.position.z - a.position.z)[0]
        connection.send(ahead ? { t: 'item', kind: 'warp', target: ahead.id } : { t: 'item', kind: 'warp' })
        if (!ahead) toast('🌀 앞에 아무도 없어 포털이 허공에 열렸어요', 'info')
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
    const kicked = input.kickCount !== lastKick.current && !blocked
    lastKick.current = input.kickCount
    const itemPressed = input.itemCount !== lastItem.current && !blocked
    lastItem.current = input.itemCount

    // 링아웃은 제한 시간 안에 도착하지 못하면 다시 울린다. 게임에서는 제한 시간이 10초다.
    const ring = ringIndex(t)
    const newRing = ring !== lastRing.current && ring >= 0
    lastRing.current = ring
    if (newRing && run.phase !== 'finished') {
      audio.alarm()
      run.rings.push(t)
      if (ring === 0) showGuide('alarm')
      else if (run.appSet) showGuide('reRing')
      if (run.phase === 'running') {
        run.boostUntil = now + BOOST_SECONDS * 1000
        if (now < run.stunUntil && stunAnim.current !== 'ufo') {
          run.stunUntil = now
          toast('알람 소리에 벌떡! 다시 출발', 'good')
        } else if (ring > 0 && run.appSet) {
          toast('제한 시간이 지나 링아웃이 다시 울려요! 정신이 번쩍, 잠깐 빨라져요', 'info')
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
          const pending = run.pendingBike
          run.rideKind = BIKES.find((bike) => bike.id === pending)?.kind ?? 'bike'
          const ride = RIDES[run.rideKind]
          run.rideUntil = now + ride.seconds * 1000
          audio.effect('go')
          toast(`${ride.icon} ${ride.name} 출발! ${ride.seconds}초 동안 쌩쌩${ride.ram ? ' · 사람을 치면 기절!' : ''}`, 'good')
        } else if (bikes[run.pendingBike] !== myId) {
          toast('앗, 다른 사람이 먼저 탔어요', 'info')
        }
        run.pendingBike = null
      }
      const wasRiding = run.rideUntil > 0
      const riding = now < run.rideUntil
      if (wasRiding && !riding) {
        run.rideUntil = 0
        toast(`${RIDES[run.rideKind].name}에서 내렸어요. 다시 걸어요`, 'info')
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
      if (kicked && !stunned && !riding && tryPunch(p.x, p.z, heading.current, true)) run.kickUntil = now + 400

      // 물풍선에 갇혔으면 스페이스를 연타해 빨리 빠져나온다.
      if (pressed && stunned && stunAnim.current === 'trapped') run.stunUntil -= BALLOON_ESCAPE_MS

      const special = specialAt(p.z)
      if (special && !specialTold.current) {
        specialTold.current = true
        toast(
          {
            storm: '⚡ 바닥의 그림자에 번개가 떨어져요! 💨 돌풍이 불면 옆으로 밀려요',
            acorns: '🌰 도토리가 굴러와요! 점프(2단 점프)로 넘고, 🍂 낙엽 더미를 밟으면 폴짝!',
            ice: '🧊 얼음판이에요! 쭈욱 미끄러져요. 🚜 제설차에 밀리지 않게 조심',
          }[special],
          'info',
        )
      }
      const icy = activeMap.theme.icy === true
      const puddle = PUDDLES.some((circle) => Math.hypot(p.x - circle.x, p.z - circle.z) < circle.r * 0.9)
      if (puddle && !inPuddle.current) audio.effect('splash')
      inPuddle.current = puddle
      // 따릉이, 부스터, 알람 부스트는 겹치지 않고 가장 빠른 쪽을 쓴다. 따릉이는 웅덩이에서도 느려지지 않는다.
      const giant = myId !== null && connection.isGiant(myId)
      const ghost = myId !== null && connection.isGhost(myId)
      const factor =
        Math.max(riding ? RIDES[run.rideKind].factor : 1, now < run.dashUntil ? DASH_FACTOR : 1, run.catchup ? CATCHUP_FACTOR : 1, now < run.boostUntil ? BOOST_FACTOR : 1, now < run.boosterUntil ? BOOSTER_FACTOR : 1, giant ? GIANT_FACTOR : 1) *
        (now < run.slowUntil ? SNAIL_FACTOR : 1)
      // 얼어붙은 웅덩이와 호수는 느려지는 대신 미끄러진다.
      const slowed = puddle && !icy && !riding && jump.current.y === 0
      const slippery = (special === 'ice' || (icy && puddle)) && jump.current.y === 0
      const speed = stunned || overlay.open || run.shortcut ? 0 : WALK_SPEED * factor * (slowed ? PUDDLE_FACTOR : 1)
      const move = moveVector()
      const blend = 1 - Math.exp(-delta * (slippery ? ICE_GRIP : 12))
      velocity.current.x += (move.x * speed - velocity.current.x) * blend
      velocity.current.y += (-move.y * speed - velocity.current.y) * blend
      // 대왕 미끄럼틀: 위에서는 저절로 쭉 미끄러져 내려가고, 옆으로만 움직일 수 있다.
      const sliding = onSlide(p.z) && !stunned
      if (sliding) {
        velocity.current.x += (move.x * SLIDE_STEER - velocity.current.x) * (1 - Math.exp(-delta * 8))
        velocity.current.y += (-SLIDE_SPEED - velocity.current.y) * (1 - Math.exp(-delta * 6))
        if (!run.sliding) {
          audio.effect('ultimate')
          shake(0.25, 300)
          if (!slideTold.current) {
            slideTold.current = true
            toast('🛝 대왕 미끄럼틀! 슈우우웅~ 좌우로만 움직일 수 있어요', 'good')
          }
        }
      } else if (run.sliding) {
        audio.effect('boom')
        shake(0.35, 250)
      }
      run.sliding = sliding
      p.x += velocity.current.x * delta
      p.z += velocity.current.y * delta
      if (now < knock.current.until) {
        p.x += knock.current.x * delta
        p.z += knock.current.z * delta
      }
      // 돌풍은 기절해 있어도, 따릉이를 타고 있어도 옆으로 민다.
      if (special === 'storm') {
        const gust = gustAt(t)
        p.x += gust.dir * gust.strength * GUST_SPEED * delta
      }
      // 낙엽 더미를 밟으면 높이 튀어 오른다. 공중에서 한 번 더 뛸 수 있다.
      if (special === 'acorns' && jump.current.y === 0 && !stunned && LEAF_PILES.some((pile) => Math.hypot(pile.x - p.x, pile.z - p.z) < pile.r)) {
        jump.current.speed = LEAF_BOUNCE_SPEED
        jump.current.count = 1
        audio.effect('pop')
      }

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
          jump.current.count = 1
          audio.effect('jump')
        } else if (jump.current.count < MAX_JUMPS) {
          // 2단 점프: 공중에서 한 번 더 뛴다.
          jump.current.speed = DOUBLE_JUMP_SPEED
          jump.current.count += 1
          audio.effect('jump')
        }
      }
      if (jump.current.y > 0 || jump.current.speed > 0) {
        jump.current.speed -= GRAVITY * delta
        jump.current.y = Math.max(0, jump.current.y + jump.current.speed * delta)
        if (jump.current.y === 0) {
          jump.current.speed = 0
          jump.current.count = 0
        }
      }
      // 계단과 미끄럼틀 위에서는 그 높이만큼 떠 있다.
      p.y = groundAt(p.z) + jump.current.y

      if (!run.appSet && prev.z > -13.9 && p.z <= -13.9) toast('📱 먼저 책상 위 휴대폰으로 링아웃 목적지를 정해요', 'info')
      confine(p, prev, !run.appSet)
      // 유령은 화분, 스크린도어, 스핑크스 벽을 그냥 통과한다.
      if (!ghost) {
        for (const prop of PROPS) pushOutOfCircle(p, prop)
        for (const wall of subwayWalls(t)) pushOutOfBox(p, wall)
        for (const wall of quizWalls()) pushOutOfBox(p, wall)
      }
      quizStep(prev, p, now)
      shortcutStep(p, now, t, stunned)
      padStep(p, now, stunned)
      rankStep(p, now)
      // 제설차는 벽처럼 밀고 지나간다.
      for (const plow of plowsAt(t)) {
        if (!circleHitsBox(p.x, p.z, BODY_RADIUS, plow)) continue
        pushOutOfBox(p, plow)
        if (!plowTold.current) {
          plowTold.current = true
          toast('🚜 제설차에 밀려요! 앞이나 뒤로 피하세요', 'info')
        }
      }

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

      // 차를 타고 있으면 부딪힌 사람을 들이받는다. 맞았는지는 서버가 정해 알려 준다.
      const ram = riding ? RIDES[run.rideKind].ram : null
      // 거인과 부딪히면 튕겨 나간다. 거인끼리는 괜찮다.
      for (const other of rivals()) {
        const distance = Math.hypot(other.position.x - p.x, other.position.z - p.z)
        if (ram && distance < ram.radius && now - (lastBump.current.get(other.id) ?? 0) > 1500) {
          lastBump.current.set(other.id, now)
          connection.send({ t: 'ram', target: other.id })
        }
        if (!giant && connection.isGiant(other.id) && distance < GIANT_BUMP && now - (lastBump.current.get(-other.id) ?? 0) > 1500) {
          lastBump.current.set(-other.id, now)
          if (areaStun('down', 1, `🍄 거인 ${nicknameOf(other.id)}님에게 튕겨 나갔어요!`)) pushAway(other.position, 5)
        }
      }

      // 폭탄은 떨어진 뒤 터지고, 회오리는 앞으로 나아가며 닿는 사람을 휘감는다.
      for (const area of areas.current) {
        if (area.done) continue
        const elapsed = (now - area.at) / 1000
        if (area.kind === 'bomb') {
          if (elapsed < BOMB_FUSE_SECONDS) continue
          area.done = true
          if (Math.hypot(p.x - area.x, p.z - area.z) < BOMB_RADIUS && areaStun('down', BOMB_STUN_SECONDS, `💣 ${nicknameOf(area.from)}님의 폭탄이 펑!`)) pushAway(area, 6)
        } else {
          if (elapsed > TORNADO_SECONDS) {
            area.done = true
            continue
          }
          const spot = tornadoAt(elapsed, area)
          if (Math.hypot(p.x - spot.x, p.z - spot.z) < TORNADO_RADIUS) {
            area.done = true
            areaStun('ufo', TORNADO_STUN_SECONDS, `🌪️ ${nicknameOf(area.from)}님의 회오리에 휘말렸어요!`)
          }
        }
      }
      areas.current = areas.current.filter((area) => !area.done)

      if (!stunned && !ghost && now >= immuneUntil.current) {
        const car = vehiclesAt(t).find((vehicle) => circleHitsBox(p.x, p.z, BODY_RADIUS, vehicle))
        const hurdle = HURDLE_ZS.find((z) => Math.abs(p.z - z) < HURDLE_HALF_DEPTH + BODY_RADIUS && p.y < HURDLE_HEIGHT)
        const moving = velocity.current.length() > 1
        const caught = p.z <= LIGHT_ZONE.from && p.z >= LIGHT_ZONE.to && moving && lightAt(t) === 'red' && lightAt(t - LIGHT_GRACE) === 'red'
        const strike = special === 'storm' ? lightningAt(t).find((bolt) => bolt.striking && Math.hypot(bolt.x - p.x, bolt.z - p.z) < LIGHTNING_RADIUS) : undefined
        const acorn = special === 'acorns' && p.y < ACORN_CLEAR_HEIGHT ? acornsAt(t).find((item) => Math.abs(item.x - p.x) < ACORN_RADIUS + BODY_RADIUS && Math.abs(item.z - p.z) < ACORN_RADIUS + BODY_RADIUS) : undefined
        const banana = connection.getState().bananas.find((item) => !slipped.current.has(item.id) && Math.hypot(item.x - p.x, item.z - p.z) < BANANA_RADIUS + BODY_RADIUS && p.y < 0.3)
        if (car) {
          hit('car', car.kind === 'scooter' ? '킥보드랑 쾅! 잠깐 기절' : '빵빵! 차에 부딪혀 넘어졌어요', 'hit', car.z + car.hz + 1.4)
        } else if (hurdle !== undefined) {
          hit('hurdle', '허들에 걸려 꽈당! 스페이스로 뛰어넘어요', 'hit', hurdle + 1.3)
        } else if (caught) {
          hit('light', '삐익! 빨간불에 움직여서 처음으로', 'whistle', LIGHT_ZONE.from + 1.5)
        } else if (strike) {
          hit('lightning', '⚡ 번개 맞았다! 찌릿찌릿', 'hit')
        } else if (acorn) {
          hit('acorn', '🌰 도토리에 데굴데굴! 점프로 넘어요', 'stumble')
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
      else if (now < run.kickUntil) anim = 'kick'
      else if (now < run.punchUntil) anim = 'punch'
      else if (now < run.rideUntil) anim = run.rideKind === 'bike' ? 'ride' : run.rideKind
      else if (run.sliding && jump.current.y === 0) anim = 'slide'
      else if (jump.current.y > 0) anim = 'jump'
      else if (planar > 0.5) anim = 'walk'
      motion.current.speed = planar

      // 구간마다 링아웃의 모임 기능을 소개한다. 함께 달리는 이 레이스가 곧 모임이다.
      if (p.z < -110) showGuide('groupFind')
      if (p.z < -228) showGuide('group')

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
        showGuide('arrive')
        // 알람 리워드: 도착할 때마다 씨앗이 자란다.
        run.reward = growth(recordArrival().arrivals)
        setReward(run.reward)
      }
    } else {
      anim = 'cheer'
      p.y = 0
    }

    motion.current.anim = anim
    // 거인 버섯을 먹으면 몸이 커지고, 유령이면 하얀 천을 뒤집어쓴다.
    const giantNow = myId !== null && connection.isGiant(myId)
    scale.current += ((giantNow ? GIANT_SCALE : 1) - scale.current) * (1 - Math.exp(-delta * 6))
    node.scale.setScalar(scale.current)
    motion.current.ghost = myId !== null && connection.isGhost(myId)
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
      // 미끄럼틀에서는 카메라가 낮게 바짝 붙어 속도감이 난다.
      const near = run.sliding ? 0.6 : 1
      cameraGoal.set(
        node.position.x - forwardX * CAMERA_DISTANCE * scale * near,
        CAMERA_HEIGHT * scale * (run.sliding ? 0.55 : 1) + p.y * 0.6,
        node.position.z - forwardZ * CAMERA_DISTANCE * scale * near,
      )
      lookGoal.set(node.position.x + forwardX * CAMERA_LOOK, 1, node.position.z + forwardZ * CAMERA_LOOK)
      camera.position.lerp(cameraGoal, 1 - Math.exp(-delta * 5))
      camera.lookAt(lookGoal)
    }
    // 미끄럼틀을 타면 시야가 넓어지며 확 빨라 보인다.
    const perspective = camera as THREE.PerspectiveCamera
    const fov = run.sliding ? 78 : 50
    if (Math.abs(perspective.fov - fov) > 0.1) {
      perspective.fov += (fov - perspective.fov) * (1 - Math.exp(-delta * 6))
      perspective.updateProjectionMatrix()
    }
    if (run.sliding) {
      camera.position.x += (Math.random() - 0.5) * 0.06
      camera.position.y += (Math.random() - 0.5) * 0.06
    }
    // 궁극기 연출 중에는 화면이 흔들린다. 끝날수록 약해진다.
    if (now < run.shakeUntil) {
      const power = run.shakePower * Math.min(1, (run.shakeUntil - now) / 400)
      camera.position.x += (Math.random() - 0.5) * power
      camera.position.y += (Math.random() - 0.5) * power
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
