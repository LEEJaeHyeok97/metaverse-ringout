import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  activeMap,
  bedSpot,
  deskSpot,
  DOOR_HALF,
  FINISH_Z,
  HOUSE_BACK_Z,
  HOUSE_FRONT_Z,
  HOUSE_HALF_W,
  HURDLE_HEIGHT,
  HURDLE_ZS,
  isRinging,
  laneX,
  LIGHT_ZONE,
  MAX_ROOM_PLAYERS,
  PROPS,
  PUDDLES,
  ROAD_ZS,
  SCOOTER_ZS,
  STREET_HALF_W,
  SUBWAY_DOOR_HALF,
  SUBWAY_DOOR_XS,
  SUBWAY_HALF_DEPTH,
  SUBWAY_Z,
  WORLD_MIN_Z,
  ZONES,
} from '../../game/course'
import { gameSeconds, run } from '../../game/run'
import { COLORS } from '../../lib/brand'
import { FloorRing, Tree, useGridTexture } from '../common'
import { Ink } from '../ink'
import { Label } from '../Label'
import { Campus } from './Campus'
import { OnCourse, RoadSurface } from './onCourse'
import { Specials } from './Specials'
import { Sphinx } from './Sphinx'
import { Slide } from './Slide'
import { Shortcuts } from './Shortcuts'
import { Pads } from './Pads'

const WALL_HEIGHT = 2
const WALL = 0.25
const HOUSE_DEPTH = HOUSE_BACK_Z - HOUSE_FRONT_Z
const HOUSE_CENTER_Z = (HOUSE_BACK_Z + HOUSE_FRONT_Z) / 2
const FLOOR_TINTS = ['#FFF1D6', '#E5F1FF', '#E6F6E6', '#FFE9F1', '#F0E8FF']
const ROAD_HALF = STREET_HALF_W + 1

function Box({ position, size, color = '#ffffff', outline = true }: { position: [number, number, number]; size: [number, number, number]; color?: string; outline?: boolean }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <Ink color={color} outline={outline} />
    </mesh>
  )
}

/** 책상 위 휴대폰. 링아웃이 울리면 흔들리고 화면이 켜진다. 내 집 휴대폰은 들고 나가면 사라진다. */
function DeskPhone({ lane }: { lane: number }) {
  const phone = useRef<THREE.Group>(null)
  const screen = useRef<THREE.MeshBasicMaterial>(null)
  const desk = deskSpot(lane)
  useFrame(({ clock }) => {
    const node = phone.current
    if (!node) return
    node.visible = !(lane === run.lane && run.appSet)
    const ringing = isRinging(gameSeconds()) || (lane === run.lane && run.phase === 'running' && !run.appSet)
    node.rotation.z = ringing ? Math.sin(clock.elapsedTime * 45) * 0.25 : 0
    node.position.y = 0.92 + (ringing ? Math.abs(Math.sin(clock.elapsedTime * 30)) * 0.06 : 0)
    screen.current?.color.set(ringing ? COLORS.accent : '#3a3a3a')
  })
  return (
    <group ref={phone} position={[desk.x, 0.92, desk.z]}>
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.4, 0.7, 0.07]} />
        <Ink color="#ffffff" thickness={1.6} />
      </mesh>
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.32, 0.6]} />
        <meshBasicMaterial ref={screen} color="#3a3a3a" />
      </mesh>
    </group>
  )
}

/** 지붕 없는 단면 집. 위에서 내려다보면 다섯 집의 방이 나란히 보인다. */
function House({ lane, owner }: { lane: number; owner: { nickname: string; color: string } | null }) {
  const x = laneX(lane)
  const bed = bedSpot(lane)
  const desk = deskSpot(lane)
  const sideWidth = HOUSE_HALF_W - DOOR_HALF
  return (
    <group>
      <Box position={[x, 0.04, HOUSE_CENTER_Z]} size={[HOUSE_HALF_W * 2, 0.08, HOUSE_DEPTH]} color={FLOOR_TINTS[lane]} />
      <Box position={[x, WALL_HEIGHT / 2, HOUSE_BACK_Z]} size={[HOUSE_HALF_W * 2 + WALL, WALL_HEIGHT, WALL]} />
      <Box position={[x - HOUSE_HALF_W, WALL_HEIGHT / 2, HOUSE_CENTER_Z]} size={[WALL, WALL_HEIGHT, HOUSE_DEPTH]} />
      <Box position={[x + HOUSE_HALF_W, WALL_HEIGHT / 2, HOUSE_CENTER_Z]} size={[WALL, WALL_HEIGHT, HOUSE_DEPTH]} />
      {/* 앞벽은 가운데 문을 비우고 양쪽만 세운다. */}
      <Box position={[x - DOOR_HALF - sideWidth / 2, WALL_HEIGHT / 2, HOUSE_FRONT_Z]} size={[sideWidth, WALL_HEIGHT, WALL]} />
      <Box position={[x + DOOR_HALF + sideWidth / 2, WALL_HEIGHT / 2, HOUSE_FRONT_Z]} size={[sideWidth, WALL_HEIGHT, WALL]} />
      <Box position={[x, WALL_HEIGHT + 0.6, HOUSE_FRONT_Z]} size={[DOOR_HALF * 2 + 0.4, 0.2, WALL]} />
      <Box position={[x - DOOR_HALF, WALL_HEIGHT + 0.3, HOUSE_FRONT_Z]} size={[0.15, 0.6, WALL]} />
      <Box position={[x + DOOR_HALF, WALL_HEIGHT + 0.3, HOUSE_FRONT_Z]} size={[0.15, 0.6, WALL]} />
      {/* 침대: 머리맡이 뒷벽 쪽이다. */}
      <Box position={[bed.x, 0.25, bed.z + 0.2]} size={[1.6, 0.42, 2.7]} color={COLORS.wood} />
      <Box position={[bed.x, 0.52, bed.z + 1.05]} size={[1.1, 0.16, 0.5]} />
      <Box position={[bed.x, 0.5, bed.z - 0.5]} size={[1.62, 0.12, 1.5]} color={owner?.color ?? '#dddddd'} />
      <Box position={[bed.x + 1.35, 0.3, bed.z + 1.1]} size={[0.7, 0.6, 0.7]} color={COLORS.wood} />
      {/* 책상과 휴대폰 */}
      <Box position={[desk.x, 0.45, desk.z]} size={[1.6, 0.9, 2.4]} color={COLORS.wood} />
      <DeskPhone lane={lane} />
      {/* 뒷벽 창문과 시계 */}
      <Box position={[x + 1.8, 1.3, HOUSE_BACK_Z - 0.16]} size={[2.2, 1.2, 0.05]} color="#DFF1FF" />
      <mesh position={[x - 0.4, 1.5, HOUSE_BACK_Z - 0.16]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.05, 24]} />
        <Ink color="#ffffff" />
      </mesh>
      <FloorRing radius={1.1} position={[x + 0.4, 0.1, -6]} color={COLORS.pencil} width={0.06} />
      <Label text={owner ? `${owner.nickname}의 집` : '빈집'} position={[x, 3.4, HOUSE_FRONT_Z]} size={0.45} color={owner?.color ?? COLORS.pencil} />
    </group>
  )
}

function Prop({ kind, r }: { kind: (typeof PROPS)[number]['kind']; r: number }) {
  switch (kind) {
    case 'bin':
      return (
        <group>
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[r, r * 0.85, 1, 16]} />
            <Ink color="#E8E8E8" />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[r * 1.05, r * 1.05, 0.1, 16]} />
            <Ink color="#ffffff" />
          </mesh>
        </group>
      )
    case 'pot':
      return (
        <group>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[r, r * 0.7, 0.7, 16]} />
            <Ink color="#F3C9A8" />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[r * 0.95, 12, 10]} />
            <Ink color={activeMap.theme.leaf} />
          </mesh>
        </group>
      )
    case 'bush':
      return (
        <mesh position={[0, r * 0.6, 0]} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[r, 14, 10]} />
          <Ink color={activeMap.theme.leaf} />
        </mesh>
      )
    case 'cone':
      return (
        <mesh position={[0, 0.45, 0]}>
          <coneGeometry args={[r, 0.9, 12]} />
          <Ink color="#FF9A3C" />
        </mesh>
      )
  }
}

/** 허들. 맵에 따라 공사장 펜스, 쓰러진 통나무, 눈더미로 그린다. 판정은 같다. */
function Hurdle() {
  const style = activeMap.theme.hurdle ?? 'fence'
  if (style === 'log') {
    return (
      <group>
        <mesh position={[0, HURDLE_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[HURDLE_HEIGHT / 2, HURDLE_HEIGHT / 2, STREET_HALF_W * 2, 14]} />
          <Ink color="#A8754B" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * STREET_HALF_W, HURDLE_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[HURDLE_HEIGHT / 2 - 0.05, HURDLE_HEIGHT / 2 - 0.05, 0.05, 14]} />
            <meshBasicMaterial color="#E9C99B" />
          </mesh>
        ))}
        <mesh position={[3, HURDLE_HEIGHT + 0.15, 0]}>
          <sphereGeometry args={[0.3, 10, 8]} />
          <Ink color="#F4A261" />
        </mesh>
      </group>
    )
  }
  if (style === 'snow') {
    return (
      <mesh position={[0, 0, 0]} scale={[STREET_HALF_W, HURDLE_HEIGHT, 0.9]}>
        <sphereGeometry args={[1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Ink color="#FFFFFF" />
      </mesh>
    )
  }
  const legs = []
  for (let x = -STREET_HALF_W + 1; x <= STREET_HALF_W - 1; x += 5) legs.push(x)
  return (
    <group>
      {legs.map((x) => (
        <mesh key={x} position={[x, HURDLE_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.08, HURDLE_HEIGHT, 0.08]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
      ))}
      <mesh position={[0, HURDLE_HEIGHT - 0.1, 0]}>
        <boxGeometry args={[STREET_HALF_W * 2, 0.2, 0.18]} />
        <Ink color="#FFD84D" />
      </mesh>
    </group>
  )
}

/** 스크린도어에서 문 자리를 뺀 고정 벽 */
function SubwayWall() {
  const pieces: { x: number; hx: number }[] = []
  let left = -STREET_HALF_W - 2
  for (const doorX of SUBWAY_DOOR_XS) {
    const right = doorX - SUBWAY_DOOR_HALF
    pieces.push({ x: (left + right) / 2, hx: (right - left) / 2 })
    left = doorX + SUBWAY_DOOR_HALF
  }
  pieces.push({ x: (left + STREET_HALF_W + 2) / 2, hx: (STREET_HALF_W + 2 - left) / 2 })
  return (
    <group>
      <Box position={[0, 0.03, 5]} size={[STREET_HALF_W * 2, 0.06, 10]} color="#E9EEF3" outline={false} />
      {pieces.map((piece) => (
        <Box key={piece.x} position={[piece.x, 1.3, 0]} size={[piece.hx * 2, 2.6, SUBWAY_HALF_DEPTH * 2]} color="#F4F7FA" />
      ))}
      <Box position={[0, 3, 0]} size={[STREET_HALF_W * 2 + 4, 0.8, SUBWAY_HALF_DEPTH * 2]} color="#3BB273" />
      <Label text="🚇 지하철 2호선 · 문 닫힐 때 뛰어들지 마세요" position={[0, 4.2, 0]} size={0.5} />
    </group>
  )
}

/** 도로를 가로지르는 띠(찻길, 정지선 등) */
function Stripe({ z, depth, color, y = 0.02 }: { z: number; depth: number; color: string; y?: number }) {
  return (
    <OnCourse z={z} y={y}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROAD_HALF * 2, depth]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </OnCourse>
  )
}

const TREE_ZS = [-30, -60, -90, -120, -150, -180, -215, -245, -275, -305, -335]

export function World({ owners }: { owners: Map<number, { nickname: string; color: string }> }) {
  const theme = activeMap.theme
  const ground = useGridTexture(60, 60, theme.paper)
  const road = useGridTexture(1, 1, theme.street)
  return (
    <>
      {/* 도로 밖 종이 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[40, -0.02, -180]}>
        <planeGeometry args={[700, 700]} />
        <meshBasicMaterial map={ground} />
      </mesh>
      <RoadSurface from={HOUSE_BACK_Z + 4} to={WORLD_MIN_Z - 2} texture={road} />

      {Array.from({ length: MAX_ROOM_PLAYERS }, (_, lane) => (
        <House key={lane} lane={lane} owner={owners.get(lane) ?? null} />
      ))}

      {ZONES.map((zone) => (
        <OnCourse key={zone.name} x={-STREET_HALF_W - 2} z={zone.from - 1}>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 2.2, 6]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
          <Label text={zone.name} position={[0, 2.6, 0]} size={0.55} background="#FFF6C9" />
        </OnCourse>
      ))}

      {ROAD_ZS.map((z) => (
        <group key={z}>
          <Stripe z={z} depth={3.4} color={theme.road} />
          <OnCourse z={z} y={0.03}>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh key={i} position={[-STREET_HALF_W + 2.5 + i * 5, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[2, 0.15]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
            ))}
          </OnCourse>
        </group>
      ))}
      {SCOOTER_ZS.map((z) => (
        <Stripe key={z} z={z} depth={1.6} color="#D8ECD9" />
      ))}

      {PUDDLES.map((puddle) => (
        <OnCourse key={`${puddle.x},${puddle.z}`} x={puddle.x} z={puddle.z} y={0.03}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]}>
            <circleGeometry args={[puddle.r, 32]} />
            <meshBasicMaterial color={theme.water} />
          </mesh>
          <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.8, 1]}>
            <ringGeometry args={[puddle.r - 0.06, puddle.r + 0.04, 32]} />
            <meshBasicMaterial color={COLORS.ink} />
          </mesh>
        </OnCourse>
      ))}
      {PROPS.map((prop) => (
        <OnCourse key={`${prop.x},${prop.z}`} x={prop.x} z={prop.z}>
          <Prop kind={prop.kind} r={prop.r} />
        </OnCourse>
      ))}
      {HURDLE_ZS.map((z) => (
        <OnCourse key={z} z={z}>
          <Hurdle />
        </OnCourse>
      ))}
      <Specials />
      <Sphinx />
      <Slide />
      <Shortcuts />
      <Pads />
      <OnCourse z={SUBWAY_Z}>
        <SubwayWall />
      </OnCourse>
      {[LIGHT_ZONE.from, LIGHT_ZONE.to].map((z) => (
        <Stripe key={z} z={z} depth={0.4} color={COLORS.ink} y={0.03} />
      ))}

      {/* 캠퍼스는 곧은 구간에 있어 결승선 자리를 기준으로 한 덩어리로 옮긴다. */}
      <OnCourse z={FINISH_Z}>
        <group position={[0, 0, -FINISH_Z]}>
          <Campus />
        </group>
      </OnCourse>

      {TREE_ZS.flatMap((z, index) => [
        <OnCourse key={`l${z}`} x={-STREET_HALF_W - 4 - (index % 3)} z={z}>
          <Tree position={[0, 0, 0]} color={theme.leaf} />
        </OnCourse>,
        <OnCourse key={`r${z}`} x={STREET_HALF_W + 4 + (index % 2) * 2} z={z - 12}>
          <Tree position={[0, 0, 0]} scale={1.15} color={index % 2 && theme.weather === 'leaves' ? '#E76F51' : theme.leaf} />
        </OnCourse>,
      ])}
    </>
  )
}
