/** 브라우저와 서버가 주고받는 메시지. 서버도 이 파일을 읽으므로 다른 파일을 가져오지 않는다. */

export const PLAYER_COLORS = ['#FF5A4E', '#2F7DF6', '#1DB46A', '#FFB020', '#A259FF', '#FF6FB5', '#14B8C4', '#8A5A2B'] as const

export const MAX_NICKNAME_LENGTH = 10
export const MAX_CHAT_LENGTH = 40

/** 캐릭터 동작. 다른 화면에서 같은 자세로 그리기 위해 함께 보낸다. */
// 번호로 주고받으므로 새 동작은 끝에만 붙인다.
export const ANIMS = ['idle', 'walk', 'jump', 'sleep', 'down', 'cheer', 'stumble', 'ride', 'punch', 'trapped', 'ufo', 'kick', 'scooter', 'car', 'sports', 'truck', 'slide'] as const
export type Anim = (typeof ANIMS)[number]

export type PlayerInfo = { id: number; nickname: string; color: string }

export type RoomPhase = 'waiting' | 'countdown' | 'playing'

export type RoomView = {
  code: string
  hostId: number
  phase: RoomPhase
  members: PlayerInfo[]
}

export type ResultRow = PlayerInfo & { lane: number; ms: number | null; rank: number | null }

/** 위치 하나: id, x, y, z, 바라보는 방향, 동작 번호 */
export type SnapshotEntry = [number, number, number, number, number, number]

/** 함께 정원에 심은 나무. at은 서버 시각이다. */
export type SharedTree = { tile: number; nickname: string; color: string; at: number }

/** 맞는 사람을 서버가 정하지 않고, 각자 화면이 자기가 맞았는지 정하는 아이템. 서버는 쓴 자리와 시각만 알린다. */
export type AreaItem = 'zap' | 'bomb' | 'tornado' | 'giant' | 'ghost' | 'snail'
export const AREA_ITEMS: readonly AreaItem[] = ['zap', 'bomb', 'tornado', 'giant', 'ghost', 'snail']

export type ClientMessage =
  | { t: 'hello'; nickname: string; color: string }
  | { t: 'move'; x: number; y: number; z: number; h: number; a: number }
  | { t: 'chat'; text: string }
  | { t: 'quick' }
  | { t: 'create' }
  | { t: 'join'; code: string }
  | { t: 'leave' }
  | { t: 'start' }
  | { t: 'finish' }
  | { t: 'lobby' }
  /** kick이면 발차기: 더 멀리 닿고 맞은 사람이 뒤로 날아간다. */
  | { t: 'punch'; target: number; kick?: boolean }
  | { t: 'ride'; bike: number }
  /** 남에게 쓰는 아이템. 물풍선과 귀가 포털은 target을, 우주선은 서버가 1등을 고른다. 바나나는 내 뒤에 놓는다. 맞힐 사람이 없으면 허공에 쓴다. */
  | { t: 'item'; kind: 'balloon' | 'ufo' | 'banana' | 'warp' | AreaItem; target?: number }
  /** 차를 타고 있는 사람이 다른 사람을 들이받았다. */
  | { t: 'ram'; target: number }
  | { t: 'slip'; banana: number }
  /** 나에게 쓰는 아이템(부스터, 방패)을 썼다. 모두의 화면에 궁극기 연출을 띄운다. */
  | { t: 'fx'; kind: 'booster' | 'shield' }
  | { t: 'plant'; tile: number }


export type ServerMessage =
  | { t: 'welcome'; id: number }
  | { t: 'roster'; channel: 'lobby' | 'game'; players: PlayerInfo[] }
  | { t: 'snap'; p: SnapshotEntry[] }
  | { t: 'room'; room: RoomView | null }
  /** map: 이번 판에 달릴 맵 id (course.ts의 MAPS) */
  | { t: 'countdown'; startIn: number; map: string }
  | { t: 'start'; startIn: number; lanes: Record<number, number>; map: string }
  | { t: 'finished'; id: number; ms: number; rank: number }
  /** 1등이 도착했다. endsIn 뒤에 게임이 끝난다. */
  | { t: 'closing'; endsIn: number }
  | { t: 'results'; rows: ResultRow[] }
  | { t: 'chat'; id: number; nickname: string; text: string }
  | { t: 'error'; message: string }
  | { t: 'punched'; from: number; to: number; kick?: boolean; ram?: boolean }
  /** 자전거 번호 → 탄 사람. 한 번 탄 따릉이는 그 판에 다시 쓸 수 없다. */
  | { t: 'bikes'; taken: Record<number, number> }
  /** 누군가 아이템에 당했다. 당한 사람의 화면이 효과를 낸다. */
  | { t: 'trapped'; from: number; to: number; kind: 'balloon' | 'ufo' | 'warp' }
  /** 궁극기 연출. 맞힐 사람 없이 허공에 쓴 물풍선, 우주선, 귀환 포털은 떨어진 자리(x, z)가 온다. */
  | { t: 'fx'; from: number; kind: 'booster' | 'shield' | 'balloon' | 'ufo' | 'warp' | AreaItem; x?: number; z?: number }
  | { t: 'bananas'; list: { id: number; x: number; z: number; owner: number }[] }
  /** 함께 정원의 모든 나무. 방금 누가 심었으면 planted에 그 타일과 심은 사람이 온다. */
  | { t: 'garden'; trees: SharedTree[]; planted?: { tile: number; by: number } }

export function animIndex(anim: Anim) {
  return ANIMS.indexOf(anim)
}

export function animFrom(index: number): Anim {
  return ANIMS[index] ?? 'idle'
}
