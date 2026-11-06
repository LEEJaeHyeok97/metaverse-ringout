import type { Stage } from '../../data/garden'

/** 알람 리워드 씨앗 캐릭터. 갈색 모자와 깨진 껍질 사이로 웃는 얼굴이 보인다. */
export function SeedArt({ stage = 'seed', className = 'size-28' }: { stage?: Stage; className?: string }) {
  return (
    <svg viewBox="0 0 100 112" className={className} role="img" aria-label={{ seed: '씨앗', sprout: '새싹', tree: '나무' }[stage]}>
      {stage === 'tree' && (
        <g stroke="#1A1A1A" strokeWidth="2.5">
          <rect x="47" y="0" width="6" height="22" fill="#8C5B37" />
          <circle cx="50" cy="4" r="14" fill="#9CD07A" />
          <circle cx="38" cy="10" r="9" fill="#9CD07A" />
          <circle cx="62" cy="10" r="9" fill="#9CD07A" />
        </g>
      )}
      {stage === 'sprout' && (
        <g stroke="#1A1A1A" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M50 16 L50 4" fill="none" />
          <path d="M50 8 Q38 -2 30 8 Q40 14 50 8 Z" fill="#9CD07A" />
          <path d="M50 6 Q62 -4 70 6 Q60 12 50 6 Z" fill="#B7E08F" />
        </g>
      )}
      <g transform={stage === 'seed' ? 'translate(0 0)' : 'translate(0 6) scale(1 0.95)'}>
        <ellipse cx="50" cy="66" rx="31" ry="27" fill="#F2DEC0" stroke="#1A1A1A" strokeWidth="3" />
        <path d="M17 66 Q17 106 50 108 Q83 106 83 66 Q75 78 63 74 L58 83 L52 74 Q38 82 17 66 Z" fill="#8C5B37" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
        <path d="M50 12 Q61 24 78 44 Q87 56 81 62 Q67 53 50 55 Q33 53 19 62 Q13 56 22 44 Q39 24 50 12 Z" fill="#A8754B" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
        <path d="M34 40 Q42 30 50 26" fill="none" stroke="#C99A6E" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="34" cy="72" rx="5" ry="3" fill="#F4A6A0" opacity="0.8" />
        <ellipse cx="66" cy="72" rx="5" ry="3" fill="#F4A6A0" opacity="0.8" />
        <circle cx="41" cy="66" r="2.8" fill="#1A1A1A" />
        <circle cx="59" cy="66" r="2.8" fill="#1A1A1A" />
        <path d="M45 72 Q50 77 55 72" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}
