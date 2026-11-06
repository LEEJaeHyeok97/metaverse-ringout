import { Outlines } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORS } from '../lib/brand'

function createRamp() {
  // 밝은 두 단계만 써서 색칠은 연하게, 형태는 펜 선으로 보이게 한다.
  const ramp = new THREE.DataTexture(new Uint8Array([200, 245, 255]), 3, 1, THREE.RedFormat)
  ramp.minFilter = THREE.NearestFilter
  ramp.magFilter = THREE.NearestFilter
  ramp.needsUpdate = true
  return ramp
}

const ramp = createRamp()

type InkProps = {
  color?: string
  map?: THREE.Texture | null
  outline?: boolean
  /** 외곽선 두께(CSS 픽셀). 카메라 거리와 상관없이 일정해 펜으로 그린 선처럼 보인다. */
  thickness?: number
  transparent?: boolean
  opacity?: number
  /** false면 안개에 흐려지지 않는다. 멀리서도 보여야 하는 랜드마크에 쓴다. */
  fog?: boolean
}

/** 졸라맨 그림체 재질. 흰 종이에 검은 펜 외곽선을 두른다. 메시의 자식으로 넣는다. */
export function Ink({ color = '#ffffff', map = null, outline = true, thickness = 2.2, transparent = false, opacity = 1, fog = true }: InkProps) {
  useThree((state) => state.size)
  const dpr = useThree((state) => state.viewport.dpr)
  return (
    <>
      <meshToonMaterial color={color} map={map} gradientMap={ramp} transparent={transparent} opacity={opacity} fog={fog} />
      {outline && <Outlines thickness={thickness * dpr} color={COLORS.ink} />}
    </>
  )
}

/** 졸라맨 팔다리처럼 그림자 없이 까만 펜 선 */
export const penMaterial = new THREE.MeshBasicMaterial({ color: COLORS.ink })
