import { useCallback } from 'react'
import { COLORS, FONT } from '../lib/brand'
import { useCanvasTexture } from './useCanvasTexture'

type LabelProps = {
  text: string
  position?: [number, number, number]
  /** 글자 높이(월드 단위) */
  size?: number
  color?: string
  background?: string | null
  bold?: boolean
}

/** 언제나 화면을 바라보는 손글씨 이름표 */
export function Label({ text, position = [0, 0, 0], size = 0.5, color = COLORS.ink, background = '#ffffff', bold = true }: LabelProps) {
  const fontPx = 64
  const width = Math.min(1024, Math.max(128, Math.ceil([...text].length * fontPx * 0.95 + 48)))
  const height = 96
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.font = `${bold ? 'bold ' : ''}${fontPx}px ${FONT}`
      const textWidth = Math.min(ctx.measureText(text).width + 36, w - 6)
      if (background) {
        ctx.fillStyle = background
        ctx.strokeStyle = COLORS.ink
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.roundRect((w - textWidth) / 2, 6, textWidth, h - 12, 26)
        ctx.fill()
        ctx.stroke()
      }
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, w / 2, h / 2 + 4, w - 40)
    },
    [text, color, background, bold],
  )
  const texture = useCanvasTexture(draw, width, height)
  const scale = size * (height / fontPx)
  return (
    <sprite position={position} scale={[(scale * width) / height, scale, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}
