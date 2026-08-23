'use client'

import { ChevronRight, Diamond, Lock, Trophy } from 'lucide-react'
import type { QuestMission } from '@/lib/onboarding-quest'
import { QuestLottie } from './QuestLottie'

type Props = {
  mission: QuestMission
  onContinue: () => void
  autoProgress?: number
}

export function QuestMissionComplete({
  mission,
  onContinue,
  autoProgress = 0,
}: Props) {
  return (
    <div className="shop-quest-overlay" role="dialog" aria-modal="true" aria-labelledby="shop-quest-complete-title">
      <div className="shop-quest-card shop-quest-complete">
        <div className="shop-quest-complete-lottie">
          <QuestLottie
            src="/lottie/success.json"
            speed={1.35}
            style={{ width: 140, height: 140 }}
          />
        </div>
        <h2 id="shop-quest-complete-title" className="shop-quest-complete-title">
          Mission complete!
        </h2>
        <p className="shop-quest-muted">Great job! You&apos;ve completed this mission.</p>
        <div className="shop-quest-unlock-box">
          <div className="shop-quest-unlock-icon">
            <Lock size={18} />
          </div>
          <div>
            <p className="shop-quest-unlock-label">{mission.unlockLabel}</p>
            <p className="shop-quest-muted text-xs">{mission.unlockBlurb}</p>
          </div>
        </div>
        <div className="shop-quest-xp-burst">
          <span className="shop-quest-star">★</span>
          <span>+{mission.xp} XP</span>
        </div>
        <div className="shop-quest-complete-tips">
          <div><Trophy size={14} /> Keep going!</div>
          <div><Lock size={14} /> Unlock features</div>
          <div><Diamond size={14} /> Become a pro</div>
        </div>
        <button type="button" className="shop-quest-btn shop-quest-btn-primary w-full" onClick={onContinue}>
          Continue <ChevronRight size={16} />
        </button>
        {autoProgress > 0 && (
          <div className="shop-quest-auto">
            <span>Next mission in a moment…</span>
            <div className="shop-quest-auto-bar">
              <div style={{ width: `${Math.min(100, autoProgress * 100)}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
