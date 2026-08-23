'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import {
  Building2, ChevronLeft, ChevronRight, LayoutDashboard, Lightbulb,
  Map, Package, Settings, ShoppingCart, Wrench,
} from 'lucide-react'
import type { QuestMission } from '@/lib/onboarding-quest'

const ICONS = {
  map: Map,
  dashboard: LayoutDashboard,
  cart: ShoppingCart,
  package: Package,
  wrench: Wrench,
  branch: Building2,
  settings: Settings,
} as const

type Props = {
  mission: QuestMission
  index: number
  total: number
  onBack: () => void
  onContinue: () => void
  onSkipMission: () => void
  canGoBack: boolean
}

export function QuestMissionModal({
  mission,
  index,
  total,
  onBack,
  onContinue,
  onSkipMission,
  canGoBack,
}: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const Icon = ICONS[mission.icon]
  const human = index + 1

  const ui = (
    <div
      className="shop-quest-mission-wrap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shop-quest-mission-title"
    >
      <div
        className="shop-quest-card shop-quest-mission"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="shop-quest-mission-head">
          <span className="shop-quest-pill">Mission {human}</span>
          <span className="shop-quest-muted">{human} / {total}</span>
        </div>
        <div className="shop-quest-mission-icon">
          <Icon size={28} />
        </div>
        <h2 id="shop-quest-mission-title" className="shop-quest-mission-title">
          {mission.title}
        </h2>
        <p className="shop-quest-mission-objective">{mission.objective}</p>
        <p className="shop-quest-mission-desc">{mission.description}</p>
        <div className="shop-quest-tip">
          <Lightbulb size={16} className="shrink-0 mt-0.5" />
          <span>{mission.tipSi}</span>
        </div>
        <div className="shop-quest-mission-actions">
          <button
            type="button"
            className="shop-quest-btn shop-quest-btn-secondary"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onBack()
            }}
            disabled={!canGoBack}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button
            type="button"
            className="shop-quest-btn shop-quest-btn-primary"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onContinue()
            }}
          >
            Continue <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          className="shop-quest-text-link"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onSkipMission()
          }}
        >
          Skip this mission
        </button>
      </div>
    </div>
  )

  if (!mounted) return null
  return createPortal(ui, document.body)
}
