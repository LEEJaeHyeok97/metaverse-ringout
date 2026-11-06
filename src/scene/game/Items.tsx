import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BIKES, COFFEES, ITEM_BOX_XS, ITEM_RESPAWN_MS, ITEM_ROWS } from '../../game/course'
import { run } from '../../game/run'
import { COLORS } from '../../lib/brand'
import { useConnection } from '../../net/connection'
import { Ink } from '../ink'
import { Label } from '../Label'
import { BikeModel } from '../StickFigure'
import { OnCourse } from './onCourse'

/** 길가에 세워진 따릉이. 누가 타고 가면 그 판에서는 사라진다. */
export function ParkedBikes() {
  const { bikes } = useConnection()
  return (
    <>
      {BIKES.filter((bike) => bikes[bike.id] === undefined).map((bike) => (
        <OnCourse key={bike.id} x={bike.x} z={bike.z} rotation={Math.PI}>
          <BikeModel />
          <Label text="🚲 따릉이" position={[0, 1.8, 0]} size={0.32} background="#E3F5E9" />
        </OnCourse>
      ))}
    </>
  )
}

/** 빙글빙글 도는 커피. 내가 먹은 것은 내 화면에서만 사라진다. */
export function Coffees() {
  const nodes = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    COFFEES.forEach((coffee, index) => {
      const node = nodes.current[index]
      if (!node) return
      node.visible = !run.coffees.has(coffee.id)
      node.rotation.y = clock.elapsedTime * 2
      node.position.y = 0.6 + Math.sin(clock.elapsedTime * 3 + index) * 0.12
    })
  })
  return (
    <>
      {COFFEES.map((coffee, index) => (
        <OnCourse key={coffee.id} x={coffee.x} z={coffee.z}>
          <group
            ref={(node) => {
              nodes.current[index] = node
            }}
          >
            <mesh>
              <cylinderGeometry args={[0.28, 0.2, 0.6, 16]} />
              <Ink color="#ffffff" />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.285, 0.25, 0.22, 16]} />
              <Ink color="#B07A4F" outline={false} />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.31, 0.31, 0.1, 16]} />
              <Ink color={COLORS.accent} />
            </mesh>
          </group>
        </OnCourse>
      ))}
    </>
  )
}

export function boxKey(row: number, slot: number) {
  return `${row}:${slot}`
}

const BOX_COLORS = ['#FFD84D', '#8FD3FF', '#FFB4A2', '#C7F0BD', '#E3C8FF']

/** 카트라이더처럼 길을 가로지르는 아이템 상자. 깨면 내 화면에서만 잠시 사라졌다가 다시 생긴다. */
export function ItemBoxes() {
  const nodes = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const now = performance.now()
    ITEM_ROWS.forEach((_, row) => {
      ITEM_BOX_XS.forEach((__, slot) => {
        const node = nodes.current[row * ITEM_BOX_XS.length + slot]
        if (!node) return
        const takenAt = run.boxesTaken.get(boxKey(row, slot))
        const gone = takenAt !== undefined && now - takenAt < ITEM_RESPAWN_MS
        node.visible = !gone
        node.rotation.y = clock.elapsedTime * 1.5 + slot
        node.position.y = 0.9 + Math.sin(clock.elapsedTime * 2.5 + slot) * 0.15
      })
    })
  })
  return (
    <>
      {ITEM_ROWS.map((z, row) => (
        <OnCourse key={z} z={z}>
          {ITEM_BOX_XS.map((x, slot) => (
            <group key={x} position={[x, 0, 0]}>
              <group
                ref={(node) => {
                  nodes.current[row * ITEM_BOX_XS.length + slot] = node
                }}
              >
                <mesh rotation={[0.4, 0, 0.4]}>
                  <boxGeometry args={[0.9, 0.9, 0.9]} />
                  <Ink color={BOX_COLORS[slot % BOX_COLORS.length]} thickness={2.4} />
                </mesh>
                <Label text="?" position={[0, 0, 0]} size={0.5} background={null} />
              </group>
            </group>
          ))}
        </OnCourse>
      ))}
    </>
  )
}

/** 누군가 떨어뜨린 바나나 껍질 */
export function Bananas() {
  const { bananas } = useConnection()
  return (
    <>
      {bananas.map((banana) => (
        <OnCourse key={banana.id} x={banana.x} z={banana.z} rotation={banana.id}>
          <group position={[0, 0.12, 0]}>
            {[0, 1, 2].map((index) => (
              <mesh key={index} rotation={[Math.PI / 2 - 0.3, 0, (index * Math.PI * 2) / 3]} position={[Math.cos((index * Math.PI * 2) / 3) * 0.25, 0, Math.sin((index * Math.PI * 2) / 3) * 0.25]} scale={[0.35, 0.6, 0.12]}>
                <sphereGeometry args={[0.6, 10, 8]} />
                <Ink color="#FFE15A" thickness={1.8} />
              </mesh>
            ))}
          </group>
        </OnCourse>
      ))}
    </>
  )
}
