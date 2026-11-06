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

// ---- 구불구불한 도로 ----
/** 구간마다 휘는 정도(1/반지름). 양수면 오른쪽으로 꺾인다. */
const BENDS: { from: number; to: number; curvature: number }[] = [
  { from: 40, to: 74, curvature: 1 / 52 },
  { from: 110, to: 150, curvature: -1 / 48 },
  { from: 150, to: 194, curvature: 1 / 64 },
  { from: 224, to: 262, curvature: -1 / 56 },
  { from: 264, to: 300, curvature: 1 / 44 },
  { from: 300, to: 332, curvature: -1 / 40 },
]
const STEP = 0.5
const TABLE_FROM = -60
const TABLE_TO = 460

function curvatureAt(s: number) {
  for (const bend of BENDS) if (s >= bend.from && s < bend.to) return bend.curvature
  return 0
}

/** 도로 가운데 선을 미리 따라가 둔 표. [x, z, 방향] */
const centerline = (() => {
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
})()

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
/** 게임 1초가 시계로 20초. 08:25에 알람이 울리고 09:00(105초)가 넘으면 지각이다. */
export const CLOCK_START_MINUTES = 8 * 60 + 25
export const CLOCK_SCALE = 20
export const LATE_SECONDS = ((9 * 60 - CLOCK_START_MINUTES) * 60) / CLOCK_SCALE

// ---- 아이템과 기물 ----
/** 따릉이를 타면 이만큼 빨라진다. 알람 부스트와 겹치지 않고 더 빠른 쪽을 쓴다. */
export const RIDE_FACTOR = 1.7
export const RIDE_SECONDS = 7
export const BIKE_REACH = 2.5
export const COFFEE_SECONDS = 3
export const COFFEE_REACH = 1.2
/** 때리기: 닿는 거리, 다시 때릴 수 있을 때까지, 맞은 사람이 기절하는 시간, 기절이 풀린 뒤 봐주는 시간 */
export const PUNCH_RANGE = 1.9
export const PUNCH_COOLDOWN_MS = 1500
export const PUNCH_STUN_SECONDS = 1.4
export const PUNCH_IMMUNE_MS = 3000

export const BIKES = [
  { id: 1, x: -10, z: -20 },
  { id: 2, x: 9, z: -21 },
  { id: 3, x: 22, z: -19 },
  { id: 4, x: -8, z: -112 },
  { id: 5, x: 8, z: -113 },
  { id: 6, x: -9, z: -222 },
  { id: 7, x: 9, z: -222 },
]

export const COFFEES = [
  { id: 1, x: -9, z: -46 },
  { id: 2, x: 10, z: -64 },
  { id: 3, x: -2, z: -130 },
  { id: 4, x: 11, z: -146 },
  { id: 5, x: -11, z: -196 },
  { id: 6, x: 6, z: -270 },
  { id: 7, x: -8, z: -318 },
]

/** 카트라이더처럼 길을 가로지르는 아이템 상자 줄 */
export const ITEM_ROWS = [-56, -152, -236, -326]
export const ITEM_BOX_XS = [-9, -4.5, 0, 4.5, 9]
export const ITEM_BOX_REACH = 1.2
export const ITEM_RESPAWN_MS = 4000
export const ITEM_COOLDOWN_MS = 1500

export const ITEM_KINDS = ['booster', 'shield', 'banana', 'balloon', 'ufo', 'warp'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

export const ITEM_INFO: Record<ItemKind, { icon: string; name: string; help: string }> = {
  booster: { icon: '🚀', name: '부스터', help: '2.5초 동안 아주 빨라져요' },
  shield: { icon: '🛡️', name: '방패', help: '6초 동안 공격 한 번을 막아요' },
  banana: { icon: '🍌', name: '바나나', help: '뒤에 떨어뜨려요. 밟으면 미끄러져요' },
  balloon: { icon: '💧', name: '물풍선', help: '앞사람을 물방울에 가둬요' },
  ufo: { icon: '🛸', name: '우주선', help: '1등을 붙잡아 공중에 띄워요' },
  warp: { icon: '🌀', name: '귀가 포털', help: '바로 앞 사람을 집 앞으로 돌려보내요' },
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
export type Zone = { name: string; from: number; to: number }

/** 진행 막대와 간판에 쓰는 구역. from이 출발 쪽(큰 z)이다. */
export const ZONES: Zone[] = [
  { name: '우리 동네 골목', from: -16, to: -72 },
  { name: '아침 찻길', from: -74, to: -106 },
  { name: '비둘기 광장', from: -108, to: -150 },
  { name: '공사장 허들', from: -154, to: -192 },
  { name: '지하철 스크린도어', from: -194, to: -222 },
  { name: '무궁화 신호등', from: -224, to: -262 },
  { name: '킥보드 언덕', from: -264, to: -334 },
  { name: '우테코 캠퍼스', from: -336, to: FINISH_Z },
]

export function zoneAt(z: number) {
  return ZONES.find((zone) => z <= zone.from && z >= zone.to) ?? null
}

// ---- 고정 장애물 ----
export type Circle = { x: number; z: number; r: number }
export type Box = { x: number; z: number; hx: number; hz: number }

export const PUDDLES: Circle[] = [
  { x: -18, z: -26, r: 3 },
  { x: 4, z: -30, r: 3.2 },
  { x: 20, z: -34, r: 2.8 },
  { x: -6, z: -44, r: 3 },
  { x: 8, z: -52, r: 2.6 },
  { x: -9, z: -62, r: 2.8 },
  { x: 6, z: -68, r: 2.4 },
  { x: 0, z: -126, r: 2.4 },
  { x: -8, z: -300, r: 2.6 },
]

/** 쓰레기통, 화분, 덤불처럼 부딪히면 막히기만 하는 것 */
export const PROPS: (Circle & { kind: 'bin' | 'pot' | 'bush' | 'cone' })[] = [
  { x: -12, z: -24, r: 0.8, kind: 'bin' },
  { x: 14, z: -27, r: 0.8, kind: 'pot' },
  { x: -2, z: -36, r: 0.8, kind: 'bin' },
  { x: 11, z: -42, r: 0.9, kind: 'pot' },
  { x: -11, z: -52, r: 0.9, kind: 'pot' },
  { x: 2, z: -60, r: 0.8, kind: 'bin' },
  { x: -7, z: -158, r: 0.6, kind: 'cone' },
  { x: 6, z: -164, r: 0.6, kind: 'cone' },
  { x: -2, z: -172, r: 0.6, kind: 'cone' },
  { x: 10, z: -180, r: 0.6, kind: 'cone' },
  { x: -10, z: -188, r: 0.6, kind: 'cone' },
  { x: -9, z: -268, r: 1.4, kind: 'bush' },
  { x: 5, z: -284, r: 1.4, kind: 'bush' },
  { x: -3, z: -302, r: 1.4, kind: 'bush' },
  { x: 9, z: -318, r: 1.4, kind: 'bush' },
]

/** 뛰어넘어야 하는 공사장 허들. 길 전체를 가로지른다. */
export const HURDLE_ZS = [-160, -168, -176, -184]
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

const VEHICLE_LANES: VehicleLane[] = [
  { kind: 'car', z: -80, speed: 12, offsets: [0, 24], hx: 2.3, hz: 1.1 },
  { kind: 'bus', z: -89, speed: -10, offsets: [6, 30], hx: 3.6, hz: 1.4 },
  { kind: 'car', z: -98, speed: 15, offsets: [12, 36], hx: 2.3, hz: 1.1 },
  { kind: 'scooter', z: -276, speed: 18, offsets: [0, 24], hx: 0.9, hz: 0.5 },
  { kind: 'scooter', z: -292, speed: -16, offsets: [10, 34], hx: 0.9, hz: 0.5 },
  { kind: 'scooter', z: -310, speed: 20, offsets: [4, 28], hx: 0.9, hz: 0.5 },
]

export const ROAD_ZS = VEHICLE_LANES.filter((lane) => lane.kind !== 'scooter').map((lane) => lane.z)
export const SCOOTER_ZS = VEHICLE_LANES.filter((lane) => lane.kind === 'scooter').map((lane) => lane.z)

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
  const t = Math.max(0, seconds)
  return Array.from({ length: PIGEON_COUNT }, (_, i) => {
    const cx = -10 + ((i * 37) % 21)
    const cz = -112 - ((i * 13) % 34)
    const speed = 0.7 + (i % 4) * 0.3
    const phase = i * 1.7
    const x = cx + Math.sin(t * speed + phase) * 4
    const z = cz + Math.cos(t * speed * 0.8 + phase) * 3
    const heading = Math.atan2(Math.cos(t * speed + phase), -Math.sin(t * speed * 0.8 + phase) * 0.8)
    return { x, z, heading, hop: Math.abs(Math.sin(t * 9 + i)) }
  })
}

// 스크린도어. 문마다 열리는 때가 달라 언제나 어딘가는 열려 있다.
export const SUBWAY_Z = -206
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
export const LIGHT_ZONE = { from: -228, to: -260 }
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
