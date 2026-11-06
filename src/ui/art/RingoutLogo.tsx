/** 링아웃 로고. 주황 원 안에 말풍선 꼬리가 달린 알람시계. 원본 파일이 오면 이미지로 바꿔도 된다. */
export function RingoutLogo({ className = 'size-10', title = '링아웃' }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title}>
      <circle cx="50" cy="50" r="50" fill="#EA6E3E" />
      <path d="M21 31 Q24 21 34 18" fill="none" stroke="#1A1A1A" strokeWidth="6" strokeLinecap="round" />
      <path d="M79 31 Q76 21 66 18" fill="none" stroke="#1A1A1A" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="53" r="27" fill="#F6EFE6" />
      <path d="M63 72 L79 82 L73 63 Z" fill="#F6EFE6" />
      <circle cx="50" cy="53" r="15" fill="#EA6E3E" />
      <line x1="50" y1="53" x2="61" y2="41" stroke="#E7F27C" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="53" r="6" fill="#1A1A1A" />
    </svg>
  )
}

/** 캔버스 텍스처에 같은 로고를 그린다. 크기는 지름이다. */
export function drawRingoutLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 100
  ctx.save()
  ctx.translate(x - size / 2, y - size / 2)
  ctx.scale(s, s)
  ctx.fillStyle = '#EA6E3E'
  ctx.beginPath()
  ctx.arc(50, 50, 50, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1A1A1A'
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(21, 31)
  ctx.quadraticCurveTo(24, 21, 34, 18)
  ctx.moveTo(79, 31)
  ctx.quadraticCurveTo(76, 21, 66, 18)
  ctx.stroke()
  ctx.fillStyle = '#F6EFE6'
  ctx.beginPath()
  ctx.arc(50, 53, 27, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(63, 72)
  ctx.lineTo(79, 82)
  ctx.lineTo(73, 63)
  ctx.fill()
  ctx.fillStyle = '#EA6E3E'
  ctx.beginPath()
  ctx.arc(50, 53, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#E7F27C'
  ctx.beginPath()
  ctx.moveTo(50, 53)
  ctx.lineTo(61, 41)
  ctx.stroke()
  ctx.fillStyle = '#1A1A1A'
  ctx.beginPath()
  ctx.arc(50, 53, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
