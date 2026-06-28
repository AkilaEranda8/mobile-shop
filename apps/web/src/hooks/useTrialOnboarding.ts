'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { authStorage } from '@/lib/auth'
import { productsApi, tenantApi } from '@/lib/api'
import { fetchInvoiceCustomizeSettings } from '@/lib/invoiceSettings'
import { useAnalyticsDashboard } from '@/lib/hooks'
import {
  TRIAL_ONBOARDING_STEPS,
  type OnboardingStepId,
  isInvoiceSetupComplete,
  isShopProfileComplete,
  onboardingCollapsedKey,
  onboardingCompleteKey,
  onboardingDismissKey,
  trialDaysRemaining,
  isFirstLoginOnboardingActive,
} from '@/lib/trialOnboarding'

export interface OnboardingStepState {
  id: OnboardingStepId
  done: boolean
}

export function useTrialOnboarding() {
  const pathname = usePathname()
  const user = authStorage.getUser()
  const tenantId = user?.tenantId
  const branchId = user?.branchIds?.[0]

  const { data: stats, refetch: refetchStats } = useAnalyticsDashboard()

  const [tenant, setTenant] = useState<any>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [productTotal, setProductTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [celebrated, setCelebrated] = useState(false)
  const [firstLoginSession, setFirstLoginSession] = useState(false)

  const loadProgress = useCallback(async (opts?: { silent?: boolean }) => {
    if (!tenantId) {
      setLoading(false)
      return
    }
    if (!opts?.silent) setLoading(true)
    try {
      const [tenantRes, invoiceSettings, productsRes] = await Promise.all([
        tenantApi.get(tenantId).catch(() => null),
        fetchInvoiceCustomizeSettings(tenantId).catch(() => null),
        productsApi.list({ limit: '1', page: '1' }).catch(() => null),
      ])
      const t = (tenantRes as any)?.data ?? tenantRes
      setTenant(t)
      setInvoice(invoiceSettings)
      const pRes = productsRes as any
      const total = pRes?.meta?.total ?? pRes?.total ?? (Array.isArray(pRes?.data) ? pRes.data.length : 0)
      setProductTotal(Number(total) || 0)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    setFirstLoginSession(isFirstLoginOnboardingActive())
    try {
      setDismissed(localStorage.getItem(onboardingDismissKey(tenantId)) === '1')
      setCollapsed(localStorage.getItem(onboardingCollapsedKey(tenantId)) === '1')
      setCelebrated(localStorage.getItem(onboardingCompleteKey(tenantId)) === '1')
    } catch { /* noop */ }
    loadProgress()
  }, [tenantId, loadProgress])

  useEffect(() => {
    if (!tenantId) return
    loadProgress({ silent: true })
  }, [pathname, tenantId, loadProgress])

  useEffect(() => {
    const refresh = () => {
      refetchStats()
      loadProgress({ silent: true })
    }
    window.addEventListener('pos:sale-complete', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('pos:sale-complete', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [loadProgress, refetchStats])

  const isTrial = tenant?.status === 'TRIAL'
  const salesCount = Number((stats as any)?.totalSalesCount ?? 0)

  const stepStates: OnboardingStepState[] = useMemo(() => {
    const shopDone = isShopProfileComplete(tenant, branchId)
    const invoiceDone = isInvoiceSetupComplete(invoice)
    const productDone = productTotal >= 1
    const saleDone = salesCount >= 1

    const map: Record<OnboardingStepId, boolean> = {
      shop_profile: shopDone,
      invoice_setup: invoiceDone,
      first_product: productDone,
      first_sale: saleDone,
    }

    return TRIAL_ONBOARDING_STEPS.map(s => ({ id: s.id, done: map[s.id] }))
  }, [tenant, branchId, invoice, productTotal, salesCount])

  const completedCount = stepStates.filter(s => s.done).length
  const totalSteps = stepStates.length
  const allComplete = completedCount === totalSteps

  const currentStepId = stepStates.find(s => !s.done)?.id ?? null
  const currentStep = TRIAL_ONBOARDING_STEPS.find(s => s.id === currentStepId) ?? null

  const trialDays = trialDaysRemaining(tenant?.trialEndsAt)

  const visible = Boolean(
    tenantId && isTrial && firstLoginSession && !loading && (!allComplete || !celebrated),
  )

  const dismiss = useCallback(() => {
    if (!tenantId) return
    try { localStorage.setItem(onboardingDismissKey(tenantId), '1') } catch { /* noop */ }
    setDismissed(true)
  }, [tenantId])

  const expand = useCallback(() => {
    if (!tenantId) return
    try { localStorage.setItem(onboardingCollapsedKey(tenantId), '0') } catch { /* noop */ }
    setCollapsed(false)
    setDismissed(false)
  }, [tenantId])

  const collapse = useCallback(() => {
    if (!tenantId) return
    try { localStorage.setItem(onboardingCollapsedKey(tenantId), '1') } catch { /* noop */ }
    setCollapsed(true)
  }, [tenantId])

  const markCelebrated = useCallback(() => {
    if (!tenantId) return
    try { localStorage.setItem(onboardingCompleteKey(tenantId), '1') } catch { /* noop */ }
    setCelebrated(true)
  }, [tenantId])

  return {
    visible,
    loading,
    isTrial,
    tenant,
    trialDays,
    stepStates,
    steps: TRIAL_ONBOARDING_STEPS,
    currentStep,
    currentStepId,
    completedCount,
    totalSteps,
    allComplete,
    progressPct: totalSteps ? Math.round((completedCount / totalSteps) * 100) : 0,
    dismissed,
    collapsed,
    celebrated,
    dismiss,
    expand,
    collapse,
    markCelebrated,
    refetch: loadProgress,
  }
}
