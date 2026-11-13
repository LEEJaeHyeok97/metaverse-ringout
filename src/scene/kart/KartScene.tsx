import { kart } from '../../game/kartRun'
import type { PlayerInfo } from '../../net/protocol'
import { Lights } from '../common'
import { RemotePlayers } from '../Players'
import { KartDriver } from './KartDriver'
import { KartTrack } from './KartTrack'

/** 카트 레이스 화면: 이번 판의 트랙과 내 카트, 다른 사람의 카트 */
export function KartScene({ me, players }: { me: PlayerInfo | null; players: PlayerInfo[] }) {
  const track = kart.track
  const sky = track.theme.sky
  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, track.theme.scenery === 'space' ? 120 : 80, track.theme.scenery === 'space' ? 320 : 220]} />
      <Lights />
      <KartTrack track={track} />
      <KartDriver me={me} />
      <RemotePlayers players={players} myId={me?.id ?? null} />
    </>
  )
}
