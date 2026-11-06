import { TREE_ARRIVALS } from '../data/garden'
import { GAME_TIPS } from '../data/ringout'
import { ALARM_PERIOD, bedSpot, clockText, FINISH_Z, GAME_LIMIT_SECONDS, isRinging, ITEM_INFO, LATE_SECONDS, lightAt, LIGHT_ZONE, WAKE_PRESSES, zoneAt } from '../game/course'
import { gameSeconds, run, toast } from '../game/run'
import { BRAND } from '../lib/brand'
import { connection, type ConnectionState, type GameInfo } from '../net/connection'
import type { PlayerInfo, ResultRow } from '../net/protocol'
import { pressAction, setOverlayOpen } from '../scene/input'
import { RingoutApp } from './RingoutApp'
import { RingoutLogo } from './art/RingoutLogo'
import { SeedArt } from './art/SeedArt'
import { ChatBox } from './ChatBox'
import { MuteButton } from './MuteButton'
import { TouchControls } from './TouchJoystick'
import { useTick } from './useTick'

function formatMs(ms: number) {
  const seconds = ms / 1000
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
}

function arrivalLabel(ms: number | null) {
  if (ms === null) return { text: '결석', tone: 'text-pencil' }
  return ms / 1000 <= LATE_SECONDS ? { text: `${clockText(ms / 1000)} 정시 출근`, tone: 'text-green-600' } : { text: `${clockText(ms / 1000)} 지각`, tone: 'text-accent' }
}

/** 링아웃 알람 화면. 도착하기 전까지는 끌 수 없고 주기마다 다시 울린다. */
function AlarmCard({ t }: { t: number }) {
  const finished = run.phase === 'finished'
  const ringing = !finished && isRinging(t)
  const remain = Math.max(0, Math.round(run.z - FINISH_Z))
  const nextRing = Math.ceil(ALARM_PERIOD - (((t % ALARM_PERIOD) + ALARM_PERIOD) % ALARM_PERIOD))
  return (
    <div className="sketch flex w-56 items-center gap-3 px-3 py-2 max-sm:w-44">
      <span className={`shrink-0 ${ringing ? 'ringing' : ''}`}>
        {finished ? <SeedArt className="size-12" stage={run.reward?.stage ?? 'seed'} /> : <RingoutLogo className="size-12" />}
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-wider text-accent">{BRAND.english}</p>
        {finished ? (
          <p className="text-lg font-bold">도착! 알람 꺼짐</p>
        ) : (
          <>
            <p className="text-lg font-bold">📍 캠퍼스까지 {run.phase === 'running' ? `${remain}m` : '…'}</p>
            <p className="text-base">{t < 0 ? '곧 울려요' : ringing ? '따르르릉! 울리는 중' : `${nextRing}초 뒤 또 울려요`}</p>
          </>
        )}
      </div>
    </div>
  )
}

/** 무궁화 신호등 구역 근처에서는 신호를 크게 보여 준다. 3D 신호등은 멀리 있어 작게 보이기 때문이다. */
function LightSign({ t }: { t: number }) {
  if (run.phase !== 'running' || run.z > LIGHT_ZONE.from + 20 || run.z < LIGHT_ZONE.to) return null
  const light = lightAt(t)
  const text = { green: '🟢 초록불! 달려요', yellow: '🟡 곧 빨간불, 멈출 준비', red: '🔴 빨간불! 움직이면 처음으로' }[light]
  return <p className={`sketch px-3 text-2xl font-bold ${light === 'red' ? 'bg-accent-soft' : light === 'yellow' ? 'bg-[#FFF6C9]' : 'bg-green-100'}`}>{text}</p>
}

function Progress({ entrants, myId }: { entrants: PlayerInfo[]; myId: number | null }) {
  const start = bedSpot(0).z
  const span = start - FINISH_Z
  return (
    <div className="sketch flex h-64 w-14 flex-col items-center py-2 max-sm:h-44" aria-label="진행 상황">
      <span className="text-xl" aria-hidden="true">🏫</span>
      <div className="relative w-1 flex-1 rounded bg-ink/20">
        {entrants.map((player) => {
          const z = player.id === myId ? run.z : connection.positions.get(player.id)?.z
          if (z === undefined) return null
          const progress = Math.min(Math.max((start - z) / span, 0), 1)
          return (
            <span
              key={player.id}
              title={player.nickname}
              className="absolute left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-ink"
              style={{ bottom: `${progress * 100}%`, background: player.color, zIndex: player.id === myId ? 2 : 1 }}
            />
          )
        })}
      </div>
      <span className="text-xl" aria-hidden="true">🛏️</span>
    </div>
  )
}

function CenterMessage({ t, myRank }: { t: number; myRank: number | null }) {
  if (t < 0) {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-2xl">모두 각자의 방에서 쿨쿨…</p>
        <p key={Math.ceil(-t)} className="pop-in text-7xl font-bold">{Math.ceil(-t)}</p>
        <p className="text-xl">알람이 울리면 스페이스를 연타해서 일어나요!</p>
      </div>
    )
  }
  if (run.phase === 'sleeping') {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="ringing text-3xl font-bold text-accent">따르르릉! {BRAND.name} 알람!</p>
        <p className="text-xl">스페이스를 연타해서 일어나기</p>
        <div className="h-5 w-64 overflow-hidden rounded-full border-[2.5px] border-ink bg-white">
          <div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${(run.wake / WAKE_PRESSES) * 100}%` }} />
        </div>
        <button
          type="button"
          className="sketch-button pointer-events-auto hidden bg-accent px-8 py-4 text-3xl text-white pointer-coarse:block"
          onPointerDown={(event) => {
            event.preventDefault()
            pressAction()
          }}
        >
          일어나기!
        </button>
      </div>
    )
  }
  if (run.phase === 'finished') {
    const arrival = arrivalLabel(run.finishedAt - run.startAt)
    return (
      <div className="sketch pop-in flex flex-col items-center px-6 py-3 text-center">
        <p className="text-4xl font-bold">{myRank ? `${myRank}등 도착!` : '도착!'}</p>
        <p className={`text-2xl ${arrival.tone}`}>{arrival.text}</p>
        {run.reward && (
          <div className="my-1 flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-1">
            <SeedArt className="size-14" stage={run.reward.stage} />
            <div className="text-left leading-tight">
              <p className="text-lg font-bold">씨앗이 자라요! {run.reward.title}</p>
              <p className="text-base">{run.reward.next}</p>
            </div>
          </div>
        )}
        <p className="text-lg text-pencil">다른 사람들을 기다리는 중…</p>
      </div>
    )
  }
  return null
}

/** 링아웃 앱을 열고 닫는다. 목적지를 정해야 현관이 열린다. */
function AppGate() {
  if (!run.appOpen) return null
  return (
    <RingoutApp
      onDone={() => {
        run.appSet = true
        run.appOpen = false
        setOverlayOpen(false)
        toast('📱 링아웃 ON! 현관문이 열렸어요. 캠퍼스로 출발!', 'good')
      }}
      onCancel={() => {
        run.appOpen = false
        setOverlayOpen(false)
      }}
    />
  )
}

/** 지금 들고 있는 아이템과 방패, 부스터 상태 */
function ItemSlot() {
  const now = performance.now()
  const info = run.item ? ITEM_INFO[run.item] : null
  return (
    <div className="flex items-center gap-2">
      <div className={`sketch flex size-16 flex-col items-center justify-center ${info ? 'pop-in bg-[#FFF6C9]' : ''}`} key={run.item ?? 'empty'} title={info?.help}>
        <span className="text-3xl leading-none">{info?.icon ?? '🎁'}</span>
        <span className="text-xs">{info ? 'E로 사용' : '빈 칸'}</span>
      </div>
      <div className="flex flex-col gap-1 text-base leading-tight">
        {info && <b className="text-lg">{info.name}</b>}
        {now < run.shieldUntil && <span className="sketch bg-[#E3F0FF] px-2">🛡️ 방패 {Math.ceil((run.shieldUntil - now) / 1000)}초</span>}
        {now < run.boosterUntil && <span className="sketch bg-accent-soft px-2">🚀 부스터!</span>}
      </div>
    </div>
  )
}

/** 따릉이 안내와 남은 시간, 조작 안내 */
function ItemStatus() {
  const now = performance.now()
  const riding = now < run.rideUntil
  return (
    <div className="absolute inset-x-0 bottom-[22%] flex flex-col items-center gap-1">
      {!run.appSet && !run.appOpen && (
        <p className={`sketch px-4 py-1 text-2xl ${run.nearDesk ? 'pop-in bg-accent-soft' : 'bg-white'}`}>
          {run.nearDesk ? <>📱 <b>스페이스</b>로 휴대폰 들기</> : '📱 책상 위에서 울리는 휴대폰으로 가요'}
        </p>
      )}
      {run.nearBike !== null && <p className="sketch pop-in bg-[#E3F5E9] px-4 py-1 text-2xl">🚲 <b>스페이스</b>로 따릉이 타기</p>}
      {riding && <p className="sketch bg-[#E3F5E9] px-4 py-1 text-2xl font-bold">🚲 따릉이 {Math.ceil((run.rideUntil - now) / 1000)}초</p>}
      <p className="rounded-full bg-white/80 px-3 text-base text-pencil max-sm:hidden">WASD 이동 · 스페이스 점프/타기 · E 아이템 · F 때리기</p>
    </div>
  )
}

/** 알람 리워드: 도착할 때마다 씨앗이 자란다. */
export function RewardCard({ reward }: { reward: NonNullable<typeof run.reward> }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-gradient-to-b from-[#DCEBF3] to-paper px-3 py-2">
      <SeedArt className="size-20 shrink-0" stage={reward.stage} />
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-base text-pencil">{reward.title}</p>
        <p className="text-xl leading-tight font-bold">{reward.next}</p>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
            <div className="h-full bg-accent" style={{ width: `${(reward.progress / TREE_ARRIVALS) * 100}%` }} />
          </div>
          <span className="text-base tabular-nums">
            {reward.progress}/{TREE_ARRIVALS}
          </span>
        </div>
      </div>
    </div>
  )
}

function Results({ rows, myId }: { rows: ResultRow[]; myId: number | null }) {
  const medal = ['🥇', '🥈', '🥉']
  return (
    <div className="pointer-events-auto absolute inset-0 grid place-items-center bg-ink/30 p-4">
      <section className="sketch pop-in flex w-full max-w-md flex-col gap-3 p-5" aria-label="출근 결과">
        <h2 className="text-center text-4xl font-bold">오늘의 출근 기록</h2>
        <ol className="flex flex-col gap-1">
          {rows.map((row) => {
            const arrival = arrivalLabel(row.ms)
            return (
              <li key={row.id} className={`flex items-center gap-2 rounded-lg border-2 px-2 py-1 text-xl ${row.id === myId ? 'border-ink bg-accent-soft' : 'border-transparent'}`}>
                <span className="w-8 text-center">{row.rank ? (medal[row.rank - 1] ?? `${row.rank}`) : '-'}</span>
                <span className="inline-block size-4 rounded-full border-2 border-ink" style={{ background: row.color }} />
                <span className="flex-1 truncate">{row.nickname}</span>
                <span className={`text-lg ${arrival.tone}`}>{arrival.text}</span>
                {row.ms !== null && <span className="w-16 text-right text-base text-pencil">{formatMs(row.ms)}</span>}
              </li>
            )
          })}
        </ol>
        {run.reward ? <RewardCard reward={run.reward} /> : <p className="text-center text-lg">도착하면 씨앗을 받아 키울 수 있어요. 다음엔 꼭 도착해요!</p>}
        <p className="text-center text-lg">도착하는 순간 {BRAND.name} 알람이 꺼져요. 실제 출근길에도 써 보세요!</p>
        <button type="button" className="sketch-button bg-accent py-2 text-2xl text-white" onClick={() => connection.leaveGame()}>
          광장으로 돌아가기
        </button>
      </section>
    </div>
  )
}

export function GameHud({ state, match, entrants }: { state: ConnectionState; match: GameInfo; entrants: PlayerInfo[] }) {
  useTick(100)
  const t = gameSeconds()
  const late = t > LATE_SECONDS
  const zone = run.phase === 'running' ? zoneAt(run.z) : null
  const myRank = match.finishes.find((finish) => finish.id === state.myId)?.rank ?? null
  const left = Math.max(0, Math.ceil(GAME_LIMIT_SECONDS - t))
  const tip = GAME_TIPS[Math.floor(Math.max(t, 0) / 12) % GAME_TIPS.length]

  return (
    <div className="pointer-events-none absolute inset-0 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2">
          <AlarmCard t={t} />
          {run.phase === 'running' && <ItemSlot />}
        </div>
        <div className="flex flex-col items-center gap-1 max-sm:hidden">
          <p className={`sketch px-4 text-5xl font-bold tabular-nums ${late ? 'text-accent' : ''}`}>{clockText(t)}</p>
          <p className="text-lg">{late ? '지각이에요! 그래도 끝까지' : '09:00까지 도착하면 정시 출근'}</p>
          {zone && <p className="sketch bg-[#FFF6C9] px-3 text-xl">{zone.name}</p>}
          <LightSign t={t} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <MuteButton />
          <button
            type="button"
            className="sketch-button pointer-events-auto bg-white px-3 py-1 text-lg"
            onClick={() => {
              connection.send({ t: 'leave' })
              connection.leaveGame()
            }}
          >
            포기하고 나가기
          </button>
          <Progress entrants={entrants} myId={state.myId} />
          {t > 0 && run.phase !== 'finished' && <p className="sketch px-2 text-base">남은 시간 {left}초</p>}
        </div>
      </div>
      <p className={`sketch mx-auto mt-2 hidden w-fit px-3 text-3xl font-bold tabular-nums max-sm:block ${late ? 'text-accent' : ''}`}>{clockText(t)}</p>

      <div className="absolute inset-x-0 top-1/3 flex justify-center px-4">
        <CenterMessage t={t} myRank={myRank} />
      </div>

      <div className="absolute inset-x-0 bottom-[30%] flex flex-col items-center gap-1">
        {run.toasts
          .filter((item) => performance.now() - item.at < 1800)
          .map((item) => (
            <p key={item.key} className={`toast sketch px-3 py-1 text-xl ${item.tone === 'bad' ? 'bg-accent-soft' : item.tone === 'good' ? 'bg-green-100' : 'bg-[#FFF6C9]'}`}>
              {item.text}
            </p>
          ))}
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2 max-sm:hidden">
        <ChatBox chats={state.chats} enabled={state.status === 'online'} />
        {run.phase === 'running' && <p className="sketch max-w-sm px-3 py-1 text-base max-sm:hidden">💡 {tip}</p>}
      </div>

      {run.phase === 'running' && <ItemStatus />}
      {run.phase === 'running' && !run.appOpen && (
        <div className="pointer-events-auto">
          <TouchControls actionLabel={run.nearDesk ? '폰 들기' : run.nearBike !== null ? '타기' : '점프'} item={run.item ? ITEM_INFO[run.item].icon : null} />
        </div>
      )}
      <AppGate />
      {state.results && <Results rows={state.results} myId={state.myId} />}
    </div>
  )
}
