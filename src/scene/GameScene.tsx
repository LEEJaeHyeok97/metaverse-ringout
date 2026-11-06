import { useMemo } from 'react'
import { activeMap } from '../game/course'
import type { GameInfo } from '../net/connection'
import type { PlayerInfo } from '../net/protocol'
import { Lights } from './common'
import { Bananas, Coffees, ItemBoxes, ParkedBikes } from './game/Items'
import { Movers } from './game/Movers'
import { PunchEffects } from './PunchEffects'
import { Runner } from './game/Runner'
import { Weather } from './game/Weather'
import { World } from './game/World'
import { RemotePlayers } from './Players'

type GameSceneProps = {
  me: PlayerInfo | null
  match: GameInfo
  /** 게임을 함께 시작한 사람들. 중간에 나간 사람의 집도 이름은 남긴다. */
  entrants: PlayerInfo[]
  players: PlayerInfo[]
}

export function GameScene({ me, match, entrants, players }: GameSceneProps) {
  const owners = useMemo(() => {
    const byId = new Map(entrants.map((player) => [player.id, player]))
    const result = new Map<number, { nickname: string; color: string }>()
    for (const [id, lane] of Object.entries(match.lanes)) {
      const player = byId.get(Number(id))
      if (player) result.set(lane, player)
    }
    return result
  }, [entrants, match.lanes])

  return (
    <>
      <color attach="background" args={[activeMap.theme.paper]} />
      <fog attach="fog" args={[activeMap.theme.paper, 45, 95]} />
      <Lights />
      <World owners={owners} />
      <Weather kind={activeMap.theme.weather} />
      <Movers />
      <ParkedBikes />
      <Coffees />
      <ItemBoxes />
      <Bananas />
      <PunchEffects curved />
      <Runner me={me} />
      <RemotePlayers players={players} myId={me?.id ?? null} curved />
    </>
  )
}
