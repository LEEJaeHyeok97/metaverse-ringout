import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  doorOpenAmount,
  lightAt,
  LIGHT_ZONE,
  pigeonsAt,
  PIGEON_COUNT,
  STREET_HALF_W,
  SUBWAY_DOOR_HALF,
  SUBWAY_DOOR_XS,
  SUBWAY_HALF_DEPTH,
  SUBWAY_Z,
  vehiclesAt,
  type Vehicle,
} from '../../game/course'
import { gameSeconds } from '../../game/run'
import { COLORS } from '../../lib/brand'
import { Ink, penMaterial } from '../ink'
import { Label } from '../Label'
import { StickFigure, type Motion } from '../StickFigure'
import { OnCourse, placeOnCourse } from './onCourse'

const CAR_COLORS = ['#FFB4A2', '#A8D8FF', '#FFE08A', '#C7F0BD', '#E3C8FF', '#FFC6E0', '#B5EAD7', '#FFDAC1']

function Wheel({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.35, 0.35, 0.25, 12]} />
      <meshBasicMaterial color={COLORS.ink} />
    </mesh>
  )
}

function VehicleModel({ vehicle }: { vehicle: Vehicle }) {
  const color = CAR_COLORS[vehicle.color % CAR_COLORS.length]
  const { hx, hz } = vehicle
  const rider = useRef<Motion>({ anim: 'idle', speed: 0 })
  if (vehicle.kind === 'scooter') {
    return (
      <group>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[hx * 2, 0.1, 0.4]} />
          <Ink color={color} />
        </mesh>
        <mesh position={[hx * 0.8, 0.7, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 1.2, 6]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
        <Wheel position={[hx * 0.8, 0.12, 0]} />
        <Wheel position={[-hx * 0.8, 0.12, 0]} />
        <group position={[-0.1, 0.2, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.85}>
          <StickFigure motion={rider} color={color} />
        </group>
      </group>
    )
  }
  const height = vehicle.kind === 'bus' ? 2.2 : 1
  return (
    <group>
      <mesh position={[0, 0.35 + height / 2, 0]}>
        <boxGeometry args={[hx * 2, height, hz * 2]} />
        <Ink color={color} thickness={2.6} />
      </mesh>
      {vehicle.kind === 'car' ? (
        <mesh position={[-0.2, 1.25 + 0.35, 0]}>
          <boxGeometry args={[hx * 1.1, 0.8, hz * 1.8]} />
          <Ink color="#ffffff" thickness={2.6} />
        </mesh>
      ) : (
        Array.from({ length: 4 }, (_, i) => (
          <mesh key={i} position={[-hx + 1 + i * 1.6, 1.9, hz + 0.01]}>
            <planeGeometry args={[1.1, 0.8]} />
            <meshBasicMaterial color="#DFF1FF" />
          </mesh>
        ))
      )}
      {/* 진행 방향 쪽 전조등 눈 */}
      <mesh position={[hx + 0.01, 0.8, 0.45]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.14, 12]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      <mesh position={[hx + 0.01, 0.8, -0.45]} rotation={[0, Math.PI / 2, 0]}>
        <circleGeometry args={[0.14, 12]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      <Wheel position={[hx * 0.6, 0.35, hz]} />
      <Wheel position={[-hx * 0.6, 0.35, hz]} />
      <Wheel position={[hx * 0.6, 0.35, -hz]} />
      <Wheel position={[-hx * 0.6, 0.35, -hz]} />
    </group>
  )
}

function Vehicles() {
  const initial = useMemo(() => vehiclesAt(0), [])
  const nodes = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    vehiclesAt(gameSeconds()).forEach((vehicle, index) => {
      const node = nodes.current[index]
      if (!node) return
      placeOnCourse(node, vehicle.x, 0, vehicle.z, vehicle.dir === 1 ? 0 : Math.PI)
      // 화면 끝에서 반대편으로 넘어가는 순간은 숨긴다.
      node.visible = Math.abs(vehicle.x) < STREET_HALF_W + 6
    })
  })
  return (
    <>
      {initial.map((vehicle, index) => (
        <group
          key={index}
          ref={(node) => {
            nodes.current[index] = node
          }}
        >
          <VehicleModel vehicle={vehicle} />
        </group>
      ))}
    </>
  )
}

const pigeonBody = new THREE.SphereGeometry(0.35, 12, 10)
const pigeonHead = new THREE.SphereGeometry(0.18, 10, 8)
const beak = new THREE.ConeGeometry(0.06, 0.16, 6)

function Pigeons() {
  const nodes = useRef<(THREE.Group | null)[]>([])
  useFrame(() => {
    pigeonsAt(gameSeconds()).forEach((pigeon, index) => {
      const node = nodes.current[index]
      if (!node) return
      placeOnCourse(node, pigeon.x, pigeon.hop * 0.15, pigeon.z, pigeon.heading)
    })
  })
  return (
    <>
      {Array.from({ length: PIGEON_COUNT }, (_, index) => (
        <group
          key={index}
          ref={(node) => {
            nodes.current[index] = node
          }}
        >
          <mesh geometry={pigeonBody} position={[0, 0.4, 0]} scale={[0.8, 0.75, 1.1]}>
            <Ink color="#D4D8E0" thickness={1.8} />
          </mesh>
          <mesh geometry={pigeonHead} position={[0, 0.78, 0.3]}>
            <Ink color="#B9C0CC" thickness={1.8} />
          </mesh>
          <mesh geometry={beak} material={penMaterial} position={[0, 0.76, 0.5]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh position={[0.08, 0.84, 0.44]} material={penMaterial}>
            <sphereGeometry args={[0.03, 6, 6]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function SubwayDoors() {
  const panels = useRef<(THREE.Mesh | null)[]>([])
  useFrame(() => {
    const t = gameSeconds()
    SUBWAY_DOOR_XS.forEach((doorX, index) => {
      const open = doorOpenAmount(index, t)
      const half = SUBWAY_DOOR_HALF / 2
      const left = panels.current[index * 2]
      const right = panels.current[index * 2 + 1]
      if (left) left.position.x = doorX - half - open * SUBWAY_DOOR_HALF
      if (right) right.position.x = doorX + half + open * SUBWAY_DOOR_HALF
    })
  })
  return (
    <OnCourse z={SUBWAY_Z}>
      {SUBWAY_DOOR_XS.flatMap((doorX, index) =>
        [-1, 1].map((side) => (
          <mesh
            key={`${index}${side}`}
            ref={(node) => {
              panels.current[index * 2 + (side === -1 ? 0 : 1)] = node
            }}
            position={[doorX + (side * SUBWAY_DOOR_HALF) / 2, 1.2, 0]}
          >
            <boxGeometry args={[SUBWAY_DOOR_HALF, 2.4, SUBWAY_HALF_DEPTH]} />
            <Ink color="#CFE8FF" />
          </mesh>
        )),
      )}
    </OnCourse>
  )
}

const LAMP_COLORS = { green: COLORS.green, yellow: COLORS.yellow, red: COLORS.red } as const

/** 무궁화 신호등. 길 양옆과 가운데 높이 세워 어디서나 보이게 한다. */
function TrafficLights() {
  const lamps = useRef<THREE.MeshBasicMaterial[]>([])
  const watcher = useRef<Motion>({ anim: 'idle', speed: 0 })
  const watcherNode = useRef<THREE.Group>(null)
  useFrame(() => {
    const light = lightAt(gameSeconds())
    lamps.current.forEach((material, index) => {
      const name = (['red', 'yellow', 'green'] as const)[index % 3]
      material.color.set(light === name ? LAMP_COLORS[name] : '#d6d3cc')
    })
    // 빨간불에는 술래가 뒤돌아 지켜본다.
    if (watcherNode.current) watcherNode.current.rotation.y = light === 'red' ? 0 : Math.PI
    watcher.current.anim = light === 'red' ? 'cheer' : 'idle'
  })
  const lampRef = (index: number) => (material: THREE.MeshBasicMaterial | null) => {
    if (material) lamps.current[index] = material
  }
  return (
    <OnCourse z={LIGHT_ZONE.to - 2}>
      {[-1, 0, 1].map((slot) => (
        <group key={slot} position={[slot * (STREET_HALF_W - 4), 0, 0]}>
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 5, 6]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
          <mesh position={[0, 5.6, 0]}>
            <boxGeometry args={[1.1, 3, 0.5]} />
            <Ink color="#ffffff" />
          </mesh>
          {(['red', 'yellow', 'green'] as const).map((name, index) => (
            <mesh key={name} position={[0, 6.55 - index * 0.95, 0.26]}>
              <circleGeometry args={[0.36, 20]} />
              <meshBasicMaterial ref={lampRef((slot + 1) * 3 + index)} color="#d6d3cc" />
            </mesh>
          ))}
        </group>
      ))}
      <group ref={watcherNode} position={[4, 0, 0]} scale={1.6}>
        <StickFigure motion={watcher} color={COLORS.red} />
      </group>
      <Label text="무궁화 꽃이 피었습니다" position={[4, 4, 0]} size={0.45} />
    </OnCourse>
  )
}

export function Movers() {
  return (
    <>
      <Vehicles />
      <Pigeons />
      <SubwayDoors />
      <TrafficLights />
    </>
  )
}
