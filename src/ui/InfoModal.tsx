import { useEffect, useRef } from 'react'
import { INTRO_BOARDS, PHONE_SCREEN, SCREENS } from '../data/ringout'
import { PHONE_INFO_INDEX } from '../game/lobby'
import { audio } from '../lib/audio'
import { BRAND } from '../lib/brand'
import { RingoutLogo } from './art/RingoutLogo'
import { AppScreens, StoreLinks } from './StoreLinks'

/** 광장 게시판과 휴대폰을 크게 보는 창. 실제 앱 화면을 함께 보여 준다. 스페이스, Esc, 바깥 누르기로 닫는다. */
export function InfoModal({ index, onClose }: { index: number; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const phone = index === PHONE_INFO_INDEX
  const board = phone ? null : INTRO_BOARDS[index]
  const title = board ? board.title : `${BRAND.name} 알람`
  const detail = board ? board.detail : PHONE_SCREEN.detail
  const screens = board ? board.screens : [{ src: SCREENS.alarmScreen, caption: '알람 화면' }]
  const howTo = index === INTRO_BOARDS.length - 1

  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape' || event.code === 'Space') {
        event.preventDefault()
        onClose()
      }
    }
    // 창을 연 스페이스가 그대로 닫기로 이어지지 않게 다음 입력부터 듣는다.
    const timer = setTimeout(() => window.addEventListener('keydown', onKey), 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center overflow-y-auto bg-ink/30 p-4" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={title} className="sketch pop-in flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col gap-4 overflow-y-auto p-6">
        <header className="flex items-start justify-between gap-2">
          <h2 className={`flex items-center gap-2 text-4xl font-bold ${howTo || phone ? 'text-accent' : ''}`}>
            <RingoutLogo className="size-10" />
            {title}
          </h2>
          <button ref={closeButton} type="button" className="text-3xl leading-none" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-3">
            {board && (
              <ul className="flex flex-col gap-1 rounded-xl border-2 border-dashed border-pencil px-4 py-3 text-center text-xl">
                {board.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 text-xl leading-relaxed">
              {detail.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {phone && (
              <button
                type="button"
                className="sketch-button bg-accent py-2 text-2xl text-white"
                onClick={() => {
                  audio.unlock()
                  audio.alarm()
                }}
              >
                ⏰ 알람 들어보기
              </button>
            )}
          </div>
          <AppScreens screens={screens} />
        </div>
        {!howTo && (
          <div className="flex flex-col items-center gap-1 rounded-xl bg-accent-soft px-3 py-2">
            <p className="text-lg">진짜 링아웃으로 내일 아침을 시작해 보세요</p>
            <StoreLinks compact />
          </div>
        )}
        <p className="text-center text-base text-pencil">스페이스나 Esc로 닫기</p>
      </section>
    </div>
  )
}
