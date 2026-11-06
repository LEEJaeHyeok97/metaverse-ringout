import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ACORN_MAX,
  ACORN_RADIUS,
  acornsAt,
  gustAt,
  halfWidthAt,
  LEAF_PILES,
  LIGHTNING_MAX,
  LIGHTNING_RADIUS,
  lightningAt,
  PLOW,
  plowsAt,
  SPECIAL,
  STREET_HALF_W,
} from '../../game/course'
import { gameSeconds } from '../../game/run'
import { COLORS } from '../../lib/brand'
import { Ink, penMaterial } from '../ink'
import { Label } from '../Label'
import { OnCourse, placeOnCourse, useRibbon } from './onCourse'

/** 맵만의 구간을 그린다. 판정은 Runner가 course.ts의 같은 함수로 한다. */
export function Specials() {
  switch (SPECIAL?.kind) {
    case 'storm':
      return <Storm />
    case 'acorns':
      return <Acorns />
    case 'ice':
      return <Ice />
    default:
      return null
  }
}

// ---- 천둥 번개 사거리 ----

/** 번개 한 줄기: 지그재그로 꺾인 굵은 선 */
export function Bolt() {
  const pieces = useMemo(() => {
    const points: [number, number][] = [
      [0, 14],
      [0.9, 10.5],
      [-0.6, 7.5],
      [0.7, 4],
      [-0.3, 0],
    ]
    return points.slice(1).map(([x, y], i) => {
      const [px, py] = points[i]
      const length = Math.hypot(x - px, y - py)
      return { x: (x + px) / 2, y: (y + py) / 2, length, angle: Math.atan2(x - px, y - py) }
    })
  }, [])
  return (
    <group>
      {pieces.map((piece, i) => (
        <mesh key={i} position={[piece.x, piece.y, 0]} rotation={[0, 0, -piece.angle]}>
          <boxGeometry args={[0.35, piece.length + 0.2, 0.35]} />
          <Ink color={COLORS.yellow} thickness={2.4} />
        </mesh>
      ))}
    </group>
  )
}

function Storm() {
  const slots = useRef<(THREE.Group | null)[]>([])
  const shadows = useRef<(THREE.Mesh | null)[]>([])
  const rims = useRef<(THREE.Mesh | null)[]>([])
  const bolts = useRef<(THREE.Group | null)[]>([])
  const wind = useRef<THREE.Group>(null)
  const streaks = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ x: ((i * 7.3) % (STREET_HALF_W * 2)) - STREET_HALF_W, d: ((i * 13.7) % 42) + 2, y: 0.6 + (i % 4) * 0.5, length: 1.5 + (i % 3) })),
    [],
  )
  const streakNodes = useRef<(THREE.Mesh | null)[]>([])
  const streakMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#6E95BA', transparent: true, opacity: 0 }), [])

  useFrame(() => {
    const t = gameSeconds()
    const strikes = lightningAt(t)
    slots.current.forEach((node, i) => {
      if (!node) return
      const strike = strikes[i]
      node.visible = strike !== undefined
      if (!strike) return
      placeOnCourse(node, strike.x, 0, strike.z)
      const grow = Math.min(strike.progress, 1)
      shadows.current[i]?.scale.setScalar(0.2 + grow * 0.8)
      const shadow = shadows.current[i]?.material as THREE.MeshBasicMaterial | undefined
      if (shadow) shadow.opacity = strike.striking ? 0.75 : 0.18 + grow * 0.35
      if (shadow) shadow.color.set(strike.striking ? '#FFF3A0' : '#33384A')
      const bolt = bolts.current[i]
      if (bolt) bolt.visible = strike.striking
    })
    // 돌풍: 부는 쪽으로 바람 줄기가 날아간다.
    const gust = gustAt(t)
    streakMaterial.opacity = gust.strength * 0.8 + (gust.warn ? 0.15 : 0)
    streaks.forEach((streak, i) => {
      const node = streakNodes.current[i]
      if (!node || !SPECIAL) return
      const span = STREET_HALF_W * 2 + 8
      const travel = (((streak.x + gust.dir * t * 14 + span / 2) % span) + span) % span - span / 2
      placeOnCourse(node, travel, streak.y, SPECIAL.from - streak.d)
    })
    if (wind.current) wind.current.visible = gust.strength > 0.05 || gust.warn
  })

  if (!SPECIAL) return null
  return (
    <>
      {Array.from({ length: LIGHTNING_MAX }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(node) => {
            slots.current[i] = node
          }}
        >
          <mesh
            position={[0, 0.05, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            ref={(node) => {
              shadows.current[i] = node
            }}
          >
            <circleGeometry args={[LIGHTNING_RADIUS, 28]} />
            <meshBasicMaterial color="#33384A" transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <mesh
            position={[0, 0.06, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            ref={(node) => {
              rims.current[i] = node
            }}
          >
            <ringGeometry args={[LIGHTNING_RADIUS - 0.08, LIGHTNING_RADIUS + 0.04, 28]} />
            <meshBasicMaterial color={COLORS.accent} />
          </mesh>
          <group
            visible={false}
            ref={(node) => {
              bolts.current[i] = node
            }}
          >
            <Bolt />
          </group>
        </group>
      ))}
      <group ref={wind}>
        {streaks.map((streak, i) => (
          <mesh
            key={i}
            material={streakMaterial}
            ref={(node) => {
              streakNodes.current[i] = node
            }}
          >
            <boxGeometry args={[streak.length, 0.07, 0.07]} />
          </mesh>
        ))}
      </group>
      {/* 구간 입구의 먹구름 */}
      {[-9, 0, 9].map((x, i) => (
        <OnCourse key={x} x={x} z={(SPECIAL?.from ?? 0) - 8 - i * 14}>
          <group position={[0, 9, 0]}>
            {[-1.2, 0, 1.2].map((dx) => (
              <mesh key={dx} position={[dx, dx === 0 ? 0.5 : 0, 0]}>
                <sphereGeometry args={[1.3, 14, 10]} />
                <Ink color="#8C93A3" />
              </mesh>
            ))}
          </group>
        </OnCourse>
      ))}
    </>
  )
}

// ---- 데굴데굴 도토리 언덕 ----

function AcornModel() {
  return (
    <group>
      <mesh scale={[1, 1.15, 1]}>
        <sphereGeometry args={[ACORN_RADIUS, 18, 14]} />
        <Ink color="#C68A4E" thickness={2.4} />
      </mesh>
      <mesh position={[0, ACORN_RADIUS * 0.55, 0]} scale={[1.08, 0.6, 1.08]}>
        <sphereGeometry args={[ACORN_RADIUS, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Ink color="#7A5230" thickness={2.4} />
      </mesh>
      <mesh position={[0, ACORN_RADIUS * 1.2, 0]} material={penMaterial}>
        <cylinderGeometry args={[0.07, 0.07, 0.35, 6]} />
      </mesh>
      {/* 굴러가는 게 보이게 옆면에 줄을 긋는다. */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[ACORN_RADIUS * 1.01, 0.03, 6, 24]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
    </group>
  )
}

function Acorns() {
  const nodes = useRef<(THREE.Group | null)[]>([])
  const spins = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    const acorns = acornsAt(gameSeconds())
    nodes.current.forEach((node, i) => {
      if (!node) return
      const acorn = acorns[i]
      node.visible = acorn !== undefined
      if (!acorn) return
      placeOnCourse(node, acorn.x, ACORN_RADIUS * 1.1, acorn.z)
      const spin = spins.current[i]
      if (spin) spin.rotation.x = acorn.roll
    })
  })
  if (!SPECIAL) return null
  return (
    <>
      {Array.from({ length: ACORN_MAX }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(node) => {
            nodes.current[i] = node
          }}
        >
          <group
            ref={(node) => {
              spins.current[i] = node
            }}
          >
            <AcornModel />
          </group>
        </group>
      ))}
      {LEAF_PILES.map((pile) => (
        <OnCourse key={`${pile.x},${pile.z}`} x={pile.x} z={pile.z}>
          <mesh scale={[1, 0.45, 1]}>
            <sphereGeometry args={[pile.r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Ink color="#F4A261" />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[Math.cos(i * 1.3) * pile.r * 0.6, 0.55 + (i % 2) * 0.12, Math.sin(i * 1.3) * pile.r * 0.6]} rotation={[-Math.PI / 2 + 0.3, 0, i]}>
              <circleGeometry args={[0.28, 5]} />
              <meshBasicMaterial color={i % 2 ? '#E76F51' : '#FFC531'} side={THREE.DoubleSide} />
            </mesh>
          ))}
          <Label text="🍂 폴짝!" position={[0, 1.6, 0]} size={0.3} background="#FFF6C9" />
        </OnCourse>
      ))}
      {/* 언덕 위의 커다란 참나무 */}
      {[-1, 1].map((side) => (
        <OnCourse key={side} x={side * (STREET_HALF_W + 5)} z={(SPECIAL?.to ?? 0) + 4}>
          <mesh position={[0, 2, 0]} material={penMaterial}>
            <cylinderGeometry args={[0.25, 0.35, 4, 8]} />
          </mesh>
          <mesh position={[0, 5, 0]}>
            <sphereGeometry args={[2.6, 16, 12]} />
            <Ink color="#D98E3F" />
          </mesh>
        </OnCourse>
      ))}
    </>
  )
}

// ---- 꽁꽁 언 호수공원 ----

function PlowModel() {
  return (
    <group>
      <mesh position={[-0.6, 1.1, 0]}>
        <boxGeometry args={[PLOW.hx * 1.3, 1.4, PLOW.hz * 1.6]} />
        <Ink color="#FF9A3C" thickness={2.6} />
      </mesh>
      <mesh position={[-1.2, 2.2, 0]}>
        <boxGeometry args={[1.6, 0.9, PLOW.hz * 1.4]} />
        <Ink color="#DFF1FF" thickness={2.6} />
      </mesh>
      {/* 앞쪽 제설 날 */}
      <mesh position={[PLOW.hx - 0.3, 0.5, 0]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.25, 1, PLOW.hz * 2]} />
        <Ink color={COLORS.yellow} thickness={2.6} />
      </mesh>
      {[-1.6, 0.4].map((x) =>
        [-1, 1].map((side) => (
          <mesh key={`${x},${side}`} position={[x, 0.35, side * PLOW.hz * 0.8]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.25, 12]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
        )),
      )}
      <mesh position={[-0.6, 3, 0]}>
        <boxGeometry args={[0.5, 0.25, 0.5]} />
        <meshBasicMaterial color={COLORS.yellow} />
      </mesh>
    </group>
  )
}

function Ice() {
  const special = SPECIAL!
  const rink = useRibbon({ from: special.from, to: special.to, edges: (z) => [-halfWidthAt(z) - 0.3, halfWidthAt(z) + 0.3], y: 0.025 })
  const nodes = useRef<(THREE.Group | null)[]>([])
  const initial = useMemo(() => plowsAt(0), [])
  useFrame(() => {
    plowsAt(gameSeconds()).forEach((plow, i) => {
      const node = nodes.current[i]
      if (!node) return
      placeOnCourse(node, plow.x, 0, plow.z, plow.dir === 1 ? 0 : Math.PI)
      node.visible = Math.abs(plow.x) < STREET_HALF_W + 6
    })
  })
  return (
    <>
      <mesh geometry={rink}>
        <meshBasicMaterial color="#D3EDFA" side={THREE.DoubleSide} />
      </mesh>
      {/* 얼음이 반짝이는 줄 */}
      {Array.from({ length: 9 }, (_, i) => (
        <OnCourse key={i} x={((i * 5.3) % 20) - 10} z={special.from - 3 - i * 4.6} y={0.04} rotation={0.6}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.4, 0.12]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </OnCourse>
      ))}
      {initial.map((_, i) => (
        <group
          key={i}
          ref={(node) => {
            nodes.current[i] = node
          }}
        >
          <PlowModel />
        </group>
      ))}
      {/* 호숫가 눈사람 */}
      {[-1, 1].map((side, i) => (
        <OnCourse key={side} x={side * (STREET_HALF_W + 3)} z={special.from - 10 - i * 18}>
          <mesh position={[0, 0.8, 0]}>
            <sphereGeometry args={[0.9, 16, 12]} />
            <Ink color="#ffffff" />
          </mesh>
          <mesh position={[0, 2, 0]}>
            <sphereGeometry args={[0.6, 16, 12]} />
            <Ink color="#ffffff" />
          </mesh>
          <mesh position={[0, 2.05, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.4, 8]} />
            <Ink color="#FF9A3C" />
          </mesh>
        </OnCourse>
      ))}
    </>
  )
}
