import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Anim } from '../net/protocol'
import { COLORS } from '../lib/brand'
import { Ink, penMaterial } from './ink'
import { BikeModel, KartModel, RideModel } from './Rides'
import type { RideKind } from '../game/course'

// 세워 둔 따릉이를 그리던 곳에서 계속 쓸 수 있게 다시 내보낸다.
export { BikeModel }

/** 차 종류 동작 → 탈것 */
const DRIVES: Partial<Record<Anim, RideKind>> = { scooter: 'scooter', car: 'car', sports: 'sports', truck: 'truck' }

/** ghost면 하얀 유령 천을 뒤집어쓴다. */
export type Motion = { anim: Anim; speed: number; ghost?: boolean }

const LINE = 0.05
const THIGH = 0.46
const SHIN = 0.46
const TORSO = 0.6
const UPPER_ARM = 0.34
const FOREARM = 0.32
const HEAD = 0.26
const HIP_Y = THIGH + SHIN

const geometries = {
  thigh: new THREE.CapsuleGeometry(LINE, THIGH, 3, 8),
  shin: new THREE.CapsuleGeometry(LINE, SHIN, 3, 8),
  torso: new THREE.CapsuleGeometry(LINE, TORSO, 3, 8),
  upper: new THREE.CapsuleGeometry(LINE, UPPER_ARM, 3, 8),
  fore: new THREE.CapsuleGeometry(LINE, FOREARM, 3, 8),
  eye: new THREE.SphereGeometry(0.035, 8, 8),
}

/** 관절 하나. 자식 선분은 관절에서 아래(-y)로 뻗는다. */
function Bone({ boneRef, geometry, length, position, children }: { boneRef: RefObject<THREE.Group | null>; geometry: THREE.BufferGeometry; length: number; position?: [number, number, number]; children?: React.ReactNode }) {
  return (
    <group ref={boneRef} position={position}>
      <mesh geometry={geometry} material={penMaterial} position={[0, -length / 2, 0]} />
      <group position={[0, -length, 0]}>{children}</group>
    </group>
  )
}

type Pose = {
  lean: number
  hipL: number
  kneeL: number
  hipR: number
  kneeR: number
  shoulderL: number
  shoulderLz: number
  elbowL: number
  shoulderR: number
  shoulderRz: number
  elbowR: number
  bob: number
  lie: number
  spin: number
}

const REST: Pose = { lean: 0, hipL: 0, kneeL: 0, hipR: 0, kneeR: 0, shoulderL: 0, shoulderLz: 0.25, elbowL: 0, shoulderR: 0, shoulderRz: -0.25, elbowR: 0, bob: 0, lie: 0, spin: 0 }

function poseFor(anim: Anim, t: number, speed: number, phase: number): Pose {
  switch (anim) {
    case 'walk': {
      const swing = Math.sin(phase) * Math.min(0.35 + speed * 0.06, 0.95)
      return {
        ...REST,
        lean: 0.12 + speed * 0.01,
        hipL: swing,
        kneeL: Math.max(0, -Math.cos(phase)) * 0.9,
        hipR: -swing,
        kneeR: Math.max(0, Math.cos(phase)) * 0.9,
        shoulderL: -swing * 0.9,
        elbowL: -0.5,
        shoulderR: swing * 0.9,
        elbowR: -0.5,
        bob: Math.abs(Math.sin(phase)) * 0.06,
      }
    }
    case 'jump':
      return { ...REST, hipL: 0.9, kneeL: 1.4, hipR: 0.5, kneeR: 1.1, shoulderL: -0.2, shoulderLz: 2.6, shoulderR: -0.2, shoulderRz: -2.6, elbowL: 0, elbowR: 0 }
    case 'sleep':
      return { ...REST, lie: 1, shoulderLz: 0.15, shoulderRz: -0.15, kneeL: 0.2, hipL: 0.1, bob: Math.sin(t * 1.6) * 0.015 }
    case 'down':
      return { ...REST, lie: 1, shoulderLz: 1.4, shoulderRz: -1.4, hipL: 0.4, hipR: -0.3, kneeL: 0.3, spin: t * 6 }
    case 'stumble': {
      const wobble = Math.sin(t * 22) * 0.25
      return { ...REST, lean: 0.55 + wobble * 0.3, hipL: 0.6, kneeL: 0.7, hipR: -0.4, shoulderL: -1.2, shoulderLz: 1.2, shoulderR: -1.2, shoulderRz: -1.2 }
    }
    case 'ride': {
      // 안장에 앉아 페달을 구르고 두 손은 핸들을 잡는다.
      const pedal = phase
      return {
        ...REST,
        lean: 0.35,
        hipL: 1.2 + Math.sin(pedal) * 0.35,
        kneeL: 1.3 + Math.cos(pedal) * 0.35,
        hipR: 1.2 - Math.sin(pedal) * 0.35,
        kneeR: 1.3 - Math.cos(pedal) * 0.35,
        shoulderL: 1.1,
        shoulderLz: 0.15,
        elbowL: -0.3,
        shoulderR: 1.1,
        shoulderRz: -0.15,
        elbowR: -0.3,
        bob: 0.06,
      }
    }
    case 'trapped': {
      // 물방울 안에 웅크리고 둥실 떠 있다.
      return { ...REST, hipL: 1.4, kneeL: 1.8, hipR: 1.4, kneeR: 1.8, shoulderL: 1, shoulderR: 1, elbowL: -1.5, elbowR: -1.5, bob: 0.55 + Math.sin(t * 3) * 0.08 }
    }
    case 'ufo': {
      // 빛줄기에 붙잡혀 허우적대며 떠오른다.
      const flail = Math.sin(t * 14) * 0.4
      return { ...REST, hipL: 0.3 + flail, hipR: -0.3 - flail, kneeL: 0.6, kneeR: 0.6, shoulderLz: 2.6 + flail, shoulderRz: -2.6 - flail, bob: 1.1 + Math.sin(t * 2) * 0.15 }
    }
    case 'punch':
      return { ...REST, lean: 0.25, hipL: 0.4, kneeL: 0.3, hipR: -0.3, shoulderR: 1.55, shoulderRz: 0, elbowR: 0, shoulderL: -0.5, elbowL: -1.2, shoulderLz: 0.4 }
    case 'scooter':
      // 스쿠터 안장에 앉아 두 손으로 핸들을 잡는다.
      return { ...REST, lean: 0.15, bob: -0.2, hipL: 1.3, kneeL: 1.1, hipR: 1.3, kneeR: 1.1, shoulderL: 1.2, shoulderR: 1.2, shoulderLz: 0.15, shoulderRz: -0.15, elbowL: -0.2, elbowR: -0.2 }
    case 'kart':
    case 'drift':
      // 카트 의자에 낮게 앉아 다리를 앞으로 뻗고 핸들을 잡는다. 드리프트 중에는 몸을 안쪽으로 기울인다.
      return {
        ...REST,
        lean: anim === 'drift' ? 0.2 : -0.05,
        bob: -0.42,
        hipL: 1.45,
        kneeL: 0.45,
        hipR: 1.45,
        kneeR: 0.45,
        shoulderL: 1.05,
        shoulderR: 1.05,
        shoulderLz: 0.25,
        shoulderRz: -0.25,
        elbowL: -0.45,
        elbowR: -0.45,
      }
    case 'car':
    case 'sports':
    case 'truck':
      // 운전석에 앉아 핸들을 잡는다. 트럭은 운전석이 높다.
      return {
        ...REST,
        lean: anim === 'sports' ? -0.15 : 0,
        bob: anim === 'truck' ? 0.05 : -0.22,
        hipL: 1.5,
        kneeL: 1.4,
        hipR: 1.5,
        kneeR: 1.4,
        shoulderL: 1.1 + Math.sin(t * 6) * 0.08,
        shoulderR: 1.1 - Math.sin(t * 6) * 0.08,
        shoulderLz: 0.2,
        shoulderRz: -0.2,
        elbowL: -0.4,
        elbowR: -0.4,
      }
    case 'slide':
      // 미끄럼틀: 앉아서 두 다리를 앞으로 뻗고 만세!
      return { ...REST, lean: -0.35, bob: -0.45, hipL: 1.5, kneeL: 0.1, hipR: 1.5, kneeR: 0.1, shoulderLz: 2.7 + Math.sin(t * 18) * 0.15, shoulderRz: -2.7 - Math.sin(t * 18) * 0.15 }
    case 'kick':
      // 몸을 뒤로 젖히고 오른발을 앞으로 쭉 뻗는다.
      return { ...REST, lean: -0.3, hipR: 1.7, kneeR: 0, hipL: -0.15, kneeL: 0.35, shoulderLz: 1.3, shoulderRz: -1.3, shoulderL: -0.3, shoulderR: -0.3 }
    case 'cheer': {
      const wave = Math.sin(t * 10) * 0.3
      return { ...REST, shoulderLz: 2.7 + wave, shoulderRz: -2.7 - wave, bob: Math.abs(Math.sin(t * 6)) * 0.2 }
    }
    default:
      return { ...REST, bob: Math.sin(t * 2) * 0.012, shoulderLz: 0.22 + Math.sin(t * 2) * 0.03, shoulderRz: -0.22 - Math.sin(t * 2) * 0.03 }
  }
}

const lerp = THREE.MathUtils.lerp

/** 졸라맨. 발이 원점이고 +z를 바라본다. 동작은 motion ref를 매 프레임 읽어서 리렌더 없이 바꾼다. */
export function StickFigure({ motion, color }: { motion: RefObject<Motion>; color: string }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const hipL = useRef<THREE.Group>(null)
  const kneeL = useRef<THREE.Group>(null)
  const hipR = useRef<THREE.Group>(null)
  const kneeR = useRef<THREE.Group>(null)
  const shoulderL = useRef<THREE.Group>(null)
  const elbowL = useRef<THREE.Group>(null)
  const shoulderR = useRef<THREE.Group>(null)
  const elbowR = useRef<THREE.Group>(null)
  const stars = useRef<THREE.Group>(null)
  const zzz = useRef<THREE.Group>(null)
  const bike = useRef<THREE.Group>(null)
  const drives = useRef<Partial<Record<RideKind, THREE.Group | null>>>({})
  const ghost = useRef<THREE.Group>(null)
  const bubble = useRef<THREE.Mesh>(null)
  const ufo = useRef<THREE.Group>(null)
  const kartRef = useRef<THREE.Group>(null)
  const sparks = useRef<THREE.Group>(null)
  const phase = useRef(Math.random() * 10)
  const current = useRef<Pose>({ ...REST })
  const scarfTail = useMemo(() => new THREE.BoxGeometry(0.12, 0.34, 0.04), [])

  useFrame(({ clock }, delta) => {
    const { anim, speed } = motion.current
    const t = clock.elapsedTime
    if (anim === 'walk' || anim === 'ride') phase.current += delta * (anim === 'ride' ? 9 : 3 + speed * 1.1)
    const target = poseFor(anim, t, speed, phase.current)
    const blend = 1 - Math.exp(-delta * 16)
    const pose = current.current
    for (const key of Object.keys(target) as (keyof Pose)[]) {
      // 빙글빙글 도는 별은 끊기지 않게 바로 맞춘다.
      pose[key] = key === 'spin' ? target[key] : lerp(pose[key], target[key], blend)
    }
    if (!body.current || !torso.current) return
    body.current.position.y = HIP_Y + pose.bob - pose.lie * (HIP_Y - 0.22)
    body.current.rotation.x = -pose.lie * (Math.PI / 2)
    torso.current.rotation.x = pose.lean
    hipL.current!.rotation.x = -pose.hipL
    kneeL.current!.rotation.x = pose.kneeL
    hipR.current!.rotation.x = -pose.hipR
    kneeR.current!.rotation.x = pose.kneeR
    shoulderL.current!.rotation.set(-pose.shoulderL, 0, pose.shoulderLz)
    elbowL.current!.rotation.x = pose.elbowL
    shoulderR.current!.rotation.set(-pose.shoulderR, 0, pose.shoulderRz)
    elbowR.current!.rotation.x = pose.elbowR
    if (stars.current) {
      stars.current.visible = anim === 'down' || anim === 'stumble'
      stars.current.rotation.y = t * 5
    }
    if (bike.current) bike.current.visible = anim === 'ride'
    if (kartRef.current) kartRef.current.visible = anim === 'kart' || anim === 'drift'
    if (sparks.current) {
      sparks.current.visible = anim === 'drift'
      sparks.current.children.forEach((child, index) => child.scale.setScalar(0.6 + Math.abs(Math.sin(t * 30 + index * 1.7)) * 0.8))
    }
    for (const [kind, node] of Object.entries(drives.current)) if (node) node.visible = DRIVES[anim] === kind
    if (ghost.current) {
      ghost.current.visible = motion.current.ghost === true
      ghost.current.position.y = 0.25 + Math.sin(t * 3) * 0.12
    }
    if (bubble.current) {
      bubble.current.visible = anim === 'trapped'
      bubble.current.position.y = 1.05 + pose.bob
      bubble.current.scale.setScalar(1 + Math.sin(t * 5) * 0.04)
    }
    if (ufo.current) {
      ufo.current.visible = anim === 'ufo'
      ufo.current.rotation.y = t * 3
    }
    if (zzz.current) {
      zzz.current.visible = anim === 'sleep'
      zzz.current.children.forEach((child, index) => {
        const local = (t * 0.6 + index / 3) % 1
        child.position.set(0.3 + local * 0.4, local * 0.9, 0)
        child.scale.setScalar(0.5 + local * 0.7)
      })
    }
  })

  return (
    <group ref={root}>
      <group ref={bike} visible={false}>
        <BikeModel />
      </group>
      <group ref={kartRef} visible={false}>
        <KartModel color={color} />
        {/* 드리프트 불꽃: 뒷바퀴 옆에서 튄다. */}
        <group ref={sparks} visible={false}>
          {[-0.85, 0.85].map((x) => (
            <mesh key={x} position={[x, 0.15, -0.95]}>
              <octahedronGeometry args={[0.16]} />
              <meshBasicMaterial color="#FFB020" />
            </mesh>
          ))}
        </group>
      </group>
      {(['scooter', 'car', 'sports', 'truck'] as const).map((kind) => (
        <group
          key={kind}
          visible={false}
          ref={(node) => {
            drives.current[kind] = node
          }}
        >
          <RideModel kind={kind} />
        </group>
      ))}
      {/* 유령: 하얀 천을 뒤집어쓰고 둥실둥실 */}
      <group ref={ghost} visible={false}>
        <mesh position={[0, 1.15, 0]} scale={[0.75, 1.05, 0.75]}>
          <sphereGeometry args={[1, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
          <meshToonMaterial color="#ffffff" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.6, 0.85, 1, 20, 1, true]} />
          <meshToonMaterial color="#ffffff" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, 1.55, 0.66]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
        ))}
        <mesh position={[0, 1.3, 0.7]} scale={[1, 1.3, 1]}>
          <sphereGeometry args={[0.08, 10, 8]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
      </group>
      <mesh ref={bubble} visible={false}>
        <sphereGeometry args={[1.05, 24, 16]} />
        <meshToonMaterial color="#8FD3FF" transparent opacity={0.45} />
      </mesh>
      <group ref={ufo} visible={false} position={[0, 4.2, 0]}>
        <UfoModel />
      </group>
      {/* 몸 전체가 엉덩이를 기준으로 눕고 일어난다. */}
      <group ref={body} position={[0, HIP_Y, 0]}>
        <Bone boneRef={hipL} geometry={geometries.thigh} length={THIGH} position={[0.09, 0, 0]}>
          <Bone boneRef={kneeL} geometry={geometries.shin} length={SHIN} />
        </Bone>
        <Bone boneRef={hipR} geometry={geometries.thigh} length={THIGH} position={[-0.09, 0, 0]}>
          <Bone boneRef={kneeR} geometry={geometries.shin} length={SHIN} />
        </Bone>
        <group ref={torso}>
          <mesh geometry={geometries.torso} material={penMaterial} position={[0, TORSO / 2, 0]} />
          <group position={[0, TORSO - 0.06, 0]}>
            <Bone boneRef={shoulderL} geometry={geometries.upper} length={UPPER_ARM} position={[0.02, 0, 0]}>
              <Bone boneRef={elbowL} geometry={geometries.fore} length={FOREARM} />
            </Bone>
            <Bone boneRef={shoulderR} geometry={geometries.upper} length={UPPER_ARM} position={[-0.02, 0, 0]}>
              <Bone boneRef={elbowR} geometry={geometries.fore} length={FOREARM} />
            </Bone>
          </group>
          {/* 플레이어 색 목도리 */}
          <mesh position={[0, TORSO + 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.12, 0.055, 8, 16]} />
            <Ink color={color} thickness={1.5} />
          </mesh>
          <mesh geometry={scarfTail} position={[0.07, TORSO - 0.16, -0.1]} rotation={[0.35, 0, 0.2]}>
            <Ink color={color} thickness={1.5} />
          </mesh>
          {/* 머리: 흰 동그라미에 점 두 개 */}
          <group position={[0, TORSO + 0.06 + HEAD, 0]}>
            <mesh>
              <sphereGeometry args={[HEAD, 24, 16]} />
              <Ink color="#ffffff" thickness={2.6} />
            </mesh>
            <mesh geometry={geometries.eye} material={penMaterial} position={[0.08, 0.04, HEAD * 0.93]} />
            <mesh geometry={geometries.eye} material={penMaterial} position={[-0.08, 0.04, HEAD * 0.93]} />
            <group ref={stars} position={[0, HEAD + 0.12, 0]} visible={false}>
              {[0, 1, 2].map((index) => (
                <mesh key={index} position={[Math.cos((index * Math.PI * 2) / 3) * 0.3, 0, Math.sin((index * Math.PI * 2) / 3) * 0.3]}>
                  <octahedronGeometry args={[0.07]} />
                  <meshBasicMaterial color={COLORS.yellow} />
                </mesh>
              ))}
            </group>
          </group>
          <group ref={zzz} position={[0, TORSO + 0.4, 0]} visible={false}>
            {[0, 1, 2].map((index) => (
              <mesh key={index}>
                <torusGeometry args={[0.07, 0.018, 4, 4]} />
                <meshBasicMaterial color={COLORS.ink} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

export function UfoModel() {
  return (
    <group>
      <mesh scale={[1, 0.28, 1]}>
        <sphereGeometry args={[1.2, 24, 12]} />
        <Ink color="#D9DEE8" thickness={2.4} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Ink color="#BFE3F5" thickness={2} />
      </mesh>
      <mesh position={[0, -2, 0]}>
        <cylinderGeometry args={[0.4, 1.3, 3.6, 20, 1, true]} />
        <meshBasicMaterial color="#FFF27A" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
