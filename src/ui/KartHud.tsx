import { useMemo } from 'react'
import { DRIFT_COLORS, driftLevel, KART_ITEM_INFO, KART_LAPS, KART_MAX_SPEED, KART_TRACK_NAME, TRACK } from '../game/kart'
import { kart, kartSeconds } from '../game/kartRun'
import { run } from '../game/run'
import { BRAND } from '../lib/brand'
import { connection, type ConnectionState, type GameInfo } from '../net/connection'
import type { PlayerInfo, ResultRow } from '../net/protocol'
import { nicknameOf } from '../scene/combat'
import { RingoutLogo } from './art/RingoutLogo'
import { ChatBox } from './ChatBox'
import { MuteButton } from './MuteButton'
import { StoreLinks } from './StoreLinks'
import { TouchControls } from './TouchJoystick'
import { useTick } from './useTick'

function formatMs(ms: number) {
  const seconds = Math.max(0, ms) / 1000
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
}

/** 위에서 내려다본 서킷과 모두의 자리 */
function MiniMap({ entrants, myId }: { entrants: PlayerInfo[]; myId: number | null }) {
  const { path, box } = useMemo(() => {
    const xs = TRACK.map((point) => -point.x)
    const zs = TRACK.map((point) => -point.z)
    const pad = 14
    const box = { left: Math.min(...xs) - pad, top: Math.min(...zs) - pad, width: Math.max(...xs) - Math.min(...xs) + pad * 2, height: Math.max(...zs) - Math.min(...zs) + pad * 2 }
    const path = TRACK.filter((_, index) => index % 4 === 0)
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${(-point.x).toFixed(1)} ${(-point.z).toFixed(1)}`)
      .join(' ')
    return { path: `${path} Z`, box }
  }, [])
  const start = TRACK[0]
  return (
    <svg viewBox={`${box.left} ${box.top} ${box.width} ${box.height}`} className="sketch h-36 w-44 bg-[#E6F2D6] p-1 max-sm:h-24 max-sm:w-28" aria-label="미니맵">
      <path d={path} fill="none" stroke="#1A1A1A" strokeWidth={13} strokeLinejoin="round" />
      <path d={path} fill="none" stroke="#D9D6CE" strokeWidth={9} strokeLinejoin="round" />
      <rect x={-start.x - 6} y={-start.z - 1.5} width={12} height={3} fill="#1A1A1A" />
      {entrants.map((player) => {
        const position = player.id === myId ? { x: kart.x, z: kart.z } : connection.positions.get(player.id)
        if (!position) return null
        return <circle key={player.id} cx={-position.x} cy={-position.z} r={player.id === myId ? 7 : 5.5} fill={player.color} stroke="#1A1A1A" strokeWidth={2.5} />
      })}
    </svg>
  )
}

function Countdown({ t }: { t: number }) {
  if (t >= 1) return null
  if (t >= 0) return <p className="pop-in text-8xl font-bold text-accent drop-shadow-[4px_4px_0_#fff]">출발!</p>
  const number = Math.ceil(-t)
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="sketch bg-[#FFF6C9] px-4 py-1 text-2xl">
        🏎️ <b>{KART_TRACK_NAME}</b> {KART_LAPS}바퀴
      </p>
      {number <= 3 ? (
        <p key={number} className="pop-in text-8xl font-bold drop-shadow-[4px_4px_0_#fff]">
          {number}
        </p>
      ) : (
        <p className="text-3xl font-bold">준비…</p>
      )}
      <p className="sketch bg-white px-3 text-xl">💡 출발 직전(1초 안)에 엑셀을 밟으면 로켓 스타트!</p>
    </div>
  )
}

function ClosingCountdown({ match, myId }: { match: GameInfo; myId: number | null }) {
  if (match.closingAt === undefined) return null
  const left = Math.max(0, Math.ceil((match.closingAt - performance.now()) / 1000))
  const first = match.finishes.find((finish) => finish.rank === 1)
  const winner = first ? (first.id === myId ? '내가' : `${nicknameOf(first.id)}님이`) : '1등이'
  return (
    <div className="pointer-events-none absolute inset-x-0 top-40 flex flex-col items-center gap-1">
      <p className="sketch bg-[#FFF6C9] px-4 py-1 text-2xl font-bold">🏁 {winner} 1등으로 들어왔어요!</p>
      {kart.phase !== 'finished' && <p className={`sketch bg-white px-3 text-xl ${left <= 5 ? 'text-accent' : ''}`}>{left}초 안에 들어오지 못하면 끝나요!</p>}
    </div>
  )
}

/** 속도계와 드리프트 터보 게이지 */
function SpeedPanel() {
  const now = performance.now()
  const level = driftLevel(kart.driftCharge)
  const speed = Math.max(0, kart.speed)
  const boosting = now < kart.boostUntil
  return (
    <div className="absolute inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col items-center gap-1 max-sm:bottom-36">
      {kart.wrongWay && <p className="sketch pop-in bg-accent px-4 py-1 text-3xl font-bold text-white">↩️ 반대 방향이에요!</p>}
      {kart.driftDir !== 0 && (
        <p className="sketch flex items-center gap-2 px-3 py-1 text-xl font-bold">
          드리프트
          {[1, 2, 3].map((step) => (
            <span key={step} className="inline-block size-5 rounded-full border-2 border-ink" style={{ background: level >= step ? DRIFT_COLORS[step] : '#fff' }} />
          ))}
          <span className="text-base font-normal text-pencil">놓으면 터보!</span>
        </p>
      )}
      {boosting && <p className="sketch bg-accent-soft px-4 py-1 text-2xl font-bold">🔥 터보!</p>}
      {kart.onGrass && !boosting && <p className="sketch bg-[#E3F5E9] px-3 text-lg">🌱 잔디에서는 느려져요</p>}
      <div className="sketch flex items-center gap-2 px-3 py-1">
        <span className="w-20 text-right text-3xl font-bold tabular-nums">{Math.round(speed * 4)}</span>
        <span className="text-base">km/h</span>
        <div className="h-3 w-40 overflow-hidden rounded-full border-2 border-ink bg-white max-sm:w-24">
          <div className={`h-full ${boosting ? 'bg-accent' : 'bg-[#2F7DF6]'}`} style={{ width: `${Math.min(1, speed / (KART_MAX_SPEED * 1.4)) * 100}%` }} />
        </div>
      </div>
      <p className="rounded-full bg-white/80 px-3 text-base text-pencil max-sm:hidden">W/↑ 엑셀 · S/↓ 브레이크 · A D 핸들 · 스페이스 누른 채 꺾기 = 드리프트(놓으면 터보) · E 아이템</p>
    </div>
  )
}

function ItemSlot() {
  const info = kart.item ? KART_ITEM_INFO[kart.item] : null
  return (
    <div className="flex items-center gap-2">
      <div className={`sketch flex min-h-16 min-w-16 flex-col items-center justify-center px-1 ${info ? 'pop-in bg-[#FFF6C9]' : ''}`} key={`${kart.item}-${kart.itemUses}`} title={info?.help}>
        <span className="text-3xl leading-none">{info ? (kart.item === 'triple' ? '🚀'.repeat(kart.itemUses) : info.icon) : '🎁'}</span>
        <span className="text-xs">{info ? 'E로 사용' : '빈 칸'}</span>
      </div>
      {info && (
        <div className="leading-tight">
          <b className="text-lg">{info.name}</b>
          <p className="text-sm">{info.help}</p>
        </div>
      )}
    </div>
  )
}

function Results({ rows, myId }: { rows: ResultRow[]; myId: number | null }) {
  const medal = ['🥇', '🥈', '🥉']
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-ink/30 p-4">
      <section className="sketch pop-in flex w-full max-w-md flex-col gap-3 p-5" aria-label="카트 레이스 결과">
        <h2 className="text-center text-4xl font-bold">🏁 {KART_TRACK_NAME} 결과</h2>
        <ol className="flex flex-col gap-1">
          {rows.map((row) => (
            <li key={row.id} className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1 text-xl ${row.id === myId ? 'border-ink bg-accent-soft' : 'border-transparent'}`}>
              <span className="w-8 text-center">{row.rank ? (medal[row.rank - 1] ?? `${row.rank}`) : '-'}</span>
              <span className="inline-block size-4 rounded-full border-2 border-ink" style={{ background: row.color }} />
              <span className="flex-1 truncate">{row.nickname}</span>
              <span className={`text-lg ${row.ms === null ? 'text-pencil' : ''}`}>{row.ms === null ? '완주 못 함' : formatMs(row.ms)}</span>
            </li>
          ))}
        </ol>
        {kart.lapTimes.length > 0 && (
          <p className="text-center text-lg">
            내 바퀴 기록: {kart.lapTimes.map((ms, index) => `${index + 1}바퀴 ${formatMs(ms)}`).join(' · ')}
          </p>
        )}
        <div className="flex flex-col items-center gap-1 rounded-xl bg-accent-soft px-3 py-2">
          <p className="text-center text-lg">레이스는 끝! 내일 아침은 도착해야 꺼지는 {BRAND.name} 알람으로 시작해 보세요.</p>
          <StoreLinks compact />
        </div>
        <button type="button" className="sketch-button bg-accent py-2 text-2xl text-white" onClick={() => connection.leaveGame()}>
          광장으로 돌아가기
        </button>
      </section>
    </div>
  )
}

export function KartHud({ state, match, entrants }: { state: ConnectionState; match: GameInfo; entrants: PlayerInfo[] }) {
  useTick(100)
  const t = kartSeconds()
  const now = performance.now()
  const lap = Math.min(KART_LAPS, kart.tracker.laps + 1)
  const myRank = match.finishes.find((finish) => finish.id === state.myId)?.rank ?? null
  const racing = kart.phase === 'racing'

  return (
    <div className="pointer-events-none absolute inset-0 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      {now < kart.boostUntil && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="speed-lines absolute inset-[-20%] rotate-90 opacity-30" />
        </div>
      )}
      {!state.results && <ClosingCountdown match={match} myId={state.myId} />}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <div className="sketch flex items-center gap-3 px-3 py-1">
            <RingoutLogo className="size-10 max-sm:size-8" />
            <div className="leading-tight">
              <p className="text-3xl font-bold tabular-nums max-sm:text-2xl">
                {lap}/{KART_LAPS} <span className="text-lg">바퀴</span>
              </p>
              <p className="text-lg tabular-nums">{formatMs(Math.max(0, (kart.phase === 'finished' ? kart.finishedAt : now) - kart.startAt))}</p>
            </div>
          </div>
          {kart.lapTimes.length > 0 && (
            <ol className="sketch px-2 text-base tabular-nums max-sm:hidden">
              {kart.lapTimes.map((ms, index) => (
                <li key={index}>
                  {index + 1}바퀴 {formatMs(ms)}
                </li>
              ))}
            </ol>
          )}
          {racing && <ItemSlot />}
        </div>
        <div className="flex flex-col items-center gap-1">
          {racing && kart.total > 1 && (
            <p key={kart.rank} className="sketch pop-in px-4 text-5xl font-bold max-sm:text-3xl">
              {kart.rank === 1 ? '👑 ' : ''}
              {kart.rank}
              <span className="text-2xl">/{kart.total}등</span>
            </p>
          )}
          {racing && kart.tracker.laps === KART_LAPS - 1 && <p className="sketch bg-[#FFF6C9] px-3 text-xl font-bold">🔔 마지막 바퀴</p>}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <MuteButton />
            <button
              type="button"
              className="sketch-button pointer-events-auto bg-white px-3 py-1 text-lg"
              onClick={() => {
                connection.send({ t: 'leave' })
                connection.leaveGame()
              }}
            >
              나가기
            </button>
          </div>
          <MiniMap entrants={entrants} myId={state.myId} />
        </div>
      </div>

      <div className="absolute inset-x-0 top-1/4 flex justify-center px-4">
        {kart.phase === 'countdown' || t < 1 ? (
          <Countdown t={t} />
        ) : kart.phase === 'finished' ? (
          <div className="sketch pop-in flex flex-col items-center px-6 py-3 text-center">
            <p className="text-4xl font-bold">{myRank ? `🏁 ${myRank}등으로 완주!` : '🏁 완주!'}</p>
            <p className="text-2xl tabular-nums">{formatMs(kart.finishedAt - kart.startAt)}</p>
            <p className="text-lg text-pencil">다른 사람들을 기다리는 중…</p>
          </div>
        ) : null}
      </div>

      <div className="absolute inset-x-0 bottom-[34%] flex flex-col items-center gap-1">
        {run.toasts
          .filter((item) => now - item.at < 1800)
          .map((item) => (
            <p key={item.key} className={`toast sketch px-3 py-1 text-xl ${item.tone === 'bad' ? 'bg-accent-soft' : item.tone === 'good' ? 'bg-green-100' : 'bg-[#FFF6C9]'}`}>
              {item.text}
            </p>
          ))}
      </div>

      <div className="absolute bottom-24 left-4 max-sm:hidden">
        <ChatBox chats={state.chats} enabled={state.status === 'online'} />
      </div>

      {racing && <SpeedPanel />}
      {racing && (
        <div className="pointer-events-auto">
          <TouchControls actionLabel="드리프트" punch={false} item={kart.item ? KART_ITEM_INFO[kart.item].icon.slice(0, 2) : null} />
        </div>
      )}
      {state.results && <Results rows={state.results} myId={state.myId} />}
    </div>
  )
}
