/**
 * 광장 가운데의 "무궁화 꽃이 피었습니다" 놀이터.
 * 거대한 술래 인형이 매번 다른 박자로 외치고 돌아보며, 돌아본 동안 움직이면 둘레의 핑크 경비대가 쏜다.
 * 앞사람 뒤에 숨어 있으면 술래 눈에 안 보여서 움직이거나 때려도 된다.
 * 박자와 시각은 서버가 정하고, 서버도 이 파일을 읽으므로 다른 파일을 가져오지 않는다.
 */

/** 놀이터: x는 -HALF..HALF, 출발선(START_Z) 뒤에서 들어와 도착선(FINISH_Z)을 넘으면 통과 */
export const RL_FIELD = { half: 8, startZ: 11, finishZ: -11 }
/** 술래 인형 자리. 사람은 이 안으로 못 들어간다. */
export const RL_TAGGER = { x: 0, z: -15, r: 1.8 }
/** 둘레에 선 핑크 경비대 */
export const RL_GUARDS = [
  { x: -11.5, z: 9 },
  { x: 11.5, z: 9 },
  { x: -11.5, z: 2 },
  { x: 11.5, z: 2 },
  { x: -11.5, z: -5 },
  { x: 11.5, z: -5 },
  { x: -11.5, z: -11.5 },
  { x: 11.5, z: -11.5 },
  { x: -5, z: -16.5 },
  { x: 5, z: -16.5 },
]
export const RL_GUARD_R = 0.6

export const RL_SYLLABLES = ['무', '궁', '화', '꽃', '이', '피', '었', '습', '니', '다']

/** 돌아본 직후 이만큼은 봐준다(멈출 틈). */
export const RL_GRACE_MS = 450
/** 돌아본 동안 이만큼 넘게 움직이면 걸린다. */
export const RL_MOVE_TOLERANCE = 0.2
/** 쓰러져 있다가 출발선으로 돌아가기까지 */
export const RL_OUT_MS = 2200
/** 앞사람과 이만큼 가깝고, 술래와 나를 잇는 선에서 이만큼 안에 있으면 숨은 것 */
export const RL_SHIELD_RANGE = 5
export const RL_SHIELD_WIDTH = 0.85

export type RedLightPhase = 'chant' | 'look' | 'turn'

/** 한 판: steps[i]는 i번째 글자 뒤에 쉬는 시간, looks는 돌아보는 시간들(사이사이 gapMs 동안 잠깐 등을 돌린다). */
export type RedLightRound = { pattern: string; steps: number[]; looks: number[]; gapMs: number }

const fill = (ms: number) => RL_SYLLABLES.map(() => ms)

export const RL_PATTERNS: { name: string; make: (jitter: number) => Omit<RedLightRound, 'pattern'> }[] = [
  { name: '🙂 보통 박자', make: (j) => ({ steps: fill(380 * j), looks: [3000], gapMs: 0 }) },
  { name: '⚡ 번개처럼 빨리', make: (j) => ({ steps: fill(130 * j), looks: [3200], gapMs: 0 }) },
  { name: '🐢 느릿느릿', make: (j) => ({ steps: fill(680 * j), looks: [2400], gapMs: 0 }) },
  { name: '✋ 뚝 끊었다 후다닥', make: (j) => ({ steps: [350, 350, 350, 350, 1700 * j, 110, 110, 110, 110, 200], looks: [3000], gapMs: 0 }) },
  { name: '🚀 점점 빠르게', make: (j) => ({ steps: RL_SYLLABLES.map((_, i) => (650 - i * 60) * j), looks: [2800], gapMs: 0 }) },
  { name: '👀 두 번 돌아보기', make: (j) => ({ steps: fill(300 * j), looks: [1400, 2600], gapMs: 700 }) },
  { name: '😠 오래 째려보기', make: (j) => ({ steps: fill(260 * j), looks: [5200], gapMs: 0 }) },
  { name: '🎵 길게 끌다 휙', make: (j) => ({ steps: [250, 250, 250, 250, 2300 * j, 90, 90, 90, 90, 150], looks: [3000], gapMs: 0 }) },
  { name: '🔁 세 번 확인', make: (j) => ({ steps: fill(220 * j), looks: [1000, 1000, 2200], gapMs: 550 }) },
]

/** 매 판 다른 패턴을 고른다. 바로 전 패턴은 다시 고르지 않는다. */
export function makeRound(last: string | null, random = Math.random): RedLightRound {
  const choices = RL_PATTERNS.filter((pattern) => pattern.name !== last)
  const pattern = choices[Math.floor(random() * choices.length)]
  return { pattern: pattern.name, ...pattern.make(0.85 + random() * 0.3) }
}

/** steps를 글자마다 나오는 시각(ms)과 외치기 전체 길이로 바꾼다. */
export function beatsOf(steps: number[]) {
  const beats: number[] = []
  let at = 0
  for (const step of steps) {
    beats.push(Math.round(at))
    at += step
  }
  return { beats, chantMs: Math.round(at) }
}

export function inRedLightField(x: number, z: number, slack = 0) {
  return Math.abs(x) <= RL_FIELD.half + slack && z <= RL_FIELD.startZ + slack && z >= RL_FIELD.finishZ - slack
}

/** 나와 술래 사이에 다른 사람이 서 있어 술래 눈에 안 보이는지 */
export function shieldedFromTagger(me: { x: number; z: number }, others: Iterable<{ x: number; z: number }>) {
  const dx = RL_TAGGER.x - me.x
  const dz = RL_TAGGER.z - me.z
  const length = Math.hypot(dx, dz) || 1
  for (const other of others) {
    const ox = other.x - me.x
    const oz = other.z - me.z
    // 술래 쪽으로 얼마나 앞에 있는지와, 그 선에서 옆으로 얼마나 비켜 있는지
    const ahead = (ox * dx + oz * dz) / length
    const side = Math.abs(ox * dz - oz * dx) / length
    if (ahead > 0.3 && ahead < RL_SHIELD_RANGE && side < RL_SHIELD_WIDTH) return true
  }
  return false
}
