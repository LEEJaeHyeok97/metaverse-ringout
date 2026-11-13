import assert from 'node:assert/strict'
import { test } from 'node:test'
import { advanceTracker, crosserLateral, gridSpot, KART_HALF_WIDTH, KART_TRACKS, KART_WALL, nearestTrack, newTracker, trackSpot } from '../src/game/kart.ts'

for (const track of KART_TRACKS) {
  test(`${track.name}: 겹치지 않는 고리이고, 모든 바퀴가 2분 안팎이다`, () => {
    // 평균 시속 약 21칸으로 달리면 전체 100~135초
    const seconds = (track.length * track.laps) / 21
    assert.ok(seconds > 100 && seconds < 135, `${track.laps}바퀴 ${seconds.toFixed(0)}초 (한 바퀴 ${track.length}칸)`)
    // 고리의 서로 먼 구간끼리는 벽까지 겹치지 않을 만큼 떨어져 있다.
    const { points, length } = track
    for (let i = 0; i < length; i += 3) {
      for (let j = 0; j < length; j += 3) {
        const gap = Math.min(Math.abs(i - j), length - Math.abs(i - j))
        if (gap < 60) continue
        const d = Math.hypot(points[i].x - points[j].x, points[i].z - points[j].z)
        assert.ok(d > KART_WALL * 2 + 2, `${i}번과 ${j}번이 ${d.toFixed(1)}칸으로 너무 가깝다`)
      }
    }
    // 가장 급한 굽이도 카트가 돌 수 있다(반지름 9칸 이상).
    for (let i = 0; i < length; i++) {
      let turn = points[(i + 4) % length].h - points[i].h
      turn = Math.atan2(Math.sin(turn), Math.cos(turn))
      assert.ok(Math.abs(turn) / 4 < 1 / 9, `${i}번 굽이 반지름 ${(4 / Math.abs(turn)).toFixed(1)}칸`)
    }
  })

  test(`${track.name}: 출발 자리, 장애물, 점프대가 트랙 위에 제대로 놓인다`, () => {
    const spots = [0, 1, 2, 3, 4].map((lane) => gridSpot(track, lane))
    for (const spot of spots) assert.ok(nearestTrack(track, spot.x, spot.z).distance < KART_HALF_WIDTH - 1)
    for (let a = 0; a < spots.length; a++) for (let b = a + 1; b < spots.length; b++) assert.ok(Math.hypot(spots[a].x - spots[b].x, spots[a].z - spots[b].z) > 2.5)
    for (const obstacle of track.obstacles) assert.ok(nearestTrack(track, obstacle.x, obstacle.z).distance < KART_HALF_WIDTH, `${obstacle.kind}가 트랙 밖`)
    // 장애물이 길을 다 막지 않는다: 같은 줄에서 장애물 사이로 지나갈 틈(3칸)이 있다.
    for (const ramp of track.ramps) assert.ok(ramp.gapTo > ramp.index && ramp.gapTo < track.length)
    // 가로지르는 것은 벽 밖까지 오간다.
    for (const crosser of track.crossers) {
      const seen = Array.from({ length: 200 }, (_, k) => crosserLateral(crosser, k * 0.1))
      assert.ok(Math.max(...seen) > KART_WALL && Math.min(...seen) < -KART_WALL)
    }
  })
}

test('출발선을 앞으로 넘을 때마다 한 바퀴가 늘고, 거꾸로 넘으면 줄어든다', () => {
  const track = KART_TRACKS[0]
  const start = gridSpot(track, 2)
  const tracker = newTracker(nearestTrack(track, start.x, start.z).index)
  let index = tracker.index
  for (let lap = 0; lap < track.laps; lap++) {
    for (let step = 0; step < track.length; step += 2) {
      index += 2
      const spot = trackSpot(track, index, 3)
      advanceTracker(track, tracker, spot.x, spot.z)
    }
  }
  assert.equal(tracker.laps, track.laps)
  for (let step = 0; step < 40; step++) {
    index -= 1
    const spot = trackSpot(track, index, 0)
    advanceTracker(track, tracker, spot.x, spot.z)
  }
  assert.equal(tracker.laps, track.laps - 1)
})
