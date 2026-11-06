import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STATUE, STONE_COUNT, VOXEL, VOXELS, type VoxelPart } from '../game/statue'
import { shake } from '../game/run'
import { audio } from '../lib/audio'
import { COLORS } from '../lib/brand'
import { connection, useConnection } from '../net/connection'
import { Label } from './Label'

const PART_COLORS: Record<VoxelPart, string> = {
  stone: '#C9C3B6',
  ring: COLORS.accent,
  face: '#ffffff',
  hand: COLORS.ink,
  bell: '#F7A26F',
  leg: COLORS.ink,
}
const PARTS = Object.keys(PART_COLORS) as VoxelPart[]

const cube = new THREE.BoxGeometry(VOXEL * 0.96, VOXEL * 0.96, VOXEL * 0.96)
const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
const scratch = new THREE.Matrix4()

/** 같은 색 블록을 한 번에 그린다. 깨진 돌은 크기를 0으로 숨긴다. */
function VoxelGroup({ part, removed }: { part: VoxelPart; removed: ReadonlySet<number> }) {
  const voxels = useMemo(() => VOXELS.filter((voxel) => voxel.part === part), [part])
  const body = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = body.current
    if (mesh) {
      voxels.forEach((voxel, i) => {
        mesh.setMatrixAt(i, removed.has(voxel.index) ? hidden : scratch.makeTranslation(voxel.x, voxel.y, voxel.z))
      })
      mesh.instanceMatrix.needsUpdate = true
    }
  }, [voxels, removed])
  return (
    <instancedMesh ref={body} args={[cube, undefined, voxels.length]}>
      <meshToonMaterial color={PART_COLORS[part]} />
    </instancedMesh>
  )
}

type Chip = { key: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; at: number }
let chipKey = 0
const CHIP_MS = 1100

/** 깨진 돌 파편: 찬 사람 반대쪽으로 튀어 오르다 떨어진다. */
function Chips() {
  const [chips, setChips] = useState<Chip[]>([])
  const nodes = useRef(new Map<number, THREE.Mesh>())
  useEffect(
    () =>
      connection.onChips((indices, by) => {
        const kicker = by === connection.getState().myId ? null : connection.positions.get(by)
        const now = performance.now()
        const fresh = indices.map((index) => {
          const voxel = VOXELS[index]
          const fromX = kicker?.x ?? voxel.x
          const fromZ = kicker?.z ?? voxel.z + 3
          const angle = Math.atan2(voxel.x - fromX, voxel.z - fromZ) + (Math.random() - 0.5) * 1.2
          const speed = 2 + Math.random() * 3
          return { key: chipKey++, x: voxel.x, y: voxel.y, z: voxel.z, vx: Math.sin(angle) * speed, vy: 3 + Math.random() * 4, vz: Math.cos(angle) * speed, at: now }
        })
        setChips((list) => [...list.filter((chip) => now - chip.at < CHIP_MS), ...fresh])
        audio.effect('smack')
        if (by === connection.getState().myId) shake(0.3, 180)
      }),
    [],
  )
  useFrame(() => {
    const now = performance.now()
    for (const chip of chips) {
      const node = nodes.current.get(chip.key)
      if (!node) continue
      const s = (now - chip.at) / 1000
      node.visible = s * 1000 < CHIP_MS
      node.position.set(chip.x + chip.vx * s, Math.max(0.15, chip.y + chip.vy * s - 9 * s * s), chip.z + chip.vz * s)
      node.rotation.set(s * 9, s * 7, 0)
      node.scale.setScalar(Math.max(0.01, 1 - s * 0.6))
    }
  })
  return (
    <>
      {chips.map((chip) => (
        <mesh
          key={chip.key}
          geometry={cube}
          ref={(mesh) => {
            if (mesh) nodes.current.set(chip.key, mesh)
            else nodes.current.delete(chip.key)
          }}
        >
          <meshToonMaterial color={PART_COLORS.stone} />
        </mesh>
      ))}
    </>
  )
}

/** 다 깎으면 반짝이가 빙글빙글 돈다. */
function Sparkles() {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = clock.elapsedTime * 0.8
    group.current.children.forEach((child, i) => {
      child.position.y = 2 + ((clock.elapsedTime * 1.5 + i * 0.7) % 9)
    })
  })
  return (
    <group ref={group} position={[STATUE.x, 0, STATUE.z]}>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[Math.cos(i) * 5.5, 2, Math.sin(i) * 5.5]}>
          <octahedronGeometry args={[0.22]} />
          <meshBasicMaterial color={i % 2 ? COLORS.yellow : COLORS.accent} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * 광장 가운데의 링아웃 로고 조각상. 커다란 돌덩이를 모두 함께 발로 차서 로고를 깎아 낸다.
 * 다 깎으면 반짝이고, 잠시 뒤 다시 돌덩이가 된다.
 */
export function Statue() {
  const { statue } = useConnection()
  const left = STONE_COUNT - statue.removed.size
  const progress = Math.round((statue.removed.size / STONE_COUNT) * 100)
  return (
    <>
      {PARTS.map((part) => (
        <VoxelGroup key={part} part={part} removed={statue.removed} />
      ))}
      {/* 받침대 */}
      <mesh position={[STATUE.x, 0.3, STATUE.z]}>
        <cylinderGeometry args={[STATUE.r, STATUE.r + 0.3, 0.6, 32]} />
        <meshToonMaterial color="#E9D7B9" />
      </mesh>
      <Chips />
      {statue.complete ? (
        <>
          <Sparkles />
          <Label text="✨ 링아웃 조각상 완성! ✨" position={[STATUE.x, 9.6, STATUE.z]} size={0.7} color={COLORS.accent} background="#FFF6C9" />
        </>
      ) : (
        <Label text={`🗿 발차기(G)로 조각하기 · ${progress}% (남은 돌 ${left})`} position={[STATUE.x, 9.4, STATUE.z + 1]} size={0.42} background="#FFF6C9" />
      )}
    </>
  )
}
