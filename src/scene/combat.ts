import { PUNCH_COOLDOWN_MS, PUNCH_RANGE } from '../game/course'
import { audio } from '../lib/audio'
import { connection } from '../net/connection'

let lastPunchAt = 0

/**
 * 가까운 사람을 때린다. 맞았는지는 서버가 정해서 알려 주므로 여기서는 휘두르고 요청만 보낸다.
 * 휘둘렀으면 true를 돌려준다(헛손질이어도 주먹은 나간다).
 */
export function tryPunch(x: number, z: number, heading: number) {
  const now = performance.now()
  if (now - lastPunchAt < PUNCH_COOLDOWN_MS) return false
  lastPunchAt = now
  const myId = connection.getState().myId
  let target: number | null = null
  let best = Infinity
  for (const [id, other] of connection.positions) {
    if (id === myId) continue
    const dx = other.x - x
    const dz = other.z - z
    const distance = Math.hypot(dx, dz)
    // 바라보는 쪽으로 너무 벗어난 사람은 빼되, 아주 가까우면 등 뒤여도 맞힌다.
    const facing = Math.cos(Math.atan2(dx, dz) - heading)
    if (distance <= PUNCH_RANGE && (facing > -0.2 || distance < 0.9) && distance < best) {
      best = distance
      target = id
    }
  }
  audio.effect('jump')
  if (target !== null) connection.send({ t: 'punch', target })
  return true
}

export function nicknameOf(id: number) {
  const { lobby, game } = connection.getState()
  return [...game, ...lobby].find((player) => player.id === id)?.nickname ?? '누군가'
}
