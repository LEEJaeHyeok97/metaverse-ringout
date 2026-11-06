import { useEffect, useRef } from 'react'
import { growth, plantableCount, TREE_ARRIVALS, useGarden } from '../data/garden'
import { BRAND } from '../lib/brand'
import { SeedArt } from './art/SeedArt'

/** 나의 나무. 링아웃 새 기능인 알람 리워드를 미리 보여 준다. */
export function GardenModal({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const saved = useGarden()
  const garden = growth(saved.arrivals)
  const plantable = plantableCount(saved)

  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape' || event.code === 'Space') {
        event.preventDefault()
        onClose()
      }
    }
    const timer = setTimeout(() => window.addEventListener('keydown', onKey), 0)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-ink/30 p-4" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section role="dialog" aria-modal="true" aria-label="나의 나무" className="sketch pop-in flex w-full max-w-sm flex-col items-center gap-3 overflow-hidden bg-gradient-to-b from-[#DCEBF3] to-paper p-6 text-center">
        <header className="flex w-full items-center justify-between">
          <h2 className="text-3xl font-bold">🌱 나의 나무</h2>
          <button ref={closeButton} type="button" className="text-3xl leading-none" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        </header>
        {garden.arrivals === 0 ? (
          <>
            <SeedArt className="size-40 opacity-40 grayscale" />
            <p className="text-2xl font-bold">아직 씨앗이 없어요</p>
            <p className="text-lg">출근 레이스에서 우테코 캠퍼스에 도착하면 첫 씨앗을 받아요.</p>
          </>
        ) : (
          <>
            <p className="text-base text-pencil">{garden.title}</p>
            <p className="text-2xl leading-snug font-bold">{garden.next}</p>
            <SeedArt className="size-44" stage={garden.stage} />
            <div className="flex w-full items-center gap-2">
              <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
                <div className="h-full bg-accent" style={{ width: `${(garden.progress / TREE_ARRIVALS) * 100}%` }} />
              </div>
              <span className="text-lg tabular-nums">
                {garden.progress}/{TREE_ARRIVALS}
              </span>
            </div>
            {plantable > 0 && (
              <p className="pop-in rounded-xl border-2 border-ink bg-[#E3F5E9] px-3 py-2 text-lg font-bold">
                🌳 심을 나무 {plantable}그루! 대기실 발판 왼쪽 정원의 빈 타일을 눌러 심어요
              </p>
            )}
            {saved.planted.length > 0 && <p className="text-lg">정원에 심은 나무 {'🌳'.repeat(Math.min(saved.planted.length, 12))}</p>}
          </>
        )}
        <p className="rounded-xl bg-white/70 px-3 py-2 text-base">
          <b className="text-accent">{BRAND.name} 알람 리워드</b> · 목적지에 도착할 때마다 씨앗이 자라요. 씨앗 → 새싹 → 나무 → 정원에 심기!
        </p>
      </section>
    </div>
  )
}
