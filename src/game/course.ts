/**
 * 출근길 코스. 장애물 위치는 출발 뒤 지난 시간(초)만으로 정해지므로 모든 화면에서 같은 차, 같은 비둘기가 보인다.
 * 서버도 이 파일을 읽어 도착 판정에 쓰므로 three나 브라우저 API를 쓰지 않는다.
 *
 * 좌표는 "코스 좌표"다. z는 도로를 따라간 거리(앞으로 갈수록 작아짐, s = -z), x는 도로 가운데에서 오른쪽으로 떨어진 거리다.
 * 판정과 통신은 모두 이 좌표로 하고, 화면에 그릴 때만 courseFrame()으로 구불구불한 실제 위치로 옮긴다.
 */

export const MAX_ROOM_PLAYERS = 5

// ---- 집 ----
export const LANE_SPACING = 12
export const HOUSE_HALF_W = 5
export const HOUSE_BACK_Z = 3
export const HOUSE_FRONT_Z = -14
export const DOOR_HALF = 1.6

export function laneX(lane: number) {
  return (lane - (MAX_ROOM_PLAYERS - 1) / 2) * LANE_SPACING
}

/** 침대에 누운 자리. 일어나면 침대 옆에 선다. */
export function bedSpot(lane: number) {
  return { x: laneX(lane) - 2.6, z: -0.4 }
}

export function wakeSpot(lane: number) {
  return { x: laneX(lane) - 0.6, z: -1.2 }
}

/** 링아웃이 울리는 휴대폰이 놓인 책상 */
export function deskSpot(lane: number) {
  return { x: laneX(lane) + 3.4, z: -2.5 }
}
export const DESK_REACH = 2.4

// ---- 길 ----
/** 집 앞마당 폭. 다섯 집이 나란히 있다. */
export const YARD_HALF_W = 30
/** 마을을 벗어난 뒤의 도로 폭(반) */
export const STREET_HALF_W = 14
const NARROW_FROM = 22
const NARROW_TO = 38
export const FINISH_Z = -358
export const GATE_Z = -352
export const WORLD_MIN_Z = -366

/** 이 거리(z)에서 도로 가운데부터 가장자리까지 */
export function halfWidthAt(z: number) {
  const s = -z
  if (s <= NARROW_FROM) return YARD_HALF_W
  if (s >= NARROW_TO) return STREET_HALF_W
  const t = (s - NARROW_FROM) / (NARROW_TO - NARROW_FROM)
  return YARD_HALF_W + (STREET_HALF_W - YARD_HALF_W) * (t * t * (3 - 2 * t))
}

// ---- 맵 ----
/**
 * 골목(출발)과 캠퍼스(도착) 사이는 장애물 구간 여섯 개로 이루어진다. 맵마다 구간 순서, 길이 휘는 모양, 날씨가 다르다.
 * 서버가 게임을 시작할 때 맵을 하나 골라 모두에게 알려 주고, 화면은 applyMap()으로 그 맵을 깐다.
 */
export type SectionKind = 'road' | 'pigeons' | 'hurdles' | 'subway' | 'light' | 'scooter' | 'quiz' | 'slide' | SpecialKind
/** 맵마다 하나씩 있는 그 맵만의 구간. 판교는 비둘기 광장이 그 자리다. */
export type SpecialKind = 'storm' | 'acorns' | 'ice'

const SECTION_LENGTH: Record<SectionKind, number> = { road: 30, pigeons: 40, hurdles: 34, subway: 26, light: 36, scooter: 36, quiz: 20, slide: 40, storm: 40, acorns: 40, ice: 40 }
const SECTION_NAME: Record<SectionKind, string> = {
  road: '아침 찻길',
  pigeons: '비둘기 광장',
  hurdles: '공사장 허들',
  subway: '지하철 스크린도어',
  light: '무궁화 신호등',
  scooter: '킥보드 언덕',
  quiz: '링아웃 스핑크스',
  slide: '대왕 미끄럼틀',
  storm: '천둥 번개 사거리',
  acorns: '데굴데굴 도토리 언덕',
  ice: '꽁꽁 언 호수공원',
}
/** 골목이 끝나고 장애물 구간이 시작되는 거리 */
const SECTIONS_FROM = 74

type Bend = { from: number; to: number; curvature: number }

export type Weather = 'none' | 'rain' | 'leaves' | 'snow'

export type MapTheme = {
  /** 하늘과 길 밖 종이 바닥 */
  paper: string
  street: string
  road: string
  leaf: string
  water: string
  weather: Weather
  /** 웅덩이가 얼어 있다. 느려지는 대신 미끄러진다. */
  icy?: boolean
  /** 허들 모양: 공사장 펜스, 쓰러진 통나무, 눈더미 */
  hurdle?: 'fence' | 'log' | 'snow'
}

export type CourseMap = {
  id: string
  name: string
  emoji: string
  /** 출발 전에 보여 주는 한 줄 소개 */
  intro: string
  alley: string
  sections: SectionKind[]
  /** 이 맵에서만 다르게 부르는 구간 이름 */
  names?: Partial<Record<SectionKind, string>>
  /** 구간마다 휘는 정도(1/반지름). 양수면 오른쪽으로 꺾인다. 캠퍼스 앞(334~)은 곧게 둔다. */
  bends: Bend[]
  theme: MapTheme
}

const BASE_THEME: MapTheme = { paper: '#FBFAF6', street: '#EFEDE6', road: '#D9D6CE', leaf: '#CFE8B9', water: '#BFE3F5', weather: 'none' }

export const MAPS: CourseMap[] = [
  {
    id: 'pangyo',
    name: '판교 출근길',
    emoji: '☀️',
    intro: '맑은 아침, 늘 다니던 그 길',
    alley: '우리 동네 골목',
    sections: ['road', 'pigeons', 'hurdles', 'slide', 'subway', 'light', 'scooter', 'quiz'],
    bends: [
      { from: 40, to: 74, curvature: 1 / 52 },
      { from: 110, to: 150, curvature: -1 / 48 },
      { from: 150, to: 194, curvature: 1 / 64 },
      { from: 224, to: 262, curvature: -1 / 56 },
      { from: 264, to: 300, curvature: 1 / 44 },
      { from: 300, to: 332, curvature: -1 / 40 },
    ],
    theme: BASE_THEME,
  },
  {
    id: 'rainy',
    name: '비 오는 월요일',
    emoji: '☔',
    intro: '⚡ 번개 그림자를 피하고, 💨 돌풍에 밀리지 마세요',
    alley: '빗물 고인 골목',
    sections: ['subway', 'road', 'scooter', 'slide', 'storm', 'light', 'hurdles', 'quiz'],
    names: { road: '물 튀기는 찻길' },
    bends: [
      { from: 50, to: 110, curvature: 1 / 70 },
      { from: 130, to: 200, curvature: -1 / 60 },
      { from: 215, to: 265, curvature: 1 / 55 },
      { from: 280, to: 330, curvature: -1 / 80 },
    ],
    theme: { paper: '#E8EDF2', street: '#DEE3E8', road: '#C5CBD2', leaf: '#B4D4AE', water: '#8FC1E6', weather: 'rain' },
  },
  {
    id: 'autumn',
    name: '단풍 공원길',
    emoji: '🍁',
    intro: '🌰 굴러오는 도토리는 2단 점프로, 🍂 낙엽 더미는 폴짝!',
    alley: '낙엽 쌓인 골목',
    sections: ['hurdles', 'acorns', 'light', 'slide', 'road', 'subway', 'scooter', 'quiz'],
    names: { hurdles: '쓰러진 통나무', scooter: '은행나무 킥보드길' },
    bends: [
      { from: 42, to: 70, curvature: 1 / 40 },
      { from: 76, to: 104, curvature: -1 / 40 },
      { from: 120, to: 150, curvature: -1 / 45 },
      { from: 156, to: 186, curvature: 1 / 45 },
      { from: 200, to: 236, curvature: 1 / 50 },
      { from: 244, to: 280, curvature: -1 / 50 },
      { from: 290, to: 320, curvature: 1 / 60 },
      { from: 320, to: 332, curvature: -1 / 30 },
    ],
    theme: { paper: '#FBF1E1', street: '#F3E6D1', road: '#DCC9AE', leaf: '#F4A261', water: '#BFE3F5', weather: 'leaves', hurdle: 'log' },
  },
  {
    id: 'snow',
    name: '첫눈 오는 날',
    emoji: '❄️',
    intro: '🧊 얼음 위는 쭈욱 미끄러지고, 🚜 제설차가 밀어내요',
    alley: '눈 쌓인 골목',
    sections: ['light', 'scooter', 'road', 'slide', 'hurdles', 'ice', 'subway', 'quiz'],
    names: { hurdles: '눈더미 허들', road: '제설 안 된 찻길' },
    bends: [
      { from: 45, to: 95, curvature: -1 / 60 },
      { from: 110, to: 170, curvature: 1 / 55 },
      { from: 185, to: 215, curvature: 1 / 70 },
      { from: 230, to: 290, curvature: -1 / 50 },
      { from: 300, to: 332, curvature: 1 / 64 },
    ],
    theme: { paper: '#F2F6FA', street: '#FFFFFF', road: '#D8E0E8', leaf: '#E4EEF6', water: '#CDEBFA', weather: 'snow', icy: true, hurdle: 'snow' },
  },
]

export const DEFAULT_MAP_ID = MAPS[0].id

export function mapById(id: string | undefined) {
  return MAPS.find((map) => map.id === id) ?? MAPS[0]
}

/** 지난번과 다른 맵을 고른다. */
export function randomMapId(previous?: string, random = Math.random) {
  const choices = MAPS.filter((map) => map.id !== previous)
  return choices[Math.floor(random() * choices.length)].id
}

const STEP = 0.5
const TABLE_FROM = -60
const TABLE_TO = 460

/** 도로 가운데 선을 미리 따라가 둔 표. [x, z, 방향] */
function buildCenterline(bends: Bend[]) {
  const curvatureAt = (s: number) => {
    for (const bend of bends) if (s >= bend.from && s < bend.to) return bend.curvature
    return 0
  }
  const count = Math.round((TABLE_TO - TABLE_FROM) / STEP) + 1
  const table = new Float64Array(count * 3)
  let x = 0
  let z = -TABLE_FROM
  let angle = 0
  // 출발 전 구간은 곧게 뻗어 있으므로 s=0에서 (0, 0)이 되게 시작점을 맞춘다.
  for (let i = 0; i < count; i++) {
    const s = TABLE_FROM + i * STEP
    table[i * 3] = x
    table[i * 3 + 1] = z
    table[i * 3 + 2] = angle
    const next = angle + curvatureAt(s) * STEP
    const mid = (angle + next) / 2
    x += Math.sin(mid) * STEP
    z -= Math.cos(mid) * STEP
    angle = next
  }
  return table
}

export type Frame = { x: number; z: number; angle: number }

/**
 * 코스 좌표 (x, z)를 실제 화면 위치로 옮긴다. angle은 그 자리에서 도로가 꺾인 정도이고,
 * 물체를 도로 방향에 맞추려면 rotation.y에 -angle을 더한다.
 */
export function courseFrame(x: number, z: number, out: Frame = { x: 0, z: 0, angle: 0 }): Frame {
  const s = -z
  const position = (Math.min(Math.max(s, TABLE_FROM), TABLE_TO) - TABLE_FROM) / STEP
  const index = Math.min(Math.floor(position), (centerline.length / 3) - 2)
  const t = position - index
  const cx = centerline[index * 3] + (centerline[index * 3 + 3] - centerline[index * 3]) * t
  const cz = centerline[index * 3 + 1] + (centerline[index * 3 + 4] - centerline[index * 3 + 1]) * t
  const angle = centerline[index * 3 + 2] + (centerline[index * 3 + 5] - centerline[index * 3 + 2]) * t
  // 표 밖은 마지막 방향으로 곧게 잇는다.
  const overflow = s > TABLE_TO ? s - TABLE_TO : s < TABLE_FROM ? s - TABLE_FROM : 0
  out.x = cx + Math.cos(angle) * x + Math.sin(angle) * overflow
  out.z = cz + Math.sin(angle) * x - Math.cos(angle) * overflow
  out.angle = angle
  return out
}

// ---- 규칙 ----
export const WALK_SPEED = 8
export const BOOST_FACTOR = 1.5
export const BOOST_SECONDS = 2
export const PUDDLE_FACTOR = 0.4
export const JUMP_SPEED = 7
export const GRAVITY = 20
export const BODY_RADIUS = 0.45

/** 링아웃은 도착할 때까지 이 주기로 다시 울린다. */
export const ALARM_PERIOD = 10
export const ALARM_RING_SECONDS = 2.5
export const WAKE_PRESSES = 15
export const WAKE_DECAY_PER_SECOND = 2

/** 출발 전 카운트다운 */
export const COUNTDOWN_MS = 4000
/** 이 시간이 지나면 도착하지 못한 사람은 결석 처리하고 끝낸다. */
export const GAME_LIMIT_SECONDS = 160
/** 1등이 도착하면 남은 사람은 이 시간 안에 들어와야 한다. 못 들어오면 게임이 끝난다. */
export const FINISH_GRACE_SECONDS = 10
/** 게임 1초가 시계로 20초. 08:25에 알람이 울리고 09:00(105초)가 넘으면 지각이다. */
export const CLOCK_START_MINUTES = 8 * 60 + 25
export const CLOCK_SCALE = 20
export const LATE_SECONDS = ((9 * 60 - CLOCK_START_MINUTES) * 60) / CLOCK_SCALE

// ---- 아이템과 기물 ----
/** 따릉이를 타면 이만큼 빨라진다. 알람 부스트와 겹치지 않고 더 빠른 쪽을 쓴다. */
/** 길가에 세워진 탈것. 탈것마다 빠르기, 탈 수 있는 시간, 들이받을 때의 위력이 다르다. */
export type RideKind = 'bike' | 'scooter' | 'car' | 'sports' | 'truck'
export const RIDES: Record<RideKind, { icon: string; name: string; factor: number; seconds: number; ram: { radius: number; stun: number } | null }> = {
  bike: { icon: '🚲', name: '따릉이', factor: 1.7, seconds: 7, ram: null },
  scooter: { icon: '🛵', name: '배달 스쿠터', factor: 1.85, seconds: 6, ram: { radius: 1.3, stun: 0.8 } },
  car: { icon: '🚗', name: '경차', factor: 1.6, seconds: 8, ram: { radius: 1.8, stun: 1.3 } },
  sports: { icon: '🏎️', name: '스포츠카', factor: 1.95, seconds: 5, ram: { radius: 1.7, stun: 1.1 } },
  truck: { icon: '🚚', name: '트럭', factor: 1.4, seconds: 9, ram: { radius: 2.4, stun: 1.7 } },
}
/** 가장 빠른 탈것. 서버가 너무 빠른 이동을 거를 때 쓴다. */
export const MAX_RIDE_FACTOR = Math.max(...Object.values(RIDES).map((ride) => ride.factor))
/** 들이받힌 사람이 날아가는 거리 */
export const RAM_PUSH = 5.5
export const BIKE_REACH = 2.5
export const COFFEE_SECONDS = 3
export const COFFEE_REACH = 1.2
/** 때리기: 닿는 거리, 다시 때릴 수 있을 때까지, 맞은 사람이 기절하는 시간, 기절이 풀린 뒤 봐주는 시간 */
export const PUNCH_RANGE = 1.9
export const PUNCH_COOLDOWN_MS = 600
export const PUNCH_STUN_SECONDS = 1.4
export const PUNCH_IMMUNE_MS = 3000
/** 발차기(G): 주먹보다 멀리 닿고, 맞은 사람을 뒤로 날려 보낸다. 기절은 짧다. */
export const KICK_RANGE = 2.6
export const KICK_COOLDOWN_MS = 1200
export const KICK_STUN_SECONDS = 0.9
/** 날아가는 거리와 시간. 서버의 속도 검사(MAX_SPEED)보다 느리게 둔다. */
export const KICK_PUSH = 4.5
export const KICK_PUSH_SECONDS = 0.35
/** 공중에서 한 번 더 뛸 수 있다. */
export const MAX_JUMPS = 2
export const DOUBLE_JUMP_SPEED = 6.5

/** 카트라이더처럼 길을 가로지르는 아이템 상자 줄은 맵마다 layout.itemRows에 있다. */
export const ITEM_BOX_XS = [-9, -4.5, 0, 4.5, 9]
export const ITEM_BOX_REACH = 1.2
export const ITEM_RESPAWN_MS = 4000
export const ITEM_COOLDOWN_MS = 1500

export const ITEM_KINDS = ['booster', 'shield', 'banana', 'balloon', 'ufo', 'warp', 'zap', 'bomb', 'tornado', 'giant', 'ghost', 'snail'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

export const ITEM_INFO: Record<ItemKind, { icon: string; name: string; help: string }> = {
  booster: { icon: '🚀', name: '부스터', help: '2.5초 동안 아주 빨라져요' },
  shield: { icon: '🛡️', name: '방패', help: '6초 동안 공격 한 번을 막아요' },
  banana: { icon: '🍌', name: '바나나', help: '뒤에 떨어뜨려요. 밟으면 미끄러져요' },
  balloon: { icon: '💧', name: '물풍선', help: '앞사람을 물방울에 가둬요. 없으면 앞으로 던져요' },
  ufo: { icon: '🛸', name: '우주선', help: '1등을 붙잡아 공중에 띄워요. 혼자면 앞길을 훑어요' },
  zap: { icon: '⚡', name: '번개', help: '다른 사람 모두에게 벼락을 내려 잠깐 기절시켜요' },
  bomb: { icon: '💣', name: '폭탄', help: '앞으로 던지면 터져서 근처 사람을 날려 버려요' },
  tornado: { icon: '🌪️', name: '회오리', help: '앞으로 회오리를 날려 닿는 사람을 휘감아요' },
  giant: { icon: '🍄', name: '거인 버섯', help: '5초 동안 거인이 되어 빨라지고, 부딪힌 사람을 튕겨내요' },
  ghost: { icon: '👻', name: '유령', help: '5초 동안 유령이 되어 장애물과 공격을 모두 통과해요' },
  snail: { icon: '🐌', name: '달팽이 저주', help: '나보다 앞선 사람 모두를 3초 동안 느리게 해요' },
  warp: { icon: '🌀', name: '귀가 포털', help: '바로 앞 사람을 집 앞으로 돌려보내요. 없으면 허공에 열려요' },
}

export const BOOSTER_FACTOR = 1.75
export const BOOSTER_SECONDS = 2.5
export const SHIELD_SECONDS = 6
export const BALLOON_RANGE = 18
export const BALLOON_SECONDS = 2.6
export const UFO_SECONDS = 2.2
export const BANANA_RADIUS = 0.75
export const BANANA_SLIP_SECONDS = 1.1
/** 귀가 포털에 맞으면 돌아가는 자리(집 현관 바로 앞) */
export const WARP_Z = HOUSE_FRONT_Z - 2
export const ZAP_STUN_SECONDS = 1
export const BOMB_FUSE_SECONDS = 0.7
export const BOMB_AHEAD = 9
export const BOMB_RADIUS = 4.5
export const BOMB_STUN_SECONDS = 1.3
export const TORNADO_SECONDS = 2.8
export const TORNADO_RADIUS = 2
export const TORNADO_STUN_SECONDS = 1.2
export const GIANT_SECONDS = 5
export const GIANT_FACTOR = 1.3
export const GIANT_SCALE = 2.2
/** 거인과 부딪히는 거리 */
export const GIANT_BUMP = 1.9
export const GHOST_SECONDS = 5
export const SNAIL_SECONDS = 3
export const SNAIL_FACTOR = 0.5

/** 회오리가 출발하고 elapsed초 뒤에 있는 자리(코스 좌표). 앞으로 구불구불 나아간다. */
export function tornadoAt(elapsed: number, origin: { x: number; z: number }) {
  return { x: origin.x + Math.sin(elapsed * 3.2) * 5, z: origin.z - 2 - elapsed * 15 }
}

/**
 * 순위에 따라 아이템이 나올 확률. 앞서갈수록 방어 아이템이, 뒤처질수록 공격 아이템이 잘 나온다.
 * rank는 0이 1등, total은 남은 사람 수다.
 */
export function rollItem(rank: number, total: number, random = Math.random()): ItemKind {
  const behind = total <= 1 ? 0.5 : rank / (total - 1)
  const weights: Record<ItemKind, number> = {
    booster: 3,
    shield: 2.5 - behind * 1.5,
    banana: 3 - behind * 1.5,
    balloon: 1.5 + behind * 2,
    ufo: behind * 2.5,
    warp: behind >= 0.99 && total > 1 ? 0.6 : 0,
    zap: behind * 1.2,
    bomb: 1.2 + behind,
    tornado: 1 + behind,
    giant: 1.4,
    ghost: 1.4 - behind * 0.6,
    snail: behind * 1.5,
  }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0)
  let pick = random * sum
  for (const kind of ITEM_KINDS) {
    pick -= weights[kind]
    if (pick <= 0) return kind
  }
  return 'booster'
}

/** 가장 빠르게 달려도 이보다 빨리 도착할 수는 없다. 서버가 도착 신고를 거를 때 쓴다. */
export const MIN_FINISH_SECONDS = Math.abs(FINISH_Z) / (WALK_SPEED * BOOSTER_FACTOR) - 2

export function clockText(seconds: number) {
  const total = CLOCK_START_MINUTES * 60 + Math.max(0, seconds) * CLOCK_SCALE
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isRinging(seconds: number) {
  return seconds >= 0 && seconds % ALARM_PERIOD < ALARM_RING_SECONDS
}

/** 지금 울리고 있는 알람이 몇 번째인지. 새로 울렸는지 알아낼 때 쓴다. */
export function ringIndex(seconds: number) {
  return seconds < 0 ? -1 : Math.floor(seconds / ALARM_PERIOD)
}

// ---- 구역 ----
export function zoneAt(z: number) {
  return ZONES.find((zone) => z <= zone.from && z >= zone.to) ?? null
}

// ---- 고정 장애물 ----
export type Circle = { x: number; z: number; r: number }
export type Box = { x: number; z: number; hx: number; hz: number }

export type Prop = Circle & { kind: 'bin' | 'pot' | 'bush' | 'cone' }

/** 뛰어넘어야 하는 공사장 허들. 길 전체를 가로지른다. */
export const HURDLE_HALF_DEPTH = 0.3
export const HURDLE_HEIGHT = 0.7

// ---- 움직이는 장애물 ----
const LOOP_HALF = 24

function wrap(value: number) {
  const span = LOOP_HALF * 2
  return ((((value + LOOP_HALF) % span) + span) % span) - LOOP_HALF
}

export type Vehicle = { kind: 'car' | 'bus' | 'scooter'; x: number; z: number; hx: number; hz: number; dir: 1 | -1; color: number }

type VehicleLane = { kind: Vehicle['kind']; z: number; speed: number; offsets: number[]; hx: number; hz: number }

export function vehiclesAt(seconds: number): Vehicle[] {
  const t = Math.max(0, seconds)
  const result: Vehicle[] = []
  VEHICLE_LANES.forEach((lane, laneIndex) => {
    lane.offsets.forEach((offset, index) => {
      result.push({
        kind: lane.kind,
        x: wrap(offset + lane.speed * t),
        z: lane.z,
        hx: lane.hx,
        hz: lane.hz,
        dir: lane.speed > 0 ? 1 : -1,
        color: laneIndex * 3 + index,
      })
    })
  })
  return result
}

export const PIGEON_COUNT = 18
export const PIGEON_RADIUS = 0.55

export function pigeonsAt(seconds: number) {
  if (!HAS_PIGEONS) return []
  const t = Math.max(0, seconds)
  return Array.from({ length: PIGEON_COUNT }, (_, i) => {
    const cx = -10 + ((i * 37) % 21)
    const cz = PIGEON_FROM - ((i * 13) % 34)
    const speed = 0.7 + (i % 4) * 0.3
    const phase = i * 1.7
    const x = cx + Math.sin(t * speed + phase) * 4
    const z = cz + Math.cos(t * speed * 0.8 + phase) * 3
    const heading = Math.atan2(Math.cos(t * speed + phase), -Math.sin(t * speed * 0.8 + phase) * 0.8)
    return { x, z, heading, hop: Math.abs(Math.sin(t * 9 + i)) }
  })
}

// 스크린도어. 문마다 열리는 때가 달라 언제나 어딘가는 열려 있다.
export const SUBWAY_HALF_DEPTH = 0.5
export const SUBWAY_DOOR_XS = [-9, 0, 9]
export const SUBWAY_DOOR_HALF = 2
const DOOR_CYCLE = 5
const DOOR_OPEN = 2.6

export function doorOpenAmount(index: number, seconds: number) {
  const local = (((seconds + index * 1.7) % DOOR_CYCLE) + DOOR_CYCLE) % DOOR_CYCLE
  const slide = 0.35
  if (local < slide) return local / slide
  if (local < DOOR_OPEN - slide) return 1
  if (local < DOOR_OPEN) return (DOOR_OPEN - local) / slide
  return 0
}

/** 스크린도어 벽에서 지금 막혀 있는 칸들 */
export function subwayWalls(seconds: number): Box[] {
  const walls: Box[] = []
  let left = -STREET_HALF_W - 2
  SUBWAY_DOOR_XS.forEach((doorX, index) => {
    const gapHalf = SUBWAY_DOOR_HALF * doorOpenAmount(index, seconds)
    const right = doorX - gapHalf
    walls.push({ x: (left + right) / 2, z: SUBWAY_Z, hx: (right - left) / 2, hz: SUBWAY_HALF_DEPTH })
    left = doorX + gapHalf
  })
  const end = STREET_HALF_W + 2
  walls.push({ x: (left + end) / 2, z: SUBWAY_Z, hx: (end - left) / 2, hz: SUBWAY_HALF_DEPTH })
  return walls.filter((wall) => wall.hx > 0.01)
}

// 무궁화 신호등. 빨간불에 움직이다 걸리면 구역 처음으로 돌아간다.
const LIGHT_CYCLE = 7
/** 빨간불이 켜진 뒤 멈출 여유 */
export const LIGHT_GRACE = 0.25

export type LightColor = 'green' | 'yellow' | 'red'

export function lightAt(seconds: number): LightColor {
  const local = ((seconds % LIGHT_CYCLE) + LIGHT_CYCLE) % LIGHT_CYCLE
  if (local < 3.8) return 'green'
  if (local < 4.8) return 'yellow'
  return 'red'
}

// ---- 판정 ----
export function circleHitsBox(x: number, z: number, r: number, box: Box) {
  const dx = Math.max(Math.abs(x - box.x) - box.hx, 0)
  const dz = Math.max(Math.abs(z - box.z) - box.hz, 0)
  return dx * dx + dz * dz < r * r
}

/** 상자 밖으로 가장 짧은 방향으로 밀어낸다. */
export function pushOutOfBox(position: { x: number; z: number }, box: Box, r = BODY_RADIUS) {
  if (!circleHitsBox(position.x, position.z, r, box)) return false
  const overlapX = box.hx + r - Math.abs(position.x - box.x)
  const overlapZ = box.hz + r - Math.abs(position.z - box.z)
  if (overlapX < overlapZ) position.x += Math.sign(position.x - box.x || 1) * overlapX
  else position.z += Math.sign(position.z - box.z || 1) * overlapZ
  return true
}

export function pushOutOfCircle(position: { x: number; z: number }, circle: Circle, r = BODY_RADIUS) {
  const dx = position.x - circle.x
  const dz = position.z - circle.z
  const distance = Math.hypot(dx, dz) || 0.0001
  const minimum = circle.r + r
  if (distance >= minimum) return false
  position.x = circle.x + (dx / distance) * minimum
  position.z = circle.z + (dz / distance) * minimum
  return true
}

/**
 * 집 안에서는 자기 집 벽 안에, 밖에서는 길 안에 둔다. 앞벽은 문으로만 지나가고,
 * doorLocked면 링아웃 목적지를 정하기 전이라 현관을 나갈 수 없다.
 */
export function confine(position: { x: number; z: number }, previous: { x: number; z: number }, doorLocked = false) {
  const insideHouse = position.z > HOUSE_FRONT_Z
  const wasInside = previous.z > HOUSE_FRONT_Z
  if (insideHouse !== wasInside) {
    const lane = Math.round(previous.x / LANE_SPACING + (MAX_ROOM_PLAYERS - 1) / 2)
    const doorX = laneX(Math.min(Math.max(lane, 0), MAX_ROOM_PLAYERS - 1))
    if (doorLocked || Math.abs(position.x - doorX) > DOOR_HALF - BODY_RADIUS) position.z = wasInside ? HOUSE_FRONT_Z + 0.01 : HOUSE_FRONT_Z - 0.01
  }
  if (position.z > HOUSE_FRONT_Z) {
    const lane = Math.min(Math.max(Math.round(position.x / LANE_SPACING + (MAX_ROOM_PLAYERS - 1) / 2), 0), MAX_ROOM_PLAYERS - 1)
    const center = laneX(lane)
    const limit = HOUSE_HALF_W - BODY_RADIUS
    position.x = Math.min(Math.max(position.x, center - limit), center + limit)
    position.z = Math.min(position.z, HOUSE_BACK_Z - BODY_RADIUS)
  } else {
    const half = halfWidthAt(position.z) - BODY_RADIUS
    position.x = Math.min(Math.max(position.x, -half), half)
    position.z = Math.max(position.z, WORLD_MIN_Z)
  }
}

// ---- 맵 배치 ----
export type Zone = { name: string; from: number; to: number }

/** 한 맵의 장애물 배치. 모두 코스 좌표다. */
export type CourseLayout = {
  zones: Zone[]
  puddles: Circle[]
  props: Prop[]
  hurdleZs: number[]
  vehicleLanes: VehicleLane[]
  /** 비둘기 떼가 시작하는 z */
  pigeonFrom: number
  subwayZ: number
  lightZone: { from: number; to: number }
  bikes: { id: number; x: number; z: number; kind: RideKind }[]
  coffees: { id: number; x: number; z: number }[]
  itemRows: number[]
  /** 이 맵만의 구간. 판교는 없다(비둘기 광장이 그 자리). */
  special: { kind: SpecialKind; from: number; to: number } | null
  hasPigeons: boolean
  /** 밟으면 높이 튀어 오르는 낙엽 더미 */
  leafPiles: Circle[]
  /** 링아웃 스핑크스: 퀴즈를 맞힌 통로로만 지나갈 수 있는 벽 */
  quiz: { from: number; wallZ: number; to: number } | null
  /** 대왕 미끄럼틀: from에서 계단을 올라 top부터 to까지 미끄러져 내려간다. */
  slide: { from: number; top: number; to: number; end: number } | null
  /** 지름길 골목: 길가 문으로 들어가면 건물 뒤 골목을 지나 앞쪽 문으로 나온다. */
  shortcuts: Shortcut[]
  /** 바닥 발판: dash는 밟으면 쌩 빨라지고, jump는 높이 튀어 앞으로 날아간다. */
  pads: Pad[]
}

export type Pad = { x: number; z: number; kind: 'dash' | 'jump' }
/** 발판 반지름 */
export const PAD_RADIUS = 1.5
/** 대시 발판: 이만큼 빨라진다. 서버의 속도 검사보다 느리다. */
export const DASH_FACTOR = 1.9
export const DASH_SECONDS = 1.3
/** 점프 발판: 위로 이만큼, 앞으로 이만큼 날아간다. */
export const PAD_JUMP_SPEED = 12
export const PAD_JUMP_FORWARD = 13
/** 발판을 둘 구간. 벽이 있는 지하철, 미끄럼틀, 스핑크스 구간에는 두지 않는다. */
const PAD_SECTIONS: SectionKind[] = ['road', 'pigeons', 'hurdles', 'light', 'scooter', 'storm', 'acorns', 'ice']
const PAD_XS = [-7, 0, 7]

/** 꼴찌가 1등보다 이만큼 넘게 뒤처지면 따라잡기 부스트를 받는다. */
export const CATCHUP_GAP = 30
export const CATCHUP_FACTOR = 1.2

/** 지름길 골목. from 문으로 들어가 to 문으로 나온다. side는 길의 왼쪽(-1)/오른쪽(1) */
export type Shortcut = { id: number; side: 1 | -1; from: number; to: number; name: string }
/** 이 구간들만 지름길로 건너뛸 수 있다. 미끄럼틀과 스핑크스는 꼭 지나야 한다. */
const SHORTCUT_SECTIONS: SectionKind[] = ['hurdles', 'light', 'subway', 'pigeons', 'storm', 'acorns', 'ice']
const SHORTCUT_NAMES = ['🐈 고양이 골목', '🍜 분식집 뒷골목', '🧱 담벼락 틈새']
/** 한 맵에 지름길 골목 수 */
const SHORTCUTS_PER_MAP = 2
/** 문 앞 이만큼 안에 들어가면 골목으로 들어간다. */
export const SHORTCUT_REACH = 1.7
/** 골목을 지나는 데 걸리는 시간 */
export const SHORTCUT_TRAVEL_MS = 1200
/** 문은 SHORTCUT_CYCLE초마다 SHORTCUT_OPEN초 동안 열린다. 지름길마다 여는 때가 다르다. */
export const SHORTCUT_CYCLE = 12
export const SHORTCUT_OPEN = 5

/** 지름길 문이 서 있는 x */
export function shortcutDoorX(shortcut: Shortcut) {
  return shortcut.side * (STREET_HALF_W - 0.6)
}

/** 이 게임 시각에 문이 열려 있는지, 그리고 다음에 바뀌기까지 남은 초 */
export function shortcutState(shortcut: Shortcut, seconds: number) {
  const local = (((seconds + shortcut.id * 5) % SHORTCUT_CYCLE) + SHORTCUT_CYCLE) % SHORTCUT_CYCLE
  const open = local < SHORTCUT_OPEN
  return { open, left: open ? SHORTCUT_OPEN - local : SHORTCUT_CYCLE - local }
}

/** 출발 골목. 모든 맵에 같다. */
const ALLEY = {
  puddles: [
    { x: -18, z: -26, r: 3 },
    { x: 4, z: -30, r: 3.2 },
    { x: 20, z: -34, r: 2.8 },
    { x: -6, z: -44, r: 3 },
    { x: 8, z: -52, r: 2.6 },
    { x: -9, z: -62, r: 2.8 },
    { x: 6, z: -68, r: 2.4 },
  ],
  props: [
    { x: -12, z: -24, r: 0.8, kind: 'bin' },
    { x: 14, z: -27, r: 0.8, kind: 'pot' },
    { x: -2, z: -36, r: 0.8, kind: 'bin' },
    { x: 11, z: -42, r: 0.9, kind: 'pot' },
    { x: -11, z: -52, r: 0.9, kind: 'pot' },
    { x: 2, z: -60, r: 0.8, kind: 'bin' },
  ] as Prop[],
  bikes: [
    { x: -10, z: -20, kind: 'bike' },
    { x: 9, z: -21, kind: 'car' },
    { x: 22, z: -19, kind: 'scooter' },
    { x: -22, z: -21, kind: 'sports' },
  ] as { x: number; z: number; kind: RideKind }[],
  coffees: [
    { x: -9, z: -46 },
    { x: 10, z: -64 },
  ],
  itemRows: [-56],
}

type Spot = { x: number; d: number }

/** 구간 안 배치. d는 구간 시작부터 앞으로 간 거리다. */
const SECTION_CONTENT: Record<
  SectionKind,
  {
    puddles?: (Spot & { r: number })[]
    props?: (Spot & { r: number; kind: Prop['kind'] })[]
    hurdles?: number[]
    lanes?: (Omit<VehicleLane, 'z'> & { d: number })[]
    bikes?: (Spot & { kind: RideKind })[]
    coffees?: Spot[]
    itemRows?: number[]
    leafPiles?: (Spot & { r: number })[]
  }
> = {
  road: {
    lanes: [
      { kind: 'car', d: 6, speed: 12, offsets: [0, 24], hx: 2.3, hz: 1.1 },
      { kind: 'bus', d: 15, speed: -10, offsets: [6, 30], hx: 3.6, hz: 1.4 },
      { kind: 'car', d: 24, speed: 15, offsets: [12, 36], hx: 2.3, hz: 1.1 },
    ],
  },
  pigeons: {
    puddles: [{ x: 0, d: 18, r: 2.4 }],
    bikes: [
      { x: -8, d: 4, kind: 'bike' },
      { x: 8, d: 5, kind: 'car' },
    ],
    coffees: [
      { x: -2, d: 22 },
      { x: 11, d: 35 },
    ],
    itemRows: [38],
  },
  hurdles: {
    hurdles: [6, 14, 22, 30],
    props: [
      { x: -7, d: 4, r: 0.6, kind: 'cone' },
      { x: 6, d: 10, r: 0.6, kind: 'cone' },
      { x: -2, d: 18, r: 0.6, kind: 'cone' },
      { x: 10, d: 26, r: 0.6, kind: 'cone' },
      { x: -10, d: 32, r: 0.6, kind: 'cone' },
    ],
  },
  subway: {
    coffees: [{ x: -11, d: 2 }],
    bikes: [
      { x: -9, d: 23, kind: 'truck' },
      { x: 9, d: 23, kind: 'sports' },
    ],
  },
  light: { itemRows: [12] },
  storm: {
    bikes: [
      { x: -8, d: 4, kind: 'bike' },
      { x: 8, d: 5, kind: 'car' },
    ],
    coffees: [
      { x: -2, d: 22 },
      { x: 11, d: 35 },
    ],
    itemRows: [38],
  },
  acorns: {
    leafPiles: [
      { x: -6, d: 9, r: 1.7 },
      { x: 7, d: 17, r: 1.7 },
      { x: -1, d: 27, r: 1.7 },
      { x: 9, d: 31, r: 1.7 },
      { x: -9, d: 37, r: 1.7 },
    ],
    bikes: [
      { x: -8, d: 4, kind: 'bike' },
      { x: 8, d: 5, kind: 'car' },
    ],
    coffees: [
      { x: -2, d: 22 },
      { x: 11, d: 35 },
    ],
    itemRows: [38],
  },
  ice: {
    bikes: [
      { x: -8, d: 4, kind: 'bike' },
      { x: 8, d: 5, kind: 'car' },
    ],
    coffees: [
      { x: -2, d: 22 },
      { x: 11, d: 35 },
    ],
    itemRows: [38],
  },
  scooter: {
    lanes: [
      { kind: 'scooter', d: 10, speed: 18, offsets: [0, 24], hx: 0.9, hz: 0.5 },
      { kind: 'scooter', d: 21, speed: -16, offsets: [10, 34], hx: 0.9, hz: 0.5 },
      { kind: 'scooter', d: 31, speed: 20, offsets: [4, 28], hx: 0.9, hz: 0.5 },
    ],
    props: [
      { x: -9, d: 4, r: 1.4, kind: 'bush' },
      { x: 5, d: 15.5, r: 1.4, kind: 'bush' },
      { x: 4, d: 26, r: 1.4, kind: 'bush' },
    ],
    puddles: [{ x: -8, d: 26, r: 2.4 }],
    bikes: [{ x: -11, d: 15.5, kind: 'scooter' }],
    coffees: [
      { x: 6, d: 6 },
      { x: -8, d: 34 },
    ],
    itemRows: [35],
  },
  quiz: {},
  slide: {},

}

/** 맵의 구간 순서대로 장애물을 늘어놓는다. */
export function buildLayout(map: CourseMap): CourseLayout {
  const layout: CourseLayout = {
    zones: [{ name: map.alley, from: -16, to: -(SECTIONS_FROM - 2) }],
    puddles: [...ALLEY.puddles],
    props: [...ALLEY.props],
    hurdleZs: [],
    vehicleLanes: [],
    pigeonFrom: 0,
    subwayZ: 0,
    lightZone: { from: 0, to: 0 },
    bikes: [],
    coffees: [],
    itemRows: [...ALLEY.itemRows],
    special: null,
    hasPigeons: false,
    leafPiles: [],
    quiz: null,
    slide: null,
    shortcuts: [],
    pads: [],
  }
  const bikes = [...ALLEY.bikes]
  const coffees = [...ALLEY.coffees]
  let start = SECTIONS_FROM
  for (const kind of map.sections) {
    const z = (d: number) => -(start + d)
    const content = SECTION_CONTENT[kind]
    layout.zones.push({ name: map.names?.[kind] ?? SECTION_NAME[kind], from: z(0), to: z(SECTION_LENGTH[kind] - 2) })
    for (const { x, d, r } of content.puddles ?? []) layout.puddles.push({ x, z: z(d), r })
    for (const { x, d, r, kind: prop } of content.props ?? []) layout.props.push({ x, z: z(d), r, kind: prop })
    for (const d of content.hurdles ?? []) layout.hurdleZs.push(z(d))
    for (const { d, ...lane } of content.lanes ?? []) layout.vehicleLanes.push({ ...lane, z: z(d) })
    for (const { x, d, kind: ride } of content.bikes ?? []) bikes.push({ x, z: z(d), kind: ride })
    for (const { x, d } of content.coffees ?? []) coffees.push({ x, z: z(d) })
    for (const d of content.itemRows ?? []) layout.itemRows.push(z(d))
    for (const { x, d, r } of content.leafPiles ?? []) layout.leafPiles.push({ x, z: z(d), r })
    if (kind === 'pigeons') {
      layout.pigeonFrom = z(4)
      layout.hasPigeons = true
    }
    if (kind === 'slide') layout.slide = { from: z(0), top: z(SLIDE_TOP_D), to: z(SLIDE_BOTTOM_D), end: z(SECTION_LENGTH.slide) }
    if (kind === 'quiz') layout.quiz = { from: z(0), wallZ: z(QUIZ_WALL_D), to: z(SECTION_LENGTH.quiz) }
    if (kind === 'storm' || kind === 'acorns' || kind === 'ice') layout.special = { kind, from: z(0), to: z(SECTION_LENGTH[kind]) }
    if (kind === 'subway') layout.subwayZ = z(12)
    if (kind === 'light') layout.lightZone = { from: z(4), to: z(32) }
    if (PAD_SECTIONS.includes(kind)) {
      const index = map.sections.indexOf(kind)
      const length = SECTION_LENGTH[kind]
      layout.pads.push({ kind: 'dash', x: PAD_XS[index % 3], z: z(Math.round(length * 0.3)) })
      layout.pads.push({ kind: index % 2 ? 'jump' : 'dash', x: PAD_XS[(index + 1) % 3], z: z(Math.round(length * 0.65)) })
      if (kind === 'road' || kind === 'scooter') layout.pads.push({ kind: 'jump', x: PAD_XS[(index + 2) % 3], z: z(Math.round(length * 0.85)) })
    }
    if (SHORTCUT_SECTIONS.includes(kind) && layout.shortcuts.length < SHORTCUTS_PER_MAP) {
      const index = layout.shortcuts.length
      layout.shortcuts.push({ id: index + 1, side: index % 2 ? 1 : -1, from: z(2), to: z(SECTION_LENGTH[kind] - 2), name: SHORTCUT_NAMES[(map.sections.indexOf(kind) + index) % SHORTCUT_NAMES.length] })
    }
    start += SECTION_LENGTH[kind]
  }
  layout.zones.push({ name: '우테코 캠퍼스', from: -(start), to: FINISH_Z })
  layout.bikes = bikes.map((bike, index) => ({ id: index + 1, ...bike }))
  layout.coffees = coffees.map((coffee, index) => ({ id: index + 1, ...coffee }))
  return layout
}

const layouts = new Map<string, CourseLayout>()

/** 맵 배치를 한 번만 만들어 둔다. 서버는 방마다 이걸로 따릉이 자리를 확인한다. */
export function layoutOf(mapId: string | undefined) {
  const map = mapById(mapId)
  let layout = layouts.get(map.id)
  if (!layout) {
    layout = buildLayout(map)
    layouts.set(map.id, layout)
  }
  return layout
}

// 지금 화면에 깔린 맵. 다른 파일은 아래 이름들을 그대로 읽고, applyMap()이 바꾸면 새 맵 값이 보인다.
export let activeMap: CourseMap = MAPS[0]
let centerline = buildCenterline(activeMap.bends)
let VEHICLE_LANES: VehicleLane[] = []
let PIGEON_FROM = 0
let HAS_PIGEONS = true
/** 지금 맵만의 구간. 없으면 null */
export let SPECIAL: CourseLayout['special'] = null
export let LEAF_PILES: Circle[] = []
export let QUIZ: CourseLayout['quiz'] = null
export let SLIDE: CourseLayout['slide'] = null
export let ZONES: Zone[] = []
export let PUDDLES: Circle[] = []
export let PROPS: Prop[] = []
export let HURDLE_ZS: number[] = []
export let ROAD_ZS: number[] = []
export let SCOOTER_ZS: number[] = []
export let SUBWAY_Z = 0
export let LIGHT_ZONE = { from: 0, to: 0 }
export let BIKES: CourseLayout['bikes'] = []
export let COFFEES: CourseLayout['coffees'] = []
export let ITEM_ROWS: number[] = []
export let SHORTCUTS: Shortcut[] = []
export let PADS: Pad[] = []

/** 이 맵으로 코스를 바꾼다. 게임 화면을 그리기 전에 부른다. */
export function applyMap(mapId: string | undefined) {
  activeMap = mapById(mapId)
  const layout = layoutOf(activeMap.id)
  centerline = buildCenterline(activeMap.bends)
  VEHICLE_LANES = layout.vehicleLanes
  PIGEON_FROM = layout.pigeonFrom
  HAS_PIGEONS = layout.hasPigeons
  SPECIAL = layout.special
  LEAF_PILES = layout.leafPiles
  QUIZ = layout.quiz
  SLIDE = layout.slide
  ZONES = layout.zones
  PUDDLES = layout.puddles
  PROPS = layout.props
  HURDLE_ZS = layout.hurdleZs
  ROAD_ZS = VEHICLE_LANES.filter((lane) => lane.kind !== 'scooter').map((lane) => lane.z)
  SCOOTER_ZS = VEHICLE_LANES.filter((lane) => lane.kind === 'scooter').map((lane) => lane.z)
  SUBWAY_Z = layout.subwayZ
  LIGHT_ZONE = layout.lightZone
  BIKES = layout.bikes
  COFFEES = layout.coffees
  ITEM_ROWS = layout.itemRows
  SHORTCUTS = layout.shortcuts
  PADS = layout.pads
}


// ---- 맵만의 구간 ----
/** 지금 이 거리(z)가 맵만의 구간 안이면 그 종류 */
export function specialAt(z: number): SpecialKind | null {
  return SPECIAL && z <= SPECIAL.from && z >= SPECIAL.to ? SPECIAL.kind : null
}

/** 0~1 사이의 고정된 난수. 같은 k면 모든 화면에서 같은 값이다. */
function noise(k: number) {
  const value = Math.sin(k * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

// 천둥 번개 사거리: 돌풍이 옆으로 밀고, 번개는 그림자로 미리 알린 자리에 떨어진다.
const GUST_CYCLE = 6
const GUST_FROM = 2.3
const GUST_TO = 4.8
export const GUST_WARN = 1.2
export const GUST_SPEED = 6

/** 돌풍. dir은 미는 쪽(+1 오른쪽), strength는 0~1, warn이면 곧 분다. */
export function gustAt(seconds: number) {
  const cycle = Math.floor(seconds / GUST_CYCLE)
  const local = seconds - cycle * GUST_CYCLE
  const dir: 1 | -1 = noise(cycle) < 0.5 ? 1 : -1
  const blowing = local >= GUST_FROM && local < GUST_TO
  const strength = blowing ? Math.sin(((local - GUST_FROM) / (GUST_TO - GUST_FROM)) * Math.PI) : 0
  return { dir, strength, warn: !blowing && local >= GUST_FROM - GUST_WARN && local < GUST_FROM }
}

const LIGHTNING_EVERY = 0.55
export const LIGHTNING_WARN = 1.3
export const LIGHTNING_FLASH = 0.3
export const LIGHTNING_RADIUS = 2.2
/** 동시에 보일 수 있는 번개 수(화면이 미리 만들어 둘 개수) */
export const LIGHTNING_MAX = Math.ceil((LIGHTNING_WARN + LIGHTNING_FLASH) / LIGHTNING_EVERY) + 1

export type Strike = { id: number; x: number; z: number; /** 0~1: 그림자가 커지는 중, 1 이상: 번쩍 */ progress: number; striking: boolean }

export function lightningAt(seconds: number): Strike[] {
  if (SPECIAL?.kind !== 'storm') return []
  const { from, to } = SPECIAL
  const result: Strike[] = []
  const first = Math.floor((seconds - LIGHTNING_FLASH) / LIGHTNING_EVERY)
  const last = Math.floor((seconds + LIGHTNING_WARN) / LIGHTNING_EVERY)
  for (let k = Math.max(first, 1); k <= last; k++) {
    const at = k * LIGHTNING_EVERY
    const age = seconds - (at - LIGHTNING_WARN)
    if (age < 0 || age >= LIGHTNING_WARN + LIGHTNING_FLASH) continue
    result.push({
      id: k,
      x: (noise(k) * 2 - 1) * (STREET_HALF_W - 3),
      z: from - 3 - noise(k + 0.37) * (from - to - 6),
      progress: age / LIGHTNING_WARN,
      striking: seconds >= at,
    })
  }
  return result
}

// 데굴데굴 도토리 언덕: 커다란 도토리가 출발 쪽으로 굴러 내려온다. 점프로 넘는다.
const ACORN_LANES = [-10, -5, 0, 5, 10]
const ACORN_SPEED = 9
const ACORN_PERIOD = 3.6
export const ACORN_RADIUS = 0.9
/** 이보다 높이 떠 있으면 도토리를 넘는다. 한 번 뛰면 아슬아슬, 2단 점프면 넉넉하다. */
export const ACORN_CLEAR_HEIGHT = 1
/** 동시에 보일 수 있는 도토리 수 */
export const ACORN_MAX = ACORN_LANES.length * 2
export const LEAF_BOUNCE_SPEED = 11

export function acornsAt(seconds: number) {
  if (SPECIAL?.kind !== 'acorns') return []
  const { from, to } = SPECIAL
  const travel = (from - to) / ACORN_SPEED
  const result: { x: number; z: number; roll: number }[] = []
  ACORN_LANES.forEach((x, lane) => {
    const offset = noise(lane + 3) * ACORN_PERIOD
    const latest = Math.floor((seconds - offset) / ACORN_PERIOD)
    for (let n = latest; n > latest - 2; n--) {
      const age = seconds - (n * ACORN_PERIOD + offset)
      if (age < 0 || age >= travel) continue
      const distance = age * ACORN_SPEED
      result.push({ x, z: to + distance, roll: distance / ACORN_RADIUS })
    }
  })
  return result
}

// 꽁꽁 언 호수공원: 얼음 위에서는 미끄러지고, 제설차가 길을 가로지르며 밀어낸다.
/** 얼음 위에서 움직임이 따라붙는 빠르기. 땅은 12다. */
export const ICE_GRIP = 1.6
const PLOW_LANES = [
  { d: 14, speed: 5, offset: 0 },
  { d: 32, speed: -4.2, offset: 20 },
]
export const PLOW = { hx: 3.2, hz: 1.3 }

export function plowsAt(seconds: number): (Box & { dir: 1 | -1 })[] {
  if (SPECIAL?.kind !== 'ice') return []
  const from = SPECIAL.from
  return PLOW_LANES.map((lane) => ({ x: wrap(lane.offset + lane.speed * Math.max(0, seconds)), z: from - lane.d, hx: PLOW.hx, hz: PLOW.hz, dir: lane.speed > 0 ? 1 : -1 }))
}

// ---- 링아웃 스핑크스 ----
/** 구간 시작에서 벽까지. 그 앞에서 문제를 읽고 통로를 고른다. */
const QUIZ_WALL_D = 14
export const QUIZ_DOOR_XS = [-8, 0, 8]
export const QUIZ_DOOR_HALF = 2.2
export const QUIZ_WALL_HALF_DEPTH = 0.5
/** 오답 통로에 들어가면 떨어졌다가 구간 처음으로 돌아온다. */
export const QUIZ_WRONG_STUN = 1.2

/** 통로 사이를 막는 벽. 통로는 늘 열려 있고, 맞았는지는 지나갈 때 정한다. */
export function quizWalls(): Box[] {
  if (!QUIZ) return []
  const walls: Box[] = []
  let left = -YARD_HALF_W
  for (const doorX of QUIZ_DOOR_XS) {
    const right = doorX - QUIZ_DOOR_HALF
    walls.push({ x: (left + right) / 2, z: QUIZ.wallZ, hx: (right - left) / 2, hz: QUIZ_WALL_HALF_DEPTH })
    left = doorX + QUIZ_DOOR_HALF
  }
  walls.push({ x: (left + YARD_HALF_W) / 2, z: QUIZ.wallZ, hx: (YARD_HALF_W - left) / 2, hz: QUIZ_WALL_HALF_DEPTH })
  return walls
}

/** 이 x가 몇 번째 통로인지. 통로 밖이면 null */
export function quizDoorAt(x: number) {
  const index = QUIZ_DOOR_XS.findIndex((doorX) => Math.abs(x - doorX) <= QUIZ_DOOR_HALF)
  return index >= 0 ? index : null
}

// ---- 대왕 미끄럼틀 ----
/** 구간 시작에서 계단 꼭대기까지, 그리고 미끄럼틀이 끝나는 곳까지 */
const SLIDE_TOP_D = 7
const SLIDE_BOTTOM_D = 36
/** 미끄럼틀 꼭대기 높이. 서버가 받는 높이(3) 안에 둔다. */
export const SLIDE_HEIGHT = 3
/** 미끄러지는 빠르기. 서버의 속도 검사(MAX_SPEED)보다 조금 느리다. */
export const SLIDE_SPEED = 18
/** 미끄럼틀 위에서 옆으로 움직이는 빠르기 */
export const SLIDE_STEER = 7

/** 이 거리(z)의 땅 높이. 계단은 올라가고, 미끄럼틀은 꼭대기에서 바닥까지 내려간다. */
export function groundAt(z: number) {
  if (!SLIDE || z > SLIDE.from || z < SLIDE.to) return 0
  if (z > SLIDE.top) return ((SLIDE.from - z) / (SLIDE.from - SLIDE.top)) * SLIDE_HEIGHT
  const t = (SLIDE.top - z) / (SLIDE.top - SLIDE.to)
  // 처음엔 가파르게, 끝에선 완만하게 내려온다.
  return SLIDE_HEIGHT * (1 - t) * (1 - t * 0.35)
}

/** 미끄럼틀을 타고 있는 구간인지(계단 말고) */
export function onSlide(z: number) {
  return SLIDE !== null && z <= SLIDE.top && z > SLIDE.to
}

// 모든 규칙을 읽은 뒤 기본 맵을 깐다.
applyMap(DEFAULT_MAP_ID)
