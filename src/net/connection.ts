import { useSyncExternalStore } from 'react'
import { recordPlanted } from '../data/garden'
import type { ClientMessage, PlayerInfo, ResultRow, RoomView, ServerMessage, SharedTree } from './protocol'

const RETRY_MS = 2000
const CLOSE_FULL = 4001
const MAX_CHATS = 30
const BUBBLE_MS = 4500

export type Status = 'connecting' | 'online' | 'offline' | 'full'

export type ChatLine = { key: number; id: number; nickname: string; text: string; at: number }

/** 시작 시각은 받은 순간의 내 시계(performance.now) 기준으로 바꿔 둔다. */
export type GameInfo = { startAt: number; lanes: Record<number, number>; finishes: { id: number; ms: number; rank: number }[] }

export type ConnectionState = {
  status: Status
  myId: number | null
  lobby: PlayerInfo[]
  game: PlayerInfo[]
  room: RoomView | null
  /** 방이 모여 집으로 출발하기 직전의 카운트다운이 끝나는 시각 */
  departAt: number | null
  match: GameInfo | null
  results: ResultRow[] | null
  chats: ChatLine[]
  error: string | null
  /** 따릉이 번호 → 탄 사람 */
  bikes: Record<number, number>
  bananas: { id: number; x: number; z: number; owner: number }[]
  garden: GardenTreeView[]
}

/** 함께 정원의 나무. plantedAt은 이 화면에서 심는 장면을 본 시각(내 시계)이고, 접속 전에 심긴 나무는 0이다. */
export type GardenTreeView = SharedTree & { plantedAt: number }

/** 맞거나 아이템에 당한 일. 3D 화면이 효과와 기절을 그리는 데 쓴다. */
export type HitEvent = { from: number; to: number; at: number; kind: 'punch' | 'balloon' | 'ufo' | 'warp' }

/** 다른 사람의 위치. 스냅샷이 올 때마다 목표값만 바꾸고 화면은 매 프레임 따라간다. */
export type RemoteState = { x: number; y: number; z: number; h: number; a: number; seenAt: number }

function serverUrl() {
  const configured = import.meta.env.VITE_REALTIME_URL as string | undefined
  if (configured) return configured
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
}

function createConnection() {
  let state: ConnectionState = {
    status: 'connecting',
    myId: null,
    lobby: [],
    game: [],
    room: null,
    departAt: null,
    match: null,
    results: null,
    chats: [],
    error: null,
    bikes: {},
    bananas: [],
    garden: [],
  }
  const listeners = new Set<() => void>()
  const positions = new Map<number, RemoteState>()
  const bubbles = new Map<number, { text: string; until: number }>()
  /** 최근에 맞은 일. 3D 화면이 "퍽!" 효과와 기절을 그리는 데 쓴다. */
  const punches: HitEvent[] = []
  const punchListeners = new Set<(hit: HitEvent) => void>()
  const emitHit = (hit: HitEvent) => {
    punches.push(hit)
    if (punches.length > 20) punches.shift()
    for (const listener of punchListeners) listener(hit)
  }
  const plantListeners = new Set<(tile: number) => void>()
  let socket: WebSocket | null = null
  let hello: { nickname: string; color: string } | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let chatKey = 0

  const set = (patch: Partial<ConnectionState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  const send = (message: ClientMessage) => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
  }

  const handle = (message: ServerMessage) => {
    switch (message.t) {
      case 'welcome':
        set({ myId: message.id, status: 'online' })
        return
      case 'roster': {
        const ids = new Set(message.players.map((player) => player.id))
        for (const id of positions.keys()) if (!ids.has(id)) positions.delete(id)
        set(message.channel === 'lobby' ? { lobby: message.players } : { game: message.players })
        return
      }
      case 'snap': {
        const now = performance.now()
        for (const [id, x, y, z, h, a] of message.p) {
          if (id === state.myId) continue
          const known = positions.get(id)
          if (known) Object.assign(known, { x, y, z, h, a, seenAt: now })
          else positions.set(id, { x, y, z, h, a, seenAt: now })
        }
        return
      }
      case 'room':
        set({ room: message.room, departAt: message.room?.phase === 'countdown' ? state.departAt : null })
        return
      case 'countdown':
        set({ departAt: performance.now() + message.startIn })
        return
      case 'start':
        positions.clear()
        set({ match: { startAt: performance.now() + message.startIn, lanes: message.lanes, finishes: [] }, results: null, departAt: null, bikes: {}, bananas: [] })
        return
      case 'finished':
        if (state.match) set({ match: { ...state.match, finishes: [...state.match.finishes, { id: message.id, ms: message.ms, rank: message.rank }] } })
        return
      case 'results':
        set({ results: message.rows })
        return
      case 'chat': {
        const line: ChatLine = { key: chatKey++, id: message.id, nickname: message.nickname, text: message.text, at: Date.now() }
        bubbles.set(message.id, { text: message.text, until: performance.now() + BUBBLE_MS })
        set({ chats: [...state.chats, line].slice(-MAX_CHATS) })
        return
      }
      case 'error':
        set({ error: message.message })
        return
      case 'punched':
        emitHit({ from: message.from, to: message.to, at: performance.now(), kind: 'punch' })
        return
      case 'trapped':
        emitHit({ from: message.from, to: message.to, at: performance.now(), kind: message.kind })
        return
      case 'bananas':
        set({ bananas: message.list })
        return
      case 'bikes':
        set({ bikes: message.taken })
        return
      case 'garden': {
        const known = new Map(state.garden.map((tree) => [tree.tile, tree]))
        const garden = message.trees.map((tree) => {
          const before = known.get(tree.tile)
          if (before && before.at === tree.at) return before
          return { ...tree, plantedAt: message.planted?.tile === tree.tile ? Date.now() : 0 }
        })
        set({ garden })
        if (message.planted && message.planted.by === state.myId) {
          recordPlanted()
          for (const listener of plantListeners) listener(message.planted.tile)
        }
        return
      }
    }
  }

  const connect = () => {
    if (socket) return
    set({ status: 'connecting' })
    const next = new WebSocket(serverUrl())
    socket = next
    next.onopen = () => {
      if (hello) send({ t: 'hello', ...hello })
    }
    next.onmessage = (event) => {
      try {
        handle(JSON.parse(event.data as string) as ServerMessage)
      } catch {
        // 알 수 없는 메시지는 버린다.
      }
    }
    next.onclose = (event) => {
      socket = null
      positions.clear()
      // 접속이 끊기면 방과 게임도 사라진다. 서버에 붙지 못해도 광장은 혼자 돌아다닐 수 있다.
      set({ status: event.code === CLOSE_FULL ? 'full' : 'offline', myId: null, room: null, match: null, lobby: [], game: [], departAt: null })
      if (event.code !== CLOSE_FULL) retryTimer = setTimeout(connect, RETRY_MS)
    }
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getState: () => state,
    positions,
    bubbles,
    punches,
    /** 맞은 순간 바로 기절시키려고 프레임을 기다리지 않고 알려 준다. */
    onPunch(listener: (hit: HitEvent) => void) {
      punchListeners.add(listener)
      return () => {
        punchListeners.delete(listener)
      }
    },
    /** 서버가 내 나무를 심어 주면 알려 준다. */
    onPlanted(listener: (tile: number) => void) {
      plantListeners.add(listener)
      return () => {
        plantListeners.delete(listener)
      }
    },
    start(nickname: string, color: string) {
      hello = { nickname, color }
      if (socket?.readyState === WebSocket.OPEN) send({ t: 'hello', ...hello })
      else connect()
    },
    send,
    clearError: () => set({ error: null }),
    /** 결과 화면을 닫고 광장으로 돌아간다. */
    leaveGame() {
      positions.clear()
      set({ match: null, results: null, game: [] })
      send({ t: 'lobby' })
    },
    stop() {
      if (retryTimer) clearTimeout(retryTimer)
      socket?.close()
    },
  }
}

export const connection = createConnection()

export function useConnection() {
  return useSyncExternalStore(connection.subscribe, connection.getState)
}

// 개발 서버에서만 브라우저 자동 점검이 접속 상태를 읽을 수 있게 열어 둔다.
if (import.meta.env.DEV) Object.assign(window, { __connection: connection })
