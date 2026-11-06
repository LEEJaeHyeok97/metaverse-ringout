import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ALARM_PERIOD } from '../game/course'
import { audio } from '../lib/audio'
import { BRAND } from '../lib/brand'
import { RingoutLogo } from './art/RingoutLogo'

type Place = { id: string; name: string; icon: string; x: number; y: number }

/** 지도 위 장소. 좌표는 지도 SVG(300×380) 기준이다. */
const PLACES: Place[] = [
  { id: 'home', name: '우리 집', icon: '🏠', x: 150, y: 345 },
  { id: 'store', name: '편의점', icon: '🏪', x: 62, y: 262 },
  { id: 'cafe', name: '카페', icon: '☕', x: 236, y: 214 },
  { id: 'subway', name: '판교역', icon: '🚇', x: 70, y: 140 },
  { id: 'campus', name: '우테코 캠퍼스', icon: '🏫', x: 205, y: 52 },
]
const GOAL = 'campus'
const PICK_RADIUS = 34

/** 집에서 캠퍼스까지 구불구불한 길. 실제 레이스 코스처럼 S자로 휜다. */
const ROUTE = 'M150 345 C150 300, 95 290, 100 245 S 230 220, 215 170 S 80 150, 110 110 S 200 90, 205 52'

/**
 * 링아웃 앱 체험. 지도에서 목적지를 찍고 알람을 켜는 흐름을 그대로 해 본다.
 * onDone은 캠퍼스를 목적지로 링아웃을 켰을 때만 부른다.
 */
export function RingoutApp({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [picked, setPicked] = useState<Place | null>(null)
  const [hint, setHint] = useState('지도에서 오늘 갈 곳을 눌러 찍어 주세요')
  const [started, setStarted] = useState(false)
  const map = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') onCancel()
      // 스페이스가 뒤의 캐릭터 점프로 새지 않게 막는다.
      if (event.code === 'Space') event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const choose = (event: PointerEvent<SVGSVGElement>) => {
    const svg = map.current
    if (!svg || started) return
    const rect = svg.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 300
    const y = ((event.clientY - rect.top) / rect.height) * 380
    setPin({ x, y })
    audio.unlock()
    audio.effect('pop')
    const near = PLACES.map((place) => ({ place, distance: Math.hypot(place.x - x, place.y - y) }))
      .filter((item) => item.distance < PICK_RADIUS)
      .sort((a, b) => a.distance - b.distance)[0]?.place
    setPicked(near ?? null)
    if (!near) setHint('여기는 아무것도 없어요. 장소 아이콘을 눌러 주세요')
    else if (near.id === 'home') setHint('집은 이미 도착해 있어요! 출근할 곳을 찍어 주세요')
    else if (near.id !== GOAL) setHint(`${near.name}도 좋지만… 오늘은 우테코 캠퍼스로 출근해요!`)
    else setHint('좋아요! 이제 링아웃을 켜요')
  }

  const start = () => {
    setStarted(true)
    audio.effect('wake')
    setTimeout(onDone, 1100)
  }

  const ready = picked?.id === GOAL

  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-ink/40 p-3">
      <section role="dialog" aria-modal="true" aria-label={`${BRAND.name} 앱`} className="pop-in flex h-[min(720px,calc(100dvh-1.5rem))] w-[min(380px,100%)] flex-col overflow-hidden rounded-[40px] border-[3px] border-ink bg-ink p-2 shadow-[8px_8px_0_#EA6E3E]">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[32px] bg-paper">
          <header className="flex items-center gap-2 px-4 pt-4 pb-2">
            <RingoutLogo className="size-9" />
            <div className="flex-1 leading-tight">
              <p className="text-sm font-bold tracking-widest text-accent">{BRAND.english}</p>
              <p className="text-lg font-bold">새 알람 · 오전 08:25</p>
            </div>
            <button type="button" className="text-2xl leading-none" aria-label="닫기" onClick={onCancel}>
              ✕
            </button>
          </header>

          {started ? (
            <div className="pop-in flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              <RingoutLogo className="ringing size-28" />
              <p className="text-3xl font-bold">링아웃 ON!</p>
              <p className="text-xl">우테코 캠퍼스에 도착할 때까지 {ALARM_PERIOD}초마다 울려요</p>
              <p className="text-lg text-pencil">이제 현관문이 열렸어요. 출발!</p>
            </div>
          ) : (
            <>
              <p className="px-4 text-xl leading-snug font-bold">목적지를 찍어 주세요</p>
              <p className={`min-h-[3rem] px-4 text-base leading-snug ${picked && !ready ? 'text-accent' : 'text-pencil'}`} aria-live="polite">
                {hint}
              </p>
              <div className="relative mx-3 mt-2 flex-1 overflow-hidden rounded-2xl border-2 border-ink bg-[#EEF5EA]">
                <svg ref={map} viewBox="0 0 300 380" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full cursor-crosshair touch-none" onPointerDown={choose} role="img" aria-label="동네 지도. 장소를 눌러 목적지로 정한다">
                  {/* 블록과 길 */}
                  {[
                    [10, 10, 120, 80],
                    [160, 110, 130, 70],
                    [10, 180, 70, 60],
                    [180, 250, 110, 70],
                    [10, 300, 90, 70],
                  ].map(([x, y, w, h]) => (
                    <rect key={`${x},${y}`} x={x} y={y} width={w} height={h} rx="10" fill="#fff" stroke="#C9CFC2" strokeWidth="2" />
                  ))}
                  <path d={ROUTE} fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round" />
                  <path d={ROUTE} fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeDasharray="7 6" strokeLinecap="round" />
                  {PLACES.map((place) => (
                    <g key={place.id}>
                      <circle cx={place.x} cy={place.y} r="20" fill={place.id === GOAL ? '#FDE4D8' : '#fff'} stroke="#1A1A1A" strokeWidth="2.5" />
                      <text x={place.x} y={place.y + 7} textAnchor="middle" fontSize="20">
                        {place.icon}
                      </text>
                      <text x={place.x} y={place.y + 36} textAnchor="middle" fontSize="13" fontFamily="Gaegu" fontWeight="700" fill="#1A1A1A">
                        {place.name}
                      </text>
                    </g>
                  ))}
                  {pin && (
                    // 등장 애니메이션의 CSS transform이 위치를 덮어쓰지 않게 위치와 애니메이션을 나눈다.
                    <g key={`${pin.x},${pin.y}`} transform={`translate(${pin.x} ${pin.y})`}>
                      <g className="pop-in" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
                        <path d="M0 0 C-12 -16 -14 -22 -14 -28 A14 14 0 1 1 14 -28 C14 -22 12 -16 0 0 Z" fill="#EA6E3E" stroke="#1A1A1A" strokeWidth="2.5" />
                        <circle cx="0" cy="-28" r="5" fill="#fff" />
                      </g>
                    </g>
                  )}
                </svg>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-3 py-2">
                  <span className="text-2xl">{picked?.icon ?? '📍'}</span>
                  <div className="flex-1 leading-tight">
                    <p className="text-lg font-bold">{picked?.name ?? '목적지 없음'}</p>
                    <p className="text-sm text-pencil">도착할 때까지 {ALARM_PERIOD}초마다 울려요 · 도착하면 자동으로 꺼져요</p>
                  </div>
                </div>
                <button type="button" disabled={!ready} onClick={start} className="sketch-button bg-accent py-3 text-2xl text-white">
                  {ready ? '링아웃 켜기' : '우테코 캠퍼스를 찍어 주세요'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
