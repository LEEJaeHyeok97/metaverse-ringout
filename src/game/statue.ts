/**
 * 광장 가운데의 링아웃 로고 조각상. 처음에는 커다란 돌덩이이고, 발차기로 돌을 깨면 로고가 드러난다.
 * 깨진 돌은 서버가 정해 모두에게 알리므로, 모두 같은 조각상을 함께 깎는다.
 * 서버도 이 파일을 읽으므로 다른 파일을 가져오지 않는다.
 */

export const STATUE = { x: 0, z: -8, r: 4.2 }
/** 블록 한 칸 크기 */
export const VOXEL = 0.48
const COLS = 15
const ROWS = 16
/** 앞뒤 두께. 가운데 두 줄이 로고, 앞뒤 한 줄씩은 덮인 돌이다. */
const LAYERS = 4
/** 이 안에서 발차기를 하면 조각상을 깎는다. */
export const CARVE_REACH = STATUE.r + 2.4
/** 발차기 한 번에 깨지는 돌 */
export const CARVE_PER_KICK = 8
/** 다 깎으면 이만큼 뒤에 다시 돌덩이가 된다. */
export const STATUE_RESET_MS = 30_000

export type VoxelPart = 'stone' | 'ring' | 'face' | 'hand' | 'bell' | 'leg'
export type Voxel = { index: number; x: number; y: number; z: number; part: VoxelPart }

/** 로고 모양: 주황 원 테두리 안에 흰 시계판, 검은 바늘, 위에 종 두 개, 아래 다리 두 개 */
function logoPart(col: number, row: number): VoxelPart | null {
  const cx = (COLS - 1) / 2
  const cy = 7.5
  const dx = col - cx
  const dy = row - cy
  const distance = Math.hypot(dx, dy)
  if (distance <= 3.3) {
    // 바늘: 가운데에서 위로, 오른쪽으로
    if ((dx === 0 && dy >= 0 && dy <= 2.5) || (dy === 0.5 && dx >= 0 && dx <= 2)) return 'hand'
    return 'face'
  }
  if (distance <= 6.3) return 'ring'
  // 종: 원 위 왼쪽과 오른쪽
  if (row >= 13 && row <= 15 && (Math.abs(dx - 4) <= 1.2 || Math.abs(dx + 4) <= 1.2)) return 'bell'
  // 다리: 원 아래 왼쪽과 오른쪽
  if (row <= 1 && (Math.abs(dx - 3.5) <= 0.6 || Math.abs(dx + 3.5) <= 0.6)) return 'leg'
  return null
}

/** 조각상 블록 전체. index는 모든 화면과 서버에서 같다. 좌표는 광장 좌표이고 앞(+z)이 출발 쪽이다. */
export const VOXELS: readonly Voxel[] = (() => {
  const result: Voxel[] = []
  for (let layer = 0; layer < LAYERS; layer++) {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const logo = layer === 1 || layer === 2 ? logoPart(col, row) : null
        result.push({
          index: result.length,
          x: STATUE.x + (col - (COLS - 1) / 2) * VOXEL,
          y: (row + 0.5) * VOXEL + 0.6,
          z: STATUE.z + (layer - (LAYERS - 1) / 2) * VOXEL,
          part: logo ?? 'stone',
        })
      }
    }
  }
  return result
})()

export const STONE_COUNT = VOXELS.filter((voxel) => voxel.part === 'stone').length

/**
 * 이 자리에서 찬 발차기에 깨질 돌. 가장 가까운 돌부터 깨되, 높이는 조금만 따져서
 * 발이 닿지 않는 위쪽 돌도 차근차근 깎인다.
 */
export function carveTargets(x: number, z: number, removed: ReadonlySet<number>, count = CARVE_PER_KICK) {
  return VOXELS.filter((voxel) => voxel.part === 'stone' && !removed.has(voxel.index))
    .map((voxel) => ({ index: voxel.index, score: Math.hypot(voxel.x - x, voxel.z - z) + voxel.y * 0.12 }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, count)
    .map((item) => item.index)
}
