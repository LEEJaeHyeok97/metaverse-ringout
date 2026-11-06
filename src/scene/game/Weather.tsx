import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Weather as WeatherKind } from '../../game/course'

const HALF = 32
const HEIGHT = 24

const SETTINGS = {
  rain: { count: 900, color: '#6E95BA', size: 0, fall: 30, sway: 0 },
  snow: { count: 700, color: '#AFC6DC', size: 0.32, fall: 3, sway: 0.9 },
  leaves: { count: 260, color: '#E9874A', size: 0.45, fall: 2.4, sway: 1.8 },
} as const

/** 둥근 점 모양. 눈송이와 낙엽을 네모 대신 동그랗게 그린다. */
function useDotTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(16, 16, 14, 0, Math.PI * 2)
    ctx.fill()
    return new THREE.CanvasTexture(canvas)
  }, [])
}

/** 카메라 주변에만 내리는 비, 눈, 낙엽. 화면 장식이라 판정에는 쓰지 않는다. */
export function Weather({ kind }: { kind: WeatherKind }) {
  if (kind === 'none') return null
  return <Particles key={kind} kind={kind} />
}

function Particles({ kind }: { kind: Exclude<WeatherKind, 'none'> }) {
  const settings = SETTINGS[kind]
  const streaks = kind === 'rain'
  const group = useRef<THREE.Group>(null)
  const dot = useDotTexture()
  const { geometry, seeds } = useMemo(() => {
    const vertices = streaks ? 2 : 1
    const positions = new Float32Array(settings.count * vertices * 3)
    const seeds = Array.from({ length: settings.count }, () => ({
      x: (Math.random() * 2 - 1) * HALF,
      y: Math.random() * HEIGHT,
      z: (Math.random() * 2 - 1) * HALF,
      phase: Math.random() * Math.PI * 2,
      speed: 0.7 + Math.random() * 0.6,
    }))
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return { geometry, seeds }
  }, [settings.count, streaks])

  useFrame(({ camera, clock }, delta) => {
    const node = group.current
    if (!node) return
    // 화면에 보이는 곳에만 내리면 되므로 카메라를 따라다닌다.
    node.position.set(Math.floor(camera.position.x), 0, Math.floor(camera.position.z))
    const dt = Math.min(delta, 0.1)
    const t = clock.elapsedTime
    const array = geometry.attributes.position.array as Float32Array
    seeds.forEach((seed, i) => {
      seed.y -= settings.fall * seed.speed * dt
      if (seed.y < 0) seed.y += HEIGHT
      const sway = Math.sin(t * 1.3 + seed.phase) * settings.sway
      const x = seed.x + sway
      const z = seed.z + Math.cos(t * 0.9 + seed.phase) * settings.sway * 0.5
      if (streaks) {
        array.set([x, seed.y, z, x + 0.08, seed.y + 0.9, z], i * 6)
      } else {
        array.set([x, seed.y, z], i * 3)
      }
    })
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <group ref={group}>
      {streaks ? (
        <lineSegments geometry={geometry} frustumCulled={false}>
          <lineBasicMaterial color={settings.color} transparent opacity={0.55} depthWrite={false} />
        </lineSegments>
      ) : (
        <points geometry={geometry} frustumCulled={false}>
          <pointsMaterial color={settings.color} size={settings.size} map={dot} alphaTest={0.5} transparent depthWrite={false} />
        </points>
      )}
    </group>
  )
}
