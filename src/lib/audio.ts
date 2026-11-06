const MUTED_KEY = 'ringout-world.muted'
/**
 * src/assets/sounds/alarm.(mp3|ogg|wav|m4a)이 있으면 합성음 대신 재생한다.
 * 빌드할 때 파일이 있는지 정해지므로, 없으면 요청을 아예 보내지 않는다.
 */
const ALARM_FILES = Object.values(
  import.meta.glob<string>('../assets/sounds/alarm.{mp3,ogg,wav,m4a}', { eager: true, query: '?url', import: 'default' }),
)
const FADE_SECONDS = 0.25

function loadMuted() {
  try {
    return window.localStorage.getItem(MUTED_KEY) === '1'
  } catch {
    return false
  }
}

function saveMuted(muted: boolean) {
  try {
    window.localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  } catch {
    // 저장하지 못해도 이번 접속에는 그대로 적용된다.
  }
}

function frequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12)
}

export type EffectName = 'wake' | 'hit' | 'stumble' | 'whistle' | 'splash' | 'jump' | 'arrive' | 'late' | 'tick' | 'go' | 'pop'

/**
 * 음원 파일 없이 브라우저에서 바로 만드는 알람과 효과음. 소리는 사용자가 누른 뒤에만 시작할 수 있다.
 * 링아웃 알람 음원이 오면 alarm()만 파일 재생으로 바꾸면 된다.
 */
export function createAudio() {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let muted = loadMuted()
  let alarmBuffer: AudioBuffer | null = null
  let alarmLoading = false
  let alarmSource: AudioBufferSourceNode | null = null

  const loadAlarmFile = async () => {
    if (!context || alarmLoading) return
    alarmLoading = true
    for (const path of ALARM_FILES) {
      try {
        const response = await fetch(path)
        if (!response.ok) continue
        alarmBuffer = await context.decodeAudioData(await response.arrayBuffer())
        return
      } catch {
        // 다음 후보를 찾는다. 하나도 없으면 합성음을 쓴다.
      }
    }
  }

  const playAlarmFile = (seconds: number) => {
    if (!context || !master || !alarmBuffer) return false
    alarmSource?.stop()
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = alarmBuffer
    source.loop = alarmBuffer.duration < seconds
    const now = context.currentTime
    gain.gain.setValueAtTime(1, now)
    gain.gain.setValueAtTime(1, now + seconds - FADE_SECONDS)
    gain.gain.linearRampToValueAtTime(0.0001, now + seconds)
    source.connect(gain).connect(master)
    source.start(now)
    source.stop(now + seconds + 0.05)
    alarmSource = source
    return true
  }

  const tone = (type: OscillatorType, freq: number, at: number, length: number, volume: number, slideTo?: number) => {
    if (!context || !master) return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(freq, at)
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + length)
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
    oscillator.connect(gain).connect(master)
    oscillator.start(at)
    oscillator.stop(at + length + 0.02)
  }

  const notes = (list: number[], gap: number, length: number, volume: number, type: OscillatorType = 'square') => {
    if (!context) return
    const now = context.currentTime
    list.forEach((note, index) => tone(type, frequency(note), now + index * gap, length, volume))
  }

  return {
    /** 누르거나 키를 칠 때마다 불러 소리를 깨운다. */
    unlock() {
      if (!context) {
        const AudioContextClass = window.AudioContext
        if (!AudioContextClass) return
        context = new AudioContextClass()
        master = context.createGain()
        master.gain.value = muted ? 0 : 0.8
        master.connect(context.destination)
        void loadAlarmFile()
      }
      if (context.state === 'suspended') void context.resume()
    },
    /** 음원 파일이 있으면 그 소리를, 없으면 디지털 알람시계처럼 삐삐삐삐 하는 합성음을 낸다. */
    alarm(seconds = 2.5) {
      if (!context) return
      if (playAlarmFile(seconds)) return
      const now = context.currentTime
      const groups = Math.floor(seconds / 0.62)
      for (let group = 0; group < groups; group++) {
        for (let beep = 0; beep < 4; beep++) {
          const at = now + group * 0.62 + beep * 0.09
          tone('square', 1760, at, 0.06, 0.12)
          tone('square', 2637, at, 0.06, 0.04)
        }
      }
    },
    effect(name: EffectName) {
      if (!context) return
      const now = context.currentTime
      switch (name) {
        case 'wake':
          notes([72, 76, 79, 84], 0.07, 0.12, 0.1)
          break
        case 'hit':
          tone('sawtooth', 220, now, 0.35, 0.18, 60)
          break
        case 'stumble':
          tone('triangle', 520, now, 0.25, 0.15, 180)
          break
        case 'whistle':
          tone('sine', 2400, now, 0.18, 0.15)
          tone('sine', 2600, now + 0.22, 0.4, 0.15)
          break
        case 'splash':
          tone('triangle', 900, now, 0.2, 0.1, 300)
          break
        case 'jump':
          tone('square', 400, now, 0.12, 0.06, 800)
          break
        case 'arrive':
          notes([72, 76, 79, 84, 88, 91], 0.09, 0.2, 0.1)
          break
        case 'late':
          notes([67, 63, 60, 55], 0.14, 0.25, 0.1, 'triangle')
          break
        case 'tick':
          tone('square', 880, now, 0.08, 0.08)
          break
        case 'go':
          tone('square', 1320, now, 0.3, 0.1)
          break
        case 'pop':
          tone('square', 660, now, 0.06, 0.06, 990)
          break
      }
    },
    isMuted: () => muted,
    setMuted(next: boolean) {
      muted = next
      saveMuted(next)
      if (master) master.gain.value = next ? 0 : 0.8
    },
  }
}

export const audio = createAudio()
