import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { connection } from '../net/connection'
import { animFrom, type PlayerInfo } from '../net/protocol'
import { courseFrame, GIANT_SCALE, type Frame } from '../game/course'
import { Label } from './Label'
import { StickFigure, type Motion } from './StickFigure'

/** 채팅 말풍선. 내 것도 서버가 되돌려 주므로 같은 방식으로 띄운다. */
export function useBubble(id: number | null) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (id === null) return
    const timer = setInterval(() => {
      const bubble = connection.bubbles.get(id)
      setText(bubble && bubble.until > performance.now() ? bubble.text : null)
    }, 250)
    return () => clearInterval(timer)
  }, [id])
  return text
}

export function NameAndBubble({ id, nickname, color, height = 2.25 }: { id: number | null; nickname: string; color: string; height?: number }) {
  const bubble = useBubble(id)
  return (
    <>
      <Label text={nickname} position={[0, height, 0]} size={0.32} color={color} />
      {bubble && <Label text={bubble} position={[0, height + 0.62, 0]} size={0.34} />}
    </>
  )
}

const FOLLOW = 12
const goal = new THREE.Vector3()
const before = new THREE.Vector3()
const frame: Frame = { x: 0, z: 0, angle: 0 }

/** curved면 받은 위치가 코스 좌표라서 휘어진 도로 위로 옮겨 그린다. */
function RemoteFigure({ player, curved }: { player: PlayerInfo; curved: boolean }) {
  const group = useRef<THREE.Group>(null)
  const motion = useRef<Motion>({ anim: 'idle', speed: 0 })
  const placed = useRef(false)

  useFrame((_, delta) => {
    const target = connection.positions.get(player.id)
    const node = group.current
    if (!node) return
    node.visible = Boolean(target)
    if (!target) return
    let heading = target.h
    if (curved) {
      courseFrame(target.x, target.z, frame)
      goal.set(frame.x, target.y, frame.z)
      heading -= frame.angle
    } else {
      goal.set(target.x, target.y, target.z)
    }
    if (!placed.current || node.position.distanceTo(goal) > 8) {
      node.position.copy(goal)
      placed.current = true
    }
    before.copy(node.position)
    const blend = 1 - Math.exp(-delta * FOLLOW)
    node.position.lerp(goal, blend)
    let turn = heading - node.rotation.y
    turn = Math.atan2(Math.sin(turn), Math.cos(turn))
    node.rotation.y += turn * blend
    motion.current.anim = animFrom(target.a)
    // 거인 버섯을 먹은 사람은 커지고, 유령은 하얀 천을 쓴다.
    const size = connection.isGiant(player.id) ? GIANT_SCALE : 1
    node.scale.setScalar(node.scale.x + (size - node.scale.x) * blend * 0.5)
    motion.current.ghost = connection.isGhost(player.id)
    motion.current.speed = delta > 0 ? Math.hypot(node.position.x - before.x, node.position.z - before.z) / delta : 0
  })

  return (
    <group ref={group} visible={false}>
      <StickFigure motion={motion} color={player.color} />
      <NameAndBubble id={player.id} nickname={player.nickname} color={player.color} />
    </group>
  )
}

/** 같은 공간에 있는 다른 사람들. 위치는 connection.positions에서 매 프레임 읽는다. */
export function RemotePlayers({ players, myId, curved = false }: { players: PlayerInfo[]; myId: number | null; curved?: boolean }) {
  return (
    <>
      {players
        .filter((player) => player.id !== myId)
        .map((player) => (
          <RemoteFigure key={player.id} player={player} curved={curved} />
        ))}
    </>
  )
}
