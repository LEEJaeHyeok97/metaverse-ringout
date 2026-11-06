import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { connection } from '../net/connection'
import { self } from './input'
import { Label } from './Label'
import { courseFrame } from '../game/course'
import type { HitEvent } from '../net/connection'

const SHOW_MS = 800

/** 맞을 때마다 조금씩 다른 소리를 낸다. */
const WORDS: Record<HitEvent['kind'], string[]> = {
  punch: ['퍽!', '빡!', '팍!', '콰직!'],
  kick: ['뻥!', '퍼억!', '뻐어엉!'],
  ram: ['쾅!!', '콰앙!!', '와장창!'],
  balloon: ['풍덩!'],
  ufo: ['슈우웅~'],
  warp: ['휘리릭!'],
}
const BURST: Partial<Record<HitEvent['kind'], { color: string; size: number }>> = {
  punch: { color: '#FFD84D', size: 1 },
  kick: { color: '#FF9A3C', size: 1.3 },
  ram: { color: '#F0473C', size: 1.8 },
}
/** 주먹과 발차기는 가끔 크리티컬이 뜬다. 보기에만 그렇다. */
const CRITICAL_CHANCE = 0.18

const SPIKES = 10
const spikeGeometry = new THREE.ConeGeometry(0.16, 1, 4)
const sparkGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5)

function Pow({ to, at, kind, curved, onDone }: { to: number; at: number; kind: HitEvent['kind']; curved: boolean; onDone: () => void }) {
  const group = useRef<THREE.Group>(null)
  const word = useRef<THREE.Group>(null)
  const star = useRef<THREE.Group>(null)
  const flash = useRef<THREE.Mesh>(null)
  const sparks = useRef<(THREE.Mesh | null)[]>([])
  const burst = BURST[kind]
  const look = useMemo(() => {
    const words = WORDS[kind]
    const critical = (kind === 'punch' || kind === 'kick') && Math.random() < CRITICAL_CHANCE
    return {
      text: critical ? 'CRITICAL!!' : words[Math.floor(Math.random() * words.length)],
      critical,
      tilt: (Math.random() - 0.5) * 0.5,
      sparks: Array.from({ length: 9 }, (_, i) => ({ angle: (i / 9) * Math.PI * 2 + Math.random() * 0.4, up: 0.5 + Math.random() * 1.6, speed: 3 + Math.random() * 3 })),
    }
  }, [kind])

  useFrame(({ camera }) => {
    const node = group.current
    if (!node) return
    const elapsed = performance.now() - at
    if (elapsed > SHOW_MS) {
      onDone()
      return
    }
    const target = to === connection.getState().myId ? self : connection.positions.get(to)
    if (target) {
      const spot = curved ? courseFrame(target.x, target.z) : target
      node.position.set(spot.x, target.y + 1.1, spot.z)
    }
    const s = elapsed / 1000
    // 글자: 크게 튀어나왔다가 살짝 줄고, 처음 0.1초는 부르르 떤다.
    if (word.current) {
      const pop = s < 0.08 ? s / 0.08 : 1
      const size = (look.critical ? 1.5 : 1) * (0.4 + pop * 0.9 - Math.max(0, s - 0.08) * 0.3)
      word.current.scale.setScalar(size)
      word.current.position.set(s < 0.12 ? (Math.random() - 0.5) * 0.25 : 0, 0.6 + s * 1.2, 0)
      word.current.rotation.z = look.tilt
    }
    // 충격 별: 한순간 커졌다가 사라진다. 카메라를 향해 세운다.
    if (star.current) {
      const grow = Math.min(s / 0.1, 1)
      const fade = Math.max(0, 1 - s / 0.35)
      star.current.visible = fade > 0
      star.current.quaternion.copy(camera.quaternion)
      star.current.scale.setScalar((burst?.size ?? 1) * (0.3 + grow * 1.1) * (look.critical ? 1.4 : 1))
      star.current.rotation.z += 0.08
    }
    if (flash.current) {
      const f = Math.max(0, 1 - s / 0.18)
      flash.current.scale.setScalar((burst?.size ?? 1) * (0.5 + (1 - f) * 1.5))
      ;(flash.current.material as THREE.MeshBasicMaterial).opacity = f * 0.9
    }
    sparks.current.forEach((spark, i) => {
      if (!spark) return
      const d = look.sparks[i]
      const travel = d.speed * s
      spark.visible = s < 0.45
      spark.position.set(Math.cos(d.angle) * travel, d.up * travel - 4 * s * s, Math.sin(d.angle) * travel)
      spark.lookAt(spark.position.x * 2, spark.position.y * 2, spark.position.z * 2)
    })
  })

  return (
    <group ref={group}>
      {burst && (
        <>
          <mesh ref={flash}>
            <sphereGeometry args={[0.6, 16, 12]} />
            <meshBasicMaterial color="#ffffff" transparent depthWrite={false} />
          </mesh>
          <group ref={star}>
            {Array.from({ length: SPIKES }, (_, i) => {
              const angle = (i / SPIKES) * Math.PI * 2
              const length = i % 2 ? 0.7 : 1.1
              return (
                <mesh key={i} geometry={spikeGeometry} position={[Math.cos(angle) * length * 0.5, Math.sin(angle) * length * 0.5, 0]} rotation={[0, 0, angle - Math.PI / 2]} scale={[1, length, 1]}>
                  <meshBasicMaterial color={burst.color} />
                </mesh>
              )
            })}
          </group>
          {look.sparks.map((_, i) => (
            <mesh
              key={i}
              geometry={sparkGeometry}
              ref={(mesh) => {
                sparks.current[i] = mesh
              }}
            >
              <meshBasicMaterial color={i % 2 ? '#ffffff' : burst.color} />
            </mesh>
          ))}
        </>
      )}
      <group ref={word}>
        <Label text={look.text} size={look.critical ? 0.6 : 0.7} color={look.critical ? '#F0473C' : '#EA6E3E'} background={look.critical ? '#FFE9A8' : '#FFF6C9'} />
      </group>
    </group>
  )
}

/** 누군가 맞으면 그 자리에 충격 별, 섬광, 파편과 "퍽!"을 띄운다. */
export function PunchEffects({ curved = false }: { curved?: boolean }) {
  const [effects, setEffects] = useState<{ key: number; to: number; at: number; kind: HitEvent['kind'] }[]>([])
  useEffect(() => {
    let key = 0
    return connection.onPunch((punch) => setEffects((list) => [...list.slice(-6), { key: key++, to: punch.to, at: punch.at, kind: punch.kind }]))
  }, [])
  return (
    <>
      {effects.map((effect) => (
        <Pow key={effect.key} to={effect.to} at={effect.at} kind={effect.kind} curved={curved} onDone={() => setEffects((list) => list.filter((item) => item.key !== effect.key))} />
      ))}
    </>
  )
}
