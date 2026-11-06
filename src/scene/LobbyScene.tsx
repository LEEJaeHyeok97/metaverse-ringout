import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { INTRO_BOARDS, PHONE_SCREEN } from '../data/ringout'
import { audio } from '../lib/audio'
import { shake } from '../game/run'
import { useLogoImage } from '../ui/art/RingoutLogo'
import { BRAND, COLORS, FONT } from '../lib/brand'
import { BOARD_SPOTS, gardenTile, gardenTileAt, INFO_SPOTS, LOBBY_HALF, LOBBY_OBSTACLES, MATCH_PAD, PHONE_SPOT, PLANT_REACH } from '../game/lobby'
import { inRedLightField, RL_FIELD, RL_GRACE_MS, RL_MOVE_TOLERANCE, RL_OUT_MS, shieldedFromTagger } from '../game/redlight'
import { RedLightField, rlSelf } from './RedLight'
import { DOUBLE_JUMP_SPEED, GRAVITY, JUMP_SPEED, KICK_PUSH, KICK_PUSH_SECONDS, KICK_STUN_SECONDS, MAX_JUMPS, PUNCH_STUN_SECONDS, pushOutOfCircle } from '../game/course'
import { nicknameOf, tryPunch } from './combat'
import { PunchEffects } from './PunchEffects'
import { connection, useConnection } from '../net/connection'
import { animIndex, type Anim, type PlayerInfo } from '../net/protocol'
import { FloorRing, Lights, Tree, useFollowCamera, useGridTexture } from './common'
import { Ink } from './ink'
import { input, moveVector, overlay, self } from './input'
import { Label } from './Label'
import { NameAndBubble, RemotePlayers } from './Players'
import { CompanionSeed } from './Seed'
import { StickFigure, type Motion } from './StickFigure'
import { companionStage, currentGarden, plantableCount, useGarden } from '../data/garden'
import { GardenPlot } from './Garden'
import { useCanvasTexture } from './useCanvasTexture'

const LOBBY_SPEED = 7
const SEND_INTERVAL = 1 / 15

function PhoneScreen() {
  const logo = useLogoImage()
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = COLORS.ink
    ctx.textAlign = 'center'
    if (logo) ctx.drawImage(logo, w / 2 - 158, 42, 96, 96)
    ctx.font = `bold 64px ${FONT}`
    ctx.fillText(BRAND.english, w / 2 + 50, 112)
    ctx.fillStyle = COLORS.accent
    ctx.font = `bold 190px ${FONT}`
    ctx.fillText(PHONE_SCREEN.time, w / 2, 360)
    ctx.fillStyle = COLORS.ink
    ctx.font = `bold 58px ${FONT}`
    ctx.fillText(`📍 ${PHONE_SCREEN.destination}`, w / 2, 490)
    ctx.font = `46px ${FONT}`
    ctx.fillText(PHONE_SCREEN.caption, w / 2, 570)
    ctx.strokeStyle = COLORS.ink
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.roundRect(w / 2 - 170, 680, 340, 110, 55)
    ctx.stroke()
    ctx.font = `bold 52px ${FONT}`
    ctx.fillText('끄면 도착 미션 →', w / 2, 755, 320)
    ctx.font = `40px ${FONT}`
    ctx.fillStyle = COLORS.pencil
    ctx.fillText('가까이 가서 스페이스', w / 2, 900)
  }, [logo])
  const texture = useCanvasTexture(draw, 560, 1000)
  return (
    <mesh position={[0, 0, 0.27]}>
      <planeGeometry args={[2.3, 4.1]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  )
}

/** 광장 가운데 거대한 링아웃 휴대폰. 몇 초마다 흔들리며 소리 물결을 낸다. */
function GiantPhone({ onOpen }: { onOpen: () => void }) {
  const phone = useRef<THREE.Group>(null)
  const waves = useRef<THREE.Group>(null)
  const period = 5
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const local = t % period
    const ringing = local < 1.6
    if (phone.current) phone.current.rotation.z = ringing ? Math.sin(t * 40) * 0.06 : 0
    waves.current?.children.forEach((wave, index) => {
      const progress = ((local + index * 0.35) % 1.6) / 1.6
      wave.visible = ringing
      wave.scale.setScalar(1 + progress * 1.6)
      const material = (wave as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = 1 - progress
    })
  })
  return (
    <group position={[PHONE_SPOT.x, 0, PHONE_SPOT.z]}>
      <group
        ref={phone}
        position={[0, 3.4, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <RoundedBox args={[2.7, 5, 0.5]} radius={0.3} smoothness={4}>
          <Ink color="#ffffff" thickness={3} />
        </RoundedBox>
        <PhoneScreen />
      </group>
      <group ref={waves} position={[0, 3.4, 0]}>
        {[0, 1, 2].map((index) => (
          <mesh key={index} rotation={[0, 0, 0]}>
            <torusGeometry args={[2.4, 0.05, 6, 48]} />
            <meshBasicMaterial color={COLORS.accent} transparent />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[2.2, 2.4, 0.6, 32]} />
        <Ink color={COLORS.accentSoft} />
      </mesh>
    </group>
  )
}

function IntroBoard({ index, onOpen }: { index: number; onOpen: () => void }) {
  const board = INTRO_BOARDS[index]
  const spot = BOARD_SPOTS[index]
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number) => {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, 400)
      ctx.textAlign = 'center'
      ctx.fillStyle = index === INTRO_BOARDS.length - 1 ? COLORS.accent : COLORS.ink
      ctx.font = `bold 62px ${FONT}`
      ctx.fillText(board.title, w / 2, 90, w - 40)
      ctx.fillStyle = COLORS.ink
      ctx.font = `46px ${FONT}`
      board.lines.forEach((line, row) => ctx.fillText(line, w / 2, 190 + row * 70, w - 40))
    },
    [board, index],
  )
  const texture = useCanvasTexture(draw, 640, 400)
  return (
    <group
      position={[spot.x, 0, spot.z]}
      rotation={[0, spot.rotation, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onOpen()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} position={[x, 1, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 2, 6]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
      ))}
      <mesh position={[0, 2.6, 0]}>
        <boxGeometry args={[3.6, 2.25, 0.12]} />
        <Ink color="#ffffff" />
      </mesh>
      <mesh position={[0, 2.6, 0.07]}>
        <planeGeometry args={[3.5, 2.15]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </group>
  )
}

function MatchPad() {
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + (Math.sin(clock.elapsedTime * 3) + 1) * 0.06)
  })
  return (
    <group position={[MATCH_PAD.x, 0, MATCH_PAD.z]}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[MATCH_PAD.r, MATCH_PAD.r, 0.12, 48]} />
        <Ink color={COLORS.accentSoft} />
      </mesh>
      <mesh ref={ring} position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[MATCH_PAD.r - 0.5, MATCH_PAD.r - 0.3, 48]} />
        <meshBasicMaterial color={COLORS.accent} />
      </mesh>
      <Label text="🏃 출근 대기실 (최대 5명)" position={[0, 2.2, 0]} size={0.5} background={COLORS.accentSoft} />
    </group>
  )
}

const TREES: [number, number, number][] = [
  [-24, 0, -22], [-15, 0, -26], [15, 0, -25], [24, 0, -20], [-26, 0, 2], [26, 0, 0],
  [-25, 0, 24], [-3, 0, 28.5], [12, 0, 26], [25, 0, 22], [-6, 0, -28],
]

type LobbyProps = {
  me: PlayerInfo | null
  players: PlayerInfo[]
  onPadChange: (inside: boolean) => void
  /** 가까이 있는 게시판이나 휴대폰. 없으면 null */
  onNearInfo: (index: number | null) => void
  onOpenInfo: (index: number) => void
  nearInfo: number | null
}

/** 내 머리 위 말풍선으로 잠깐 알려 준다. */
const say = (text: string) => connection.bubbles.set(connection.getState().myId ?? -1, { text, until: performance.now() + 2200 })

/** 서버가 답하지 않으면 이 시간 뒤에 다시 심을 수 있다. */
const PLANT_WAIT_MS = 3000
const PLANT_CHEER_MS = 2200

type PlayerExtras = {
  /** 내가 서 있는 정원 타일이 바뀌면 알린다. */
  onStandingTile: (tile: number | null) => void
  /** 정원 타일 위에서 스페이스를 눌렀다. 심었으면 true */
  onPlantHere: (tile: number) => boolean
  /** 나무를 심고 만세하는 동안 */
  cheerUntil: RefObject<number>
}

function nearestInfo(x: number, z: number) {
  let best: number | null = null
  let bestDistance = Infinity
  INFO_SPOTS.forEach((spot, index) => {
    const distance = Math.hypot(spot.x - x, spot.z - z)
    if (distance < spot.reach && distance < bestDistance) {
      best = index
      bestDistance = distance
    }
  })
  return best
}

/** 내 캐릭터. 서버에 붙지 못해도 혼자 돌아다닐 수 있다. */
function LocalLobbyPlayer({ me, onPadChange, onNearInfo, onOpenInfo, onStandingTile, onPlantHere, cheerUntil }: Omit<LobbyProps, 'players' | 'nearInfo'> & PlayerExtras) {
  const group = useRef<THREE.Group>(null)
  const motion = useRef<Motion>({ anim: 'idle', speed: 0 })
  const velocity = useRef(new THREE.Vector2())
  const jump = useRef({ y: 0, speed: 0, count: 0 })
  const knock = useRef({ x: 0, z: 0, until: 0 })
  const lastAction = useRef(input.actionCount)
  const sendTimer = useRef(0)
  const onPad = useRef(false)
  const nearInfo = useRef<number | null>(null)
  const standingTile = useRef<number | null>(null)
  const lastPunch = useRef(input.punchCount)
  const lastKick = useRef(input.kickCount)
  const stunUntil = useRef(0)
  const punchUntil = useRef(0)
  const kickUntil = useRef(0)

  // 광장에서도 맞으면 잠깐 벌러덩 눕는다.
  useEffect(
    () =>
      connection.onPunch((punch) => {
        const myId = connection.getState().myId
        if (punch.from === myId) {
          audio.effect('smack')
          shake(punch.kind === 'kick' ? 0.4 : 0.25, 160)
        }
        if (punch.to !== myId) return
        shake(punch.kind === 'kick' ? 0.8 : 0.6, 350)
        const kicked = punch.kind === 'kick'
        stunUntil.current = performance.now() + (kicked ? KICK_STUN_SECONDS : PUNCH_STUN_SECONDS) * 1000
        velocity.current.set(0, 0)
        audio.effect('smack')
        const node = group.current
        const from = connection.positions.get(punch.from)
        if (node && from) {
          // 때린 사람에게서 멀어지는 쪽으로 밀려난다. 발차기는 멀리 날아간다.
          const dx = node.position.x - from.x
          const dz = node.position.z - from.z
          const length = Math.hypot(dx, dz) || 1
          const speed = (kicked ? KICK_PUSH : 1.2) / KICK_PUSH_SECONDS
          knock.current = { x: (dx / length) * speed, z: (dz / length) * speed, until: performance.now() + KICK_PUSH_SECONDS * 1000 }
        }
        connection.bubbles.set(myId, { text: kicked ? `${nicknameOf(punch.from)}님에게 차였다!` : `${nicknameOf(punch.from)}님에게 맞았다!`, until: performance.now() + 2000 })
      }),
    [],
  )

  // 무궁화 놀이터: 서버가 쏘라고 하면 쓰러졌다가 출발선 뒤로 돌아가고, 통과하면 만세한다.
  const rl = useRef({ phaseAt: -1, moved: 0, sent: false, respawnAt: 0, lastZ: 10 })
  useEffect(
    () =>
      connection.onRedLight((event) => {
        if (event.id !== connection.getState().myId) return
        const now = performance.now()
        rlSelf.playing = false
        if (event.kind === 'shot') {
          rlSelf.outAt = now
          stunUntil.current = now + RL_OUT_MS
          rl.current.respawnAt = now + RL_OUT_MS
          velocity.current.set(0, 0)
          shake(1, 700)
          say('💥 탈락… 출발선으로!')
        } else {
          rlSelf.winAt = now
          cheerUntil.current = now + 2500
          say('🎉 무궁화 통과!')
        }
      }),
    [cheerUntil],
  )

  useFollowCamera(group, { height: 10, distance: 13, look: 4 })

  /** 무궁화 놀이터 판정. 출발선을 넘어 들어오면 참가, 술래가 보는 동안 움직이면 서버에 알린다. */
  const lastPosition = useRef({ x: 0, z: 10 })
  const stepRedLight = (position: THREE.Vector3, rise: number) => {
    const now = performance.now()
    const state = rl.current
    const step = Math.hypot(position.x - lastPosition.current.x, position.z - lastPosition.current.z) + rise
    lastPosition.current = { x: position.x, z: position.z }
    // 쓰러졌다 일어나면 출발선 뒤로 돌아간다.
    if (state.respawnAt && now >= state.respawnAt) {
      state.respawnAt = 0
      position.set((Math.random() - 0.5) * RL_FIELD.half * 1.4, 0, RL_FIELD.startZ + 2.5)
      lastPosition.current = { x: position.x, z: position.z }
      state.lastZ = position.z
      return
    }
    if (state.respawnAt) return
    if (!rlSelf.playing && state.lastZ > RL_FIELD.startZ && position.z <= RL_FIELD.startZ && Math.abs(position.x) <= RL_FIELD.half) {
      rlSelf.playing = true
      say('🌺 시작! 술래가 볼 땐 멈춰요')
    }
    state.lastZ = position.z
    if (rlSelf.playing && !inRedLightField(position.x, position.z, 0.6)) rlSelf.playing = false
    const light = connection.getState().redLight
    if (light && light.at !== state.phaseAt) {
      state.phaseAt = light.at
      state.moved = 0
      state.sent = false
    }
    const others = [...connection.positions.values()]
    rlSelf.shielded = rlSelf.playing && shieldedFromTagger(position, others)
    if (!rlSelf.playing) return
    if (position.z <= RL_FIELD.finishZ) {
      rlSelf.playing = false
      connection.send({ t: 'rlWin' })
      return
    }
    if (light?.phase !== 'look' || now - light.at < RL_GRACE_MS) {
      state.moved = 0
      return
    }
    // 앞사람 뒤에 숨어 있으면 술래 눈에 안 보인다.
    if (rlSelf.shielded) {
      state.moved = 0
      return
    }
    state.moved += step
    if (state.moved > RL_MOVE_TOLERANCE && !state.sent) {
      state.sent = true
      connection.send({ t: 'rlOut' })
    }
  }

  useFrame((_, rawDelta) => {
    const node = group.current
    if (!node) return
    const delta = Math.min(rawDelta, 0.05)
    // 자세히 보기 창이 열려 있으면 제자리에 선다.
    const stunned = performance.now() < stunUntil.current
    const planting = performance.now() < cheerUntil.current
    const move = overlay.open || stunned || planting ? { x: 0, y: 0 } : moveVector()
    const blend = 1 - Math.exp(-delta * 12)
    velocity.current.x += (move.x * LOBBY_SPEED - velocity.current.x) * blend
    velocity.current.y += (-move.y * LOBBY_SPEED - velocity.current.y) * blend
    node.position.x += velocity.current.x * delta
    node.position.z += velocity.current.y * delta
    if (performance.now() < knock.current.until) {
      node.position.x += knock.current.x * delta
      node.position.z += knock.current.z * delta
    }
    for (const obstacle of LOBBY_OBSTACLES) pushOutOfCircle(node.position, obstacle)
    node.position.x = THREE.MathUtils.clamp(node.position.x, -LOBBY_HALF, LOBBY_HALF)
    node.position.z = THREE.MathUtils.clamp(node.position.z, -LOBBY_HALF, LOBBY_HALF)

    if (input.punchCount !== lastPunch.current) {
      lastPunch.current = input.punchCount
      if (!overlay.open && !stunned && tryPunch(node.position.x, node.position.z, node.rotation.y)) {
        punchUntil.current = performance.now() + 300
        rl.current.moved += 1
      }
    }
    if (input.kickCount !== lastKick.current) {
      lastKick.current = input.kickCount
      if (!overlay.open && !stunned && tryPunch(node.position.x, node.position.z, node.rotation.y, true)) {
        kickUntil.current = performance.now() + 400
        rl.current.moved += 1
      }
    }

    const near = nearestInfo(node.position.x, node.position.z)
    if (near !== nearInfo.current) {
      nearInfo.current = near
      onNearInfo(near)
    }

    const tile = gardenTileAt(node.position.x, node.position.z)
    if (tile !== standingTile.current) {
      standingTile.current = tile
      onStandingTile(tile)
    }

    if (input.actionCount !== lastAction.current) {
      lastAction.current = input.actionCount
      if (overlay.open || performance.now() < overlay.ignoreActionsUntil) {
        // 창을 여닫는 데 쓴 스페이스는 점프로 치지 않는다.
      } else if (stunned) {
        // 쓰러져 있는 동안에는 아무것도 못 한다.
      } else if (near !== null) {
        onOpenInfo(near)
      } else if (tile !== null && onPlantHere(tile)) {
        // 정원 타일 위의 스페이스는 나무 심기로 쓴다.
      } else if (jump.current.y === 0) {
        jump.current.speed = JUMP_SPEED
        jump.current.count = 1
        audio.effect('jump')
      } else if (jump.current.count < MAX_JUMPS) {
        // 2단 점프
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
    const lastY = node.position.y
    node.position.y = jump.current.y
    stepRedLight(node.position, Math.abs(node.position.y - lastY))

    const speed = velocity.current.length()
    if (speed > 0.3) {
      const heading = Math.atan2(velocity.current.x, velocity.current.y)
      let turn = heading - node.rotation.y
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      node.rotation.y += turn * (1 - Math.exp(-delta * 14))
    }
    const now = performance.now()
    const anim: Anim = now < stunUntil.current ? 'down' : now < cheerUntil.current ? 'cheer' : now < kickUntil.current ? 'kick' : now < punchUntil.current ? 'punch' : jump.current.y > 0 ? 'jump' : speed > 0.5 ? 'walk' : 'idle'
    self.x = node.position.x
    self.y = node.position.y
    self.z = node.position.z
    motion.current.anim = anim
    motion.current.speed = speed

    const inside = Math.hypot(node.position.x - MATCH_PAD.x, node.position.z - MATCH_PAD.z) < MATCH_PAD.r
    if (inside !== onPad.current) {
      onPad.current = inside
      onPadChange(inside)
    }

    sendTimer.current += delta
    if (sendTimer.current >= SEND_INTERVAL) {
      sendTimer.current = 0
      connection.send({ t: 'move', x: node.position.x, y: node.position.y, z: node.position.z, h: node.rotation.y, a: animIndex(anim) })
    }
  })

  // 한 번이라도 도착했다면 키우는 씨앗이 따라다닌다. 다 자란 나무가 있으면 나무를 이고 다닌다.
  const companion = companionStage(useGarden())
  return (
    <>
      <group ref={group} position={[0, 0, 10]} rotation={[0, Math.PI, 0]}>
        <StickFigure motion={motion} color={me?.color ?? COLORS.accent} />
        <NameAndBubble id={me?.id ?? null} nickname={me ? `${me.nickname} (나)` : '나'} color={me?.color ?? COLORS.ink} />
      </group>
      {companion && <CompanionSeed key={companion} target={group} stage={companion} />}
    </>
  )
}

export function LobbyScene({ me, players, onPadChange, onNearInfo, onOpenInfo, nearInfo }: LobbyProps) {
  const grid = useGridTexture(LOBBY_HALF, LOBBY_HALF)
  const plantable = plantableCount(useGarden())
  const shared = useConnection().garden
  const [standingTile, setStandingTile] = useState<number | null>(null)
  const cheerUntil = useRef(0)
  const waitingUntil = useRef(0)

  // 서버가 내 나무를 심어 주면 만세하고 소리를 낸다.
  useEffect(
    () =>
      connection.onPlanted(() => {
        waitingUntil.current = 0
        audio.effect('pop')
        setTimeout(() => audio.effect('arrive'), 800)
        cheerUntil.current = performance.now() + PLANT_CHEER_MS
        say('🌳 나무를 심었어요!')
      }),
    [],
  )

  /** 다 자란 나무를 함께 정원에 심어 달라고 서버에 보낸다. 너무 멀면 가까이 오라고 알려 준다. */
  const plant = useCallback((tile: number) => {
    const { status, garden } = connection.getState()
    if (plantableCount(currentGarden()) <= 0 || garden.some((tree) => tree.tile === tile)) return false
    const spot = gardenTile(tile)
    if (Math.hypot(spot.x - self.x, spot.z - self.z) > PLANT_REACH) {
      say('정원 가까이 가서 심어요!')
      return false
    }
    if (status !== 'online') {
      say('서버에 연결되면 심을 수 있어요')
      return false
    }
    if (performance.now() < waitingUntil.current) return true
    waitingUntil.current = performance.now() + PLANT_WAIT_MS
    audio.unlock()
    connection.send({ t: 'plant', tile })
    return true
  }, [])
  return (
    <>
      <color attach="background" args={[COLORS.paper]} />
      <fog attach="fog" args={[COLORS.paper, 40, 80]} />
      <Lights />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LOBBY_HALF * 2 + 40, LOBBY_HALF * 2 + 40]} />
        <meshBasicMaterial map={grid} />
      </mesh>
      <FloorRing radius={LOBBY_HALF - 1} />
      <RedLightField />
      <Label text={`${BRAND.name} 월드`} position={[0, 9.4, PHONE_SPOT.z - 1]} size={1.1} color={COLORS.accent} />
      <Label text={BRAND.slogan} position={[0, 8.4, PHONE_SPOT.z - 1]} size={0.5} background={null} />
      <GiantPhone onOpen={() => onOpenInfo(INFO_SPOTS.length - 1)} />
      {nearInfo !== null && (
        <Label
          text="스페이스 ▶ 자세히 보기"
          position={[INFO_SPOTS[nearInfo].x, nearInfo === INFO_SPOTS.length - 1 ? 6.6 : 4.4, INFO_SPOTS[nearInfo].z]}
          size={0.45}
          background={COLORS.accentSoft}
        />
      )}
      {INTRO_BOARDS.map((_, index) => (
        <IntroBoard key={index} index={index} onOpen={() => onOpenInfo(index)} />
      ))}
      <MatchPad />
      <GardenPlot planted={shared} myName={me?.nickname ?? null} plantable={plantable} standingTile={standingTile} onPlant={plant} />
      {TREES.map((position, index) => (
        <Tree key={index} position={position} scale={0.9 + (index % 3) * 0.15} />
      ))}
      <LocalLobbyPlayer
        me={me}
        onPadChange={onPadChange}
        onNearInfo={onNearInfo}
        onOpenInfo={onOpenInfo}
        onStandingTile={setStandingTile}
        onPlantHere={plant}
        cheerUntil={cheerUntil}
      />
      <RemotePlayers players={players} myId={me?.id ?? null} />
      <PunchEffects />
    </>
  )
}
