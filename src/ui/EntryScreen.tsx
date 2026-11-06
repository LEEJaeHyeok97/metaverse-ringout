import { useState, type FormEvent } from 'react'
import { BRAND } from '../lib/brand'
import { MAX_NICKNAME_LENGTH, PLAYER_COLORS } from '../net/protocol'
import { RingoutLogo } from './art/RingoutLogo'

const PROFILE_KEY = 'ringout-world.profile'

export type Profile = { nickname: string; color: string }

export function loadProfile(): Profile | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(PROFILE_KEY) ?? 'null')
    if (saved && typeof saved.nickname === 'string' && typeof saved.color === 'string') return saved
  } catch {
    // 저장된 값이 없거나 읽을 수 없으면 새로 고른다.
  }
  return null
}

function saveProfile(profile: Profile) {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  } catch {
    // 저장하지 못해도 이번 접속에는 그대로 쓴다.
  }
}

/** 졸라맨 미리보기. 목도리 색만 바뀐다. */
function StickPreview({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 100 140" className="h-36 w-28" aria-hidden="true">
      <g fill="none" stroke="#1A1A1A" strokeWidth="4.5" strokeLinecap="round">
        <circle cx="50" cy="30" r="18" fill="#fff" />
        <line x1="50" y1="48" x2="50" y2="92" />
        <line x1="50" y1="60" x2="28" y2="80" />
        <line x1="50" y1="60" x2="74" y2="44" />
        <line x1="50" y1="92" x2="34" y2="128" />
        <line x1="50" y1="92" x2="66" y2="128" />
      </g>
      <circle cx="44" cy="28" r="2.6" fill="#1A1A1A" />
      <circle cx="56" cy="28" r="2.6" fill="#1A1A1A" />
      <path d="M38 52 Q50 60 62 52 L62 58 Q50 66 38 58 Z" fill={color} stroke="#1A1A1A" strokeWidth="3" />
      <path d="M56 58 L64 74 L57 75 Z" fill={color} stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export function EntryScreen({ onEnter }: { onEnter: (profile: Profile) => void }) {
  const saved = loadProfile()
  const [nickname, setNickname] = useState(saved?.nickname ?? '')
  const [color, setColor] = useState(saved?.color ?? PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const profile = { nickname: nickname.trim() || '졸라맨', color }
    saveProfile(profile)
    onEnter(profile)
  }

  return (
    <div className="notebook absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <form onSubmit={submit} className="sketch pop-in flex w-full max-w-md flex-col items-center gap-4 p-6">
        <div className="flex flex-col items-center text-center">
          <RingoutLogo className="size-16" />
          <p className="text-lg text-pencil">{BRAND.slogan}</p>
          <h1 className="text-5xl font-bold">
            <span className="text-accent">{BRAND.name}</span> 월드
          </h1>
        </div>
        <StickPreview color={color} />
        <label className="flex w-full flex-col gap-1 text-xl">
          닉네임
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={MAX_NICKNAME_LENGTH}
            placeholder="졸라맨"
            autoFocus
            className="rounded-xl border-[2.5px] border-ink bg-white px-3 py-2 text-2xl outline-none focus:border-accent"
          />
        </label>
        <fieldset className="w-full">
          <legend className="mb-2 text-xl">목도리 색</legend>
          <div className="flex flex-wrap justify-center gap-2">
            {PLAYER_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`색 ${option}`}
                aria-pressed={option === color}
                onClick={() => setColor(option)}
                className="size-10 rounded-full border-[2.5px] border-ink aria-pressed:ring-4 aria-pressed:ring-ink/30"
                style={{ background: option }}
              />
            ))}
          </div>
        </fieldset>
        <button type="submit" className="sketch-button w-full bg-accent py-3 text-2xl text-white">
          광장으로 입장
        </button>
        <p className="text-center text-base text-pencil">WASD·방향키로 걷고 스페이스로 점프해요</p>
      </form>
    </div>
  )
}
