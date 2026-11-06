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
  warp: { icon: '🌀', name: '차원 귀환문', item: '귀환 포털', color: 'from-[#4B1FA8] via-[#A259FF] to-[#E3C8FF]', flash: '#E3C8FF' },
}

const SHOW_MS = 1700

type Shown = FxEvent & { key: number; who: 'me' | 'target' | 'other' }

let nextKey = 1

/**
 * 메이플스토리 궁극기처럼 화면을 가로지르는 컷인.
 * 내가 쓰면 화면 가운데를 크게 덮고, 내가 당하면 붉게, 남끼리면 위쪽에 작게 띄운다.
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
        if (fx.who === 'other') {
          return (
            <div key={fx.key} className="pointer-events-none absolute inset-x-0 top-28 flex justify-center overflow-hidden">
              <div className={`cut-in relative flex items-center gap-2 overflow-hidden border-y-[3px] border-ink bg-gradient-to-r px-6 py-1 ${skill.color}`}>
                <span className="speed-lines absolute inset-0" aria-hidden="true" />
                <span className="relative text-3xl">{skill.icon}</span>
                <span className="relative text-2xl font-bold text-ink">
                  {caster}의 <b>{skill.name}</b>!
                </span>
              </div>
            </div>
          )
        }
        const victim = fx.who === 'target'
        return (
          <div key={fx.key} className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="screen-flash absolute inset-0" style={{ background: victim ? '#F0473C' : skill.flash }} />
            <div className="absolute inset-x-[-10%] top-1/2 -translate-y-1/2">
              <div className={`cut-in relative flex items-center justify-center gap-4 overflow-hidden border-y-4 border-ink bg-gradient-to-r py-5 shadow-[0_8px_0_#1A1A1A] ${victim ? 'from-[#8B1E16] via-[#F0473C] to-[#FDE4D8]' : skill.color}`}>
                <span className="speed-lines absolute inset-0" aria-hidden="true" />
                <span className="cut-in-title relative text-7xl drop-shadow-[3px_3px_0_#1A1A1A] max-sm:text-5xl">{skill.icon}</span>
                <div className="cut-in-title relative flex flex-col items-start leading-none">
                  <span className="text-xl font-bold text-white drop-shadow-[2px_2px_0_#1A1A1A]">{victim ? `${caster}의 ${skill.item}에 당했다!` : `${skill.item} 발동!`}</span>
                  <span className="text-6xl font-bold text-white [-webkit-text-stroke:2px_#1A1A1A] max-sm:text-4xl">{skill.name}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
