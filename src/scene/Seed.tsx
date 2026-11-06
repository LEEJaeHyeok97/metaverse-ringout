import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Stage } from '../data/garden'
import { COLORS } from '../lib/brand'
import { Ink, penMaterial } from './ink'

const SHELL = '#8C5B37'
const CAP = '#A8754B'
const FACE = '#F2DEC0'
const BLUSH = '#F4A6A0'
const LEAF = '#9CD07A'

/** 위가 뾰족한 도토리 모자. 옆모습 곡선을 돌려 만든다. */
function useCapGeometry() {
  return useMemo(() => {
    const points = [
      new THREE.Vector2(0, 0.62),
      new THREE.Vector2(0.12, 0.5),
      new THREE.Vector2(0.3, 0.3),
      new THREE.Vector2(0.43, 0.1),
      new THREE.Vector2(0.48, -0.04),
      new THREE.Vector2(0.44, -0.1),
      new THREE.Vector2(0, -0.06),
    ]
    return new THREE.LatheGeometry(points, 32)
  }, [])
}

/** 알람 리워드 씨앗. 바닥이 원점이고 +z를 바라본다. 단계마다 새싹, 나무가 머리 위로 자란다. */
export function SeedModel({ stage = 'seed' }: { stage?: Stage }) {
  const cap = useCapGeometry()
  return (
    <group>
      {/* 아래 껍질: 위가 열린 반구 */}
      <mesh position={[0, 0.42, 0]} rotation={[0.18, 0, 0]}>
        <sphereGeometry args={[0.46, 28, 16, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52]} />
        <Ink color={SHELL} thickness={2.4} />
      </mesh>
      {/* 얼굴 */}
      <mesh position={[0, 0.5, 0]} scale={[1, 0.88, 0.95]}>
        <sphereGeometry args={[0.4, 28, 20]} />
        <Ink color={FACE} thickness={2.4} />
      </mesh>
      {/* 모자. 살짝 뒤로 젖혀 얼굴이 보이게 한다. */}
      <mesh geometry={cap} position={[0, 0.66, -0.05]} rotation={[-0.25, 0, 0.08]}>
        <Ink color={CAP} thickness={2.4} />
      </mesh>
      {/* 눈, 입, 볼 */}
      <mesh material={penMaterial} position={[-0.12, 0.5, 0.37]}>
        <sphereGeometry args={[0.035, 8, 8]} />
      </mesh>
      <mesh material={penMaterial} position={[0.12, 0.5, 0.37]}>
        <sphereGeometry args={[0.035, 8, 8]} />
      </mesh>
      <mesh material={penMaterial} position={[0, 0.42, 0.375]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.06, 0.014, 6, 12, Math.PI]} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 0.42, 0.33]} rotation={[0, x * 1.6, 0]}>
          <circleGeometry args={[0.055, 12]} />
          <meshBasicMaterial color={BLUSH} transparent opacity={0.85} />
        </mesh>
      ))}
      {stage === 'sprout' && (
        <group position={[0, 1.2, -0.05]}>
          <mesh position={[0, -0.08, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.2, 6]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.13, 0.04, 0]} rotation={[0, 0, side * -0.5]} scale={[1, 0.45, 0.6]}>
              <sphereGeometry args={[0.15, 12, 8]} />
              <Ink color={LEAF} thickness={1.6} />
            </mesh>
          ))}
        </group>
      )}
      {stage === 'tree' && (
        <group position={[0, 1.1, -0.05]}>
          <mesh position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.5, 8]} />
            <Ink color={SHELL} thickness={1.6} />
          </mesh>
          <mesh position={[0, 0.7, 0]}>
            <sphereGeometry args={[0.38, 16, 12]} />
            <Ink color={LEAF} />
          </mesh>
          <mesh position={[-0.28, 0.55, 0]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <Ink color={LEAF} />
          </mesh>
          <mesh position={[0.28, 0.55, 0]}>
            <sphereGeometry args={[0.22, 12, 10]} />
            <Ink color={LEAF} />
          </mesh>
        </group>
      )}
    </group>
  )
}

/** 통통 튀는 씨앗. appearAt을 주면 그때 톡 튀어나온다. */
export function BouncySeed({ stage, scale = 1, appearAt }: { stage: Stage; scale?: number; appearAt?: () => number | null }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const node = group.current
    if (!node) return
    const t = clock.elapsedTime
    let pop = 1
    if (appearAt) {
      const at = appearAt()
      if (at === null) {
        node.visible = false
        return
      }
      const elapsed = (performance.now() - at) / 1000
      // 0.5초 동안 커지며 살짝 넘쳤다가 제자리로 온다.
      pop = elapsed >= 0.5 ? 1 : Math.sin((elapsed / 0.5) * Math.PI * 0.75) / Math.sin(Math.PI * 0.75)
      pop = Math.max(0.01, Math.min(pop, 1.25))
    }
    node.visible = true
    node.scale.setScalar(scale * pop)
    node.position.y = Math.abs(Math.sin(t * 4)) * 0.18 * scale
    node.rotation.z = Math.sin(t * 4) * 0.08
  })
  return (
    <group ref={group}>
      <SeedModel stage={stage} />
    </group>
  )
}

const follow = new THREE.Vector3()
const offset = new THREE.Vector3()

/** 광장에서 주인을 졸졸 따라다니는 씨앗 */
export function CompanionSeed({ target, stage }: { target: React.RefObject<THREE.Object3D | null>; stage: Stage }) {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    const node = group.current
    const owner = target.current
    if (!node || !owner) return
    // 주인의 오른쪽 뒤에 선다.
    offset.set(0.9, 0, -0.9).applyAxisAngle(THREE.Object3D.DEFAULT_UP, owner.rotation.y)
    follow.set(owner.position.x + offset.x, 0, owner.position.z + offset.z)
    const distance = node.position.distanceTo(follow)
    if (distance > 15) node.position.copy(follow)
    node.position.lerp(follow, 1 - Math.exp(-delta * 4))
    const dx = owner.position.x - node.position.x
    const dz = owner.position.z - node.position.z
    if (distance > 0.05) node.rotation.y = Math.atan2(dx, dz)
  })
  return (
    <group ref={group}>
      <BouncySeed stage={stage} scale={0.8} />
    </group>
  )
}
