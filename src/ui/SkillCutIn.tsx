import { useEffect, useState } from 'react'
import { connection, type FxEvent } from '../net/connection'
import { nicknameOf } from '../scene/combat'

/** 아이템마다 붙인 궁극기 이름과 색 */
const SKILLS: Record<FxEvent['kind'], { icon: string; name: string; item: string; color: string; flash: string }> = {
  booster: { icon: '🐉', name: '청룡 질주', item: '부스터', color: 'from-[#1E9E68] via-[#2FB67C] to-[#FFE08A]', flash: '#C7F0BD' },
  shield: { icon: '🛡️', name: '황금 수호진', item: '방패', color: 'from-[#C98A00] via-[#F2A900] to-[#FFF1B8]', flash: '#FFF1B8' },
  banana: { icon: '🍌', name: '하늘에서 바나나가!', item: '바나나', color: 'from-[#D9A400] via-[#FFD84D] to-[#FFF6C9]', flash: '#FFF6C9' },
  balloon: { icon: '🌊', name: '대해일 물폭탄', item: '물풍선', color: 'from-[#1E6FB8] via-[#3FA9E8] to-[#BFE3F5]', flash: '#BFE3F5' },
  ufo: { icon: '🛸', name: '외계 모선 강림', item: '우주선', color: 'from-[#3A4766] via-[#6B7FA8] to-[#E7F27C]', flash: '#E7F27C' },
  zap: { icon: '⚡', name: '천벌의 낙뢰', item: '번개', color: 'from-[#3A2A8C] via-[#6E5BD8] to-[#FFF3A0]', flash: '#FFF3A0' },
  bomb: { icon: '💣', name: '메가 폭탄', item: '폭탄', color: 'from-[#5A1E0E] via-[#E9483B] to-[#FFC531]', flash: '#FFD8A8' },
  tornado: { icon: '🌪️', name: '폭풍 회오리', item: '회오리', color: 'from-[#4A5266] via-[#8C93A3] to-[#E4EEF6]', flash: '#E4EEF6' },
  giant: { icon: '🍄', name: '거인화', item: '거인 버섯', color: 'from-[#B8281E] via-[#F0473C] to-[#FFF6E5]', flash: '#FFE0DC' },
  ghost: { icon: '👻', name: '유령 변신', item: '유령', color: 'from-[#5B4E80] via-[#A79BD0] to-[#FFFFFF]', flash: '#F3EFFF' },
  snail: { icon: '🐌', name: '달팽이의 저주', item: '달팽이 저주', color: 'from-[#3E7A2E] via-[#8BC34A] to-[#E9A65A]', flash: '#E3F5E9' },
  warp: { icon: '🌀', name: '차원 귀환문', item: '귀가 포털', color: 'from-[#4B1FA8] via-[#A259FF] to-[#E3C8FF]', flash: '#E3C8FF' },
}

const SHOW_MS = 1700

type Shown = FxEvent & { key: number; who: 'me' | 'target' | 'other' }

let nextKey = 1

/**
 * 메이플스토리 궁극기처럼 화면을 가로지르는 컷인.
 * 화면 가운데는 가리지 않고 위쪽에 얇은 띠로 띄운다. 내가 쓰거나 당하면 화면이 한 번 번쩍인다.
 */
export function SkillCutIn() {
  const [shown, setShown] = useState<Shown[]>([])
  useEffect(
    () =>
      connection.onFx((fx) => {
        const myId = connection.getState().myId
        const who = fx.from === myId ? 'me' : fx.to === myId ? 'target' : 'other'
        const key = nextKey++
        setShown((list) => [...list.filter((item) => item.who === 'other' || who === 'other').slice(-2), { ...fx, key, who }])
        setTimeout(() => setShown((list) => list.filter((item) => item.key !== key)), SHOW_MS)
      }),
    [],
  )
  return (
    <>
      {shown.map((fx) => {
        const skill = SKILLS[fx.kind]
        const caster = fx.who === 'me' ? '나' : nicknameOf(fx.from)
        const victim = fx.who === 'target'
        // 가운데를 가리지 않게 위쪽에 얇은 띠로만 띄운다. 내가 쓰거나 당하면 화면이 한 번 번쩍인다.
        return (
          <div key={fx.key} className="pointer-events-none absolute inset-0 overflow-hidden">
            {fx.who !== 'other' && <div className="screen-flash absolute inset-0 opacity-60" style={{ background: victim ? '#F0473C' : skill.flash }} />}
            <div className="absolute inset-x-0 top-28 flex justify-center max-sm:top-24">
              <div className={`cut-in relative flex items-center gap-2 overflow-hidden border-y-[3px] border-ink bg-gradient-to-r px-6 py-1 ${victim ? 'from-[#8B1E16] via-[#F0473C] to-[#FDE4D8]' : skill.color}`}>
                <span className="speed-lines absolute inset-0" aria-hidden="true" />
                <span className="relative text-3xl">{skill.icon}</span>
                <span className={`relative text-2xl font-bold max-sm:text-lg ${victim ? 'text-white' : 'text-ink'}`}>
                  {victim ? `${caster}의 ${skill.name}에 당했다!` : `${caster}의 ${skill.name}!`}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
