'use client'

import { LogOut } from 'lucide-react'

type Props = {
  onAbandon: () => void
}

export function QuestAbandonButton({ onAbandon }: Props) {
  return (
    <button type="button" className="shop-quest-abandon" onClick={onAbandon}>
      <LogOut size={14} />
      Abandon quest
    </button>
  )
}
