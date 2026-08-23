'use client'

import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'

const Lottie = dynamic(
  () => import('lottie-react').then((mod) => mod.Lottie),
  { ssr: false },
)

type Props = {
  src: string | object | null
  className?: string
  style?: CSSProperties
  loop?: boolean
  speed?: number
}

export function QuestLottie({ src, className, style, loop = false, speed }: Props) {
  if (!src) return null
  return (
    <Lottie
      src={src}
      autoplay
      loop={loop}
      speed={speed}
      className={className}
      style={style}
    />
  )
}
