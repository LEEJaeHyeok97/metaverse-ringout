import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { connection } from '../net/connection'
import { self } from './input'
import { Label } from './Label'
import { courseFrame } from '../game/course'
import type { HitEvent } from '../net/connection'

const SHOW_MS = 700

const WORDS: Record<HitEvent['kind'], string> = { punch: '퍽!', kick: '뻥!', balloon: '풍덩!', ufo: '슈우웅~', warp: '휘리릭!' }

function Pow({ to, at, kind, curved, onDone }: { to: number; at: number; kind: HitEvent['kind']; curved: boolean; onDone: () => void }) {
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
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
      node.position.set(spot.x, target.y + 1.3 + elapsed / 900, spot.z)
    }
    node.scale.setScalar(0.6 + Math.min(elapsed / 120, 1) * 0.6)
  })
  return (
    <group ref={group}>
      <Label text={WORDS[kind]} size={0.7} color="#EA6E3E" background="#FFF6C9" />
    </group>
  )
}

/** 누군가 맞으면 그 사람 머리 위에 "퍽!"을 띄운다. */
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
