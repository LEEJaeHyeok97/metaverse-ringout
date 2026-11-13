import { useCallback, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  crosserLateral,
  KART_BOX_LATERALS,
  KART_BOX_RESPAWN_MS,
  KART_HALF_WIDTH,
  KART_WALL,
  nearestTrack,
  trackSpot,
  type KartCrosserKind,
  type KartObstacleKind,
  type KartTrack as Track,
} from '../../game/kart'
import { kart, kartSeconds } from '../../game/kartRun'
import { COLORS } from '../../lib/brand'
import { useConnection } from '../../net/connection'
import { useGridTexture } from '../common'
import { Ink } from '../ink'
import { Label } from '../Label'
import { useCanvasTexture } from '../useCanvasTexture'

/**
 * 카트 트랙: 길, 연석, 벽, 출발선, 관중석, 맵마다 다른 풍경, 광고판, 부스터 발판, 아이템 상자, 장애물, 가로지르는 것, 점프대와 구덩이.
 * 이미지나 3D 모델 파일 없이 모두 코드로 그려서 맵을 늘려도 용량이 늘지 않는다.
 */

/** 가운데 선을 따라 from~to(옆으로 떨어진 거리) 사이를 잇는 띠. 칸마다 색을 번갈아 줄 수 있다. */
function ribbon(track: Track, from: number, to: number, y: number, colors: string[] | null, every = 1, start = 0, end = track.length) {
  const positions: number[] = []
  const vertexColors: number[] = []
  const color = new THREE.Color()
  for (let i = start; i < end; i++) {
    const a = trackSpot(track, i, from)
    const b = trackSpot(track, i, to)
    const c = trackSpot(track, i + 1, from)
    const d = trackSpot(track, i + 1, to)
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
function wall(track: Track, lateral: number, height: number, colors: string[], every: number) {
  const positions: number[] = []
  const vertexColors: number[] = []
  const color = new THREE.Color()
  for (let i = 0; i < track.length; i++) {
    const a = trackSpot(track, i, lateral)
    const b = trackSpot(track, i + 1, lateral)
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
function edgeLine(track: Track, lateral: number, y: number) {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= track.length; i++) {
    const spot = trackSpot(track, i, lateral)
    points.push(new THREE.Vector3(spot.x, y, spot.z))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

const inkLine = new THREE.LineBasicMaterial({ color: COLORS.ink })

/** 우주 길에서 끊긴 곳(점프대 뒤)은 길을 그리지 않는다. */
function roadPieces(track: Track) {
  if (!track.open || track.ramps.length === 0) return [[0, track.length]]
  const pieces: [number, number][] = []
  let from = 0
  for (const ramp of [...track.ramps].sort((a, b) => a.index - b.index)) {
    pieces.push([from, ramp.index + 2])
    from = ramp.gapTo + 1
  }
  pieces.push([from, track.length])
  return pieces
}

function Road({ track }: { track: Track }) {
  const { theme } = track
  const geometries = useMemo(() => {
    const pieces = roadPieces(track)
    const strips = (from: number, to: number, y: number, colors: string[] | null, every = 1) => pieces.map(([start, end]) => ribbon(track, from, to, y, colors, every, start, end))
    return {
      road: strips(-KART_HALF_WIDTH, KART_HALF_WIDTH, 0.02, null),
      curbs: [...strips(-KART_HALF_WIDTH - 1.2, -KART_HALF_WIDTH, 0.04, theme.curb, 3), ...strips(KART_HALF_WIDTH, KART_HALF_WIDTH + 1.2, 0.04, theme.curb, 3)],
      // 우주 길에는 벽이 없다.
      walls: track.open ? [] : [wall(track, -KART_WALL, 0.9, theme.wall, 2), wall(track, KART_WALL, 0.9, theme.wall, 2)],
      lines: [
        ...[-KART_HALF_WIDTH - 1.2, -KART_HALF_WIDTH, KART_HALF_WIDTH, KART_HALF_WIDTH + 1.2].map((lateral) => edgeLine(track, lateral, 0.06)),
        ...(track.open ? [] : [-KART_WALL, KART_WALL].map((lateral) => edgeLine(track, lateral, 0.92))),
      ].map((geometry) => new THREE.Line(geometry, inkLine)),
    }
  }, [track, theme])
  return (
    <group>
      {geometries.road.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshBasicMaterial color={theme.road} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[...geometries.curbs, ...geometries.walls].map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      ))}
      {geometries.lines.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
    </group>
  )
}

/** 출발선: 체크무늬와 위에 걸린 현수막 */
function StartLine({ track }: { track: Track }) {
  const start = track.points[0]
  const columns = 12
  const size = (KART_HALF_WIDTH * 2) / columns
  const squares = useMemo(() => {
    const list: { x: number; z: number; dark: boolean }[] = []
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < columns; column++) {
        list.push({ x: -KART_HALF_WIDTH + (column + 0.5) * size, z: (row - 0.5) * 1.3, dark: (row + column) % 2 === 0 })
      }
    }
    return list
  }, [size])
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
      <Label text={`${track.emoji} ${track.name}`} position={[0, 6.2, -0.3]} size={0.85} background={null} color="#ffffff" />
    </group>
  )
}

/** 출발선 왼쪽 관중석. 트랙에서 멀어질수록 높아진다(그룹 안에서 +x가 트랙 왼쪽). */
function Grandstand({ track }: { track: Track }) {
  const spot = trackSpot(track, -6, -(KART_WALL + 7))
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

const BUILDING_COLORS = ['#FFFFFF', '#DCE6F2', '#FDE4D8', '#E3F5E9', '#FFF6C9']

/** 맵마다 다른 트랙 밖 풍경: 소나무, 눈 덮인 나무, 선인장, 빌딩 */
function Scenery({ track }: { track: Track }) {
  const kind = track.theme.scenery
  const spots = useMemo(() => {
    const list: { x: number; z: number; scale: number; seed: number }[] = []
    const step = kind === 'city' ? 16 : 22
    for (let i = 0; i < track.length; i += step) {
      for (const side of [-1, 1]) {
        const lateral = side * (KART_WALL + (kind === 'city' ? 7 : 4) + noise(i + side) * 14)
        const spot = trackSpot(track, i + noise(i * 3) * 10, lateral)
        if (nearestTrack(track, spot.x, spot.z).distance < KART_WALL + (kind === 'city' ? 6 : 2.5)) continue
        list.push({ x: spot.x, z: spot.z, scale: 0.8 + noise(i * 7 + side) * 0.7, seed: i + side })
      }
    }
    return list
  }, [track, kind])
  return (
    <>
      {spots.map((spot, index) => (
        <group key={index} position={[spot.x, 0, spot.z]} scale={spot.scale} rotation={[0, noise(spot.seed) * Math.PI, 0]}>
          {kind === 'pine' && (
            <>
              <mesh position={[0, 1, 0]}>
                <cylinderGeometry args={[0.25, 0.3, 2, 8]} />
                <Ink color="#B07A4F" outline={false} />
              </mesh>
              <mesh position={[0, 3.2, 0]}>
                <coneGeometry args={[1.6, 3.4, 10]} />
                <Ink color="#9ED67F" />
              </mesh>
            </>
          )}
          {kind === 'snow' && (
            <>
              <mesh position={[0, 1, 0]}>
                <cylinderGeometry args={[0.25, 0.3, 2, 8]} />
                <Ink color="#B07A4F" outline={false} />
              </mesh>
              <mesh position={[0, 3.2, 0]}>
                <coneGeometry args={[1.6, 3.4, 10]} />
                <Ink color="#BFE0C8" />
              </mesh>
              <mesh position={[0, 4.4, 0]}>
                <coneGeometry args={[0.85, 1.2, 10]} />
                <Ink color="#ffffff" />
              </mesh>
            </>
          )}
          {kind === 'cactus' && (
            <>
              <mesh position={[0, 1.8, 0]}>
                <capsuleGeometry args={[0.45, 2.6, 4, 10]} />
                <Ink color="#7CC46A" />
              </mesh>
              {[-1, 1].map((side) => (
                <group key={side} position={[side * 0.75, 1.6 + (side > 0 ? 0.6 : 0), 0]}>
                  <mesh position={[0, 0.5, 0]}>
                    <capsuleGeometry args={[0.28, 0.9, 4, 8]} />
                    <Ink color="#7CC46A" />
                  </mesh>
                </group>
              ))}
              <mesh position={[1.6, 0.4, 0.8]} scale={[1, 0.6, 0.8]}>
                <dodecahedronGeometry args={[0.7]} />
                <Ink color="#C9A27A" />
              </mesh>
            </>
          )}
          {kind === 'city' && (
            <mesh position={[0, 4 + noise(spot.seed * 5) * 6, 0]}>
              <boxGeometry args={[6, 8 + noise(spot.seed * 5) * 12, 6]} />
              <Ink color={BUILDING_COLORS[spot.seed % BUILDING_COLORS.length]} thickness={2.4} />
            </mesh>
          )}
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
function Billboards({ track }: { track: Track }) {
  return (
    <>
      {BILLBOARDS.map((board) => {
        const spot = trackSpot(track, Math.round(track.length * board.at), board.side * (KART_WALL + 3))
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
function Pads({ track }: { track: Track }) {
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
      {track.pads.map((pad, index) => (
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

/** 점프대와 바로 뒤 구덩이. 점프대는 앞으로 갈수록 높아지는 판이다. */
function Ramps({ track }: { track: Track }) {
  const ditches = useMemo(() => (track.open ? [] : track.ramps).map((ramp) => ribbon(track, -KART_HALF_WIDTH - 1.2, KART_HALF_WIDTH + 1.2, 0.08, ['#5B3A22', '#4A2E1A'], 1, ramp.index + 2, ramp.gapTo + 1)), [track])
  return (
    <>
      {track.ramps.map((ramp, index) => {
        const spot = trackSpot(track, ramp.index - 1, 0)
        return (
          <group key={index} position={[spot.x, 0, spot.z]} rotation={[0, spot.h, 0]}>
            {/* 앞이 들린 판: 그룹 안에서 +z가 앞 */}
            <mesh position={[0, 0.45, 0]} rotation={[-0.28, 0, 0]}>
              <boxGeometry args={[KART_HALF_WIDTH * 2, 0.25, 3.4]} />
              <Ink color="#FF9A2E" thickness={2.4} />
            </mesh>
            {[-4.5, 0, 4.5].map((x) => (
              <mesh key={x} position={[x, 0.62, 0.2]} rotation={[-Math.PI / 2 - 0.28, 0, 0]}>
                <planeGeometry args={[1.2, 1.6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            ))}
            <Label text="🛹 JUMP" position={[0, 2.4, 0]} size={0.6} background="#FFF6C9" />
          </group>
        )
      })}
      {ditches.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}

function ObstacleModel({ kind }: { kind: KartObstacleKind }) {
  switch (kind) {
    case 'cone':
      return (
        <mesh position={[0, 0.5, 0]}>
          <coneGeometry args={[0.5, 1, 12]} />
          <Ink color="#FF9A2E" />
        </mesh>
      )
    case 'hydrant':
      return (
        <group>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.35, 0.4, 1, 12]} />
            <Ink color="#F0473C" />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[0.35, 12, 8]} />
            <Ink color="#F0473C" />
          </mesh>
        </group>
      )
    case 'snowman':
      return (
        <group>
          <mesh position={[0, 0.7, 0]}>
            <sphereGeometry args={[0.8, 14, 10]} />
            <Ink color="#ffffff" />
          </mesh>
          <mesh position={[0, 1.75, 0]}>
            <sphereGeometry args={[0.55, 14, 10]} />
            <Ink color="#ffffff" />
          </mesh>
          <mesh position={[0, 1.8, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.1, 0.45, 8]} />
            <meshBasicMaterial color="#FF9A2E" />
          </mesh>
        </group>
      )
    case 'rock':
      return (
        <mesh position={[0, 0.7, 0]} scale={[1.2, 0.8, 1]}>
          <dodecahedronGeometry args={[1.2]} />
          <Ink color="#B9A58C" />
        </mesh>
      )
  }
}

function Obstacles({ track }: { track: Track }) {
  return (
    <>
      {track.obstacles.map((obstacle, index) => (
        <group key={index} position={[obstacle.x, 0, obstacle.z]}>
          <ObstacleModel kind={obstacle.kind} />
        </group>
      ))}
    </>
  )
}

function CrosserModel({ kind }: { kind: KartCrosserKind }) {
  switch (kind) {
    case 'bus':
      // 그룹 안에서 +x가 버스가 달리는 쪽(길을 가로지르는 쪽)이다.
      return (
        <group>
          <mesh position={[0, 1.6, 0]}>
            <boxGeometry args={[7.2, 2.6, 2.6]} />
            <Ink color="#3BB273" thickness={2.6} />
          </mesh>
          <mesh position={[0, 2.1, 0]}>
            <boxGeometry args={[6.4, 0.8, 2.65]} />
            <meshBasicMaterial color="#DFF1FF" />
          </mesh>
          {[-2.4, 2.4].map((x) => (
            <mesh key={x} position={[x, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.45, 0.45, 2.7, 14]} />
              <meshBasicMaterial color={COLORS.ink} />
            </mesh>
          ))}
        </group>
      )
    case 'tumbleweed':
      return (
        <mesh position={[0, 0.9, 0]}>
          <icosahedronGeometry args={[0.9, 1]} />
          <meshBasicMaterial color="#B0814F" wireframe />
        </mesh>
      )
    case 'meteor':
      // 불꽃 꼬리를 단 운석. 그룹 안에서 +x가 날아가는 쪽이다.
      return (
        <group position={[0, 1.2, 0]}>
          <mesh>
            <dodecahedronGeometry args={[1.1]} />
            <Ink color="#8C7A6B" />
          </mesh>
          <mesh position={[-1.8, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <coneGeometry args={[0.9, 2.6, 10]} />
            <meshBasicMaterial color="#FF9A2E" transparent opacity={0.8} />
          </mesh>
        </group>
      )
    case 'penguin':
      return (
        <group>
          <mesh position={[0, 0.7, 0]} scale={[0.6, 0.8, 0.55]}>
            <sphereGeometry args={[0.9, 14, 10]} />
            <Ink color={COLORS.ink} />
          </mesh>
          <mesh position={[0.28, 0.65, 0]} scale={[0.25, 0.6, 0.45]}>
            <sphereGeometry args={[0.9, 12, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.55, 1, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <coneGeometry args={[0.1, 0.3, 8]} />
            <meshBasicMaterial color="#FF9A2E" />
          </mesh>
        </group>
      )
  }
}

/** 시간만으로 자리가 정해지는 것들. 모든 화면에서 같은 자리에 보인다. */
function Crossers({ track }: { track: Track }) {
  const nodes = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const t = kartSeconds()
    track.crossers.forEach((crosser, index) => {
      const node = nodes.current[index]
      if (!node) return
      const spot = trackSpot(track, crosser.index, crosserLateral(crosser, t))
      node.position.set(spot.x, 0, spot.z)
      // 달리는 쪽을 본다: 오른쪽(+lateral)으로 가면 트랙 방향에서 오른쪽으로 돈다.
      node.rotation.y = spot.h - Math.PI / 2 + (crosser.speed > 0 ? Math.PI : 0)
      const child = node.children[0]
      if (crosser.kind === 'meteor' && child) child.rotation.y = Math.sin(t * 3) * 0.1
      if (crosser.kind === 'tumbleweed' && child) child.rotation.z = -t * 6 * Math.sign(crosser.speed)
      if (crosser.kind === 'penguin' && child) child.rotation.z = Math.sin(clock.elapsedTime * 10 + index) * 0.15
    })
  })
  return (
    <>
      {track.crossers.map((crosser, index) => (
        <group
          key={index}
          ref={(node) => {
            nodes.current[index] = node
          }}
        >
          <group>
            <CrosserModel kind={crosser.kind} />
          </group>
        </group>
      ))}
    </>
  )
}

const PLANETS = [
  { x: -260, y: 60, z: 120, r: 38, color: '#FF9A2E', ring: true },
  { x: 180, y: 90, z: -220, r: 26, color: '#3FA9FF', ring: false },
  { x: 40, y: 40, z: 300, r: 18, color: '#A259FF', ring: true },
  { x: -120, y: -40, z: -280, r: 30, color: '#1DB46A', ring: false },
]

/** 우주 맵 풍경: 반짝이는 별, 고리 달린 행성, 떠다니는 소행성, 링아웃 로고 위성 */
function Space({ track }: { track: Track }) {
  const stars = useMemo(() => {
    const positions: number[] = []
    for (let i = 0; i < 1500; i++) {
      const theta = noise(i) * Math.PI * 2
      const phi = Math.acos(2 * noise(i + 0.5) - 1)
      const radius = 260 + noise(i + 0.25) * 80
      positions.push(Math.sin(phi) * Math.cos(theta) * radius, Math.cos(phi) * radius * 0.6 + 20, Math.sin(phi) * Math.sin(theta) * radius)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geometry
  }, [])
  const rocks = useMemo(() => {
    const list: { x: number; y: number; z: number; r: number }[] = []
    for (let i = 0; i < track.length; i += 30) {
      const side = noise(i) > 0.5 ? 1 : -1
      const spot = trackSpot(track, i, side * (KART_HALF_WIDTH + 12 + noise(i + 1) * 20))
      if (nearestTrack(track, spot.x, spot.z).distance < KART_HALF_WIDTH + 8) continue
      list.push({ x: spot.x, y: -6 + noise(i + 2) * 14, z: spot.z, r: 1 + noise(i + 3) * 2.5 })
    }
    return list
  }, [track])
  const spin = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.05
  })
  const center = track.points.reduce((sum, point) => ({ x: sum.x + point.x / track.length, z: sum.z + point.z / track.length }), { x: 0, z: 0 })
  return (
    <group>
      <group ref={spin} position={[center.x, 0, center.z]}>
        <points geometry={stars}>
          <pointsMaterial color="#ffffff" size={1.6} sizeAttenuation={false} fog={false} />
        </points>
        {PLANETS.map((planet, index) => (
          <group key={index} position={[planet.x, planet.y, planet.z]}>
            <mesh>
              <sphereGeometry args={[planet.r, 24, 16]} />
              <Ink color={planet.color} fog={false} thickness={3} />
            </mesh>
            {planet.ring && (
              <mesh rotation={[1.2, 0.3, 0]}>
                <torusGeometry args={[planet.r * 1.7, planet.r * 0.12, 6, 48]} />
                <meshBasicMaterial color="#FFE08A" fog={false} />
              </mesh>
            )}
          </group>
        ))}
      </group>
      {rocks.map((rock, index) => (
        <mesh key={index} position={[rock.x, rock.y, rock.z]} rotation={[noise(index), noise(index + 1) * 3, 0]}>
          <dodecahedronGeometry args={[rock.r]} />
          <Ink color="#6B5E8C" />
        </mesh>
      ))}
    </group>
  )
}

export function boxKey(row: number, slot: number) {
  return `${row}:${slot}`
}

const BOX_COLORS = ['#FFD84D', '#8FD3FF', '#FFB4A2', '#C7F0BD', '#E3C8FF']

/** 트랙을 가로지르는 아이템 상자. 깨면 내 화면에서만 잠시 사라졌다가 다시 생긴다. */
function ItemBoxes({ track }: { track: Track }) {
  const nodes = useRef<(THREE.Group | null)[]>([])
  useFrame(({ clock }) => {
    const now = performance.now()
    track.boxRows.forEach((_, row) => {
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
      {track.boxRows.map((index, row) =>
        KART_BOX_LATERALS.map((lateral, slot) => {
          const spot = trackSpot(track, index, lateral)
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

export function KartTrack({ track }: { track: Track }) {
  const ground = useGridTexture(120, 120, track.theme.ground)
  const center = useMemo(() => {
    const xs = track.points.map((point) => point.x)
    const zs = track.points.map((point) => point.z)
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 }
  }, [track])
  return (
    <>
      {track.theme.scenery === 'space' ? (
        <Space track={track} />
      ) : (
        <mesh position={[center.x, 0, center.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[700, 700]} />
          <meshBasicMaterial map={ground} />
        </mesh>
      )}
      <Road track={track} />
      <StartLine track={track} />
      <Grandstand track={track} />
      <Scenery track={track} />
      <Billboards track={track} />
      <Pads track={track} />
      <Ramps track={track} />
      <Obstacles track={track} />
      <Crossers track={track} />
      <ItemBoxes track={track} />
      <Bananas />
    </>
  )
}
