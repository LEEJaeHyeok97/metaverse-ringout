import { useMemo, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORS } from '../lib/brand'
import { Ink } from './ink'

/** 모눈 공책 바닥 무늬 */
export function useGridTexture(repeatX: number, repeatY: number, base: string = COLORS.paper) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 128, 128)
    ctx.strokeStyle = COLORS.grid
    ctx.lineWidth = 3
    ctx.strokeRect(0, 0, 128, 128)
    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(repeatX, repeatY)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [repeatX, repeatY, base])
}

export function Lights() {
  return (
    <>
      <ambientLight intensity={1.6} />
      <directionalLight position={[8, 20, 10]} intensity={1.4} />
    </>
  )
}

/** 줄기는 펜 선 한 줄, 잎은 동그라미 하나인 나무 */
export function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 1.8, 6]} />
        <meshBasicMaterial color={COLORS.ink} />
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <sphereGeometry args={[1.1, 16, 12]} />
        <Ink color={COLORS.leaf} />
      </mesh>
    </group>
  )
}

/** 바닥에 그린 펜 선 동그라미 */
export function FloorRing({ radius, position = [0, 0.02, 0], color = COLORS.ink, width = 0.08 }: { radius: number; position?: [number, number, number]; color?: string; width?: number }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - width / 2, radius + width / 2, 64]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

const cameraTarget = new THREE.Vector3()
const lookTarget = new THREE.Vector3()

/** 캐릭터 뒤 위에서 따라가는 카메라. 세로 화면에서는 조금 더 물러선다. */
export function useFollowCamera(target: RefObject<THREE.Object3D | null>, options: { height: number; distance: number; look: number; enabled?: RefObject<boolean> }) {
  const size = useThree((state) => state.size)
  const portrait = size.height > size.width
  useFrame(({ camera }, delta) => {
    if (options.enabled && !options.enabled.current) return
    const node = target.current
    if (!node) return
    const scale = portrait ? 1.35 : 1
    cameraTarget.set(node.position.x, options.height * scale, node.position.z + options.distance * scale)
    lookTarget.set(node.position.x, 1, node.position.z - options.look)
    const blend = 1 - Math.exp(-delta * 5)
    camera.position.lerp(cameraTarget, blend)
    camera.lookAt(lookTarget)
  })
}
