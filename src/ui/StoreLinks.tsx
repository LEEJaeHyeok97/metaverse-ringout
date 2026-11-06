import { APP_STORE_URL, PLAY_STORE_URL, RINGOUT_SITE } from '../data/ringout'

/** 링아웃 앱 내려받기. 새 탭으로 열어 게임은 그대로 둔다. */
export function StoreLinks({ compact = false }: { compact?: boolean }) {
  const button = `sketch-button flex items-center justify-center gap-1 bg-ink text-white ${compact ? 'px-3 py-1 text-base' : 'px-4 py-2 text-lg'}`
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <a className={button} href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
         App Store ↗
      </a>
      <a className={button} href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
        ▶ Google Play ↗
      </a>
      {!compact && (
        <a className="text-base text-pencil underline" href={RINGOUT_SITE} target="_blank" rel="noopener noreferrer">
          ringout.my
        </a>
      )}
    </div>
  )
}

/** 앱 화면 캡처를 휴대폰처럼 둥글게 보여 준다. */
export function AppScreens({ screens, size = 'h-64' }: { screens: readonly { src: string; caption: string }[]; size?: string }) {
  if (screens.length === 0) return null
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {screens.map((screen) => (
        <figure key={screen.caption} className="flex shrink-0 flex-col items-center gap-1">
          <img src={screen.src} alt={`링아웃 앱 화면: ${screen.caption}`} className={`${size} w-auto rounded-2xl border-[2.5px] border-ink bg-ink`} loading="lazy" />
          <figcaption className="text-sm text-pencil">{screen.caption}</figcaption>
        </figure>
      ))}
    </div>
  )
}
