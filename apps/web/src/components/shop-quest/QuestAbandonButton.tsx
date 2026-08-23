'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { LogOut } from 'lucide-react'

type Props = {
  onAbandon: () => void
}

export function QuestAbandonButton({ onAbandon }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const ui = (
    <button
      type="button"
      className="shop-quest-abandon"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onAbandon()
      }}
    >
      <LogOut size={14} />
      Abandon quest
    </button>
  )

  if (!mounted) return null
  return createPortal(ui, document.body)
}
