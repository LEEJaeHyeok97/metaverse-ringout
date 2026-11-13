import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advanceTracker, gridSpot, KART_HALF_WIDTH, KART_LAPS, KART_MIN_FINISH_SECONDS, nearestTrack, newTracker, TRACK, TRACK_LENGTH, trackSpot } from '../src/game/kart.ts'

test('서킷은 겹치지 않는 고리이고, 3바퀴가 2분쯤 걸린다', () => {
  // 한 바퀴가 너무 짧거나 길지 않다(평균 시속 약 21칸이면 3바퀴 110~130초).
  const seconds = (TRACK_LENGTH * KART_LAPS) / 21
  assert.ok(seconds > 110 && seconds < 130, `3바퀴 ${seconds.toFixed(0)}초`)
  // 고리의 서로 먼 구간끼리는 벽까지 겹치지 않을 만큼 떨어져 있다.
  for (let i = 0; i < TRACK_LENGTH; i += 3) {
    for (let j = 0; j < TRACK_LENGTH; j += 3) {
      const gap = Math.min(Math.abs(i - j), TRACK_LENGTH - Math.abs(i - j))
      if (gap < 60) continue
      assert.ok(Math.hypot(TRACK[i].x - TRACK[j].x, TRACK[i].z - TRACK[j].z) > 30, `${i}번과 ${j}번이 너무 가깝다`)
    }
  }
  assert.ok(KART_MIN_FINISH_SECONDS > 30)
})

test('출발 자리는 모두 도로 위에 있고 서로 겹치지 않는다', () => {
  const spots = [0, 1, 2, 3, 4].map(gridSpot)
  for (const spot of spots) assert.ok(nearestTrack(spot.x, spot.z).distance < KART_HALF_WIDTH - 1)
  for (let a = 0; a < spots.length; a++) for (let b = a + 1; b < spots.length; b++) assert.ok(Math.hypot(spots[a].x - spots[b].x, spots[a].z - spots[b].z) > 2.5)
})

test('출발선을 앞으로 넘을 때마다 한 바퀴가 늘고, 거꾸로 넘으면 줄어든다', () => {
  const start = gridSpot(2)
  const tracker = newTracker(nearestTrack(start.x, start.z).index)
  let index = tracker.index
  for (let lap = 0; lap < KART_LAPS; lap++) {
    for (let step = 0; step < TRACK_LENGTH; step += 2) {
      index += 2
      const spot = trackSpot(index, 3)
      advanceTracker(tracker, spot.x, spot.z)
    }
  }
  assert.equal(tracker.laps, KART_LAPS)
  // 출발선을 거꾸로 넘어가면 바퀴가 줄어서, 선 앞뒤를 오가며 바퀴를 벌 수 없다.
  for (let step = 0; step < 40; step++) {
    index -= 1
    const spot = trackSpot(index, 0)
    advanceTracker(tracker, spot.x, spot.z)
  }
  assert.equal(tracker.laps, KART_LAPS - 1)
})
