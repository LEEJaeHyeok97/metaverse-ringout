import { useRef, type PointerEvent } from 'react'
import { input, pressAction, pressItem, pressPunch } from '../scene/input'

const TRAVEL = 40
const DEAD_ZONE = 0.12

/** 터치 화면에서만 보이는 이동 조이스틱과 점프 버튼 */
export function TouchControls({ actionLabel = '점프', punch = true, item = null }: { actionLabel?: string; punch?: boolean; item?: string | null }) {
  const knob = useRef<HTMLDivElement>(null)
  const pointerId = useRef<number | null>(null)

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = event.clientX - (rect.left + rect.width / 2)
    const dy = event.clientY - (rect.top + rect.height / 2)
    const scale = Math.min(TRAVEL / (Math.hypot(dx, dy) || 1), 1)
    const x = dx * scale
    const y = dy * scale
    if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`
    const strength = Math.hypot(x, y) / TRAVEL
    input.joystick.x = strength < DEAD_ZONE ? 0 : x / TRAVEL
    input.joystick.y = strength < DEAD_ZONE ? 0 : -y / TRAVEL
  }

  const release = () => {
    pointerId.current = null
    input.joystick.x = 0
    input.joystick.y = 0
    if (knob.current) knob.current.style.transform = ''
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-[calc(1rem+env(safe-area-inset-left))] hidden size-28 touch-none place-items-center rounded-full border-[2.5px] border-ink bg-white/70 select-none pointer-coarse:grid"
        onPointerDown={(event) => {
          if (pointerId.current !== null) return
          pointerId.current = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          update(event)
        }}
        onPointerMove={(event) => {
          if (event.pointerId === pointerId.current) update(event)
        }}
        onPointerUp={(event) => {
          if (event.pointerId === pointerId.current) release()
        }}
        onPointerCancel={(event) => {
          if (event.pointerId === pointerId.current) release()
        }}
      >
        <div ref={knob} className="size-12 rounded-full border-[2.5px] border-ink bg-accent" />
      </div>
      <button
        type="button"
        className="sketch-button absolute right-[calc(1rem+env(safe-area-inset-right))] bottom-[calc(1.5rem+env(safe-area-inset-bottom))] hidden size-20 touch-none rounded-full bg-white text-xl select-none pointer-coarse:block"
        onPointerDown={(event) => {
          event.preventDefault()
          pressAction()
          input.actionHeld = true
        }}
        onPointerUp={() => {
          input.actionHeld = false
        }}
      >
        {actionLabel}
      </button>
      {punch && (
        <button
          type="button"
          aria-label="때리기"
          className="sketch-button absolute right-[calc(6.5rem+env(safe-area-inset-right))] bottom-[calc(1.5rem+env(safe-area-inset-bottom))] hidden size-16 touch-none rounded-full bg-accent-soft text-2xl select-none pointer-coarse:block"
          onPointerDown={(event) => {
            event.preventDefault()
            pressPunch()
          }}
        >
          👊
        </button>
      )}
      {item && (
        <button
          type="button"
          aria-label="아이템 쓰기"
          className="sketch-button absolute right-[calc(1.5rem+env(safe-area-inset-right))] bottom-[calc(7.5rem+env(safe-area-inset-bottom))] hidden size-16 touch-none rounded-full bg-[#FFF6C9] text-3xl select-none pointer-coarse:block"
          onPointerDown={(event) => {
            event.preventDefault()
            pressItem()
          }}
        >
          {item}
        </button>
      )}
    </>
  )
}
