'use client'

import { Check, ChevronRight, Crown, LockOpen, Share2, Star } from 'lucide-react'
import { QUEST_TOTAL_XP } from '@/lib/onboarding-quest'
import { QuestLottie } from './QuestLottie'

type Props = {
  missionCount: number
  xp: number
  onClaim: () => void
  onShare: () => void
}

export function QuestVictory({
  missionCount,
  xp,
  onClaim,
  onShare,
}: Props) {
  return (
    <div className="shop-quest-overlay" role="dialog" aria-modal="true" aria-labelledby="shop-quest-victory-title">
      <div className="shop-quest-card shop-quest-victory">
        <div className="shop-quest-victory-hero">
          <QuestLottie
            src="/lottie/success.json"
            style={{ width: 180, height: 180 }}
          />
          <div className="shop-quest-ribbon">Shop Quest Master</div>
        </div>
        <h2 id="shop-quest-victory-title" className="shop-quest-victory-title">
          Shop is ready!
        </h2>
        <p className="shop-quest-muted">
          Congratulations! You&apos;ve completed all missions and unlocked the full power of Hexalyte Shop.
        </p>
        <div className="shop-quest-victory-stats">
          <div>
            <Star size={16} className="text-violet-500" />
            <span>{missionCount} / {missionCount} Missions</span>
          </div>
          <div>
            <span className="shop-quest-star">★</span>
            <span>{xp || QUEST_TOTAL_XP} XP Total</span>
          </div>
          <div>
            <LockOpen size={16} className="text-emerald-500" />
            <span>All Features Unlocked</span>
          </div>
        </div>
        <div className="shop-quest-victory-callout">
          🚀 You&apos;re all set to manage your shop like a pro. Go ahead and explore!
        </div>
        <button type="button" className="shop-quest-btn shop-quest-btn-primary w-full" onClick={onClaim}>
          <Crown size={16} /> Claim Badge &amp; Continue <ChevronRight size={16} />
        </button>
        <button type="button" className="shop-quest-btn shop-quest-btn-secondary w-full" onClick={onShare}>
          <Share2 size={16} /> Share Achievement
        </button>
      </div>
      <div className="shop-quest-toast">
        <Check size={14} className="text-emerald-400" />
        <span>All features unlocked! You now have full access to Hexalyte Shop.</span>
      </div>
    </div>
  )
}
