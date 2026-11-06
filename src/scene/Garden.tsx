import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ordinal, type PlantedTree } from '../data/garden'
import { GARDEN, gardenTile, GARDEN_TILES } from '../game/lobby'
import { COLORS } from '../lib/brand'
import { Ink, penMaterial } from './ink'
import { Label } from './Label'
import { SeedModel } from './Seed'

const SOIL = '#E9D7B9'
const SOIL_DARK = '#C9A27A'
const LEAF_DARK = '#9CD07A'
const TRUNK = '#A8754B'

const MOUND_MS = 350
const SEED_FALL_MS = 700
const GROW_FROM_MS = 750
const GROW_MS = 1200
const SPARKLE_FROM_MS = 1000
const SPARKLE_MS = 900
/** 이 시간이 지나면 연출 없이 다 자란 나무로 그린다. */
export const PLANT_ANIMATION_MS = 2400

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)
/** 살짝 넘쳤다가 돌아오는 곡선 */
function easeOutBack(t: number) {
  const c = 1.9
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
}

const sparkleGeometry = new THREE.OctahedronGeometry(0.12)
const SPARKLE_COUNT = 8

/** 정원에 심은 나무. 막 심었으면 흙이 솟고, 씨앗이 떨어지고, 나무가 쑥 자라는 연출을 한다. */
function GardenTree({ tree, index }: { tree: PlantedTree; index: number }) {
  const spot = gardenTile(tree.tile)
  const mound = useRef<THREE.Mesh>(null)
  const seed = useRef<THREE.Group>(null)
  const trunk = useRef<THREE.Group>(null)
  const canopy = useRef<THREE.Group>(null)
  const sparkles = useRef<THREE.Group>(null)
  const [fresh, setFresh] = useState(() => Date.now() - tree.at < PLANT_ANIMATION_MS)
  // 나무마다 조금씩 다른 모양
  const lean = ((tree.tile * 37) % 10) / 60 - 0.08
  const size = 0.9 + ((tree.tile * 13) % 5) / 15

  useFrame(({ clock }) => {
    const elapsed = Date.now() - tree.at
    if (fresh && elapsed > PLANT_ANIMATION_MS + 200) setFresh(false)
    const done = elapsed >= PLANT_ANIMATION_MS
    if (mound.current) mound.current.scale.setScalar(done ? 1 : Math.max(0.01, easeOutBack(clamp01(elapsed / MOUND_MS))))
    if (seed.current) {
      const fall = clamp01(elapsed / SEED_FALL_MS)
      seed.current.visible = !done && elapsed < GROW_FROM_MS + 150
      seed.current.position.y = 4 * (1 - fall * fall) + 0.1
      seed.current.rotation.y = fall * Math.PI * 4
      seed.current.scale.setScalar(elapsed > GROW_FROM_MS ? Math.max(0.01, 1 - (elapsed - GROW_FROM_MS) / 150) : 1)
    }
    const grow = done ? 1 : clamp01((elapsed - GROW_FROM_MS) / GROW_MS)
    if (trunk.current) trunk.current.scale.set(1, Math.max(0.01, easeOutBack(grow)), 1)
    if (canopy.current) {
      canopy.current.scale.setScalar(Math.max(0.01, easeOutBack(clamp01((grow - 0.2) / 0.8)) * size))
      // 다 자란 나무는 바람에 살랑인다.
      canopy.current.rotation.z = Math.sin(clock.elapsedTime * 1.3 + tree.tile) * 0.04
    }
    if (sparkles.current) {
      const spark = clamp01((elapsed - SPARKLE_FROM_MS) / SPARKLE_MS)
      sparkles.current.visible = !done && spark > 0 && spark < 1
      sparkles.current.children.forEach((child, i) => {
        const angle = (i / SPARKLE_COUNT) * Math.PI * 2
        child.position.set(Math.cos(angle) * spark * 1.8, 1.6 + spark * 1.2 - spark * spark * 0.8, Math.sin(angle) * spark * 1.8)
        child.scale.setScalar(1 - spark)
      })
    }
  })

  return (
    <group position={[spot.x, 0, spot.z]}>
      <mesh ref={mound} position={[0, 0.06, 0]} scale={[1, 1, 1]}>
        <sphereGeometry args={[0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Ink color={SOIL_DARK} thickness={1.8} />
      </mesh>
      <group ref={seed} visible={false}>
        <SeedModel stage="seed" />
      </group>
      <group rotation={[0, 0, lean]}>
        <group ref={trunk}>
          <mesh position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 1.8, 8]} />
            <Ink color={TRUNK} thickness={1.8} />
          </mesh>
        </group>
        <group ref={canopy} position={[0, 1.9, 0]}>
          <mesh position={[0, 0.4, 0]}>
            <sphereGeometry args={[0.85, 16, 12]} />
            <Ink color={COLORS.leaf} />
          </mesh>
          <mesh position={[-0.6, 0.05, 0.1]}>
            <sphereGeometry args={[0.55, 14, 10]} />
            <Ink color={LEAF_DARK} />
          </mesh>
          <mesh position={[0.6, 0.1, -0.1]}>
            <sphereGeometry args={[0.55, 14, 10]} />
            <Ink color={LEAF_DARK} />
          </mesh>
          {/* 씨앗 캐릭터가 자란 나무라는 표시로 작은 열매를 단다. */}
          <mesh position={[0.25, -0.15, 0.7]}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <Ink color="#A8754B" thickness={1.4} />
          </mesh>
        </group>
      </group>
      <group ref={sparkles} visible={false}>
        {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
          <mesh key={i} geometry={sparkleGeometry}>
            <meshBasicMaterial color={i % 2 ? COLORS.yellow : COLORS.accent} />
          </mesh>
        ))}
      </group>
      {fresh && <Label text={`🌳 ${ordinal(index + 1)} 번째 나무!`} position={[0, 4.2, 0]} size={0.4} background="#E3F5E9" />}
    </group>
  )
}

type GardenProps = {
  planted: PlantedTree[]
  /** 심을 수 있는 나무 수. 0보다 크면 빈 타일이 반짝인다. */
  plantable: number
  /** 내가 서 있는 타일 */
  standingTile: number | null
  onPlant: (tile: number) => void
}

/** 광장의 나의 정원. 빈 타일을 누르거나 그 위에서 스페이스를 누르면 다 자란 나무를 심는다. */
export function GardenPlot({ planted, plantable, standingTile, onPlant }: GardenProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const glow = useRef<THREE.MeshBasicMaterial[]>([])
  const taken = new Set(planted.map((tree) => tree.tile))

  useFrame(({ clock }) => {
    const pulse = 0.35 + (Math.sin(clock.elapsedTime * 4) + 1) * 0.25
    glow.current.forEach((material) => {
      if (material) material.opacity = pulse
    })
  })

  const width = GARDEN.cols * GARDEN.tile
  const depth = GARDEN.rows * GARDEN.tile
  let glowIndex = 0
  glow.current = []

  return (
    <group>
      {/* 정원 울타리 바닥 */}
      <mesh position={[GARDEN.x, 0.03, GARDEN.z]}>
        <boxGeometry args={[width + 0.6, 0.06, depth + 0.6]} />
        <Ink color="#DCEFD0" thickness={2} />
      </mesh>
      {Array.from({ length: GARDEN_TILES }, (_, tile) => {
        const spot = gardenTile(tile)
        const empty = !taken.has(tile)
        const active = empty && plantable > 0
        const highlighted = active && (hovered === tile || standingTile === tile)
        return (
          <group key={tile} position={[spot.x, 0, spot.z]}>
            <mesh
              position={[0, 0.1, 0]}
              onClick={(event) => {
                event.stopPropagation()
                if (active) onPlant(tile)
              }}
              onPointerOver={(event) => {
                event.stopPropagation()
                setHovered(tile)
                if (active) document.body.style.cursor = 'pointer'
              }}
              onPointerOut={() => {
                setHovered((value) => (value === tile ? null : value))
                document.body.style.cursor = ''
              }}
            >
              <boxGeometry args={[GARDEN.tile - 0.25, 0.12, GARDEN.tile - 0.25]} />
              <Ink color={highlighted ? '#FFE9A8' : SOIL} thickness={1.6} />
            </mesh>
            {active && (
              <mesh position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.55, 0.75, 32]} />
                <meshBasicMaterial
                  ref={(material) => {
                    if (material) glow.current[glowIndex++] = material
                  }}
                  color={COLORS.green}
                  transparent
                />
              </mesh>
            )}
            {highlighted && <Label text="여기에 심기 🌱" position={[0, 1.2, 0]} size={0.32} background="#FFF6C9" />}
          </group>
        )
      })}
      {planted.map((tree, index) => (
        <GardenTree key={tree.tile} tree={tree} index={index} />
      ))}
      {/* 팻말 */}
      <group position={[GARDEN.x - width / 2 - 0.9, 0, GARDEN.z + depth / 2]}>
        <mesh position={[0, 0.8, 0]} material={penMaterial}>
          <cylinderGeometry args={[0.06, 0.06, 1.6, 6]} />
        </mesh>
        <Label text={plantable > 0 ? `🌳 나의 정원 · 심을 나무 ${plantable}그루` : '🌳 나의 정원'} position={[0, 2, 0]} size={0.42} background="#E3F5E9" />
      </group>
    </group>
  )
}
