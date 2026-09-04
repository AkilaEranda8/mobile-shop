'use client'

import dynamic from 'next/dynamic'
import type { CSSProperties } from 'react'

const Lottie = dynamic(
  () => import('lottie-react').then((mod) => mod.Lottie),
  { ssr: false },
)

type Props = {
  src: string
  className?: string
  style?: CSSProperties
  loop?: boolean
  speed?: number
}

/** Shared Lottie player for billing UI (Revenue / Payment Successful). */
export default function BillingLottie({ src, className, style, loop = true, speed }: Props) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: 64, ...style }}>
      <Lottie
        src={src}
        autoplay
        loop={loop}
        speed={speed}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
