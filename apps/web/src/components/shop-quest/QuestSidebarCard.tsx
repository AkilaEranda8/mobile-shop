'use client'

import { Star, Trophy } from 'lucide-react'
import { skipShopQuestFromUi } from '@/lib/onboarding-quest'
import { useShopQuestUnlock } from '@/lib/shop-quest-unlock'

export function QuestSidebarCard() {
  const { isQuestActive, xp, missionIndex, missionTotal } = useShopQuestUnlock()
  if (!isQuestActive || missionTotal <= 0) return null

  const human = Math.min(missionIndex + 1, missionTotal)
  const pct = Math.round((missionIndex / missionTotal) * 100)

  return (
    <div className="shop-quest-sidebar-card">
      <div className="shop-quest-sidebar-card-head">
        <Trophy size={14} className="text-amber-500" />
        <span>Shop Quest</span>
      </div>
      <p className="shop-quest-sidebar-card-meta">Mission {human} of {missionTotal}</p>
      <div className="shop-quest-progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="shop-quest-sidebar-card-xp">
        <Star size={12} className="text-amber-400 fill-amber-400" />
        <span>{xp} XP</span>
      </div>
      <button type="button" className="shop-quest-text-link" onClick={() => skipShopQuestFromUi()}>
        Skip quest →
      </button>
    </div>
  )
}
