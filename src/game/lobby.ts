/** 링아웃 광장 배치. 서버가 범위 확인에 함께 쓴다. */

export const LOBBY_HALF = 30

/** 가운데 거대한 링아웃 휴대폰 조형물 */
export const PHONE_SPOT = { x: 0, z: -8, r: 3.2 }

/** 대기실로 들어가는 발판. 밟으면 방 고르기 창이 열린다. */
export const MATCH_PAD = { x: 0, z: 18, r: 3 }

/** 소개 게시판 자리. 문구는 data/ringout.ts에 있다. */
export const BOARD_SPOTS = [
  { x: -16, z: -4, rotation: Math.PI / 5 },
  { x: -9, z: -17, rotation: Math.PI / 10 },
  { x: 9, z: -17, rotation: -Math.PI / 10 },
  { x: 16, z: -4, rotation: -Math.PI / 5 },
  { x: 18, z: 10, rotation: -Math.PI / 2.4 },
  { x: -18, z: 10, rotation: Math.PI / 2.4 },
]

export const LOBBY_OBSTACLES = [
  PHONE_SPOT,
  ...BOARD_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, r: 1.6 })),
]

/** 가까이 가서 스페이스로 자세히 볼 수 있는 것들. 앞쪽은 게시판, 마지막은 휴대폰이다. */
export const INFO_SPOTS = [
  ...BOARD_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, reach: 4 })),
  { x: PHONE_SPOT.x, z: PHONE_SPOT.z, reach: PHONE_SPOT.r + 2.5 },
]

export const PHONE_INFO_INDEX = BOARD_SPOTS.length

/** 다 자란 나무를 심는 나의 정원. 대기실 발판 왼쪽에 있다. */
export const GARDEN = { x: -12, z: 22, cols: 4, rows: 3, tile: 2.4 }
export const GARDEN_TILES = GARDEN.cols * GARDEN.rows

export function gardenTile(index: number) {
  const col = index % GARDEN.cols
  const row = Math.floor(index / GARDEN.cols)
  return {
    x: GARDEN.x + (col - (GARDEN.cols - 1) / 2) * GARDEN.tile,
    z: GARDEN.z + (row - (GARDEN.rows - 1) / 2) * GARDEN.tile,
  }
}

/** 이 자리가 정원의 몇 번째 타일 위인지. 정원 밖이면 null */
export function gardenTileAt(x: number, z: number) {
  const col = Math.round((x - GARDEN.x) / GARDEN.tile + (GARDEN.cols - 1) / 2)
  const row = Math.round((z - GARDEN.z) / GARDEN.tile + (GARDEN.rows - 1) / 2)
  if (col < 0 || col >= GARDEN.cols || row < 0 || row >= GARDEN.rows) return null
  const tile = gardenTile(row * GARDEN.cols + col)
  if (Math.abs(tile.x - x) > GARDEN.tile / 2 || Math.abs(tile.z - z) > GARDEN.tile / 2) return null
  return row * GARDEN.cols + col
}
