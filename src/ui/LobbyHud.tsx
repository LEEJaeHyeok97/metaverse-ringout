import { useState, type FormEvent } from 'react'
import { BRAND } from '../lib/brand'
import { MAX_ROOM_PLAYERS } from '../game/course'
import { INTRO_BOARDS } from '../data/ringout'
import { connection, type ConnectionState } from '../net/connection'
import { RingoutLogo } from './art/RingoutLogo'
import { ChatBox } from './ChatBox'
import { MuteButton } from './MuteButton'
import { TouchControls } from './TouchJoystick'
import { useTick } from './useTick'

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

function Countdown({ departAt }: { departAt: number }) {
  useTick(100)
  const left = Math.max(0, Math.ceil((departAt - performance.now()) / 1000))
  return <p className="pop-in text-center text-2xl font-bold text-accent">{left}초 뒤 각자 집에서 눈을 떠요!</p>
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
            <Countdown departAt={state.departAt} />
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
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          <h1 className="sketch flex items-center gap-2 px-3 py-1 text-3xl font-bold">
            <RingoutLogo className="size-9" />
            <span>
              <span className="text-accent">{BRAND.name}</span> 월드
            </span>
          </h1>
          <StatusPill state={state} />
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button type="button" className="sketch-button pointer-events-auto bg-white px-3 py-1 text-lg" onClick={onOpenGarden}>
              🌱 나의 나무
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
        WASD 이동 · 스페이스 점프/보기 · F 때리기 · 엔터 채팅
      </p>
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
