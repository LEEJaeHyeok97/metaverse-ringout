import { useMemo } from 'react'
import * as THREE from 'three'
import { FINISH_Z, GATE_Z, STREET_HALF_W, WORLD_MIN_Z } from '../../game/course'
import { BRAND, COLORS } from '../../lib/brand'
import { Tree } from '../common'
import { Ink } from '../ink'
import { Label } from '../Label'

/**
 * 판교 우테코 캠퍼스. 세로 창살이 촘촘한 유리 타워, 오른쪽의 계단식 테라스, 유리 저층부와 앞면의 흰 사각 프레임,
 * 양옆의 유리 빌딩을 펜 선 그림체로 옮겼다. 안개를 받지 않아 출발할 때부터 멀리 목표로 보인다.
 */

const TOWER = { x: 0, z: WORLD_MIN_Z - 26, w: 22, d: 14, base: 8, h: 34 }
const PODIUM = { w: 30, d: 18, h: 8 }

/** 유리 커튼월 무늬. 세로 창살은 촘촘하게, 층 줄은 연하게, 군데군데 하늘이 비친다. */
function useGlassTexture(tint: string, columns: number, floors: number, seed: number) {
  return useMemo(() => {
    const width = 512
    const height = 1024
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = tint
    ctx.fillRect(0, 0, width, height)
    // 하늘이 비친 밝은 사선
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    for (let i = 0; i < 3; i++) {
      const x = ((seed * 97 + i * 173) % width) - 80
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x + 70, 0)
      ctx.lineTo(x + 250, height)
      ctx.lineTo(x + 180, height)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(26,26,26,0.55)'
    ctx.lineWidth = 3
    for (let c = 0; c <= columns; c++) {
      const x = (c / columns) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(26,26,26,0.25)'
    ctx.lineWidth = 2
    for (let f = 0; f <= floors; f++) {
      const y = (f / floors) * height
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [tint, columns, floors, seed])
}

function Block({ position, size, color = '#ffffff', map = null, thickness = 2.6 }: { position: [number, number, number]; size: [number, number, number]; color?: string; map?: THREE.Texture | null; thickness?: number }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <Ink color={color} map={map} thickness={thickness} fog={false} />
    </mesh>
  )
}

function GlassTower({ x, z, w, d, h, tint, seed }: { x: number; z: number; w: number; d: number; h: number; tint: string; seed: number }) {
  const glass = useGlassTexture(tint, Math.round(w * 1.4), Math.round(h / 1.6), seed)
  return (
    <group>
      <Block position={[x, h / 2, z]} size={[w, h, d]} color="#ffffff" map={glass} />
      {/* 옥상 테두리 */}
      <Block position={[x, h + 0.5, z]} size={[w + 0.4, 1, d + 0.4]} color="#F4F7FA" />
    </group>
  )
}

export function Campus() {
  const towerGlass = useGlassTexture('#BFD8EC', 34, 22, 3)
  const podiumGlass = useGlassTexture('#D6E8F4', 26, 4, 7)
  const towerTop = TOWER.base + TOWER.h
  const front = TOWER.z + TOWER.d / 2
  const podiumFront = TOWER.z + PODIUM.d / 2

  // 오른쪽 계단식 테라스. 위로 갈수록 안쪽으로 들어간다.
  const terraces = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        y: TOWER.base + 2 + i * 3.2,
        out: 3.2 - i * 0.28,
      })),
    [],
  )

  return (
    <group>
      {/* 정문과 결승선 */}
      {[-STREET_HALF_W + 1, STREET_HALF_W - 1].map((x) => (
        <mesh key={x} position={[x, 2.2, GATE_Z]}>
          <boxGeometry args={[1.2, 4.4, 1.2]} />
          <Ink color="#ffffff" />
        </mesh>
      ))}
      <mesh position={[0, 4.6, GATE_Z]}>
        <boxGeometry args={[STREET_HALF_W * 2, 0.9, 1.2]} />
        <Ink color={COLORS.accentSoft} />
      </mesh>
      <Label text="우아한테크코스 캠퍼스" position={[0, 6, GATE_Z]} size={0.9} color={COLORS.accent} />
      {[0, 1].flatMap((row) =>
        Array.from({ length: STREET_HALF_W }, (_, i) => (
          <mesh key={`${row}-${i}`} position={[-STREET_HALF_W + 1 + row + i * 2, 0.03, FINISH_Z - row]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial color={i % 2 ? COLORS.ink : '#ffffff'} />
          </mesh>
        )),
      )}
      <Label text={`🎉 도착하면 ${BRAND.name} 알람이 꺼져요`} position={[0, 2.6, FINISH_Z - 2]} size={0.5} background={COLORS.accentSoft} />

      {/* 캠퍼스 앞마당 */}
      <mesh position={[0, 0.02, (WORLD_MIN_Z + TOWER.z) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, Math.abs(TOWER.z - WORLD_MIN_Z) + 20]} />
        <meshBasicMaterial color="#EDEAE2" fog={false} />
      </mesh>

      {/* 저층부: 유리 3층, 위에 흰 띠 */}
      <Block position={[TOWER.x, PODIUM.h / 2, TOWER.z]} size={[PODIUM.w, PODIUM.h, PODIUM.d]} map={podiumGlass} />
      <Block position={[TOWER.x, PODIUM.h + 0.4, TOWER.z]} size={[PODIUM.w + 0.6, 0.8, PODIUM.d + 0.6]} color="#F4F7FA" />
      {/* 입구 캐노피 */}
      <Block position={[TOWER.x - 4, 3.2, podiumFront + 1.2]} size={[10, 0.35, 2.4]} color="#F4F7FA" />

      {/* 본 타워 */}
      <Block position={[TOWER.x, TOWER.base + TOWER.h / 2, TOWER.z]} size={[TOWER.w, TOWER.h, TOWER.d]} map={towerGlass} />
      {/* 옥상의 흰 왕관 프레임 */}
      <Block position={[TOWER.x, towerTop + 1.2, TOWER.z]} size={[TOWER.w + 0.4, 2.4, TOWER.d + 0.4]} color="#F4F7FA" />
      <Block position={[TOWER.x - 2, towerTop + 3, TOWER.z]} size={[TOWER.w - 6, 1.2, TOWER.d - 4]} color="#E6EDF3" />
      {/* 앞면 아래쪽의 흰 사각 프레임 */}
      <group position={[TOWER.x - 4, TOWER.base + 5, front + 0.2]}>
        <Block position={[0, 2.2, 0]} size={[11, 0.45, 0.5]} thickness={2} />
        <Block position={[0, -2.2, 0]} size={[11, 0.45, 0.5]} thickness={2} />
        <Block position={[-5.3, 0, 0]} size={[0.45, 4.85, 0.5]} thickness={2} />
        <Block position={[5.3, 0, 0]} size={[0.45, 4.85, 0.5]} thickness={2} />
      </group>
      {/* 오른쪽 계단식 테라스 */}
      {terraces.map((terrace) => (
        <group key={terrace.y}>
          <Block position={[TOWER.x + TOWER.w / 2 + terrace.out / 2, terrace.y, TOWER.z + 0.5]} size={[terrace.out, 0.35, TOWER.d - 1]} thickness={1.8} />
          <Block position={[TOWER.x + TOWER.w / 2 + terrace.out / 2, terrace.y + 1.4, TOWER.z + 0.5]} size={[terrace.out, 2.4, TOWER.d - 1.4]} color="#D6E8F4" thickness={1.4} />
        </group>
      ))}
      {/* 옥상 간판 자리. 로고 에셋이 오면 이미지로 바꾼다. */}
      <Label text="우테코 캠퍼스" position={[TOWER.x + 4, towerTop - 1.5, front + 0.6]} size={1.4} color={COLORS.ink} background="#ffffff" />

      {/* 양옆 유리 빌딩 */}
      <GlassTower x={-30} z={TOWER.z + 4} w={16} d={14} h={30} tint="#A9C4DA" seed={11} />
      <GlassTower x={31} z={TOWER.z + 2} w={14} d={14} h={27} tint="#B4CFE3" seed={5} />
      <GlassTower x={-48} z={TOWER.z - 6} w={14} d={12} h={22} tint="#C3D7E6" seed={2} />
      <GlassTower x={48} z={TOWER.z - 8} w={12} d={12} h={20} tint="#C3D7E6" seed={9} />

      {/* 앞마당 가로수 */}
      {[-14, -7, 7, 14].map((x) => (
        <Tree key={x} position={[x, 0, podiumFront + 5]} scale={1.2} />
      ))}
    </group>
  )
}
