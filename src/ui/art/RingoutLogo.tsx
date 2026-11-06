import { useEffect, useState } from 'react'
import logoUrl from '../../assets/ringout/logo.png'

export { logoUrl }

/** 링아웃 공식 로고(주황 원 안의 알람시계와 위치 핀) */
export function RingoutLogo({ className = 'size-10', title = '링아웃' }: { className?: string; title?: string }) {
  return <img src={logoUrl} alt={title} className={`${className} object-contain`} draggable={false} />
}

/** 캔버스 텍스처에 로고를 그리려고 이미지를 미리 불러 둔다. 불러오기 전에는 null이다. */
export function useLogoImage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    const next = new Image()
    next.onload = () => setImage(next)
    next.src = logoUrl
  }, [])
  return image
}
