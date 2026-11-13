import { gridSpot, nearestTrack, newTracker, type KartItem, type LapTracker } from './kart'

/** 내 카트 레이스 진행 상태. 3D 화면이 매 프레임 쓰고 HUD가 주기적으로 읽는다. 안내 문구와 화면 흔들림은 run.ts의 것을 함께 쓴다. */

export type KartPhase = 'countdown' | 'racing' | 'finished'

export const kart = {
  startAt: 0,
  lane: 2,
  phase: 'countdown' as KartPhase,
  x: 0,
  z: 0,
  h: 0,
  /** 앞으로 가는 빠르기(뒤로 가면 음수) */
  speed: 0,
  tracker: newTracker(0) as LapTracker,
  /** 바퀴마다 걸린 시간(ms) */
  lapTimes: [] as number[],
  lapStartedAt: 0,
  /** 드리프트 방향(-1 왼쪽, 1 오른쪽, 0 아님)과 모은 터보 */
  driftDir: 0,
  driftCharge: 0,
  boostUntil: 0,
  spinUntil: 0,
  item: null as KartItem | null,
  itemUses: 0,
  rank: 0,
  total: 1,
  wrongWay: false,
  onGrass: false,
  finishedAt: 0,
  /** 상자 줄-칸 → 깬 시각. 잠시 뒤 다시 생긴다. */
  boxesTaken: new Map<string, number>(),
}

export function resetKart(startAt: number, lane: number) {
  const spot = gridSpot(lane)
  kart.startAt = startAt
  kart.lane = lane
  kart.phase = 'countdown'
  kart.x = spot.x
  kart.z = spot.z
  kart.h = spot.h
  kart.speed = 0
  kart.tracker = newTracker(nearestTrack(spot.x, spot.z).index)
  kart.lapTimes = []
  kart.lapStartedAt = startAt
  kart.driftDir = 0
  kart.driftCharge = 0
  kart.boostUntil = 0
  kart.spinUntil = 0
  kart.item = null
  kart.itemUses = 0
  kart.rank = 0
  kart.total = 1
  kart.wrongWay = false
  kart.onGrass = false
  kart.finishedAt = 0
  kart.boxesTaken = new Map()
}

/** 출발 신호부터 지난 초. 신호 전이면 음수다. */
export function kartSeconds(now = performance.now()) {
  return (now - kart.startAt) / 1000
}

if (import.meta.env.DEV) Object.assign(window, { __kart: kart })
