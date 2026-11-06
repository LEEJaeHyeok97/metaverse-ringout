import { useMemo } from 'react'
import * as THREE from 'three'
import { courseFrame, groundAt, SLIDE, SLIDE_HEIGHT, STREET_HALF_W } from '../../game/course'
import { COLORS } from '../../lib/brand'
import { Ink } from '../ink'
import { Label } from '../Label'
import { OnCourse } from './onCourse'

const STRIPES = ['#FFD84D', '#FF9A3C', '#FF6FB5', '#8FD3FF', '#C7F0BD', '#E3C8FF']
const HALF = STREET_HALF_W - 0.5

/** 미끄럼틀을 따라 휘어지는 띠. y는 그 거리의 땅 높이에 offset을 더한다. */
function useSlideStrip(left: number, right: number, from: number, to: number, offset = 0.06, vertical = false) {
  return useMemo(() => {
    const positions: number[] = []
    const indices: number[] = []
    let row = 0
    for (let z = from; z >= to - 0.001; z -= 0.5) {
      const ground = groundAt(z)
      const a = courseFrame(left, z)
      const b = courseFrame(right, z)
      if (vertical) {
        // 옆 난간: 같은 x에서 바닥부터 offset 높이까지 세운 벽
        positions.push(a.x, ground, a.z, a.x, ground + offset, a.z)
      } else {
        positions.push(a.x, ground + offset, a.z, b.x, ground + offset, b.z)
      }
      if (row > 0) {
        const i = row * 2
        indices.push(i - 2, i - 1, i, i - 1, i + 1, i)
      }
      row += 1
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }, [left, right, from, to, offset, vertical])
}

function Stripe({ index, count, from, to }: { index: number; count: number; from: number; to: number }) {
  const width = (HALF * 2) / count
  const left = -HALF + index * width
  const geometry = useSlideStrip(left, left + width, from, to)
  return (
    <mesh geometry={geometry}>
      <meshToonMaterial color={STRIPES[index % STRIPES.length]} side={THREE.DoubleSide} />
    </mesh>
  )
}

function Rail({ x, from, to }: { x: number; from: number; to: number }) {
  const wall = useSlideStrip(x, x, from, to, 1.1, true)
  const top = useSlideStrip(x - 0.15, x + 0.15, from, to, 1.15)
  return (
    <>
      <mesh geometry={wall}>
        <meshToonMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh geometry={top}>
        <meshBasicMaterial color={COLORS.ink} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

/**
 * 맵 가운데의 대왕 미끄럼틀. 계단을 올라 넓은 무지개 미끄럼틀을 쭉 타고 내려간다.
 * 높이는 course.ts의 groundAt()을 그대로 따른다.
 */
export function Slide() {
  const slide = SLIDE
  const steps = useMemo(() => {
    if (!slide) return []
    const count = 8
    return Array.from({ length: count }, (_, i) => {
      const z = slide.from - ((i + 0.5) / count) * (slide.from - slide.top)
      return { z, height: groundAt(z) }
    })
  }, [slide])
  if (!slide) return null
  return (
    <>
      {/* 계단 */}
      {steps.map((step) => (
        <OnCourse key={step.z} z={step.z}>
          <mesh position={[0, step.height / 2, 0]}>
            <boxGeometry args={[HALF * 2, step.height, (slide.from - slide.top) / steps.length + 0.02]} />
            <Ink color="#E9D7B9" thickness={1.6} />
          </mesh>
        </OnCourse>
      ))}
      {/* 꼭대기 발판 */}
      <OnCourse z={slide.top + 0.3}>
        <mesh position={[0, SLIDE_HEIGHT - 0.1, 0]}>
          <boxGeometry args={[HALF * 2, 0.2, 0.8]} />
          <Ink color="#FFF6C9" thickness={1.6} />
        </mesh>
        <Label text="🛝 대왕 미끄럼틀 · 슈우웅~" position={[0, SLIDE_HEIGHT + 3.2, 0]} size={0.7} color={COLORS.accent} background="#FFF6C9" />
        {/* 입구 아치 */}
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (HALF + 0.3), SLIDE_HEIGHT + 1.2, 0]}>
            <cylinderGeometry args={[0.25, 0.25, 2.6, 10]} />
            <Ink color={COLORS.accent} thickness={1.8} />
          </mesh>
        ))}
        <mesh position={[0, SLIDE_HEIGHT + 2.5, 0]}>
          <boxGeometry args={[HALF * 2 + 1, 0.4, 0.4]} />
          <Ink color={COLORS.accent} thickness={1.8} />
        </mesh>
      </OnCourse>
      {/* 무지개 미끄럼판 */}
      {STRIPES.map((_, i) => (
        <Stripe key={i} index={i} count={STRIPES.length} from={slide.top} to={slide.to} />
      ))}
      <Rail x={-HALF} from={slide.top} to={slide.to} />
      <Rail x={HALF} from={slide.top} to={slide.to} />
      {/* 아래 받침 기둥 */}
      {[0.25, 0.5].map((t) => {
        const z = slide.top - (slide.top - slide.to) * t
        return [-1, 1].map((side) => (
          <OnCourse key={`${t},${side}`} x={side * (HALF - 1)} z={z}>
            <mesh position={[0, groundAt(z) / 2, 0]}>
              <cylinderGeometry args={[0.2, 0.2, groundAt(z), 8]} />
              <Ink color="#ffffff" thickness={1.4} />
            </mesh>
          </OnCourse>
        ))
      })}
    </>
  )
}
