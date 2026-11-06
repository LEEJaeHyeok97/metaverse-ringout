import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { courseFrame, halfWidthAt, type Frame } from '../../game/course'
import { COLORS } from '../../lib/brand'

const scratch: Frame = { x: 0, z: 0, angle: 0 }

/** 코스 좌표 (x, z)에 놓인 물체를 휘어진 도로 위의 실제 자리와 방향으로 옮긴다. */
export function OnCourse({ x = 0, z, y = 0, rotation = 0, children }: { x?: number; z: number; y?: number; rotation?: number; children: ReactNode }) {
  const frame = useMemo(() => courseFrame(x, z), [x, z])
  return (
    <group position={[frame.x, y, frame.z]} rotation={[0, rotation - frame.angle, 0]}>
      {children}
    </group>
  )
}

/** 매 프레임 움직이는 물체를 코스 좌표에서 실제 자리로 옮긴다. heading은 코스 좌표 기준 방향이다. */
export function placeOnCourse(object: THREE.Object3D, x: number, y: number, z: number, heading = 0) {
  courseFrame(x, z, scratch)
  object.position.set(scratch.x, y, scratch.z)
  object.rotation.y = heading - scratch.angle
  return scratch.angle
}

type RibbonOptions = {
  from: number
  to: number
  /** 이 거리(z)에서 리본의 왼쪽, 오른쪽 가장자리(코스 x) */
  edges: (z: number) => [number, number]
  step?: number
  y?: number
  /** 텍스처 한 칸이 차지하는 길이 */
  cell?: number
}

/** 도로를 따라 휘어지는 띠. 도로 바닥과 가장자리 선에 쓴다. */
export function useRibbon({ from, to, edges, step = 1, y = 0, cell = 2 }: RibbonOptions) {
  return useMemo(() => {
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    let row = 0
    for (let s = -from; s <= -to + 0.001; s += step) {
      const z = -s
      const [left, right] = edges(z)
      const a = courseFrame(left, z)
      positions.push(a.x, y, a.z)
      uvs.push(left / cell, s / cell)
      const b = courseFrame(right, z)
      positions.push(b.x, y, b.z)
      uvs.push(right / cell, s / cell)
      if (row > 0) {
        const i = row * 2
        indices.push(i - 2, i - 1, i, i - 1, i + 1, i)
      }
      row += 1
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
    // edges는 매번 새 함수여도 모양이 같으므로 범위만으로 다시 만든다.
  }, [from, to, step, y, cell])
}

/** 도로 바닥(모눈)과 양쪽 펜 선 */
export function RoadSurface({ from, to, texture }: { from: number; to: number; texture: THREE.Texture }) {
  const road = useRibbon({ from, to, edges: (z) => [-halfWidthAt(z) - 0.4, halfWidthAt(z) + 0.4], y: 0.01 })
  const left = useRibbon({ from, to, edges: (z) => [-halfWidthAt(z) - 0.55, -halfWidthAt(z) - 0.2], y: 0.03, step: 0.5 })
  const right = useRibbon({ from, to, edges: (z) => [halfWidthAt(z) + 0.2, halfWidthAt(z) + 0.55], y: 0.03, step: 0.5 })
  return (
    <>
      <mesh geometry={road}>
        <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={left}>
        <meshBasicMaterial color={COLORS.ink} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={right}>
        <meshBasicMaterial color={COLORS.ink} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}
