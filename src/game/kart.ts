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
  kart: { icon: '🏎️', name: '카트 레이스', help: '드리프트, 부스터, 아이템 8종으로 맵 5곳을 3바퀴씩' },
}

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

/** 아이템은 한 번에 하나만 들고, 한 번 쓰면 사라진다(한 개로 여러 번 쓰는 아이템은 너무 세서 뺐다). */
export const KART_ITEMS = ['booster', 'banana', 'shield', 'alarm', 'ghost', 'giant', 'snail', 'zap'] as const
export type KartItem = (typeof KART_ITEMS)[number]

export const KART_ITEM_INFO: Record<KartItem, { icon: string; name: string; help: string }> = {
  booster: { icon: '🚀', name: '부스터', help: '한 번 쌩!' },
  banana: { icon: '🍌', name: '바나나', help: '뒤에 떨어뜨려요. 밟으면 빙글' },
  shield: { icon: '🛡️', name: '방패', help: '8초 동안 공격 한 번을 막아요' },
  alarm: { icon: '⏰', name: '유도 알람', help: '바로 앞 카트를 쫓아가 빙글 돌려요' },
  ghost: { icon: '👻', name: '유령', help: '5초 동안 장애물과 공격을 모두 통과해요' },
  giant: { icon: '🍄', name: '거인 버섯', help: '5초 동안 커지고 빨라져요. 부딪힌 카트는 빙글' },
  snail: { icon: '🐌', name: '달팽이 저주', help: '나보다 앞선 카트 모두 3초 동안 느려져요' },
  zap: { icon: '⚡', name: '번개', help: '다른 카트 모두 빙글 돌아요' },
}
export const KART_SHIELD_SECONDS = 8
/** 다른 화면에 보이는 유령, 거인 시간(connection의 GHOST_SECONDS, GIANT_SECONDS)과 같다. */
export const KART_GHOST_SECONDS = 5
export const KART_GIANT_SECONDS = 5
export const KART_GIANT_SCALE = 1.8
/** 거인과 부딪히는 거리 */
export const KART_GIANT_BUMP = 2.6
export const KART_SNAIL_SECONDS = 3
export const KART_SNAIL_FACTOR = 0.6
export const ALARM_SPIN_SECONDS = 1.3
export const KART_BOOSTER_SECONDS = 1.5

/** 순위에 따라 나오는 아이템. 앞설수록 바나나와 방패가, 뒤처질수록 부스터, 유도 알람, 거인, 달팽이, 번개가 잘 나온다. rank는 0이 1등이다. */
export function rollKartItem(rank: number, total: number, random = Math.random()): KartItem {
  const behind = total <= 1 ? 0.5 : rank / (total - 1)
  const versus = total > 1 ? 1 : 0
  const weights: Record<KartItem, number> = {
    booster: 3 + behind * 1.5,
    banana: 2.8 - behind * 2,
    shield: 2 - behind * 1.5,
    alarm: versus * (0.4 + behind * 2),
    ghost: 1,
    giant: 0.6 + behind * 1.4,
    snail: versus * behind * 1.5,
    zap: versus * behind * behind * 1.6,
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
 * 맵마다 서킷 모양(조종점), 테마, 기믹이 다르다. 모두 숫자로만 정의하고 화면은 코드로 그리므로 맵을 늘려도 용량이 거의 늘지 않는다.
 * at은 한 바퀴 중 위치(0~1), lateral은 가운데 선에서 오른쪽으로 떨어진 거리다.
 */
export type KartTheme = {
  sky: string
  ground: string
  road: string
  curb: [string, string]
  wall: [string, string]
  /** 트랙 밖 장식 */
  scenery: 'pine' | 'snow' | 'cactus' | 'city' | 'space'
}

/** 트랙 위에 서 있는 장애물. 부딪히면 튕겨 나며 느려진다. */
export type KartObstacleKind = 'cone' | 'snowman' | 'rock' | 'hydrant'
/** 트랙을 가로질러 오가는 것. 부딪히면 빙글 돈다. */
export type KartCrosserKind = 'bus' | 'tumbleweed' | 'penguin' | 'meteor'

type TrackDef = {
  id: string
  name: string
  emoji: string
  intro: string
  laps: number
  control: [number, number][]
  scale: number
  theme: KartTheme
  /** 얼음처럼 미끄러운 정도. 1이 보통, 낮을수록 옆으로 미끄러진다. */
  grip?: number
  pads: { at: number; lateral: number }[]
  boxes: number[]
  obstacles?: { at: number; lateral: number; kind: KartObstacleKind }[]
  crossers?: { at: number; kind: KartCrosserKind; speed: number; offset: number }[]
  /** 점프대: 빠르게 밟으면 날아올라 바로 뒤 구덩이를 넘는다. 느리면 구덩이에 빠져 엉금엉금 */
  ramps?: { at: number; gap: number }[]
  /** 벽이 없어 길 밖으로 나가면 떨어진다(우주). */
  open?: boolean
}

const TRACK_DEFS: TrackDef[] = [
  {
    id: 'circuit',
    name: '링아웃 서킷',
    emoji: '🏁',
    intro: '헤어핀과 S자, 긴 직선. 드리프트 터보를 모아 보세요',
    laps: 3,
    scale: 0.85,
    control: [
      [0, -40], [0, 40], [6, 90], [30, 120], [66, 120], [86, 96], [82, 64], [96, 36], [130, 30], [160, 46], [176, 82], [204, 104],
      [240, 100], [262, 70], [266, 20], [262, -40], [244, -88], [204, -112], [156, -110], [128, -94], [100, -96], [70, -120], [34, -116], [8, -88],
    ],
    theme: { sky: '#EAF4FB', ground: '#E6F2D6', road: '#D9D6CE', curb: ['#F0473C', '#FFFFFF'], wall: ['#2F7DF6', '#FFFFFF'], scenery: 'pine' },
    pads: [
      { at: 0.08, lateral: -3 },
      { at: 0.33, lateral: 3 },
      { at: 0.58, lateral: 0 },
      { at: 0.63, lateral: -4 },
      { at: 0.88, lateral: 4 },
    ],
    boxes: [0.2, 0.47, 0.74],
  },
  {
    id: 'ice',
    name: '꽁꽁 호수 링크',
    emoji: '❄️',
    intro: '🧊 얼음이라 쭉쭉 미끄러져요. ⛄ 눈사람과 🐧 펭귄 조심!',
    laps: 3,
    scale: 1.15,
    grip: 0.35,
    control: [
      [0, -40], [0, 40], [16, 84], [56, 104], [100, 96], [124, 64], [118, 26], [92, 6], [96, -22], [128, -40], [142, -80], [120, -116], [76, -126], [36, -108],
    ],
    theme: { sky: '#E3EEF7', ground: '#F4F8FC', road: '#CFE6F5', curb: ['#3FA9FF', '#FFFFFF'], wall: ['#8FD3FF', '#FFFFFF'], scenery: 'snow' },
    pads: [
      { at: 0.1, lateral: 0 },
      { at: 0.55, lateral: 3 },
      { at: 0.85, lateral: -3 },
    ],
    boxes: [0.25, 0.5, 0.78],
    obstacles: [
      { at: 0.17, lateral: -3.5, kind: 'snowman' },
      { at: 0.19, lateral: 3, kind: 'snowman' },
      { at: 0.41, lateral: 0, kind: 'snowman' },
      { at: 0.64, lateral: -4, kind: 'snowman' },
      { at: 0.66, lateral: 2.5, kind: 'snowman' },
      { at: 0.93, lateral: 0, kind: 'snowman' },
    ],
    crossers: [
      { at: 0.33, kind: 'penguin', speed: 5, offset: 0 },
      { at: 0.35, kind: 'penguin', speed: -4, offset: 9 },
      { at: 0.72, kind: 'penguin', speed: 4.5, offset: 4 },
    ],
  },
  {
    id: 'canyon',
    name: '점프 협곡',
    emoji: '🏜️',
    intro: '🛹 점프대를 빠르게 밟아야 구덩이를 넘어요. 🌵 굴러오는 덤불 조심',
    laps: 3,
    scale: 1,
    control: [
      [0, -40], [0, 60], [24, 96], [72, 104], [100, 72], [104, 20], [128, -16], [176, -14], [200, 22], [236, 30], [256, -6], [246, -64], [204, -100], [140, -110], [70, -104], [24, -82],
    ],
    theme: { sky: '#FCEFD9', ground: '#F3DDB3', road: '#D8C3A0', curb: ['#E07A3F', '#FFF4E0'], wall: ['#B5653A', '#F3DDB3'], scenery: 'cactus' },
    pads: [
      { at: 0.03, lateral: 0 },
      { at: 0.44, lateral: 0 },
      { at: 0.8, lateral: 3 },
    ],
    boxes: [0.15, 0.52, 0.72],
    ramps: [
      { at: 0.07, gap: 9 },
      { at: 0.47, gap: 10 },
      { at: 0.88, gap: 9 },
    ],
    obstacles: [
      { at: 0.26, lateral: -2, kind: 'rock' },
      { at: 0.3, lateral: 3.5, kind: 'rock' },
      { at: 0.62, lateral: 0, kind: 'rock' },
    ],
    crossers: [
      { at: 0.22, kind: 'tumbleweed', speed: 7, offset: 0 },
      { at: 0.58, kind: 'tumbleweed', speed: -6, offset: 7 },
      { at: 0.67, kind: 'tumbleweed', speed: 6.5, offset: 14 },
    ],
  },
  {
    id: 'city',
    name: '출근길 도심',
    emoji: '🏙️',
    intro: '🚌 교차로를 지나는 버스와 🧯 소화전을 피해 직각 코너를 돌아요',
    laps: 3,
    scale: 1.05,
    control: [
      [0, -36], [0, 44], [16, 70], [60, 76], [76, 92], [80, 140], [96, 156], [142, 156], [166, 132], [166, 62], [150, 46], [124, 40], [112, 20], [116, -40], [100, -62], [40, -70], [10, -60],
    ],
    theme: { sky: '#E8EBF2', ground: '#E4E4E0', road: '#C9C9C6', curb: ['#FFD84D', '#3A3A3A'], wall: ['#FF9A2E', '#FFFFFF'], scenery: 'city' },
    pads: [
      { at: 0.05, lateral: 3 },
      { at: 0.4, lateral: -3 },
      { at: 0.62, lateral: 0 },
    ],
    boxes: [0.18, 0.5, 0.82],
    obstacles: [
      { at: 0.12, lateral: 5, kind: 'hydrant' },
      { at: 0.31, lateral: -5, kind: 'hydrant' },
      { at: 0.55, lateral: 4.5, kind: 'cone' },
      { at: 0.56, lateral: -4.5, kind: 'cone' },
      { at: 0.75, lateral: 0, kind: 'cone' },
    ],
    crossers: [
      { at: 0.24, kind: 'bus', speed: 9, offset: 0 },
      { at: 0.46, kind: 'bus', speed: -8, offset: 12 },
      { at: 0.7, kind: 'bus', speed: 8.5, offset: 6 },
      { at: 0.92, kind: 'bus', speed: -9, offset: 18 },
    ],
  },
  {
    id: 'galaxy',
    name: '링아웃 은하 고속도로',
    emoji: '🌌',
    intro: '🌠 벽이 없어요! 길 밖으로 나가면 우주로 떨어져요. 행성 사이를 날아 넘어요',
    laps: 3,
    scale: 1.2,
    control: [
      [0, -40], [0, 50], [-14, 92], [-52, 112], [-96, 104], [-118, 70], [-104, 34], [-70, 20], [-60, -14], [-82, -48], [-80, -92], [-48, -124], [-6, -118], [12, -84],
    ],
    theme: { sky: '#120E2A', ground: '#120E2A', road: '#3A2F6B', curb: ['#FF6FB5', '#3FE0FF'], wall: ['#FFD84D', '#A259FF'], scenery: 'space' },
    open: true,
    pads: [
      { at: 0.06, lateral: 0 },
      { at: 0.3, lateral: -3 },
      { at: 0.5, lateral: 3 },
      { at: 0.72, lateral: 0 },
      { at: 0.9, lateral: -3 },
    ],
    boxes: [0.18, 0.42, 0.62, 0.84],
    ramps: [{ at: 0.56, gap: 10 }],
    crossers: [
      { at: 0.24, kind: 'meteor', speed: 8, offset: 0 },
      { at: 0.78, kind: 'meteor', speed: -7, offset: 11 },
    ],
  },
]

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t
  const t3 = t2 * t
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
}

export type TrackPoint = { x: number; z: number; h: number }

/** 조종점을 부드럽게 이은 고리를 1칸 간격으로 다시 고른다. 0번이 출발 직선(원점 근처)에 온다. */
function buildPoints(def: TrackDef): TrackPoint[] {
  const dense: [number, number][] = []
  const control = def.control.map(([x, z]) => [x * def.scale, z * def.scale] as const)
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

export type KartTrack = {
  id: string
  name: string
  emoji: string
  intro: string
  laps: number
  theme: KartTheme
  grip: number
  /** 가운데 선. x, z와 그 자리에서 앞을 보는 방향 h */
  points: TrackPoint[]
  length: number
  pads: { index: number; x: number; z: number; h: number }[]
  /** 아이템 상자 줄(샘플 번호) */
  boxRows: number[]
  obstacles: { x: number; z: number; r: number; kind: KartObstacleKind }[]
  crossers: { index: number; kind: KartCrosserKind; speed: number; offset: number }[]
  /** 점프대 샘플 번호와 바로 뒤 구덩이 끝 샘플 번호 */
  ramps: { index: number; gapTo: number }[]
  /** 아무리 빨라도 이보다 빨리 들어올 수는 없다. 서버가 도착 신고를 거를 때 쓴다. */
  minFinishSeconds: number
  /** 벽이 없어 길 밖으로 나가면 떨어진다. */
  open: boolean
}

const OBSTACLE_RADIUS: Record<KartObstacleKind, number> = { cone: 0.6, snowman: 1.1, rock: 1.4, hydrant: 0.6 }

function buildTrack(def: TrackDef): KartTrack {
  const points = buildPoints(def)
  const length = points.length
  const track: KartTrack = {
    id: def.id,
    name: def.name,
    emoji: def.emoji,
    intro: def.intro,
    laps: def.laps,
    theme: def.theme,
    grip: def.grip ?? 1,
    open: def.open ?? false,
    points,
    length,
    pads: [],
    boxRows: def.boxes.map((at) => Math.round(length * at)),
    obstacles: [],
    crossers: (def.crossers ?? []).map(({ at, ...rest }) => ({ index: Math.round(length * at), ...rest })),
    ramps: (def.ramps ?? []).map(({ at, gap }) => ({ index: Math.round(length * at), gapTo: Math.round(length * at) + 2 + gap })),
    minFinishSeconds: (def.laps * length) / KART_TOP_SPEED - 3,
  }
  track.pads = def.pads.map(({ at, lateral }) => ({ index: Math.round(length * at), ...trackSpot(track, Math.round(length * at), lateral) }))
  track.obstacles = (def.obstacles ?? []).map(({ at, lateral, kind }) => ({ ...trackSpot(track, Math.round(length * at), lateral), r: OBSTACLE_RADIUS[kind], kind }))
  return track
}

export const KART_TRACKS: KartTrack[] = TRACK_DEFS.map(buildTrack)
export const DEFAULT_KART_TRACK = KART_TRACKS[0]

export function kartTrackById(id: string | undefined) {
  return KART_TRACKS.find((track) => track.id === id) ?? DEFAULT_KART_TRACK
}

/** 지난번과 다른 트랙을 고른다. */
export function randomKartTrackId(previous?: string, random = Math.random) {
  const choices = KART_TRACKS.filter((track) => track.id !== previous)
  return choices[Math.floor(random() * choices.length)].id
}

function wrapIndex(track: KartTrack, index: number) {
  return ((Math.round(index) % track.length) + track.length) % track.length
}

export function trackPoint(track: KartTrack, index: number) {
  return track.points[wrapIndex(track, index)]
}

/** 가운데 선에서 오른쪽으로 lateral만큼 떨어진 자리. 오른쪽은 앞을 볼 때 오른손 쪽이다. */
export function trackSpot(track: KartTrack, index: number, lateral: number) {
  const point = trackPoint(track, index)
  return { x: point.x - Math.cos(point.h) * lateral, z: point.z + Math.sin(point.h) * lateral, h: point.h }
}

/** 이 자리에서 가장 가까운 가운데 선 샘플과 거리. hint를 주면 그 근처부터 찾는다. */
export function nearestTrack(track: KartTrack, x: number, z: number, hint?: number) {
  let best = 0
  let bestDistance = Infinity
  const scan = (from: number, to: number) => {
    for (let i = from; i <= to; i++) {
      const index = ((i % track.length) + track.length) % track.length
      const point = track.points[index]
      const d = (point.x - x) ** 2 + (point.z - z) ** 2
      if (d < bestDistance) {
        bestDistance = d
        best = index
      }
    }
  }
  if (hint !== undefined) scan(hint - 40, hint + 40)
  // 근처에서 못 찾았으면(순간이동 등) 전부 훑는다.
  if (hint === undefined || bestDistance > KART_WALL * KART_WALL * 2) scan(0, track.length - 1)
  return { index: best, distance: Math.sqrt(bestDistance) }
}

/** 가운데 선에서 오른쪽(+)/왼쪽(-)으로 얼마나 떨어졌는지 */
export function lateralOf(track: KartTrack, index: number, x: number, z: number) {
  const point = trackPoint(track, index)
  return -(x - point.x) * Math.cos(point.h) + (z - point.z) * Math.sin(point.h)
}

/** 지나온 바퀴 수와 지금 샘플. 출발선을 앞으로 넘으면 바퀴가 늘고, 거꾸로 넘으면 준다. */
export type LapTracker = { index: number; laps: number }

export function newTracker(index: number): LapTracker {
  return { index, laps: 0 }
}

/** 새 자리로 바퀴 기록을 옮긴다. 바퀴가 바뀌었으면 true */
export function advanceTracker(track: KartTrack, tracker: LapTracker, x: number, z: number) {
  const { index } = nearestTrack(track, x, z, tracker.index)
  const step = index - tracker.index
  const before = tracker.laps
  if (step < -track.length / 2) tracker.laps += 1
  else if (step > track.length / 2) tracker.laps -= 1
  tracker.index = index
  return tracker.laps !== before
}

/** 앞으로 간 거리 전체. 순위를 매길 때 쓴다. */
export function trackerProgress(track: KartTrack, tracker: LapTracker) {
  return tracker.laps * track.length + tracker.index
}

/** 출발 자리. 출발선 바로 앞에 두 줄로 엇갈려 선다. */
export function gridSpot(track: KartTrack, lane: number) {
  const lateral = (lane - 2) * 2.8
  const index = 12 - (lane % 2) * 5
  return trackSpot(track, index, lateral)
}

export const KART_BOX_LATERALS = [-5, -2.5, 0, 2.5, 5]

// ---- 기믹 ----
/** 가로지르는 것이 오가는 폭. 벽 밖에서 나와 반대편 벽 밖으로 사라진다. */
const CROSS_SPAN = KART_WALL * 2 + 8
export const CROSSER_SIZE: Record<KartCrosserKind, { hx: number; hz: number }> = {
  bus: { hx: 3.6, hz: 1.4 },
  tumbleweed: { hx: 0.9, hz: 0.9 },
  penguin: { hx: 0.6, hz: 0.6 },
  meteor: { hx: 1.3, hz: 1.3 },
}

/** 지금 이 순간 가로지르는 것의 옆 위치(lateral). 시간만으로 정해져서 모든 화면에서 같다. */
export function crosserLateral(crosser: KartTrack['crossers'][number], seconds: number) {
  const value = crosser.offset + crosser.speed * Math.max(0, seconds)
  return ((((value + CROSS_SPAN / 2) % CROSS_SPAN) + CROSS_SPAN) % CROSS_SPAN) - CROSS_SPAN / 2
}

/** 점프대를 밟을 때 이보다 빨라야 구덩이를 넘을 만큼 뜬다. */
export const RAMP_MIN_SPEED = 18
export const KART_GRAVITY = 26
/** 구덩이에 빠지면 이 빠르기로 기어 나온다. */
export const DITCH_SPEED = 6
/** 벽 없는 트랙에서 길 밖으로 이만큼 나가면 떨어진다. 떨어지면 잠시 뒤 길 위로 돌아온다. */
export const FALL_EDGE = KART_HALF_WIDTH + 1.6
export const FALL_SECONDS = 1.4
