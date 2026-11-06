import { useSyncExternalStore } from 'react'

/**
 * 알람 리워드: 도착할 때마다 씨앗이 자란다. 첫 도착에 새싹이 돋고, 두 번째 도착에 나무가 된다.
 * 다 자란 나무는 광장의 함께 정원에 심는다. 정원은 서버에 있어 모두에게 보이고,
 * 내가 몇 번 도착해 몇 그루를 심었는지는 로그인이 없어서 이 브라우저에만 저장한다.
 */

const KEY = 'ringout-world.garden'
export const TREE_ARRIVALS = 2
export const SPROUT_ARRIVALS = 1

export type Stage = 'seed' | 'sprout' | 'tree'

/** shared: 함께 정원에 심은 나무 수 */
export type Garden = { arrivals: number; shared: number }

export function loadGarden(): Garden {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
    if (saved && Number.isInteger(saved.arrivals) && saved.arrivals >= 0) {
      // 예전에 나만 보이게 심은 나무(planted)는 함께 정원에 다시 심을 수 있게 세지 않는다.
      const shared = Number.isInteger(saved.shared) && saved.shared >= 0 ? saved.shared : 0
      return { arrivals: saved.arrivals, shared }
    }
  } catch {
    // 저장된 값이 없거나 읽을 수 없으면 처음부터 키운다.
  }
  return { arrivals: 0, shared: 0 }
}

let current: Garden | null = null
const listeners = new Set<() => void>()

export function currentGarden() {
  return getGarden()
}

function getGarden() {
  current ??= loadGarden()
  return current
}

function save(next: Garden) {
  current = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 저장하지 못해도 이번 화면에는 보여 준다.
  }
  for (const listener of listeners) listener()
}

/** 광장과 HUD가 같은 정원 상태를 보도록 구독한다. */
export function useGarden() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getGarden,
  )
}

export function recordArrival(): Garden {
  const garden = getGarden()
  const next = { ...garden, arrivals: garden.arrivals + 1 }
  save(next)
  return next
}

/** 다 자랐지만 아직 정원에 심지 않은 나무 수 */
export function plantableCount(garden: Garden) {
  return Math.max(0, Math.floor(garden.arrivals / TREE_ARRIVALS) - garden.shared)
}

/** 서버가 내 나무를 함께 정원에 심었다고 알려 왔다. */
export function recordPlanted() {
  const garden = getGarden()
  save({ ...garden, shared: garden.shared + 1 })
}

const ORDINALS = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']

export function ordinal(index: number) {
  return ORDINALS[index - 1] ?? `${index}`
}

/** 지금 키우고 있는 나무의 진행 상태 */
export function growth(arrivals: number) {
  const treeIndex = Math.max(1, Math.ceil(arrivals / TREE_ARRIVALS))
  const progress = arrivals === 0 ? 0 : arrivals - (treeIndex - 1) * TREE_ARRIVALS
  const stage: Stage = progress >= TREE_ARRIVALS ? 'tree' : progress >= SPROUT_ARRIVALS ? 'sprout' : 'seed'
  const stageName = { seed: '씨앗', sprout: '새싹', tree: '나무' }[stage]
  const title = `${ordinal(treeIndex)} 번째 나무 · ${stageName}`
  const left = stage === 'seed' ? SPROUT_ARRIVALS - progress : TREE_ARRIVALS - progress
  const next =
    stage === 'tree'
      ? '나무가 다 자랐어요! 광장 정원에 심어 주세요'
      : stage === 'seed'
        ? `${numberWord(left)} 번 더 도착하면 새싹이 돋아나요`
        : `${numberWord(left)} 번 더 도착하면 나무로 자라요`
  return { arrivals, treeIndex, progress, stage, title, next, completedTrees: Math.floor(arrivals / TREE_ARRIVALS) }
}

/**
 * 광장에서 따라다니는 씨앗의 모습. 심을 나무가 있으면 나무를 이고 다니고,
 * 다 심었으면 다음 씨앗으로 돌아간다.
 */
export function companionStage(garden: Garden): Stage | null {
  if (garden.arrivals === 0) return null
  if (plantableCount(garden) > 0) return 'tree'
  const { stage } = growth(garden.arrivals)
  return stage === 'tree' ? 'seed' : stage
}

function numberWord(count: number) {
  return ['', '한', '두', '세', '네', '다섯'][count] ?? String(count)
}
