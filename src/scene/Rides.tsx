import type { RideKind } from '../game/course'
import { COLORS } from '../lib/brand'
import { Ink } from './ink'

/**
 * 탈것 모형. 모두 앞이 +z이고, 사람이 타면 엉덩이 자리에 맞게 앉는다.
 * 길가에 세워 둔 것과 타고 가는 것을 같은 모형으로 그린다.
 */

const bikeFrame = '#3BB273'

/** 따릉이. 앞이 +z이고 안장 높이가 엉덩이에 맞는다. 세워 둔 자전거에도 쓴다. */
export function BikeModel() {
  return (
    <group>
      {[-0.55, 0.55].map((z) => (
        <mesh key={z} position={[0, 0.36, z]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.33, 0.04, 8, 24]} />
          <meshBasicMaterial color="#1A1A1A" />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 1.1, 6]} />
        <Ink color={bikeFrame} thickness={1.4} />
      </mesh>
      <mesh position={[0, 0.72, -0.18]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
        <Ink color={bikeFrame} thickness={1.4} />
      </mesh>
      <mesh position={[0, 0.94, -0.26]}>
        <boxGeometry args={[0.16, 0.06, 0.3]} />
        <meshBasicMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[0, 0.8, 0.5]} rotation={[-0.25, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
        <Ink color={bikeFrame} thickness={1.4} />
      </mesh>
      <mesh position={[0, 1.13, 0.58]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.6, 6]} />
        <meshBasicMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[0, 0.85, 0.72]}>
        <boxGeometry args={[0.3, 0.2, 0.22]} />
        <Ink color="#ffffff" thickness={1.4} />
      </mesh>
    </group>
  )
}

/** 우주선. 아래로 빛줄기를 쏜다. */

function Wheel({ position, radius = 0.32 }: { position: [number, number, number]; radius?: number }) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[radius, radius, 0.22, 14]} />
      <meshBasicMaterial color={COLORS.ink} />
    </mesh>
  )
}

/** 배달 스쿠터: 낮은 발판, 앞 방패, 뒤에 배달 상자 */
export function ScooterModel() {
  return (
    <group>
      <Wheel position={[0, 0.25, 0.65]} radius={0.25} />
      <Wheel position={[0, 0.25, -0.6]} radius={0.25} />
      <mesh position={[0, 0.38, 0]}>
        <boxGeometry args={[0.5, 0.18, 1.3]} />
        <Ink color="#FF6FB5" thickness={1.6} />
      </mesh>
      <mesh position={[0, 0.8, 0.62]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.55, 0.8, 0.14]} />
        <Ink color="#FF6FB5" thickness={1.6} />
      </mesh>
      <mesh position={[0, 1.22, 0.7]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 0.7, 6]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      <mesh position={[0, 0.66, -0.25]}>
        <boxGeometry args={[0.45, 0.14, 0.6]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      <mesh position={[0, 0.95, -0.75]}>
        <boxGeometry args={[0.6, 0.5, 0.5]} />
        <Ink color="#FFD84D" thickness={1.6} />
      </mesh>
    </group>
  )
}

/** 지붕 없는 작은 차. 사람은 운전석(가운데 조금 뒤)에 앉는다. */
function OpenCar({ color, length, width, height, low = false }: { color: string; length: number; width: number; height: number; low?: boolean }) {
  const half = length / 2
  return (
    <group position={[0, 0, 0.35]}>
      <Wheel position={[width / 2, 0.32, half * 0.62]} />
      <Wheel position={[-width / 2, 0.32, half * 0.62]} />
      <Wheel position={[width / 2, 0.32, -half * 0.62]} />
      <Wheel position={[-width / 2, 0.32, -half * 0.62]} />
      {/* 몸통: 앞뒤는 높고 운전석 자리는 비어 있다. */}
      <mesh position={[0, 0.3 + height / 2, half * 0.55]}>
        <boxGeometry args={[width, height, length * 0.45]} />
        <Ink color={color} thickness={2.2} />
      </mesh>
      <mesh position={[0, 0.3 + height / 2, -half * 0.72]}>
        <boxGeometry args={[width, height, length * 0.28]} />
        <Ink color={color} thickness={2.2} />
      </mesh>
      <mesh position={[0, 0.38, -0.3]}>
        <boxGeometry args={[width, 0.16, length * 0.3]} />
        <Ink color={color} thickness={2.2} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * width) / 2, 0.3 + height * 0.35, -0.3]}>
          <boxGeometry args={[0.08, height * 0.7, length * 0.3]} />
          <Ink color={color} thickness={2.2} />
        </mesh>
      ))}
      {/* 앞유리와 핸들 */}
      <mesh position={[0, 0.3 + height + 0.22, 0.05]} rotation={[-0.35, 0, 0]}>
        <boxGeometry args={[width * 0.85, 0.45, 0.05]} />
        <meshBasicMaterial color="#DFF1FF" transparent opacity={0.75} />
      </mesh>
      <mesh position={[0, 0.3 + height * 0.85, -0.1]} rotation={[0.9, 0, 0]}>
        <torusGeometry args={[0.18, 0.035, 6, 16]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      {/* 전조등 눈 */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * width * 0.3, 0.3 + height * 0.6, half + 0.01]}>
          <circleGeometry args={[low ? 0.1 : 0.13, 12]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
      ))}
    </group>
  )
}

export function CarModel() {
  return <OpenCar color="#8FD3FF" length={2.8} width={1.5} height={0.55} />
}

/** 스포츠카: 납작하고 길고 뒤에 날개가 달렸다. */
export function SportsModel() {
  return (
    <group>
      <OpenCar color="#F0473C" length={3.2} width={1.6} height={0.38} low />
      <mesh position={[0, 1.05, -1.25]}>
        <boxGeometry args={[1.7, 0.08, 0.4]} />
        <Ink color={COLORS.ink} thickness={1.6} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.85, -1.25]}>
          <boxGeometry args={[0.08, 0.35, 0.08]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
      ))}
    </group>
  )
}

/** 트럭: 높은 운전칸과 긴 짐칸. 사람은 지붕 없는 운전칸에 앉는다. */
export function TruckModel() {
  return (
    <group position={[0, 0, 0.5]}>
      {[1.1, -0.9, -2].map((z) =>
        [-0.95, 0.95].map((x) => <Wheel key={`${x},${z}`} position={[x, 0.42, z]} radius={0.42} />),
      )}
      <mesh position={[0, 0.95, 1.1]}>
        <boxGeometry args={[1.9, 1.1, 1]} />
        <Ink color="#FFC531" thickness={2.4} />
      </mesh>
      <mesh position={[0, 0.6, -0.1]}>
        <boxGeometry args={[1.9, 0.3, 1.4]} />
        <Ink color="#FFC531" thickness={2.4} />
      </mesh>
      <mesh position={[0, 1.15, -1.55]}>
        <boxGeometry args={[2, 1.3, 1.9]} />
        <Ink color="#ffffff" thickness={2.4} />
      </mesh>
      <mesh position={[0, 1.9, 0.62]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[1.7, 0.6, 0.05]} />
        <meshBasicMaterial color="#DFF1FF" transparent opacity={0.75} />
      </mesh>
    </group>
  )
}

/** 탈것 종류에 맞는 모형 */
export function RideModel({ kind }: { kind: RideKind }) {
  switch (kind) {
    case 'bike':
      return <BikeModel />
    case 'scooter':
      return <ScooterModel />
    case 'car':
      return <CarModel />
    case 'sports':
      return <SportsModel />
    case 'truck':
      return <TruckModel />
  }
}

/** 카트 레이스용 카트. 낮은 차체에 사람이 다리를 앞으로 뻗고 앉는다. 차체는 탄 사람의 색이다. */
export function KartModel({ color }: { color: string }) {
  return (
    <group>
      {[
        [0.78, 0.62],
        [-0.78, 0.62],
        [0.82, -0.72],
        [-0.82, -0.72],
      ].map(([x, z]) => (
        <Wheel key={`${x},${z}`} position={[x, 0.3, z]} radius={z < 0 ? 0.32 : 0.27} />
      ))}
      {/* 바닥판과 앞 범퍼 */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[1.25, 0.16, 2.1]} />
        <Ink color={color} thickness={2} />
      </mesh>
      <mesh position={[0, 0.42, 1.05]}>
        <boxGeometry args={[1.5, 0.22, 0.3]} />
        <Ink color={color} thickness={2} />
      </mesh>
      {/* 앞코 덮개 */}
      <mesh position={[0, 0.52, 0.62]} rotation={[-0.25, 0, 0]}>
        <boxGeometry args={[0.9, 0.2, 0.7]} />
        <Ink color="#ffffff" thickness={2} />
      </mesh>
      {/* 의자 */}
      <mesh position={[0, 0.48, -0.28]}>
        <boxGeometry args={[0.7, 0.18, 0.6]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      <mesh position={[0, 0.85, -0.6]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.14]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      {/* 핸들 */}
      <mesh position={[0, 0.95, 0.38]} rotation={[0.9, 0, 0]}>
        <torusGeometry args={[0.2, 0.04, 6, 16]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      {/* 뒤 엔진과 배기통 */}
      <mesh position={[0, 0.55, -1.0]}>
        <boxGeometry args={[0.8, 0.4, 0.35]} />
        <Ink color="#BFC5CC" thickness={2} />
      </mesh>
      {[-0.25, 0.25].map((x) => (
        <mesh key={x} position={[x, 0.55, -1.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.3, 8]} />
          <meshBasicMaterial color={COLORS.ink} />
        </mesh>
      ))}
    </group>
  )
}
