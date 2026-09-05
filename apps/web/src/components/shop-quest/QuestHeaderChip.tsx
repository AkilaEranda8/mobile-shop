'use client'

import { Flag, Star } from 'lucide-react'
import { useShopQuestUnlock } from '@/lib/shop-quest-unlock'

export function QuestHeaderChip() {
  const { isQuestActive, xp, missionIndex, missionTotal } = useShopQuestUnlock()
  if (!isQuestActive || missionTotal <= 0) return null

  const human = Math.min(missionIndex + 1, missionTotal)
  const pct = Math.round((missionIndex / Math.max(1, missionTotal)) * 100)

  return (
    <div className="shop-quest-header-chip" title="Shop Quest progress">
      <Flag size={12} className="text-brand-500" />
      <span>Mission {human} / {missionTotal}</span>
      <div className="shop-quest-header-bar">
        <div style={{ width: `${pct}%` }} />
      </div>
      <Star size={11} className="text-amber-400 fill-amber-400" />
      <span>{xp} XP</span>
    </div>
  )
}
