'use client'

import { createPortal } from 'react-dom'
import { LogOut } from 'lucide-react'

type Props = {
  onAbandon: () => void
}

export function QuestAbandonButton({ onAbandon }: Props) {
  const ui = (
    <button type="button" className="shop-quest-abandon" onClick={onAbandon}>
      <LogOut size={14} />
      Abandon quest
    </button>
  )

  if (typeof document === 'undefined') return null
  return createPortal(ui, document.body)
}
