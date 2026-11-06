/**
 * 알람 리워드: 도착할 때마다 씨앗이 자란다. 첫 도착에 새싹이 돋고, 두 번째 도착에 나무가 된다.
 * 로그인이 없어서 이 브라우저에만 저장한다.
 */

const KEY = 'ringout-world.garden'
export const TREE_ARRIVALS = 2
export const SPROUT_ARRIVALS = 1

export type Stage = 'seed' | 'sprout' | 'tree'

export type Garden = { arrivals: number }

export function loadGarden(): Garden {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
    if (saved && Number.isInteger(saved.arrivals) && saved.arrivals >= 0) return { arrivals: saved.arrivals }
  } catch {
    // 저장된 값이 없거나 읽을 수 없으면 처음부터 키운다.
  }
  return { arrivals: 0 }
}

export function recordArrival(): Garden {
  const next = { arrivals: loadGarden().arrivals + 1 }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 저장하지 못해도 이번 화면에는 보여 준다.
  }
  return next
}

const ORDINALS = ['첫', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열']

/** 지금 키우고 있는 나무의 진행 상태 */
export function growth(arrivals: number) {
  const treeIndex = Math.max(1, Math.ceil(arrivals / TREE_ARRIVALS))
  const progress = arrivals === 0 ? 0 : arrivals - (treeIndex - 1) * TREE_ARRIVALS
  const stage: Stage = progress >= TREE_ARRIVALS ? 'tree' : progress >= SPROUT_ARRIVALS ? 'sprout' : 'seed'
  const stageName = { seed: '씨앗', sprout: '새싹', tree: '나무' }[stage]
  const title = `${ORDINALS[treeIndex - 1] ?? `${treeIndex}`} 번째 나무 · ${stageName}`
  const left = stage === 'seed' ? SPROUT_ARRIVALS - progress : TREE_ARRIVALS - progress
  const next =
    stage === 'tree'
      ? '나무가 다 자랐어요! 다음 도착부터 새 씨앗을 키워요'
      : stage === 'seed'
        ? `${numberWord(left)} 번 더 도착하면 새싹이 돋아나요`
        : `${numberWord(left)} 번 더 도착하면 나무로 자라요`
  return { arrivals, treeIndex, progress, stage, title, next, completedTrees: Math.floor(arrivals / TREE_ARRIVALS) }
}

function numberWord(count: number) {
  return ['', '한', '두', '세', '네', '다섯'][count] ?? String(count)
}
