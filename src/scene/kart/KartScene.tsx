import type { PlayerInfo } from '../../net/protocol'
import { Lights } from '../common'
import { RemotePlayers } from '../Players'
import { KartDriver } from './KartDriver'
import { KartTrack } from './KartTrack'

const SKY = '#EAF4FB'

/** 카트 레이스 화면: 링아웃 서킷과 내 카트, 다른 사람의 카트 */
export function KartScene({ me, players }: { me: PlayerInfo | null; players: PlayerInfo[] }) {
  return (
    <>
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 80, 220]} />
      <Lights />
      <KartTrack />
      <KartDriver me={me} />
      <RemotePlayers players={players} myId={me?.id ?? null} />
    </>
  )
}
