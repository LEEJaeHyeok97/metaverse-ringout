import { useEffect, useRef } from 'react'
import { INTRO_BOARDS, PHONE_SCREEN } from '../data/ringout'
import { PHONE_INFO_INDEX } from '../game/lobby'
import { audio } from '../lib/audio'
import { BRAND } from '../lib/brand'

/** 광장 게시판과 휴대폰을 크게 보는 창. 스페이스, Esc, 바깥 누르기로 닫는다. */
export function InfoModal({ index, onClose }: { index: number; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const phone = index === PHONE_INFO_INDEX
  const board = phone ? null : INTRO_BOARDS[index]
  const title = board ? board.title : `${BRAND.name} 알람`
  const detail = board ? board.detail : PHONE_SCREEN.detail

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
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-ink/30 p-4" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label={title} className="sketch pop-in flex w-full max-w-lg flex-col gap-4 p-6">
        <header className="flex items-start justify-between gap-2">
          <h2 className={`text-4xl font-bold ${index === 3 || phone ? 'text-accent' : ''}`}>{title}</h2>
          <button ref={closeButton} type="button" className="text-3xl leading-none" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </header>
        {phone && (
          <div className="mx-auto flex w-48 flex-col items-center gap-1 rounded-[28px] border-[3px] border-ink bg-white px-4 py-5 text-center">
            <p className="text-sm font-bold tracking-widest">{BRAND.english}</p>
            <p className="ringing text-5xl font-bold text-accent">{PHONE_SCREEN.time}</p>
            <p className="text-lg font-bold">📍 {PHONE_SCREEN.destination}</p>
            <p className="text-base">{PHONE_SCREEN.caption}</p>
          </div>
        )}
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
        <p className="text-center text-base text-pencil">스페이스나 Esc로 닫기</p>
      </section>
    </div>
  )
}
