/** 키보드와 터치 조이스틱을 한곳에 모은다. 매 프레임 읽으므로 상태는 그냥 객체에 둔다. */

const FORWARD = new Set(['KeyW', 'ArrowUp'])
const BACK = new Set(['KeyS', 'ArrowDown'])
const LEFT = new Set(['KeyA', 'ArrowLeft'])
const RIGHT = new Set(['KeyD', 'ArrowRight'])
const ACTION = 'Space'
const PUNCH = 'KeyF'
const ITEM = 'KeyE'

export const input = {
  pressed: new Set<string>(),
  joystick: { x: 0, y: 0 },
  /** 스페이스나 점프 버튼을 누른 횟수. 읽는 쪽이 지난번 값과 비교한다. */
  actionCount: 0,
  actionHeld: false,
  /** F 키나 때리기 버튼을 누른 횟수 */
  punchCount: 0,
  /** E 키나 아이템 버튼을 누른 횟수 */
  itemCount: 0,
}

/** 채팅을 치는 동안에는 WASD가 캐릭터를 움직이지 않게 한다. */
function isTyping(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

export function pressAction() {
  input.actionCount += 1
}

export function pressPunch() {
  input.punchCount += 1
}

export function pressItem() {
  input.itemCount += 1
}

export function bindKeyboard() {
  const down = (event: KeyboardEvent) => {
    if (isTyping(event.target)) return
    // e.code는 키보드 위치 기준이라 한글 입력 상태에서도 동작한다.
    if (event.code === ACTION) {
      event.preventDefault()
      if (!event.repeat) pressAction()
      input.actionHeld = true
      return
    }
    if (event.code === PUNCH) {
      if (!event.repeat) pressPunch()
      return
    }
    if (event.code === ITEM) {
      if (!event.repeat) pressItem()
      return
    }
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      event.preventDefault()
      input.pressed.add(event.code)
    }
  }
  const up = (event: KeyboardEvent) => {
    if (event.code === ACTION) input.actionHeld = false
    input.pressed.delete(event.code)
  }
  const blur = () => {
    input.pressed.clear()
    input.actionHeld = false
  }
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}

const has = (keys: Set<string>) => {
  for (const key of keys) if (input.pressed.has(key)) return true
  return false
}

/** 화면 기준 이동 방향. x는 오른쪽, y는 앞(화면 안쪽)이다. 길이는 0~1. */
export function moveVector() {
  let x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0) + input.joystick.x
  let y = (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0) + input.joystick.y
  const length = Math.hypot(x, y)
  if (length > 1) {
    x /= length
    y /= length
  }
  return { x, y }
}

/** 창이 열려 있으면 캐릭터를 멈춘다. 창을 닫은 스페이스가 곧바로 점프나 다시 열기로 이어지지 않게 잠깐 무시한다. */
export const overlay = { open: false, ignoreActionsUntil: 0 }

export function setOverlayOpen(open: boolean) {
  overlay.open = open
  if (!open) overlay.ignoreActionsUntil = performance.now() + 250
}

/** 내 캐릭터의 지금 위치. "퍽!" 효과처럼 내 자리가 필요한 곳에서 읽는다. */
export const self = { x: 0, y: 0, z: 0 }

if (import.meta.env.DEV) Object.assign(window, { __self: self })
