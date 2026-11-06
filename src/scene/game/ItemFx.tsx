import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { courseFrame, type Frame } from '../../game/course'
import { run, shake } from '../../game/run'
import { audio } from '../../lib/audio'
import { COLORS } from '../../lib/brand'
import { connection, type FxEvent } from '../../net/connection'
import { Ink, penMaterial } from '../ink'

/**
 * 아이템 궁극기 연출. 아이템을 쓰면 같은 방 모두의 화면에 커다란 연출이 지나간다.
 * 판정과는 상관없는 장식이라 각자 화면에서 시각만 맞춰 그린다.
 */

export const FX_MS: Record<FxEvent['kind'], number> = { booster: 3000, shield: 2600, banana: 1700, balloon: 2000, ufo: 2800, warp: 1800 }

type Active = FxEvent & { key: number }

const scratch: Frame = { x: 0, z: 0, angle: 0 }

/** 이 사람이 지금 있는 코스 좌표. 나는 run에서, 다른 사람은 받은 위치에서 읽는다. */
function anchorOf(id: number | undefined): { x: number; z: number } | null {
  if (id === undefined) return null
  if (id === connection.getState().myId) return { x: run.x, z: run.z }
  const other = connection.positions.get(id)
  return other ? { x: other.x, z: other.z } : null
}

function toWorld(x: number, y: number, z: number, out: THREE.Vector3) {
  courseFrame(x, z, scratch)
  return out.set(scratch.x, y, scratch.z)
}

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

let nextKey = 1

export function ItemFx() {
  const [active, setActive] = useState<Active[]>([])
  useEffect(
    () =>
      connection.onFx((fx) => {
        const key = nextKey++
        const myId = connection.getState().myId
        const mine = fx.from === myId
        const targeted = fx.to !== undefined && fx.to === myId
        // 내가 쓰면 크게, 내가 당하면 더 크게 흔들린다.
        if (mine) {
          audio.effect('ultimate')
          shake(fx.kind === 'booster' || fx.kind === 'ufo' ? 0.5 : 0.3, 900)
        } else if (targeted) {
          audio.effect('boom')
          shake(0.8, 1100)
        } else {
          audio.effect('boom')
        }
        setActive((list) => [...list.slice(-8), { ...fx, key }])
        setTimeout(() => setActive((list) => list.filter((item) => item.key !== key)), FX_MS[fx.kind] + 100)
      }),
    [],
  )
  return (
    <>
      {active.map((fx) => {
        switch (fx.kind) {
          case 'booster':
            return <Dragon key={fx.key} fx={fx} />
          case 'shield':
            return <GoldenShield key={fx.key} fx={fx} />
          case 'banana':
            return <GiantBanana key={fx.key} fx={fx} />
          case 'balloon':
            return <Tsunami key={fx.key} fx={fx} />
          case 'ufo':
            return <Mothership key={fx.key} fx={fx} />
          case 'warp':
            return <Vortex key={fx.key} fx={fx} />
        }
      })}
    </>
  )
}

// ---- 🚀 청룡 질주: 용이 시전자를 휘감아 오르다가 길 앞으로 날아간다 ----

const DRAGON_SEGMENTS = 30
const SEGMENT_DELAY = 0.045
const segmentGeometry = new THREE.SphereGeometry(1, 14, 10)
const spikeGeometry = new THREE.ConeGeometry(0.22, 0.6, 6)
const DRAGON_GREEN = '#2FB67C'
const DRAGON_BELLY = '#FFE08A'

/** 용 머리가 s초에 있는 코스 좌표 */
function dragonPath(s: number, origin: { x: number; z: number }) {
  const spiral = 1.3
  if (s < spiral) {
    // 시전자를 두 바퀴 휘감으며 솟아오른다.
    const angle = s * 10
    const radius = 3.2 - s * 0.6
    return { x: origin.x + Math.cos(angle) * radius, y: 0.8 + s * 3.2, z: origin.z + Math.sin(angle) * radius }
  }
  // 그 뒤로는 도로 앞쪽으로 구불구불 날아간다.
  const u = s - spiral
  const top = { x: origin.x + Math.cos(spiral * 10) * (3.2 - spiral * 0.6), z: origin.z + Math.sin(spiral * 10) * (3.2 - spiral * 0.6) }
  return { x: top.x + Math.sin(u * 5) * 4 * Math.min(1, u * 2), y: 0.8 + spiral * 3.2 + Math.sin(u * 3) * 1.2 + u * 1.5, z: top.z - u * u * 9 - u * 14 }
}

function Dragon({ fx }: { fx: Active }) {
  const segments = useRef<(THREE.Mesh | null)[]>([])
  const spikes = useRef<(THREE.Mesh | null)[]>([])
  const head = useRef<THREE.Group>(null)
  const burst = useRef<THREE.Mesh>(null)
  const origin = useRef(anchorOf(fx.from))
  const point = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  const radii = useMemo(() => Array.from({ length: DRAGON_SEGMENTS }, (_, i) => 0.75 * (1 - i / DRAGON_SEGMENTS) + 0.18), [])

  useFrame(() => {
    const anchor = origin.current
    if (!anchor) return
    const s = (performance.now() - fx.at) / 1000
    const fade = 1 - clamp01((s - FX_MS.booster / 1000 + 0.5) / 0.5)
    segments.current.forEach((mesh, i) => {
      if (!mesh) return
      const local = s - i * SEGMENT_DELAY
      mesh.visible = local > 0
      if (local <= 0) return
      const p = dragonPath(local, anchor)
      toWorld(p.x, p.y, p.z, mesh.position)
      mesh.scale.setScalar(radii[i] * fade)
      const spike = spikes.current[i]
      if (spike) {
        spike.visible = mesh.visible && i % 2 === 0
        spike.position.copy(mesh.position)
        spike.position.y += radii[i] * fade * 0.95
        spike.scale.setScalar(fade * (1 - i / DRAGON_SEGMENTS) + 0.3)
      }
    })
    const node = head.current
    if (node) {
      const p = dragonPath(s, anchor)
      const q = dragonPath(s + 0.03, anchor)
      toWorld(p.x, p.y, p.z, point)
      toWorld(q.x, q.y, q.z, ahead)
      node.position.copy(point)
      node.lookAt(ahead)
      node.scale.setScalar(fade)
    }
    if (burst.current) {
      const b = clamp01(s / 0.6)
      toWorld(anchor.x, 0.1, anchor.z, burst.current.position)
      burst.current.scale.setScalar(1 + easeOut(b) * 7)
      ;(burst.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - b)
    }
  })

  return (
    <>
      {radii.map((_, i) => (
        <mesh
          key={i}
          geometry={segmentGeometry}
          visible={false}
          ref={(mesh) => {
            segments.current[i] = mesh
          }}
        >
          <Ink color={i % 3 === 1 ? DRAGON_BELLY : DRAGON_GREEN} thickness={2.2} />
        </mesh>
      ))}
      {radii.map((_, i) => (
        <mesh
          key={`s${i}`}
          geometry={spikeGeometry}
          visible={false}
          ref={(mesh) => {
            spikes.current[i] = mesh
          }}
        >
          <meshBasicMaterial color="#E9483B" />
        </mesh>
      ))}
      {/* 머리: +z가 앞이다(lookAt). */}
      <group ref={head}>
        <mesh scale={[0.95, 0.75, 1.3]}>
          <sphereGeometry args={[1, 16, 12]} />
          <Ink color={DRAGON_GREEN} thickness={2.4} />
        </mesh>
        <mesh position={[0, -0.15, 1.15]} scale={[0.65, 0.45, 0.8]}>
          <sphereGeometry args={[1, 14, 10]} />
          <Ink color={DRAGON_BELLY} thickness={2.4} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.45, 0.85, -0.3]} rotation={[-0.7, 0, side * -0.3]}>
              <coneGeometry args={[0.16, 1.1, 8]} />
              <Ink color="#FFF6C9" thickness={1.8} />
            </mesh>
            <mesh position={[side * 0.42, 0.35, 0.75]}>
              <sphereGeometry args={[0.17, 10, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[side * 0.44, 0.37, 0.89]}>
              <sphereGeometry args={[0.08, 8, 6]} />
              <meshBasicMaterial color={COLORS.ink} />
            </mesh>
            {/* 수염 */}
            <mesh position={[side * 0.9, -0.2, 1.5]} rotation={[0.4, 0, side * 1.1]} material={penMaterial}>
              <cylinderGeometry args={[0.03, 0.03, 1.4, 5]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -0.45, 1.5]} rotation={[0.3, 0, 0]} scale={[0.4, 0.08, 0.3]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshBasicMaterial color="#E9483B" />
        </mesh>
      </group>
      <mesh ref={burst} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color={DRAGON_GREEN} transparent depthWrite={false} />
      </mesh>
    </>
  )
}

// ---- 🛡️ 황금 수호진: 빛기둥이 솟고, 황금 돔과 마법진이 시전자를 감싼다 ----

function GoldenShield({ fx }: { fx: Active }) {
  const group = useRef<THREE.Group>(null)
  const dome = useRef<THREE.Mesh>(null)
  const circle = useRef<THREE.Group>(null)
  const pillars = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const anchor = anchorOf(fx.from)
    const node = group.current
    if (!anchor || !node) return
    const s = (performance.now() - fx.at) / 1000
    const total = FX_MS.shield / 1000
    toWorld(anchor.x, 0, anchor.z, node.position)
    const grow = easeOut(clamp01(s / 0.45))
    const fade = 1 - clamp01((s - total + 0.6) / 0.6)
    if (dome.current) {
      dome.current.scale.setScalar(2.4 * grow)
      ;(dome.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * fade
    }
    if (circle.current) {
      circle.current.rotation.y = s * 2.2
      circle.current.scale.setScalar(grow * 1.15)
    }
    pillars.current.forEach((pillar, i) => {
      if (!pillar) return
      const rise = easeOut(clamp01((s - i * 0.08) / 0.4))
      pillar.scale.set(1, 0.01 + rise * fade, 1)
      ;(pillar.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade
    })
  })
  return (
    <group ref={group}>
      <mesh ref={dome} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#FFD84D" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <group ref={circle} position={[0, 0.06, 0]}>
        {[3.1, 2.4].map((radius) => (
          <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius - 0.08, radius, 48]} />
            <meshBasicMaterial color="#F2A900" />
          </mesh>
        ))}
        {/* 마법진의 룬 */}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 2.75, 0.01, Math.sin((i / 8) * Math.PI * 2) * 2.75]} rotation={[-Math.PI / 2, 0, (i / 8) * Math.PI * 2]}>
            <planeGeometry args={[0.18, 0.5]} />
            <meshBasicMaterial color="#F2A900" />
          </mesh>
        ))}
      </group>
      {Array.from({ length: 4 }, (_, i) => (
        <mesh
          key={i}
          position={[Math.cos((i / 4) * Math.PI * 2 + 0.8) * 3, 0, Math.sin((i / 4) * Math.PI * 2 + 0.8) * 3]}
          ref={(mesh) => {
            pillars.current[i] = mesh
          }}
        >
          <cylinderGeometry args={[0.35, 0.35, 16, 12, 1, true]} />
          <meshBasicMaterial color="#FFE9A8" transparent depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

// ---- 🍌 하늘에서 바나나가!: 집채만 한 바나나가 떨어져 쿵 하고 퍼진다 ----

function GiantBanana({ fx }: { fx: Active }) {
  const banana = useRef<THREE.Group>(null)
  const wave = useRef<THREE.Mesh>(null)
  const spot = useMemo(() => ({ x: fx.x ?? 0, z: fx.z ?? 0 }), [fx.x, fx.z])
  const landed = useRef(false)
  useFrame(() => {
    const s = (performance.now() - fx.at) / 1000
    const fall = clamp01(s / 0.55)
    const node = banana.current
    if (node) {
      const squash = s > 0.55 ? clamp01((s - 0.55) / 0.9) : 0
      toWorld(spot.x, 22 * (1 - fall * fall) + 1.2, spot.z, node.position)
      node.rotation.y = s * 6
      const size = 3.2 * (1 - squash * 0.85)
      node.scale.set(size * (1 + Math.sin(squash * Math.PI) * 0.3), size * (1 - Math.sin(squash * Math.PI) * 0.3), size)
    }
    if (s > 0.55 && !landed.current) {
      landed.current = true
      shake(0.35, 500)
    }
    if (wave.current) {
      const w = clamp01((s - 0.55) / 0.8)
      toWorld(spot.x, 0.1, spot.z, wave.current.position)
      wave.current.visible = s > 0.55
      wave.current.scale.setScalar(1 + w * 9)
      ;(wave.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - w)
    }
  })
  return (
    <>
      <group ref={banana}>
        <mesh rotation={[0, 0, Math.PI * 0.15]}>
          <torusGeometry args={[0.7, 0.24, 10, 24, Math.PI * 0.85]} />
          <Ink color="#FFD84D" thickness={2} />
        </mesh>
        <mesh position={[0.62, 0.42, 0]} rotation={[0, 0, -0.5]}>
          <cylinderGeometry args={[0.06, 0.1, 0.3, 6]} />
          <meshBasicMaterial color="#7A5230" />
        </mesh>
      </group>
      <mesh ref={wave} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.7, 1, 40]} />
        <meshBasicMaterial color="#FFC531" transparent depthWrite={false} />
      </mesh>
    </>
  )
}

// ---- 💧 대해일 물폭탄: 맞은 사람 자리에 물기둥이 솟고 물방울이 사방으로 튄다 ----

const DROPS = 26
const dropGeometry = new THREE.SphereGeometry(0.28, 8, 6)

function Tsunami({ fx }: { fx: Active }) {
  const column = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const drops = useRef<(THREE.Mesh | null)[]>([])
  const center = useMemo(() => new THREE.Vector3(), [])
  const dirs = useMemo(() => Array.from({ length: DROPS }, (_, i) => ({ angle: (i / DROPS) * Math.PI * 2 + (i % 3) * 0.2, up: 9 + (i % 5) * 2, out: 4 + (i % 4) * 1.5 })), [])
  useFrame(() => {
    const anchor = anchorOf(fx.to)
    if (!anchor) return
    const s = (performance.now() - fx.at) / 1000
    toWorld(anchor.x, 0, anchor.z, center)
    const rise = easeOut(clamp01(s / 0.35))
    const fall = clamp01((s - 1.1) / 0.8)
    if (column.current) {
      column.current.position.copy(center)
      column.current.scale.set(1.8 * (1 - fall * 0.5), 0.01 + rise * 9 * (1 - fall), 1.8 * (1 - fall * 0.5))
      ;(column.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - fall)
    }
    if (ring.current) {
      const w = clamp01(s / 1.2)
      ring.current.position.set(center.x, 0.12, center.z)
      ring.current.scale.setScalar(1 + w * 8)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - w)
    }
    drops.current.forEach((drop, i) => {
      if (!drop) return
      const d = dirs[i]
      const tt = Math.max(0, s - 0.2)
      const y = d.up * tt - 9 * tt * tt
      drop.visible = s > 0.2 && y > -0.2
      drop.position.set(center.x + Math.cos(d.angle) * d.out * tt, Math.max(0, y) + 0.5, center.z + Math.sin(d.angle) * d.out * tt)
    })
  })
  return (
    <>
      <mesh ref={column}>
        <cylinderGeometry args={[0.9, 1.3, 1, 20, 1, true]} />
        <meshBasicMaterial color="#6EC3F2" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 1, 40]} />
        <meshBasicMaterial color="#3FA9E8" transparent depthWrite={false} />
      </mesh>
      {dirs.map((_, i) => (
        <mesh
          key={i}
          geometry={dropGeometry}
          visible={false}
          ref={(mesh) => {
            drops.current[i] = mesh
          }}
        >
          <meshBasicMaterial color={i % 2 ? '#BFE3F5' : '#6EC3F2'} />
        </mesh>
      ))}
    </>
  )
}

// ---- 🛸 외계 함대 강림: 거대한 모선이 1등 머리 위로 내려와 빛줄기를 쏜다 ----

function Mothership({ fx }: { fx: Active }) {
  const ship = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const lights = useRef<THREE.Group>(null)
  useFrame(() => {
    const anchor = anchorOf(fx.to)
    if (!anchor) return
    const s = (performance.now() - fx.at) / 1000
    const total = FX_MS.ufo / 1000
    const down = easeOut(clamp01(s / 0.7))
    const up = clamp01((s - total + 0.7) / 0.7)
    const height = 34 - down * 24 + up * up * 30
    if (ship.current) {
      toWorld(anchor.x, height, anchor.z, ship.current.position)
      ship.current.rotation.y = s * 1.5
    }
    if (lights.current) lights.current.children.forEach((light, i) => light.scale.setScalar(Math.sin(s * 12 + i) > 0 ? 1.3 : 0.7))
    if (beam.current) {
      const on = clamp01((s - 0.6) / 0.25) * (1 - up)
      toWorld(anchor.x, height / 2, anchor.z, beam.current.position)
      beam.current.scale.set(on, height, on)
      ;(beam.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * on
    }
  })
  return (
    <>
      <group ref={ship}>
        <mesh scale={[6.5, 1.1, 6.5]}>
          <sphereGeometry args={[1, 32, 12]} />
          <Ink color="#C9D2E3" thickness={3} />
        </mesh>
        <mesh position={[0, 1, 0]} scale={[2.6, 1.6, 2.6]}>
          <sphereGeometry args={[1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial color="#A8F0D8" transparent opacity={0.7} />
        </mesh>
        <group ref={lights}>
          {Array.from({ length: 12 }, (_, i) => (
            <mesh key={i} position={[Math.cos((i / 12) * Math.PI * 2) * 5.6, -0.3, Math.sin((i / 12) * Math.PI * 2) * 5.6]}>
              <sphereGeometry args={[0.32, 10, 8]} />
              <meshBasicMaterial color={i % 2 ? COLORS.yellow : COLORS.accent} />
            </mesh>
          ))}
        </group>
      </group>
      <mesh ref={beam}>
        <cylinderGeometry args={[1.2, 3.2, 1, 24, 1, true]} />
        <meshBasicMaterial color="#E7F27C" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

// ---- 🌀 차원 귀환문: 맞은 사람 발밑에 소용돌이가 열렸다가 빨아들인다 ----

function Vortex({ fx }: { fx: Active }) {
  const group = useRef<THREE.Group>(null)
  const rings = useRef<(THREE.Mesh | null)[]>([])
  const pillar = useRef<THREE.Mesh>(null)
  const origin = useRef(anchorOf(fx.to))
  useFrame(() => {
    const anchor = origin.current
    const node = group.current
    if (!anchor || !node) return
    const s = (performance.now() - fx.at) / 1000
    toWorld(anchor.x, 0, anchor.z, node.position)
    const open = easeOut(clamp01(s / 0.5))
    const close = clamp01((s - 1.1) / 0.6)
    rings.current.forEach((ring, i) => {
      if (!ring) return
      ring.rotation.z = s * (4 + i * 2) * (i % 2 ? -1 : 1)
      ring.scale.setScalar((1 + i * 0.9) * open * (1 - close))
      ring.position.y = 0.1 + i * 0.5 * open
    })
    if (pillar.current) {
      const flash = clamp01((s - 0.9) / 0.15) * (1 - clamp01((s - 1.2) / 0.5))
      pillar.current.scale.set(0.2 + flash * 1.6, 1, 0.2 + flash * 1.6)
      ;(pillar.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * flash
    }
  })
  return (
    <group ref={group}>
      {Array.from({ length: 4 }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          ref={(mesh) => {
            rings.current[i] = mesh
          }}
        >
          <torusGeometry args={[1, 0.12, 8, 40, Math.PI * 1.6]} />
          <meshBasicMaterial color={['#A259FF', '#6E3BD8', '#E3C8FF', '#8A5CF6'][i]} />
        </mesh>
      ))}
      <mesh ref={pillar} position={[0, 10, 0]}>
        <cylinderGeometry args={[1, 1, 20, 16, 1, true]} />
        <meshBasicMaterial color="#E3C8FF" transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
