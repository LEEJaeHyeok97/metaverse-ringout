import { useEffect, useState } from 'react'

/** 매 프레임 바뀌는 값(시계, 게이지)을 HUD에 보여 주려고 일정 간격으로 다시 그린다. */
export function useTick(ms = 100) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), ms)
    return () => clearInterval(timer)
  }, [ms])
}
