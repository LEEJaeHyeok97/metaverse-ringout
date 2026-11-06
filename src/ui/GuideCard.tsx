import { GUIDES } from '../data/ringout'
import { run } from '../game/run'
import { RingoutLogo } from './art/RingoutLogo'

const SHOW_MS = 8000

/**
 * 게임 중 화면 옆에 잠깐 뜨는 링아웃 가이드. 게임 속 순간과 실제 앱 기능을 앱 화면과 함께 짝지어 보여 준다.
 * HUD가 주기적으로 다시 그리므로 상태는 run에서 읽는다.
 */
export function GuideCard() {
  const current = run.guide
  if (!current || performance.now() - current.at > SHOW_MS) return null
  const guide = GUIDES[current.id]
  return (
    <aside
      key={current.id}
      aria-live="polite"
      className="sketch pop-in pointer-events-auto absolute right-4 bottom-4 flex w-80 gap-3 p-3 max-sm:top-24 max-sm:right-auto max-sm:bottom-auto max-sm:left-1/2 max-sm:w-[calc(100%-2rem)] max-sm:-translate-x-1/2"
    >
      <img src={guide.screen} alt="" className="h-36 w-auto shrink-0 rounded-xl border-2 border-ink bg-ink max-sm:hidden" />
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1 text-sm font-bold tracking-wider text-accent">
          <RingoutLogo className="size-5" /> 링아웃 알아보기
        </p>
        <p className="text-xl leading-tight font-bold">{guide.title}</p>
        <p className="text-base leading-snug">{guide.text}</p>
        <button type="button" className="mt-auto self-end text-sm text-pencil underline" onClick={() => (run.guide = null)}>
          닫기
        </button>
      </div>
    </aside>
  )
}
