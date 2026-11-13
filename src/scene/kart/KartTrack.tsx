import { useCallback, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  KART_BOX_LATERALS,
  KART_BOX_RESPAWN_MS,
  KART_BOX_ROWS,
  KART_HALF_WIDTH,
  KART_PADS,
  KART_WALL,
  nearestTrack,
  TRACK,
  TRACK_LENGTH,
  trackSpot,
} from '../../game/kart'
import { kart } from '../../game/kartRun'
import { COLORS } from '../../lib/brand'
import { useConnection } from '../../net/connection'
import { useGridTexture } from '../common'
import { Ink } from '../ink'
import { Label } from '../Label'
import { useCanvasTexture } from '../useCanvasTexture'

/** 링아웃 서킷의 길, 연석, 타이어 벽, 출발선, 관중석, 나무, 광고판, 부스터 발판, 아이템 상자 */

const ROAD = '#D9D6CE'
const CURB_A = '#F0473C'
const CURB_B = '#FFFFFF'
const WALL_A = '#2F7DF6'
const WALL_B = '#FFFFFF'

/** 가운데 선을 따라 from~to(옆으로 떨어진 거리) 사이를 잇는 띠. 칸마다 색을 번갈아 줄 수 있다. */
function ribbon(from: number, to: number, y: number, colors: string[] | null, every = 1) {
  const positions: number[] = []
  const vertexColors: number[] = []
  const color = new THREE.Color()
  for (let i = 0; i < TRACK_LENGTH; i++) {
    const a = trackSpot(i, from)
    const b = trackSpot(i, to)
    const c = trackSpot(i + 1, from)
    const d = trackSpot(i + 1, to)
    positions.push(a.x, y, a.z, c.x, y, c.z, b.x, y, b.z, b.x, y, b.z, c.x, y, c.z, d.x, y, d.z)
    if (colors) {
      color.set(colors[Math.floor(i / every) % colors.length])
      for (let k = 0; k < 6; k++) vertexColors.push(color.r, color.g, color.b)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3))
  return geometry
}

/** 옆으로 lateral만큼 떨어진 곳에 세운 벽 띠 */
function wall(lateral: number, height: number, colors: string[], every: number) {
  const positions: number[] = []
  const vertexColors: number[] = []
  const color = new THREE.Color()
  for (let i = 0; i < TRACK_LENGTH; i++) {
    const a = trackSpot(i, lateral)
    const b = trackSpot(i + 1, lateral)
    positions.push(a.x, 0, a.z, b.x, 0, b.z, a.x, height, a.z, a.x, height, a.z, b.x, 0, b.z, b.x, height, b.z)
    color.set(colors[Math.floor(i / every) % colors.length])
    for (let k = 0; k < 6; k++) vertexColors.push(color.r, color.g, color.b)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3))
  return geometry
}

/** 펜으로 그은 가장자리 선 */
function edgeLine(lateral: number, y: number) {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= TRACK_LENGTH; i++) {
    const spot = trackSpot(i, lateral)
    points.push(new THREE.Vector3(spot.x, y, spot.z))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

const inkLine = new THREE.LineBasicMaterial({ color: COLORS.ink })

function Road() {
  const geometries = useMemo(
    () => ({
      road: ribbon(-KART_HALF_WIDTH, KART_HALF_WIDTH, 0.02, null),
      curbL: ribbon(-KART_HALF_WIDTH - 1.2, -KART_HALF_WIDTH, 0.04, [CURB_A, CURB_B], 3),
      curbR: ribbon(KART_HALF_WIDTH, KART_HALF_WIDTH + 1.2, 0.04, [CURB_A, CURB_B], 3),
      wallL: wall(-KART_WALL, 0.9, [WALL_A, WALL_B], 2),
      wallR: wall(KART_WALL, 0.9, [WALL_A, WALL_B], 2),
      edges: [-KART_HALF_WIDTH - 1.2, -KART_HALF_WIDTH, KART_HALF_WIDTH, KART_HALF_WIDTH + 1.2].map((lateral) => edgeLine(lateral, 0.06)),
      wallTops: [-KART_WALL, KART_WALL].map((lateral) => edgeLine(lateral, 0.92)),
    }),
    [],
  )
  return (
    <group>
      <mesh geometry={geometries.road}>
        <meshBasicMaterial color={ROAD} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometries.curbL}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometries.curbR}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometries.wallL}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={geometries.wallR}>
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </mesh>
      {[...geometries.edges, ...geometries.wallTops].map((geometry, index) => (
        <primitive key={index} object={new THREE.Line(geometry, inkLine)} />
      ))}
    </group>
  )
}

/** 출발선: 체크무늬와 위에 걸린 현수막 */
function StartLine() {
  const start = TRACK[0]
  const squares = useMemo(() => {
    const list: { x: number; z: number; dark: boolean }[] = []
    const columns = 12
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < columns; column++) {
        const lateral = -KART_HALF_WIDTH + ((column + 0.5) * (KART_HALF_WIDTH * 2)) / columns
        list.push({ x: lateral, z: (row - 0.5) * 1.3, dark: (row + column) % 2 === 0 })
      }
    }
    return list
  }, [])
  const size = (KART_HALF_WIDTH * 2) / 12
  return (
    <group position={[start.x, 0, start.z]} rotation={[0, start.h, 0]}>
      {squares.map((square, index) => (
        <mesh key={index} position={[-square.x, 0.05, square.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size, 1.3]} />
          <meshBasicMaterial color={square.dark ? COLORS.ink : '#ffffff'} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (KART_HALF_WIDTH + 1.6), 3.2, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 6.4, 10]} />
          <Ink color="#ffffff" />
        </mesh>
      ))}
      <mesh position={[0, 6.2, 0]}>
        <boxGeometry args={[KART_HALF_WIDTH * 2 + 3.6, 1.4, 0.3]} />
        <Ink color={COLORS.accent} thickness={2.6} />
      </mesh>
      <Label text="🏁 RINGOUT GP" position={[0, 6.2, -0.3]} size={0.9} background={null} color="#ffffff" />
    </group>
  )
}

/** 출발선 왼쪽 관중석. 트랙에서 멀어질수록 높아진다(그룹 안에서 +x가 트랙 왼쪽). */
function Grandstand() {
  const spot = trackSpot(-6, -(KART_WALL + 7))
  const seatColors = ['#FF5A4E', '#2F7DF6', '#1DB46A', '#FFB020', '#A259FF']
  return (
    <group position={[spot.x, 0, spot.z]} rotation={[0, spot.h, 0]}>
      {[0, 1, 2, 3].map((step) => (
        <mesh key={step} position={[step * 1.6, 0.6 + step * 1.1, 0]}>
          <boxGeometry args={[1.6, 1.2 + step * 2.2, 26]} />
          <Ink color="#ffffff" />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((step) =>
        Array.from({ length: 10 }, (_, seat) => (
          <mesh key={`${step}-${seat}`} position={[step * 1.6, 1.4 + step * 2.2, -11.25 + seat * 2.5]}>
            <boxGeometry args={[0.8, 0.5, 1.6]} />
            <meshBasicMaterial color={seatColors[(step + seat) % seatColors.length]} />
          </mesh>
        )),
      )}
      <mesh position={[3, 10.5, 0]}>
        <boxGeometry args={[7, 0.3, 27]} />
        <Ink color={COLORS.accent} />
      </mesh>
    </group>
  )
}

/** 0~1 사이의 고정된 난수 */
function noise(k: number) {
  const value = Math.sin(k * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

/** 트랙 밖 나무. 다른 구간 트랙 위에 서지 않게 거리를 확인한다. */
function Trees() {
  const trees = useMemo(() => {
    const list: { x: number; z: number; scale: number }[] = []
    for (let i = 0; i < TRACK_LENGTH; i += 22) {
      for (const side of [-1, 1]) {
        const lateral = side * (KART_WALL + 4 + noise(i + side) * 14)
        const spot = trackSpot(i + noise(i * 3) * 10, lateral)
        if (nearestTrack(spot.x, spot.z).distance < KART_WALL + 2.5) continue
        list.push({ x: spot.x, z: spot.z, scale: 0.8 + noise(i * 7 + side) * 0.7 })
      }
    }
    return list
  }, [])
  return (
    <>
      {trees.map((tree, index) => (
        <group key={index} position={[tree.x, 0, tree.z]} scale={tree.scale}>
          <mesh position={[0, 1, 0]}>
            <cylinderGeometry args={[0.25, 0.3, 2, 8]} />
            <Ink color="#B07A4F" outline={false} />
          </mesh>
          <mesh position={[0, 3.2, 0]}>
            <coneGeometry args={[1.6, 3.4, 10]} />
            <Ink color="#9ED67F" />
          </mesh>
        </group>
      ))}
    </>
  )
}

const BILLBOARDS = [
  { at: 0.16, side: 1, text: '⏰ 링아웃: 도착해야 꺼지는 알람' },
  { at: 0.42, side: -1, text: '📍 목적지에 도착하면 알람 OFF' },
  { at: 0.68, side: 1, text: '👥 친구와 함께 모임 알람' },
  { at: 0.9, side: -1, text: '🌱 도착할수록 자라는 씨앗' },
]

/** 트랙 밖 링아웃 광고판 */
function Billboards() {
  return (
    <>
      {BILLBOARDS.map((board) => {
        const spot = trackSpot(Math.round(TRACK_LENGTH * board.at), board.side * (KART_WALL + 3))
        return (
          <group key={board.text} position={[spot.x, 0, spot.z]}>
            <mesh position={[0, 2.2, 0]}>
              <cylinderGeometry args={[0.18, 0.18, 4.4, 8]} />
              <Ink color="#ffffff" />
            </mesh>
            <Label text={board.text} position={[0, 4.8, 0]} size={0.75} background="#FDE4D8" />
          </group>
        )
      })}
    </>
  )
}

/** 밟으면 쌩 빨라지는 부스터 발판. 화살표가 앞쪽을 가리킨다. */
function Pads() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#FFB020'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = COLORS.ink
    ctx.lineWidth = 10
    ctx.strokeRect(5, 5, w - 10, h - 10)
    ctx.fillStyle = '#ffffff'
    for (let k = 0; k < 3; k++) {
      const top = 30 + k * 70
      ctx.beginPath()
      ctx.moveTo(w / 2, top)
      ctx.lineTo(w - 40, top + 50)
      ctx.lineTo(w - 70, top + 50)
      ctx.lineTo(w / 2, top + 20)
      ctx.lineTo(70, top + 50)
      ctx.lineTo(40, top + 50)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
  }, [])
  const texture = useCanvasTexture(draw, 256, 256)
  const materials = useRef<THREE.MeshBasicMaterial[]>([])
  useFrame(({ clock }) => {
    for (const material of materials.current) if (material) material.opacity = 0.75 + Math.sin(clock.elapsedTime * 8) * 0.25
  })
  return (
    <>
      {KART_PADS.map((pad, index) => (
        <mesh key={index} position={[pad.x, 0.07, pad.z]} rotation={[-Math.PI / 2, 0, pad.h + Math.PI]}>
          <planeGeometry args={[3.6, 3.6]} />
          <meshBasicMaterial
            ref={(material) => {
              if (material) materials.current[index] = material
            }}
            map={texture}
            transparent
          />
        </mesh>
      ))}
    </>
  )
}

export function boxKey(row: number, slot: number) {
  return `${row}:${slot}`
}

const BOX_COLORS = ['#FFD84D', '#8FD3FF', '#FFB4A2', '#C7F0BD', '#E3C8FF']

/** 트랙을 가로지르는 아이템 상자. 깨면 내 화면에서만 잠시 사라졌다가 다시 생긴다. */
function ItemBoxes() {
  const nodes = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const now = performance.now()
    KART_BOX_ROWS.forEach((_, row) => {
      KART_BOX_LATERALS.forEach((__, slot) => {
        const node = nodes.current[row * KART_BOX_LATERALS.length + slot]
        if (!node) return
        const takenAt = kart.boxesTaken.get(boxKey(row, slot))
        node.visible = takenAt === undefined || now - takenAt > KART_BOX_RESPAWN_MS
        node.rotation.y = clock.elapsedTime * 1.5 + slot
        node.position.y = 1 + Math.sin(clock.elapsedTime * 2.5 + slot) * 0.15
      })
    })
  })
  return (
    <>
      {KART_BOX_ROWS.map((index, row) =>
        KART_BOX_LATERALS.map((lateral, slot) => {
          const spot = trackSpot(index, lateral)
          return (
            <group key={`${row}-${slot}`} position={[spot.x, 0, spot.z]}>
              <group
                ref={(node) => {
                  nodes.current[row * KART_BOX_LATERALS.length + slot] = node
                }}
              >
                <mesh rotation={[0.4, 0, 0.4]}>
                  <boxGeometry args={[1, 1, 1]} />
                  <Ink color={BOX_COLORS[slot % BOX_COLORS.length]} thickness={2.4} />
                </mesh>
                <Label text="?" size={0.55} background={null} />
              </group>
            </group>
          )
        }),
      )}
    </>
  )
}

/** 누군가 떨어뜨린 바나나 껍질 */
function Bananas() {
  const { bananas } = useConnection()
  return (
    <>
      {bananas.map((banana) => (
        <group key={banana.id} position={[banana.x, 0.15, banana.z]} rotation={[0, banana.id, 0]}>
          {[0, 1, 2].map((index) => (
            <mesh key={index} rotation={[Math.PI / 2 - 0.3, 0, (index * Math.PI * 2) / 3]} position={[Math.cos((index * Math.PI * 2) / 3) * 0.3, 0, Math.sin((index * Math.PI * 2) / 3) * 0.3]} scale={[0.4, 0.7, 0.14]}>
              <sphereGeometry args={[0.6, 10, 8]} />
              <Ink color="#FFE15A" thickness={1.8} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

export function KartTrack() {
  const grass = useGridTexture(120, 120, '#E6F2D6')
  const center = useMemo(() => {
    const xs = TRACK.map((point) => point.x)
    const zs = TRACK.map((point) => point.z)
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
  }, [])
  return (
    <>
      <mesh position={[center.x, 0, center.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[700, 700]} />
        <meshBasicMaterial map={grass} />
      </mesh>
      <Road />
      <StartLine />
      <Grandstand />
      <Trees />
      <Billboards />
      <Pads />
      <ItemBoxes />
      <Bananas />
    </>
  )
}
