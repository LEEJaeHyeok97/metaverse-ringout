/** 링아웃 광장 배치. 서버가 범위 확인에 함께 쓴다. */

export const LOBBY_HALF = 30

/** 가운데 거대한 링아웃 휴대폰 조형물 */
export const PHONE_SPOT = { x: 0, z: -8, r: 3.2 }

/** 대기실로 들어가는 발판. 밟으면 방 고르기 창이 열린다. */
export const MATCH_PAD = { x: 0, z: 18, r: 3 }

/** 소개 게시판 자리. 문구는 data/ringout.ts에 있다. */
export const BOARD_SPOTS = [
  { x: -16, z: -4, rotation: Math.PI / 5 },
  { x: -18, z: 10, rotation: Math.PI / 2.4 },
  { x: 16, z: -4, rotation: -Math.PI / 5 },
  { x: 18, z: 10, rotation: -Math.PI / 2.4 },
]

export const LOBBY_OBSTACLES = [
  PHONE_SPOT,
  ...BOARD_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, r: 1.6 })),
]

/** 가까이 가서 스페이스로 자세히 볼 수 있는 것들. 0~3은 게시판, 4는 휴대폰이다. */
export const INFO_SPOTS = [
  ...BOARD_SPOTS.map((spot) => ({ x: spot.x, z: spot.z, reach: 4 })),
  { x: PHONE_SPOT.x, z: PHONE_SPOT.z, reach: PHONE_SPOT.r + 2.5 },
]

export const PHONE_INFO_INDEX = BOARD_SPOTS.length
