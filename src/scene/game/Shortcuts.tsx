import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SHORTCUTS, shortcutDoorX, shortcutState, type Shortcut } from '../../game/course'
import { gameSeconds } from '../../game/run'
import { COLORS } from '../../lib/brand'
import { Ink } from '../ink'
import { Label } from '../Label'
import { OnCourse } from './onCourse'

const FRAME = '#8C5A3C'
const WIDTH = 2.6
const HEIGHT = 3
/** 문이 길 가운데와 다가오는 사람 쪽 사이를 비스듬히 바라보게 돌린다. 길을 따라 달리며 문 안이 잘 보인다. */
const FACE = Math.PI / 4

/** 문틀과 어두운 골목 입구. 길 가운데를 바라본다. */
function Doorway({ shutter }: { shutter?: React.RefObject<THREE.Mesh | null> }) {
  return (
    <>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (WIDTH / 2 + 0.2), HEIGHT / 2, 0]}>
          <boxGeometry args={[0.4, HEIGHT, 0.5]} />
          <Ink color={FRAME} thickness={1.6} />
        </mesh>
      ))}
      <mesh position={[0, HEIGHT + 0.2, 0]}>
        <boxGeometry args={[WIDTH + 0.8, 0.4, 0.5]} />
        <Ink color={FRAME} thickness={1.6} />
      </mesh>
      {/* 문 양옆의 벽돌 담 */}
      {[-1, 1].map((side) => (
        <mesh key={`wall${side}`} position={[side * (WIDTH / 2 + 1.4), (HEIGHT + 0.4) / 2, -0.1]}>
          <boxGeometry args={[2, HEIGHT + 0.4, 0.4]} />
          <Ink color="#D98C6A" thickness={1.6} />
        </mesh>
      ))}
      <mesh position={[0, HEIGHT / 2, -0.2]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial color="#2B2B2B" />
      </mesh>
      {shutter && (
        <mesh ref={shutter} position={[0, HEIGHT / 2, 0]}>
          <boxGeometry args={[WIDTH, HEIGHT, 0.12]} />
          <Ink color="#A8B4C2" thickness={1.4} />
        </mesh>
      )}
    </>
  )
}

/** 지름길 입구: 셔터가 열렸다 닫혔다 하고, 위 간판에 열림/닫힘과 남은 초를 띄운다. 바닥 화살표가 문으로 이끈다. */
function Entrance({ shortcut }: { shortcut: Shortcut }) {
  const shutter = useRef<THREE.Mesh>(null)
  const [status, setStatus] = useState({ open: false, left: 0 })
  useFrame((_, delta) => {
    const state = shortcutState(shortcut, gameSeconds())
    if (shutter.current) shutter.current.position.y = THREE.MathUtils.damp(shutter.current.position.y, state.open ? HEIGHT * 1.45 : HEIGHT / 2, 8, delta)
    const left = Math.ceil(state.left)
    if (state.open !== status.open || left !== status.left) setStatus({ open: state.open, left })
  })
  const x = shortcutDoorX(shortcut)
  return (
    <>
      <OnCourse x={x} z={shortcut.from} rotation={-shortcut.side * FACE}>
        <Doorway shutter={shutter} />
        <Label text={`🚪 지름길 · ${shortcut.name}`} position={[0, HEIGHT + 1.3, 0]} size={0.5} color={COLORS.accent} background="#FFF6C9" />
        <Label
          text={status.open ? `열림! ${status.left}초 남음` : `닫힘 · ${status.left}초 뒤 열려요`}
          position={[0, HEIGHT + 0.65, 0]}
          size={0.4}
          color={status.open ? '#1E9E68' : '#F0473C'}
          background="#ffffff"
        />
      </OnCourse>
      {/* 문으로 이끄는 바닥 화살표 */}
      {[3, 5.5, 8].map((inward, i) => (
        <OnCourse key={i} x={x - shortcut.side * inward} z={shortcut.from} y={0.04 + i * 0.001} rotation={shortcut.side === 1 ? 0 : Math.PI}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.7, 3]} />
            <meshBasicMaterial color={status.open ? '#FFD84D' : '#D9D9D9'} />
          </mesh>
        </OnCourse>
      ))}
    </>
  )
}

/** 길가 건물 사이로 난 지름길 골목. 들어가는 문과 나오는 문이 있다. */
export function Shortcuts() {
  return (
    <>
      {SHORTCUTS.map((shortcut) => (
        <group key={shortcut.id}>
          <Entrance shortcut={shortcut} />
          <OnCourse x={shortcutDoorX(shortcut)} z={shortcut.to} rotation={-shortcut.side * FACE}>
            <Doorway />
            <Label text="🏃 지름길 출구" position={[0, HEIGHT + 1, 0]} size={0.42} background="#ffffff" />
          </OnCourse>
        </group>
      ))}
    </>
  )
}
