import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PAD_RADIUS, PADS, type Pad } from '../../game/course'
import { Ink } from '../ink'
import { OnCourse } from './onCourse'

const arrowShape = (() => {
  const shape = new THREE.Shape()
  shape.moveTo(-0.6, -0.15)
  shape.lineTo(0, 0.35)
  shape.lineTo(0.6, -0.15)
  shape.lineTo(0.6, -0.45)
  shape.lineTo(0, 0.05)
  shape.lineTo(-0.6, -0.45)
  shape.closePath()
  return new THREE.ShapeGeometry(shape)
})()

/** 대시 발판: 주황 판 위로 노란 화살표가 앞으로 계속 흘러간다. */
function DashPad() {
  const arrows = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    arrows.current?.children.forEach((arrow, i) => {
      const t = (clock.elapsedTime * 1.6 + i / 3) % 1
      arrow.position.z = 0.9 - t * 1.8
      const material = (arrow as THREE.Mesh).material as THREE.MeshBasicMaterial
      material.opacity = Math.sin(t * Math.PI)
    })
  })
  return (
    <>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[PAD_RADIUS * 1.6, 0.1, PAD_RADIUS * 2]} />
        <Ink color="#FF8A3C" thickness={1.6} />
      </mesh>
      <group ref={arrows} position={[0, 0.12, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} geometry={arrowShape} rotation={[-Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color="#FFE45C" transparent depthWrite={false} />
          </mesh>
        ))}
      </group>
    </>
  )
}

/** 점프 발판: 용수철 위의 분홍 트램펄린. 통통 튄다. */
function JumpPad() {
  const top = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (top.current) top.current.position.y = 0.5 + Math.abs(Math.sin(clock.elapsedTime * 4)) * 0.12
  })
  return (
    <>
      {[0.15, 0.3].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[PAD_RADIUS * 0.75, 0.06, 6, 24]} />
          <meshBasicMaterial color="#555555" />
        </mesh>
      ))}
      <group ref={top}>
        <mesh>
          <cylinderGeometry args={[PAD_RADIUS, PAD_RADIUS, 0.18, 28]} />
          <Ink color="#FF5FA2" thickness={1.8} />
        </mesh>
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[PAD_RADIUS * 0.45, PAD_RADIUS * 0.6, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
    </>
  )
}

function PadOnCourse({ pad }: { pad: Pad }) {
  return <OnCourse x={pad.x} z={pad.z}>{pad.kind === 'dash' ? <DashPad /> : <JumpPad />}</OnCourse>
}

/** 길 위의 대시 발판과 점프 발판 */
export function Pads() {
  return (
    <>
      {PADS.map((pad) => (
        <PadOnCourse key={`${pad.x},${pad.z}`} pad={pad} />
      ))}
    </>
  )
}
