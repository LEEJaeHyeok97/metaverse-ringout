import { useState, type FormEvent } from 'react'
import { BRAND } from '../lib/brand'
import { mapById, MAX_ROOM_PLAYERS } from '../game/course'
import { INTRO_BOARDS } from '../data/ringout'
import { plantableCount, useGarden } from '../data/garden'
import { connection, type ConnectionState } from '../net/connection'
import { RingoutLogo } from './art/RingoutLogo'
import { ChatBox } from './ChatBox'
import { StoreLinks } from './StoreLinks'
import { MuteButton } from './MuteButton'
import { TouchControls } from './TouchJoystick'
import { useTick } from './useTick'
import { rlSelf } from '../scene/RedLight'
import { RL_FIELD, RL_GRACE_MS, RL_SYLLABLES } from '../game/redlight'
import { self } from '../scene/input'

/** 무궁화 놀이터에 들어가 있을 때 화면 위에 지금 움직여도 되는지 크게 알려 준다. 맞으면 화면이 빨갛게 번쩍인다. */
function RedLightBanner({ state }: { state: ConnectionState }) {
  useTick(80)
  const now = performance.now()
  const light = state.redLight
  const out = now - rlSelf.outAt < 900
  const RED = { background: '#F0473C', color: '#ffffff' }
  let banner: { text: string; style: { background: string; color: string }; pulse?: boolean } | null = null
  if (now - rlSelf.winAt < 2500) banner = { text: '🎉 통과! 무궁화 꽃이 피었습니다 클리어', style: { background: '#FFF6C9', color: '#EA6E3E' } }
  else if (now - rlSelf.outAt < 2200) banner = { text: '💥 탈락! 출발선으로 돌아가요', style: RED }
  else if (rlSelf.playing && light) {
    if (light.phase === 'look') banner = rlSelf.shielded ? { text: '🙈 앞사람 뒤에 숨었어요 · 움직여도 OK', style: { background: '#E3F5E9', color: '#2B2B2B' } } : { text: now - light.at < RL_GRACE_MS ? '🚨 멈춰!!' : '🚨 멈춰!! 움직이면 탈락', style: RED, pulse: true }
    else if (light.phase === 'turn') banner = { text: '😶 아직 멈춰… 다시 볼지도?', style: { background: '#ffffff', color: '#2B2B2B' } }
    else {
      const said = RL_SYLLABLES.slice(0, light.beats.filter((beat) => now - light.at >= beat).length).join('')
      banner = { text: `🌺 ${said || '…'} · 지금 달려!`, style: { background: '#FFF0F6', color: '#D93D82' } }
    }
  } else if (light && Math.abs(self.x) < RL_FIELD.half + 2 && self.z > RL_FIELD.startZ && self.z < RL_FIELD.startZ + 6) {
    banner = { text: '🌺 무궁화 꽃이 피었습니다 · 출발선을 넘으면 시작!', style: { background: '#ffffff', color: '#D93D82' } }
  }
  return (
    <>
      {out && <div key={rlSelf.outAt} className="screen-flash pointer-events-none fixed inset-0" style={{ background: 'rgb(240 71 60 / 0.45)' }} />}
      {banner && (
        <div className="pointer-events-none absolute bottom-14 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 max-sm:top-28 max-sm:bottom-auto">
          <p className={`sketch px-5 py-2 text-3xl font-bold whitespace-nowrap max-sm:text-xl ${banner.pulse ? 'animate-pulse' : ''}`} style={banner.style}>
            {banner.text}
          </p>
          {light && (rlSelf.playing || banner.style.color === '#D93D82') && <p className="rounded-full bg-white/85 px-3 text-lg">이번 박자: {light.pattern}</p>}
        </div>
      )}
    </>
  )
}

function StatusPill({ state }: { state: ConnectionState }) {
  const text = {
    connecting: '서버에 연결 중…',
    online: `광장에 ${state.lobby.length}명`,
    offline: '서버와 끊겼어요. 다시 연결하는 중…',
    full: '광장이 가득 찼어요. 잠시 후 새로고침해 주세요',
  }[state.status]
  return (
    <span className="sketch px-3 py-1 text-lg">
      <span className={`mr-1 inline-block size-2.5 rounded-full ${state.status === 'online' ? 'bg-green-500' : 'bg-pencil'}`} />
      {text}
    </span>
  )
}

function Countdown({ departAt, mapId }: { departAt: number; mapId: string | null }) {
  useTick(100)
  const left = Math.max(0, Math.ceil((departAt - performance.now()) / 1000))
  const map = mapId ? mapById(mapId) : null
  return (
    <div className="pop-in flex flex-col items-center gap-1 text-center">
      {map && (
        <p className="sketch bg-[#FFF6C9] px-3 py-1 text-xl">
          🎲 이번 맵: <b>{map.emoji} {map.name}</b>
        </p>
      )}
      <p className="text-2xl font-bold text-accent">{left}초 뒤 각자 집에서 눈을 떠요!</p>
    </div>
  )
}

function RoomPanel({ state, onClose }: { state: ConnectionState; onClose: () => void }) {
  const [code, setCode] = useState('')
  const room = state.room
  const online = state.status === 'online'
  const join = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim()) connection.send({ t: 'join', code: code.trim() })
  }

  return (
    <section className="sketch pointer-events-auto pop-in flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4" aria-label="출근 대기실">
      <header className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🏃 출근 대기실</h2>
        {!room && (
          <button type="button" className="text-2xl leading-none" aria-label="닫기" onClick={onClose}>
            ✕
          </button>
        )}
      </header>
      {state.error && (
        <p role="alert" className="rounded-lg bg-accent-soft px-2 py-1 text-lg">
          {state.error}
        </p>
      )}
      {!room ? (
        <>
          <p className="text-lg leading-snug">
            최대 {MAX_ROOM_PLAYERS}명이 각자 집에서 {BRAND.name} 알람을 듣고 일어나, 우테코 캠퍼스까지 누가 먼저 도착하는지 겨뤄요.
          </p>
          <button type="button" disabled={!online} className="sketch-button bg-accent py-2 text-2xl text-white" onClick={() => connection.send({ t: 'quick' })}>
            빠른 참가
          </button>
          <button type="button" disabled={!online} className="sketch-button bg-white py-2 text-xl" onClick={() => connection.send({ t: 'create' })}>
            친구랑 할 방 만들기
          </button>
          <form onSubmit={join} className="flex gap-2">
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                connection.clearError()
              }}
              maxLength={4}
              placeholder="방 코드"
              aria-label="방 코드"
              className="w-0 flex-1 rounded-xl border-[2.5px] border-ink bg-white px-3 text-xl tracking-widest uppercase outline-none focus:border-accent"
            />
            <button type="submit" disabled={!online || code.trim().length < 4} className="sketch-button bg-white px-4 py-1 text-xl">
              입장
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="text-lg">
            방 코드 <b className="rounded bg-accent-soft px-2 text-2xl tracking-widest">{room.code}</b> 친구에게 알려 주세요
          </p>
          <ol className="flex flex-col gap-1">
            {Array.from({ length: MAX_ROOM_PLAYERS }, (_, index) => {
              const member = room.members[index]
              return (
                <li key={index} className="flex items-center gap-2 rounded-lg border-2 border-dashed border-pencil px-2 py-1 text-xl" style={member ? { borderStyle: 'solid', borderColor: member.color } : undefined}>
                  <span className="inline-block size-4 rounded-full border-2 border-ink" style={{ background: member?.color ?? 'transparent' }} />
                  {member ? (
                    <>
                      {member.nickname}
                      {member.id === state.myId && ' (나)'}
                      {member.id === room.hostId && <span className="ml-auto text-base">👑 방장</span>}
                    </>
                  ) : (
                    <span className="text-pencil">기다리는 중…</span>
                  )}
                </li>
              )
            })}
          </ol>
          {state.departAt ? (
            <Countdown departAt={state.departAt} mapId={state.nextMap} />
          ) : (
            <>
              <p className="text-center text-lg text-pencil">{MAX_ROOM_PLAYERS}명이 모이면 자동으로 출발해요</p>
              {room.hostId === state.myId && (
                <button type="button" className="sketch-button bg-accent py-2 text-2xl text-white" onClick={() => connection.send({ t: 'start' })}>
                  지금 출발 ({room.members.length}명)
                </button>
              )}
              <button type="button" className="sketch-button bg-white py-1 text-xl" onClick={() => connection.send({ t: 'leave' })}>
                방 나가기
              </button>
            </>
          )}
        </>
      )}
    </section>
  )
}

type LobbyHudProps = {
  state: ConnectionState
  panelOpen: boolean
  onOpenPanel: () => void
  onClosePanel: () => void
  nearInfo: number | null
  infoOpen: boolean
  onOpenGarden: () => void
}

export function LobbyHud({ state, panelOpen, onOpenPanel, onClosePanel, nearInfo, infoOpen, onOpenGarden }: LobbyHudProps) {
  const showPanel = panelOpen || state.room !== null
  const plantable = plantableCount(useGarden())
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <RedLightBanner state={state} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <h1 className="sketch flex items-center gap-2 px-3 py-1 text-3xl font-bold">
            <RingoutLogo className="size-9" />
            <span>
              <span className="text-accent">{BRAND.name}</span> 월드
            </span>
          </h1>
          <StatusPill state={state} />
          <div className="pointer-events-auto max-sm:hidden">
            <StoreLinks compact />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button type="button" className={`sketch-button pointer-events-auto px-3 py-1 text-lg ${plantable > 0 ? 'bg-[#E3F5E9]' : 'bg-white'}`} onClick={onOpenGarden}>
              {plantable > 0 ? `🌳 심을 나무 ${plantable}` : '🌱 나의 나무'}
            </button>
            <MuteButton />
          </div>
          {!showPanel && (
            <button type="button" className="sketch-button pointer-events-auto bg-accent px-4 py-2 text-2xl text-white" onClick={onOpenPanel}>
              🏃 출근 레이스
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2 max-sm:mb-32">
        <div className={`max-sm:order-2 ${showPanel ? 'max-sm:hidden' : ''}`}>
          <ChatBox chats={state.chats} enabled={state.status === 'online'} />
        </div>
        {showPanel && <RoomPanel state={state} onClose={onClosePanel} />}
      </div>
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/80 px-3 text-base whitespace-nowrap text-pencil max-sm:hidden">
        WASD 이동 · 스페이스 점프(2단)/보기 · F 때리기 · G 발차기 · 엔터 채팅
      </p>
      {plantable > 0 && nearInfo === null && !infoOpen && !showPanel && (
        <p className="sketch pop-in absolute bottom-40 left-1/2 -translate-x-1/2 bg-[#E3F5E9] px-4 py-1 text-xl whitespace-nowrap max-sm:bottom-52 max-sm:text-base">
          🌳 다 자란 나무가 있어요! 발판 왼쪽 <b>함께 정원</b>의 빈 타일을 눌러 심어요
        </p>
      )}
      {nearInfo !== null && !infoOpen && (
        <p className="sketch pop-in absolute bottom-28 left-1/2 -translate-x-1/2 bg-accent-soft px-4 py-1 text-xl whitespace-nowrap max-sm:bottom-40">
          🔍 <b>스페이스</b>로 「{INTRO_BOARDS[nearInfo]?.title ?? '링아웃 알람'}」 자세히 보기
        </p>
      )}
      {/* 휴대폰에서 방 패널을 열면 조이스틱이 버튼을 가리므로 잠시 숨긴다. */}
      {!showPanel && !infoOpen && (
        <div className="pointer-events-auto">
          <TouchControls actionLabel={nearInfo !== null ? '보기' : '점프'} />
        </div>
      )}
    </div>
  )
}
