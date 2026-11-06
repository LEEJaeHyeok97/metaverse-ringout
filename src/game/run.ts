import { growth } from '../data/garden'
import type { ItemKind } from './course'

/** 내 출근길 진행 상태. 3D 화면이 매 프레임 쓰고 HUD가 주기적으로 읽는다. */

export type RunPhase = 'countdown' | 'sleeping' | 'running' | 'finished'

export type Toast = { key: number; text: string; tone: 'bad' | 'good' | 'info'; at: number }

export const run = {
  startAt: 0,
  lane: 2,
  phase: 'countdown' as RunPhase,
  /** 일어나기 게이지 */
  wake: 0,
  stunUntil: 0,
  boostUntil: 0,
  x: 0,
  z: 0,
  finishedAt: 0,
  toasts: [] as Toast[],
  /** 도착해서 받은 씨앗의 성장 상태. 도착 전에는 null */
  reward: null as ReturnType<typeof growth> | null,
  /** 따릉이를 타고 있으면 내릴 시각 */
  rideUntil: 0,
  /** 가까이 세워진 빈 따릉이 */
  nearBike: null as number | null,
  /** 타겠다고 서버에 물어본 따릉이 */
  pendingBike: null as number | null,
  coffees: new Set<number>(),
  punchUntil: 0,
  /** 링아웃 앱에서 목적지를 정했는지. 정하기 전에는 현관이 잠겨 있다. */
  appSet: false,
  appOpen: false,
  nearDesk: false,
  item: null as ItemKind | null,
  /** 아이템 상자 줄-칸 → 깨진 시각. 잠시 뒤 다시 생긴다. */
  boxesTaken: new Map<string, number>(),
  boosterUntil: 0,
  shieldUntil: 0,
}

let toastKey = 0

export function resetRun(startAt: number, lane: number) {
  run.startAt = startAt
  run.lane = lane
  run.phase = 'countdown'
  run.wake = 0
  run.stunUntil = 0
  run.boostUntil = 0
  run.finishedAt = 0
  run.toasts = []
  run.reward = null
  run.rideUntil = 0
  run.nearBike = null
  run.pendingBike = null
  run.coffees = new Set()
  run.punchUntil = 0
  run.appSet = false
  run.appOpen = false
  run.nearDesk = false
  run.item = null
  run.boxesTaken = new Map()
  run.boosterUntil = 0
  run.shieldUntil = 0
}

/** 출발(첫 알람)부터 지난 초. 출발 전이면 음수다. */
export function gameSeconds(now = performance.now()) {
  return (now - run.startAt) / 1000
}

export function toast(text: string, tone: Toast['tone'] = 'bad') {
  // 같은 안내를 연달아 띄우지 않는다(쓸 데 없는 아이템 키를 연타할 때 등).
  const last = run.toasts[run.toasts.length - 1]
  if (last && last.text === text && performance.now() - last.at < 1500) return
  run.toasts = [...run.toasts.slice(-3), { key: toastKey++, text, tone, at: performance.now() }]
}

// 개발 서버에서만 브라우저 자동 점검이 진행 상태를 읽을 수 있게 열어 둔다.
if (import.meta.env.DEV) (window as unknown as { __ringout: unknown }).__ringout = { run, gameSeconds }
