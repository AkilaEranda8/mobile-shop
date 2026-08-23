'use client'

import { QuestLottie } from './QuestLottie'

type Props = {
  onStart: () => void
  onSkip: () => void
}

export function QuestWelcome({ onStart, onSkip }: Props) {
  return (
    <div className="shop-quest-overlay" role="dialog" aria-modal="true" aria-labelledby="shop-quest-welcome-title">
      <div className="shop-quest-card shop-quest-welcome">
        <div className="shop-quest-welcome-lottie">
          <QuestLottie src="/lottie/welcome.json" style={{ width: '100%', maxWidth: 360 }} />
        </div>
        <h2 id="shop-quest-welcome-title" className="shop-quest-welcome-title">
          Shop Quest: Day 1
        </h2>
        <p className="shop-quest-welcome-sub">
          Complete missions, earn XP and unlock Hexalyte — one area at a time.
        </p>
        <p className="shop-quest-welcome-si">
          Shop එක ready — Day 1 quest පටන් ගමු. Skip කළොත් මුළු system එක unlock වෙනවා.
        </p>
        <div className="shop-quest-welcome-actions">
          <button type="button" className="shop-quest-btn shop-quest-btn-primary" onClick={onStart}>
            Start quest
          </button>
          <button type="button" className="shop-quest-btn shop-quest-btn-secondary" onClick={onSkip}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
