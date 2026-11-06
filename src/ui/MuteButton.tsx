import { useState } from 'react'
import { audio } from '../lib/audio'

export function MuteButton() {
  const [muted, setMuted] = useState(audio.isMuted())
  return (
    <button
      type="button"
      className="sketch-button pointer-events-auto bg-white px-3 py-1 text-lg"
      aria-pressed={muted}
      onClick={() => {
        audio.unlock()
        audio.setMuted(!muted)
        setMuted(!muted)
      }}
    >
      {muted ? '🔇 소리 꺼짐' : '🔔 소리 켜짐'}
    </button>
  )
}
