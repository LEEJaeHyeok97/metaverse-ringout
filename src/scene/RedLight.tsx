import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RL_FIELD, RL_GUARDS, RL_OUT_MS, RL_SYLLABLES, RL_TAGGER } from '../game/redlight'
import { audio } from '../lib/audio'
import { COLORS } from '../lib/brand'
import { connection, useConnection, type RedLightEvent } from '../net/connection'
import { nicknameOf } from './combat'
import { Ink, penMaterial } from './ink'
import { Label } from './Label'
import { self } from './input'

/**
 * 내 캐릭터의 무궁화 놀이터 상태. LobbyScene이 매 프레임 바꾸고, HUD가 읽는다.
 * playing: 출발선을 넘어 들어와 술래에게 걸릴 수 있는 중. shielded: 앞사람 뒤에 숨어 있다.
 */
export const rlSelf = { playing: false, shielded: false, outAt: 0, winAt: 0 }

const SKIN = '#FFE2C6'
const HAIR = '#3B2A22'
const DRESS = COLORS.accent
const PINK = '#FF5FA2'
const PINK_DARK = '#D93D82'
/** 술래 인형 크기. 출발선에서 머리까지 화면에 들어오게 한다. */
const DOLL_SCALE = 0.66
const LABEL_Y = 8.6 * DOLL_SCALE

/** 이 사람의 지금 자리(나 또는 다른 사람). 모르면 null */
function spotOf(id: number) {
  if (id === connection.getState().myId) return self
  return connection.positions.get(id) ?? null
}

const nearTagger = () => Math.hypot(self.x - RL_TAGGER.x, self.z - RL_TAGGER.z) < 34

/** 지금 화면에 보여 줄 총격들(맞은 사람과 시각) */
const volleys: RedLightEvent[] = []
const VOLLEY_MS = 1100

function activeVolleys(now: number) {
  while (volleys.length && now - volleys[0].at > RL_OUT_MS) volleys.shift()
  return volleys.filter((volley) => now - volley.at < VOLLEY_MS)
}

/** 바닥: 모래색 놀이터, 출발선, 도착선, 옆 줄 */
function Field() {
  const length = RL_FIELD.startZ - RL_FIELD.finishZ
  const middle = (RL_FIELD.startZ + RL_FIELD.finishZ) / 2
  const width = RL_FIELD.half * 2
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, middle]}>
        <planeGeometry args={[width, length]} />
        <meshBasicMaterial color="#F3DFB6" />
      </mesh>
      {/* 출발선: 흰 줄 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, RL_FIELD.startZ]}>
        <planeGeometry args={[width, 0.45]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* 도착선: 빨강·하양 체크 */}
      {Array.from({ length: 16 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-RL_FIELD.half + (i + 0.5) * (width / 16), 0.03, RL_FIELD.finishZ]}>
          <planeGeometry args={[width / 16, 0.6]} />
          <meshBasicMaterial color={i % 2 ? '#ffffff' : '#F0473C'} />
        </mesh>
      ))}
      {/* 옆 줄과 모서리 기둥 */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[side * RL_FIELD.half, 0.03, middle]}>
            <planeGeometry args={[0.15, length]} />
            <meshBasicMaterial color={PINK} />
          </mesh>
          {[RL_FIELD.startZ, RL_FIELD.finishZ].map((z) => (
            <mesh key={z} position={[side * RL_FIELD.half, 0.6, z]}>
              <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
              <Ink color={PINK} thickness={1.4} />
            </mesh>
          ))}
        </group>
      ))}
      <Label text="출발선" position={[-RL_FIELD.half + 1.3, 0.7, RL_FIELD.startZ + 0.4]} size={0.34} color={PINK_DARK} background="#FFF0F6" />
      <Label text="🏁 도착선" position={[RL_FIELD.half - 1.6, 1.2, RL_FIELD.finishZ]} size={0.38} color="#F0473C" />
    </group>
  )
}

/**
 * 거대한 술래 인형. 링아웃 주황 원피스에 단발머리, 머리엔 알람시계 종 머리핀을 꽂았다.
 * 외칠 때는 등을 돌리고, 돌아보면 눈이 빨갛게 빛나며 탐지 빛이 놀이터를 훑는다.
 */
function TaggerDoll() {
  const { redLight } = useConnection()
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const beams = useRef<THREE.Group>(null)
  const eyes = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const spoken = useRef({ at: -1, count: 0 })
  const [shown, setShown] = useState(0)

  useFrame(({ clock }, delta) => {
    const now = performance.now()
    const looking = redLight?.phase === 'look'
    // 몸은 천천히, 머리는 먼저 휙 돈다.
    const facing = looking ? 0 : Math.PI
    if (root.current) root.current.rotation.y = THREE.MathUtils.damp(root.current.rotation.y, facing, 5, delta)
    if (head.current) head.current.rotation.y = THREE.MathUtils.damp(head.current.rotation.y, facing - (root.current?.rotation.y ?? 0), 14, delta)
    if (beams.current) {
      beams.current.visible = looking
      beams.current.rotation.y = Math.sin(clock.elapsedTime * 1.6) * 0.45
    }
    for (const eye of eyes.current) eye?.color.set(looking ? (Math.sin(clock.elapsedTime * 20) > 0 ? '#FF2020' : '#FF7A7A') : COLORS.ink)
    // 외치는 글자: 서버가 준 박자대로 하나씩 나온다.
    if (!redLight) return
    if (spoken.current.at !== redLight.at) {
      spoken.current = { at: redLight.at, count: 0 }
      if (redLight.phase === 'look' && nearTagger()) audio.effect('spotted')
    }
    let count = 0
    if (redLight.phase === 'chant') count = redLight.beats.filter((beat) => now - redLight.at >= beat).length
    else count = redLight.phase === 'turn' ? 0 : RL_SYLLABLES.length
    if (redLight.phase === 'chant' && count > spoken.current.count) {
      if (nearTagger()) audio.syllable(count - 1)
      spoken.current.count = count
    }
    if (count !== shown) setShown(count)
  })

  const phase = redLight?.phase
  const words = RL_SYLLABLES.slice(0, shown)
  // "무궁화 꽃이 피었습니다"처럼 띄어 쓴다.
  const text = words.map((word, i) => (i === 3 || i === 5 ? ` ${word}` : word)).join('')
  return (
    <group position={[RL_TAGGER.x, 0, RL_TAGGER.z]}>
      <group ref={root} scale={DOLL_SCALE}>
        {/* 구두와 다리 */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.55, 0.25, 0.15]}>
              <boxGeometry args={[0.6, 0.5, 1]} />
              <Ink color={COLORS.ink} thickness={1.6} />
            </mesh>
            <mesh position={[side * 0.55, 1.3, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 1.8, 12]} />
              <Ink color="#ffffff" thickness={1.8} />
            </mesh>
          </group>
        ))}
        {/* 원피스: 링아웃 주황 치마와 흰 앞치마 띠 */}
        <mesh position={[0, 3.3, 0]}>
          <cylinderGeometry args={[0.9, 2.1, 2.8, 24]} />
          <Ink color={DRESS} thickness={3} />
        </mesh>
        <mesh position={[0, 2.3, 0]}>
          <cylinderGeometry args={[1.78, 1.86, 0.3, 24]} />
          <Ink color="#ffffff" thickness={1.6} />
        </mesh>
        <mesh position={[0, 5, 0]}>
          <cylinderGeometry args={[0.85, 0.95, 1, 18]} />
          <Ink color={DRESS} thickness={2.4} />
        </mesh>
        {/* 흰 깃 */}
        <mesh position={[0, 5.5, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[1.05, 1.05, 0.18, 20]} />
          <Ink color="#ffffff" thickness={1.6} />
        </mesh>
        {/* 팔 */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 1.15, 4.3, 0]} rotation={[0, 0, side * 0.18]}>
            <cylinderGeometry args={[0.22, 0.26, 2.2, 10]} />
            <Ink color={SKIN} thickness={1.6} />
          </mesh>
        ))}
        {/* 머리: 얼굴은 +z 쪽 */}
        <group ref={head} position={[0, 6.9, 0]}>
          <mesh>
            <sphereGeometry args={[1.45, 32, 24]} />
            <Ink color={SKIN} thickness={3} />
          </mesh>
          {/* 단발머리: 뒤통수를 덮고 앞머리를 내렸다 */}
          <mesh position={[0, 0.15, -0.18]} scale={[1.08, 1.05, 1.05]}>
            <sphereGeometry args={[1.45, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
            <Ink color={HAIR} thickness={2.4} />
          </mesh>
          <mesh position={[0, 0.15, -0.25]} rotation={[Math.PI, 0, 0]} scale={[1.08, 0.9, 1.05]}>
            <sphereGeometry args={[1.45, 32, 12, Math.PI * 0.9, Math.PI * 1.2, 0, Math.PI * 0.42]} />
            <Ink color={HAIR} thickness={2.4} />
          </mesh>
          <mesh position={[0, 0.95, 1.05]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[1.9, 0.35, 0.3]} />
            <Ink color={HAIR} thickness={1.6} />
          </mesh>
          {/* 알람시계 종 머리핀 */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.95, 1.25, 0.1]} rotation={[0, 0, side * -0.5]}>
              <sphereGeometry args={[0.38, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <Ink color="#FFC93C" thickness={2} />
            </mesh>
          ))}
          {/* 얼굴: 큰 눈, 볼터치, 작은 입 */}
          {[-1, 1].map((side) => (
            <group key={side} position={[side * 0.5, 0.15, 1.33]}>
              <mesh>
                <sphereGeometry args={[0.24, 16, 12]} />
                <meshBasicMaterial
                  ref={(material) => {
                    eyes.current[side === -1 ? 0 : 1] = material
                  }}
                  color={COLORS.ink}
                />
              </mesh>
              <mesh position={[0.07, 0.08, 0.18]}>
                <sphereGeometry args={[0.07, 8, 8]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[side * 0.25, -0.38, -0.05]}>
                <sphereGeometry args={[0.17, 10, 8]} />
                <meshBasicMaterial color="#FFB0C4" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, -0.5, 1.35]} material={penMaterial}>
            <boxGeometry args={[0.32, 0.06, 0.06]} />
          </mesh>
          {/* 돌아보면 두 눈에서 붉은 탐지 빛이 나와 놀이터를 훑는다. */}
          <group ref={beams} position={[0, 0.15, 1.3]} rotation={[0.28, 0, 0]} visible={false}>
            {[-0.5, 0.5].map((x) => (
              <mesh key={x} position={[x, 0, 13]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[2.4, 26, 20, 1, true]} />
                <meshBasicMaterial color="#FF3030" transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
      {/* 외치는 말과 이번 박자 */}
      {phase === 'look' ? (
        <Label text="🚨 멈춰!!" position={[0, LABEL_Y, 0]} size={0.8} color="#F0473C" background="#FFF6C9" />
      ) : phase === 'turn' ? (
        <Label text="……?" position={[0, LABEL_Y, 0]} size={0.8} />
      ) : (
        <Label text={text ? `${text}${shown === RL_SYLLABLES.length ? '!' : '~'}` : '🌺 …'} position={[0, LABEL_Y, 0]} size={0.8} color={PINK_DARK} background="#FFF0F6" />
      )}
    </group>
  )
}

const TRACERS = 3
const tracerGeometry = new THREE.BoxGeometry(0.07, 0.07, 1.4)
const tracerMaterial = new THREE.MeshBasicMaterial({ color: '#FFE45C' })
const tracerPinkMaterial = new THREE.MeshBasicMaterial({ color: '#FF8AC4' })
const muzzle = new THREE.Vector3()
const aim = new THREE.Vector3()

/**
 * 핑크 경비대 한 명. 분홍 작업복에 까만 헬멧과 고글. 평소엔 놀이터를 지켜보다가
 * 누가 걸리면 그쪽으로 총구를 돌려 다다다 쏜다.
 */
function Guard({ x, z, index }: { x: number; z: number; index: number }) {
  const body = useRef<THREE.Group>(null)
  const arms = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const tracers = useRef<(THREE.Mesh | null)[]>([])
  const rest = Math.atan2(-x, (RL_FIELD.startZ + RL_FIELD.finishZ) / 2 - z)

  useFrame((_, delta) => {
    const node = body.current
    if (!node) return
    const now = performance.now()
    const active = activeVolleys(now)
    const volley = active.length ? active[index % active.length] : null
    const target = volley ? spotOf(volley.id) : null
    const heading = target ? Math.atan2(target.x - x, target.z - z) : rest
    let turn = heading - node.rotation.y
    turn = Math.atan2(Math.sin(turn), Math.cos(turn))
    node.rotation.y += turn * (1 - Math.exp(-delta * (target ? 25 : 4)))
    if (arms.current) arms.current.rotation.x = THREE.MathUtils.damp(arms.current.rotation.x, target ? -1.45 : -0.5, 18, delta)
    const elapsed = volley ? now - volley.at : Infinity
    const firing = target !== null && elapsed > 120 && elapsed < VOLLEY_MS - 100
    if (flash.current) {
      flash.current.visible = firing && (now + index * 37) % 90 < 40
      flash.current.scale.setScalar(0.7 + Math.random() * 0.8)
    }
    // 총알: 총구에서 맞은 사람까지 노랑·분홍 줄이 쉴 새 없이 날아간다.
    if (firing && target && flash.current) flash.current.getWorldPosition(muzzle)
    tracers.current.forEach((tracer, i) => {
      if (!tracer) return
      tracer.visible = firing
      if (!firing || !target) return
      aim.set(target.x + Math.sin(i * 7 + index) * 0.3, (target.y ?? 0) + 0.8 + Math.cos(i * 5) * 0.3, target.z)
      const f = ((now / 1000 + i / TRACERS + index * 0.13) % 0.16) / 0.16
      tracer.position.lerpVectors(muzzle, aim, f)
      tracer.lookAt(aim)
    })
  })

  return (
    <>
      <group ref={body} position={[x, 0, z]} rotation={[0, rest, 0]}>
        {/* 다리와 몸통: 분홍 작업복 */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * 0.18, 0.45, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.9, 8]} />
            <Ink color={PINK} thickness={1.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.32, 0.12, 0.3]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
        <mesh position={[0, 1.3, 0]}>
          <capsuleGeometry args={[0.3, 0.55, 4, 12]} />
          <Ink color={PINK} thickness={1.8} />
        </mesh>
        {/* 머리: 까만 헬멧과 고글 */}
        <mesh position={[0, 2.05, 0]}>
          <sphereGeometry args={[0.28, 16, 12]} />
          <Ink color={PINK} thickness={1.6} />
        </mesh>
        <mesh position={[0, 2.12, 0]}>
          <sphereGeometry args={[0.31, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <Ink color={COLORS.ink} thickness={1.2} />
        </mesh>
        <mesh position={[0, 2.03, 0.22]}>
          <boxGeometry args={[0.42, 0.12, 0.1]} />
          <meshBasicMaterial color="#2A2A2A" />
        </mesh>
        {/* 팔과 총. 평소엔 비스듬히 들고, 쏠 때는 앞으로 겨눈다. */}
        <group ref={arms} position={[0, 1.6, 0.1]} rotation={[-0.5, 0, 0]}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.25, -0.3, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.6, 6]} />
              <Ink color={PINK} thickness={1.2} />
            </mesh>
          ))}
          <mesh position={[0, -0.6, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.16, 0.9, 0.22]} />
            <meshBasicMaterial color="#222222" />
          </mesh>
          <mesh ref={flash} position={[0, -0.6, 0.7]} visible={false}>
            <sphereGeometry args={[0.22, 10, 8]} />
            <meshBasicMaterial color="#FFF27A" />
          </mesh>
        </group>
      </group>
      {Array.from({ length: TRACERS }, (_, i) => (
        <mesh
          key={i}
          geometry={tracerGeometry}
          material={i % 2 ? tracerPinkMaterial : tracerMaterial}
          visible={false}
          ref={(mesh) => {
            tracers.current[i] = mesh
          }}
        />
      ))}
    </>
  )
}

const splatGeometry = new THREE.CircleGeometry(1, 16)
const sparkGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.45)

/** 맞은 자리: 번쩍이는 섬광, 사방으로 튀는 불꽃, 바닥에 번지는 분홍 물감, "탈락!" 글자 */
function Hit({ event, onDone }: { event: RedLightEvent; onDone: () => void }) {
  const group = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const sparks = useRef<(THREE.Mesh | null)[]>([])
  const splats = useRef<THREE.Group>(null)
  const spot = useRef({ x: 0, y: 0, z: 0 })
  const look = useMemo(
    () => ({
      sparks: Array.from({ length: 16 }, () => ({ angle: Math.random() * Math.PI * 2, up: 0.4 + Math.random() * 1.8, speed: 4 + Math.random() * 5, delay: Math.random() * 0.7 })),
      splats: Array.from({ length: 7 }, () => ({ x: (Math.random() - 0.5) * 2.6, z: (Math.random() - 0.5) * 2.6, size: 0.3 + Math.random() * 0.6 })),
    }),
    [],
  )
  useFrame(() => {
    const node = group.current
    if (!node) return
    const elapsed = (performance.now() - event.at) / 1000
    if (elapsed * 1000 > RL_OUT_MS) {
      onDone()
      return
    }
    // 쓰러질 때까지는 맞은 사람을 따라간다.
    const target = spotOf(event.id)
    if (target && elapsed < 1.2) spot.current = { x: target.x, y: target.y ?? 0, z: target.z }
    node.position.set(spot.current.x, 0, spot.current.z)
    if (flash.current) {
      const pulse = elapsed < VOLLEY_MS / 1000 ? 0.6 + Math.abs(Math.sin(elapsed * 40)) * 0.8 : Math.max(0, 1.4 - (elapsed - VOLLEY_MS / 1000) * 3)
      flash.current.scale.setScalar(pulse)
      flash.current.visible = pulse > 0.05
    }
    sparks.current.forEach((spark, i) => {
      if (!spark) return
      const d = look.sparks[i]
      const s = (elapsed - d.delay * 0.2) % 0.5
      spark.visible = elapsed < VOLLEY_MS / 1000 + 0.3 && s > 0
      const travel = d.speed * s
      spark.position.set(Math.cos(d.angle) * travel, 1 + d.up * travel - 6 * s * s, Math.sin(d.angle) * travel)
      spark.lookAt(spark.position.x * 2, spark.position.y * 2, spark.position.z * 2)
    })
    splats.current?.children.forEach((splat, i) => {
      const grow = THREE.MathUtils.clamp((elapsed - 0.2 - i * 0.08) * 4, 0, 1)
      splat.scale.setScalar(look.splats[i].size * grow + 0.001)
    })
  })
  return (
    <group ref={group}>
      <mesh ref={flash} position={[0, 1, 0]}>
        <sphereGeometry args={[0.9, 16, 12]} />
        <meshBasicMaterial color="#FFF6A0" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {look.sparks.map((_, i) => (
        <mesh
          key={i}
          geometry={sparkGeometry}
          ref={(mesh) => {
            sparks.current[i] = mesh
          }}
        >
          <meshBasicMaterial color={i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#FF5FA2' : '#FFD84D'} />
        </mesh>
      ))}
      <group ref={splats}>
        {look.splats.map((splat, i) => (
          <mesh key={i} geometry={splatGeometry} position={[splat.x, 0.04 + i * 0.002, splat.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color={i % 2 ? PINK : PINK_DARK} />
          </mesh>
        ))}
      </group>
      <Label text={`💥 ${nicknameOf(event.id)} 탈락!`} position={[0, 3.2, 0]} size={0.6} color="#F0473C" background="#FFF6C9" />
    </group>
  )
}

const confettiGeometry = new THREE.PlaneGeometry(0.22, 0.14)
const CONFETTI = ['#FF5FA2', '#FFD84D', '#8FD3FF', '#C7F0BD', '#FF9A3C', '#E3C8FF']

/** 통과한 사람 머리 위로 꽃가루가 터진다. */
function Win({ event, onDone }: { event: RedLightEvent; onDone: () => void }) {
  const group = useRef<THREE.Group>(null)
  const pieces = useRef<(THREE.Mesh | null)[]>([])
  const look = useMemo(() => Array.from({ length: 40 }, () => ({ angle: Math.random() * Math.PI * 2, speed: 2 + Math.random() * 4, up: 5 + Math.random() * 5, spin: Math.random() * 10 })), [])
  const start = useMemo(() => {
    const target = spotOf(event.id)
    return { x: target?.x ?? 0, z: target?.z ?? RL_FIELD.finishZ }
  }, [event.id])
  useFrame(() => {
    const s = (performance.now() - event.at) / 1000
    if (s > 3) {
      onDone()
      return
    }
    pieces.current.forEach((piece, i) => {
      if (!piece) return
      const d = look[i]
      piece.position.set(Math.cos(d.angle) * d.speed * s, Math.max(0.05, 2 + d.up * s - 5 * s * s), Math.sin(d.angle) * d.speed * s)
      piece.rotation.set(s * d.spin, s * d.spin * 0.7, 0)
    })
  })
  return (
    <group ref={group} position={[start.x, 0, start.z]}>
      {look.map((_, i) => (
        <mesh
          key={i}
          geometry={confettiGeometry}
          ref={(mesh) => {
            pieces.current[i] = mesh
          }}
        >
          <meshBasicMaterial color={CONFETTI[i % CONFETTI.length]} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <Label text={`🎉 ${nicknameOf(event.id)} 통과!`} position={[0, 3.4, 0]} size={0.65} color={COLORS.accent} background="#FFF6C9" />
    </group>
  )
}

/** 광장 가운데의 무궁화 놀이터 전체: 바닥, 술래 인형, 핑크 경비대, 총격과 통과 연출 */
export function RedLightField() {
  const [events, setEvents] = useState<(RedLightEvent & { key: number })[]>([])
  useEffect(() => {
    let key = 0
    return connection.onRedLight((event) => {
      if (event.kind === 'shot') {
        volleys.push(event)
        if (nearTagger()) audio.effect('gunfire')
      } else if (nearTagger()) audio.effect('cleared')
      setEvents((list) => [...list.slice(-8), { ...event, key: key++ }])
    })
  }, [])
  const remove = (key: number) => setEvents((list) => list.filter((item) => item.key !== key))
  return (
    <>
      <Field />
      <TaggerDoll />
      {RL_GUARDS.map((guard, index) => (
        <Guard key={index} x={guard.x} z={guard.z} index={index} />
      ))}
      {events.map((event) =>
        event.kind === 'shot' ? <Hit key={event.key} event={event} onDone={() => remove(event.key)} /> : <Win key={event.key} event={event} onDone={() => remove(event.key)} />,
      )}
    </>
  )
}
