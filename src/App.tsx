import { useCallback, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { applyMap } from './game/course'
import { resetRun } from './game/run'
import { audio } from './lib/audio'
import { connection, useConnection, type GameInfo } from './net/connection'
import type { PlayerInfo } from './net/protocol'
import { GameScene } from './scene/GameScene'
import { bindKeyboard, setOverlayOpen } from './scene/input'
import { LobbyScene } from './scene/LobbyScene'
import { EntryScreen, type Profile } from './ui/EntryScreen'
import { GameHud } from './ui/GameHud'
import { InfoModal } from './ui/InfoModal'
import { GardenModal } from './ui/GardenModal'
import { LobbyHud } from './ui/LobbyHud'

function supportsWebGL() {
  try {
    return document.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}

export function App() {
  const [webgl] = useState(supportsWebGL)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [nearInfo, setNearInfo] = useState<number | null>(null)
  const [infoIndex, setInfoIndex] = useState<number | null>(null)
  const [gardenOpen, setGardenOpen] = useState(false)
  const openInfo = useCallback((index: number) => {
    setOverlayOpen(true)
    setInfoIndex(index)
  }, [])
  const closeInfo = useCallback(() => {
    setOverlayOpen(false)
    setInfoIndex(null)
  }, [])
  const openGarden = useCallback(() => {
    setOverlayOpen(true)
    setGardenOpen(true)
  }, [])
  const closeGarden = useCallback(() => {
    setOverlayOpen(false)
    setGardenOpen(false)
  }, [])
  const state = useConnection()
  // 집 배치와 진행 상태를 먼저 초기화한 뒤에 게임 화면을 띄운다.
  const [activeMatch, setActiveMatch] = useState<{ match: GameInfo; entrants: PlayerInfo[] } | null>(null)

  useEffect(() => bindKeyboard(), [])

  useEffect(() => {
    // 브라우저는 사용자가 누른 뒤에만 소리를 낼 수 있다.
    const unlock = () => audio.unlock()
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const startAt = state.match?.startAt ?? null
  useEffect(() => {
    if (startAt === null) {
      setActiveMatch(null)
      return
    }
    const match = connection.getState().match!
    const { myId, room } = connection.getState()
    // 게임 화면을 그리기 전에 이번 판의 맵으로 코스를 바꾼다.
    applyMap(match.map)
    resetRun(match.startAt, myId !== null ? (match.lanes[myId] ?? 2) : 2)
    setActiveMatch({ match, entrants: room?.members ?? [] })
    setPanelOpen(false)
    setOverlayOpen(false)
    setInfoIndex(null)
    setNearInfo(null)
  }, [startAt])

  const me = useMemo<PlayerInfo | null>(
    () => (profile ? { id: state.myId ?? -1, nickname: profile.nickname, color: profile.color } : null),
    [profile, state.myId],
  )

  if (!webgl) {
    return (
      <main className="notebook grid h-full place-items-center p-6 text-center text-2xl">
        이 브라우저에서는 3D 화면(WebGL2)을 쓸 수 없어요. 최신 Chrome, Safari, Edge에서 열어 주세요.
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="relative h-full w-full">
        <EntryScreen
          onEnter={(next) => {
            audio.unlock()
            setProfile(next)
            connection.start(next.nickname, next.color)
          }}
        />
      </main>
    )
  }

  const inGame = activeMatch !== null && state.match !== null
  const match = inGame ? { ...activeMatch.match, finishes: state.match!.finishes, closingAt: state.match!.closingAt } : null

  return (
    <main className="relative h-full w-full overflow-hidden">
      <Canvas flat camera={{ position: [0, 12, 26], fov: 50, near: 0.1, far: 600 }} dpr={[1, 2]}>
        {match && activeMatch ? (
          <GameScene key={match.startAt} me={me} match={match} entrants={activeMatch.entrants} players={state.game} />
        ) : (
          <LobbyScene me={me} players={state.lobby} onPadChange={(inside) => inside && setPanelOpen(true)} nearInfo={nearInfo} onNearInfo={setNearInfo} onOpenInfo={openInfo} />
        )}
      </Canvas>
      {match && activeMatch ? (
        <GameHud state={state} match={match} entrants={activeMatch.entrants} />
      ) : (
        <>
          <LobbyHud state={state} panelOpen={panelOpen} onOpenPanel={() => setPanelOpen(true)} onClosePanel={() => setPanelOpen(false)} nearInfo={nearInfo} infoOpen={infoIndex !== null || gardenOpen} onOpenGarden={openGarden} />
          {infoIndex !== null && <InfoModal index={infoIndex} onClose={closeInfo} />}
          {gardenOpen && <GardenModal onClose={closeGarden} />}
        </>
      )}
    </main>
  )
}
