/**
 * 카트 레이스 모드. 한 바퀴를 도는 서킷을 3바퀴 달린다(전체 2분쯤).
 * 서버도 이 파일을 읽어 바퀴 수와 도착을 확인하므로 three나 브라우저 API를 쓰지 않는다.
 *
 * 좌표는 평평한 월드 좌표(x, z)다. 카트가 바라보는 방향 h는 앞이 (sin h, cos h)가 되는 각도다.
 * 트랙은 가운데 선을 1칸 간격의 점(샘플)으로 늘어놓은 표이고, 샘플 번호가 커지는 쪽이 앞이다. 0번이 출발선이다.
 */

import type { GameMode } from '../net/protocol'

export const MODE_INFO: Record<GameMode, { icon: string; name: string; help: string }> = {
  commute: { icon: '🏃', name: '출근 레이스', help: '알람에 일어나 장애물을 넘어 캠퍼스까지' },
  kart: { icon: '🏎️', name: '카트 레이스', help: '드리프트와 부스터로 서킷 3바퀴' },
}

export const KART_LAPS = 3
export const KART_TRACK_NAME = '링아웃 서킷'
/** 도로 가운데에서 가장자리까지. 이 밖은 잔디라 느려진다. */
export const KART_HALF_WIDTH = 8
/** 잔디 바깥의 타이어 벽. 이 밖으로는 못 나간다. */
export const KART_WALL = KART_HALF_WIDTH + 5
export const KART_RADIUS = 1

// ---- 빠르기 ----
export const KART_MAX_SPEED = 26
export const KART_ACCEL = 17
export const KART_BRAKE = 30
export const KART_REVERSE_SPEED = 8
export const KART_COAST = 7
/** 잔디 위에서는 최고 속도가 이만큼으로 줄어든다. */
export const KART_GRASS_FACTOR = 0.5
export const KART_TURN = 2.1
/** 부스트(드리프트 터보, 발판, 아이템)를 받으면 최고 속도에 곱한다. */
export const KART_BOOST_FACTOR = 1.4
/** 가장 빠를 때. 서버가 너무 빠른 이동을 거를 때 쓴다. */
export const KART_TOP_SPEED = KART_MAX_SPEED * KART_BOOST_FACTOR

// ---- 드리프트 ----
/** 드리프트를 시작하려면 이만큼은 빨라야 한다. */
export const DRIFT_MIN_SPEED = 12
/** 드리프트를 이만큼(초) 끌면 미니 터보가 1·2·3단으로 모인다. 파랑 → 주황 → 보라 */
export const DRIFT_LEVELS = [0.8, 1.7, 2.7] as const
/** 단계별 터보 시간(초). 0단은 터보가 없다. */
export const DRIFT_TURBO_SECONDS = [0, 0.6, 1.1, 1.7] as const
export const DRIFT_COLORS = ['#ffffff', '#3FA9FF', '#FF9A2E', '#B45CFF'] as const

export function driftLevel(charge: number) {
  let level = 0
  DRIFT_LEVELS.forEach((need, index) => {
    if (charge >= need) level = index + 1
  })
  return level
}

// ---- 부스터 발판, 아이템 ----
export const KART_PAD_RADIUS = 2.4
export const KART_PAD_SECONDS = 1.1
export const KART_BOX_REACH = 1.8
export const KART_BOX_RESPAWN_MS = 3000
/** 출발 신호 직전에 엑셀을 밟으면 로켓 스타트. 너무 일찍 밟으면 헛바퀴 */
export const ROCKET_WINDOW = 1
export const ROCKET_SECONDS = 1.3
export const BANANA_SPIN_SECONDS = 1.1
export const ZAP_SPIN_SECONDS = 1.2

export const KART_ITEMS = ['booster', 'triple', 'banana', 'zap'] as const
export type KartItem = (typeof KART_ITEMS)[number]

export const KART_ITEM_INFO: Record<KartItem, { icon: string; name: string; help: string; uses: number }> = {
  booster: { icon: '🚀', name: '부스터', help: '한 번 쌩!', uses: 1 },
  triple: { icon: '🚀🚀🚀', name: '트리플 부스터', help: '세 번까지 쌩!', uses: 3 },
  banana: { icon: '🍌', name: '바나나', help: '뒤에 떨어뜨려요. 밟으면 빙글', uses: 1 },
  zap: { icon: '⚡', name: '번개', help: '다른 카트 모두 빙글 돌아요', uses: 1 },
}
export const KART_BOOSTER_SECONDS = 1.5

/** 순위에 따라 나오는 아이템. 뒤처질수록 트리플 부스터와 번개가 잘 나온다. rank는 0이 1등이다. */
export function rollKartItem(rank: number, total: number, random = Math.random()): KartItem {
  const behind = total <= 1 ? 0.5 : rank / (total - 1)
  const weights: Record<KartItem, number> = {
    booster: 3,
    triple: 0.6 + behind * 2.4,
    banana: 3.2 - behind * 2.2,
    zap: total > 1 ? behind * behind * 1.6 : 0,
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0)
  let pick = random * sum
  for (const kind of KART_ITEMS) {
    pick -= weights[kind]
    if (pick <= 0) return kind
  }
  return 'booster'
}

// ---- 시간 ----
/** 출발 신호까지(3, 2, 1, 출발!) */
export const KART_COUNTDOWN_MS = 4000
/** 이 시간이 지나면 들어오지 못한 사람은 완주 실패로 끝낸다. */
export const KART_LIMIT_SECONDS = 200
/** 1등이 들어오면 남은 사람은 이 시간 안에 들어와야 한다. */
export const KART_GRACE_SECONDS = 15

// ---- 트랙 ----
/**
 * 서킷 모양을 잡는 점. 이 점들을 부드럽게 이은 고리가 가운데 선이 된다.
 * 출발 직선 → 오른쪽 헤어핀 → S자 → 긴 직선 → 큰 왼쪽 곡선 → 시케인 → 출발선
 */
const CONTROL: [number, number][] = [
  [0, -40],
  [0, 40],
  [6, 90],
  [30, 120],
  [66, 120],
  [86, 96],
  [82, 64],
  [96, 36],
  [130, 30],
  [160, 46],
  [176, 82],
  [204, 104],
  [240, 100],
  [262, 70],
  [266, 20],
  [262, -40],
  [244, -88],
  [204, -112],
  [156, -110],
  [128, -94],
  [100, -96],
  [70, -120],
  [34, -116],
  [8, -88],
]

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

/** 고리를 촘촘히 따라간 뒤 1칸 간격으로 다시 고른다. */
/** 한 바퀴가 40초 남짓 되도록 모양을 줄인다. */
const SCALE = 0.85

function buildTrack() {
  const dense: [number, number][] = []
  const control = CONTROL.map(([x, z]) => [x * SCALE, z * SCALE] as const)
  const n = control.length
  for (let i = 0; i < n; i++) {
    const p0 = control[(i - 1 + n) % n]
    const p1 = control[i]
    const p2 = control[(i + 1) % n]
    const p3 = control[(i + 2) % n]
    for (let k = 0; k < 40; k++) {
      const t = k / 40
      dense.push([catmullRom(p0[0], p1[0], p2[0], p3[0], t), catmullRom(p0[1], p1[1], p2[1], p3[1], t)])
    }
  }
  const points: { x: number; z: number }[] = []
  let carry = 0
  for (let i = 0; i < dense.length; i++) {
    const [ax, az] = dense[i]
    const [bx, bz] = dense[(i + 1) % dense.length]
    const length = Math.hypot(bx - ax, bz - az)
    let at = carry
    while (at < length) {
      const t = at / length
      points.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t })
      at += 1
    }
    carry = at - length
  }
  // 0번이 출발 직선(x=0, z=0 근처)에 오게 돌린다.
  let start = 0
  let best = Infinity
  points.forEach((point, index) => {
    const d = Math.hypot(point.x, point.z)
    if (d < best) {
      best = d
      start = index
    }
  })
  const rotated = [...points.slice(start), ...points.slice(0, start)]
  return rotated.map((point, index) => {
    const next = rotated[(index + 1) % rotated.length]
    const prev = rotated[(index - 1 + rotated.length) % rotated.length]
    return { ...point, h: Math.atan2(next.x - prev.x, next.z - prev.z) }
  })
}

/** 가운데 선. x, z와 그 자리에서 앞을 보는 방향 h */
export const TRACK = buildTrack()
export const TRACK_LENGTH = TRACK.length

export function trackPoint(index: number) {
  return TRACK[((Math.round(index) % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH]
}

/** 가운데 선에서 오른쪽으로 lateral만큼 떨어진 자리. 오른쪽은 앞을 볼 때 오른손 쪽이다. */
export function trackSpot(index: number, lateral: number) {
  const point = trackPoint(index)
  return { x: point.x - Math.cos(point.h) * lateral, z: point.z + Math.sin(point.h) * lateral, h: point.h }
}

/** 이 자리에서 가장 가까운 가운데 선 샘플과 거리. hint를 주면 그 근처부터 찾는다. */
export function nearestTrack(x: number, z: number, hint?: number) {
  let best = 0
  let bestDistance = Infinity
  const scan = (from: number, to: number) => {
    for (let i = from; i <= to; i++) {
      const index = ((i % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH
      const point = TRACK[index]
      const d = (point.x - x) ** 2 + (point.z - z) ** 2
      if (d < bestDistance) {
        bestDistance = d
        best = index
      }
    }
  }
  if (hint !== undefined) scan(hint - 40, hint + 40)
  // 근처에서 못 찾았으면(순간이동 등) 전부 훑는다.
  if (hint === undefined || bestDistance > KART_WALL * KART_WALL * 2) scan(0, TRACK_LENGTH - 1)
  return { index: best, distance: Math.sqrt(bestDistance) }
}

/** 지나온 바퀴 수와 지금 샘플. 출발선을 앞으로 넘으면 바퀴가 늘고, 거꾸로 넘으면 준다. */
export type LapTracker = { index: number; laps: number }

export function newTracker(index: number): LapTracker {
  return { index, laps: 0 }
}

/** 새 자리로 바퀴 기록을 옮긴다. 바퀴가 바뀌었으면 true */
export function advanceTracker(tracker: LapTracker, x: number, z: number) {
  const { index } = nearestTrack(x, z, tracker.index)
  const step = index - tracker.index
  const before = tracker.laps
  if (step < -TRACK_LENGTH / 2) tracker.laps += 1
  else if (step > TRACK_LENGTH / 2) tracker.laps -= 1
  tracker.index = index
  return tracker.laps !== before
}

/** 앞으로 간 거리 전체. 순위를 매길 때 쓴다. */
export function trackerProgress(tracker: LapTracker) {
  return tracker.laps * TRACK_LENGTH + tracker.index
}

/** 출발 자리. 출발선 바로 앞에 두 줄로 엇갈려 선다. */
export function gridSpot(lane: number) {
  const lateral = (lane - 2) * 2.8
  const index = 12 - (lane % 2) * 5
  return trackSpot(index, lateral)
}

/** 트랙을 가로지르는 아이템 상자 줄(샘플 번호)과 한 줄의 칸 */
export const KART_BOX_ROWS = [0.2, 0.47, 0.74].map((f) => Math.round(TRACK_LENGTH * f))
export const KART_BOX_LATERALS = [-5, -2.5, 0, 2.5, 5]

/** 부스터 발판. 직선과 곡선 출구에 있다. */
export const KART_PADS = [
  { at: 0.08, lateral: -3 },
  { at: 0.33, lateral: 3 },
  { at: 0.58, lateral: 0 },
  { at: 0.63, lateral: -4 },
  { at: 0.88, lateral: 4 },
].map(({ at, lateral }) => ({ index: Math.round(TRACK_LENGTH * at), ...trackSpot(Math.round(TRACK_LENGTH * at), lateral) }))

/** 아무리 빨라도 이보다 빨리 들어올 수는 없다. 서버가 도착 신고를 거를 때 쓴다. */
export const KART_MIN_FINISH_SECONDS = (KART_LAPS * TRACK_LENGTH) / KART_TOP_SPEED - 3
