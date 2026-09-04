'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Loader2,
  Lock,
  Minus,
  Package,
  Plus,
  ScanLine,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { HexaPosLayout, categoryIcon } from '@/components/pos/HexaPosLayout'
import { POS_THEME, syncPosThemeRuntime } from '@/components/pos/pos-theme'
import { printThermalReceipt, type ThermalSale } from '@/components/invoice/ThermalReceipt'
import { productsApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import {
  findProductByCode,
  isImeiCode,
  normalizeScanCode,
  productSearchHaystack,
} from '@/lib/barcode-scan'
import { useActiveBranchId, useFeatureFlag, useProducts } from '@/lib/hooks'
import { useCanEditModule } from '@/lib/module-access'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { gridColsClass, usePosUiSettings } from '@/lib/posUiSettings'
import { formatCurrency } from '@/lib/utils'
import {
  wholesaleApi,
  type WholesaleDealer,
  type WholesalePaymentMethod,
  type WholesaleSellUnit,
} from '@/lib/wholesale-api'
import { WholesaleFeatureGate } from './wholesale-ui'

type PosProduct = {
  id: string
  name: string
  sku: string
  barcode?: string | null
  trackImei?: boolean
  wholesalePrice?: number
  stock?: number
  unitsPerBox?: number | null
  unitsPerCarton?: number | null
  brandName?: string
  categoryName?: string
  storageVariations?: Array<{
    id?: string
    sku?: string
    storage?: string
    colorName?: string
    sellingPrice?: number
    stock?: number
  }> | null
  isActive?: boolean
}

type CartLine = {
  key: string
  productId: string
  productName: string
  sku: string | null
  trackImei: boolean
  sellUnit: WholesaleSellUnit
  quantity: number
  unitPrice: number
  priceSource: string | null
  atp: number | null
  imei: string
  imeiReserved: boolean
  unitsPerBox: number | null
  unitsPerCarton: number | null
  resolving: boolean
}

type PayAmounts = Record<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT', string>

const PAY_KEYS: Array<{ key: keyof PayAmounts; method: WholesalePaymentMethod; label: string }> = [
  { key: 'CASH', method: 'CASH', label: 'Cash' },
  { key: 'CARD', method: 'CARD', label: 'Card' },
  { key: 'BANK_TRANSFER', method: 'BANK_TRANSFER', label: 'Bank' },
  { key: 'CREDIT', method: 'CREDIT', label: 'Credit' },
]

function lineTotal(line: CartLine) {
  return Math.max(0, line.unitPrice * line.quantity)
}

function stockQtyFor(line: CartLine) {
  if (line.sellUnit === 'BOX') return line.quantity * (line.unitsPerBox || 0)
  if (line.sellUnit === 'CARTON') return line.quantity * (line.unitsPerCarton || 0)
  return line.quantity
}

export function WholesalePosPage() {
  const router = useRouter()
  const wholesaleOn = useFeatureFlag('WHOLESALE')
  const canPos = useCanEditModule('WHOLESALE_POS')
  const branchId = useActiveBranchId()
  const posUi = usePosUiSettings()
  const T = POS_THEME

  const productQueryParams = useMemo(
    (): Record<string, string> => ({
      ...(branchId ? { branchId } : {}),
    }),
    [branchId],
  )
  const {
    data: productsData,
    loading: productsLoading,
    error: productsError,
  } = useProducts(productQueryParams)
  const products = useMemo(() => {
    const raw = (productsData as { data?: PosProduct[] } | null)?.data
    const list = Array.isArray(raw) ? raw : []
    return list.filter((p) => p.isActive !== false)
  }, [productsData])

  useEffect(() => {
    if (productsError) toast.error(`Products: ${productsError}`)
  }, [productsError])

  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [dealerQuery, setDealerQuery] = useState('')
  const [dealerOpen, setDealerOpen] = useState(false)
  const [dealer, setDealer] = useState<WholesaleDealer | null>(null)

  const [productQuery, setProductQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [cart, setCart] = useState<CartLine[]>([])
  const [notes, setNotes] = useState('')
  const [pay, setPay] = useState<PayAmounts>({
    CASH: '',
    CARD: '',
    BANK_TRANSFER: '',
    CREDIT: '',
  })
  const [checkingOut, setCheckingOut] = useState(false)
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products')
  const [mounted, setMounted] = useState(false)
  const productInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    syncPosThemeRuntime(posUi.theme, posUi.accent)
  }, [posUi.theme, posUi.accent])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  useEffect(() => {
    wholesaleApi
      .dealers({ limit: '500', status: 'ACTIVE', isActive: 'true' })
      .then((res) => setDealers(res.data ?? []))
      .catch((e: Error) => toast.error(e.message))
  }, [branchId])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      if (p.categoryName?.trim()) set.add(p.categoryName.trim())
    }
    return ['All', ...Array.from(set).sort((a, b) => a.localeCompare(b))]
  }, [products])

  const dealerMatches = useMemo(() => {
    const q = dealerQuery.trim().toLowerCase()
    if (!q) return dealers.slice(0, 12)
    return dealers
      .filter(
        (d) =>
          d.legalName.toLowerCase().includes(q) ||
          (d.tradingName ?? '').toLowerCase().includes(q) ||
          d.dealerCode.toLowerCase().includes(q) ||
          d.phone.includes(q),
      )
      .slice(0, 12)
  }, [dealers, dealerQuery])

  const gridProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    let list = products
    if (category !== 'All') {
      list = list.filter((p) => (p.categoryName || '').trim() === category)
    }
    if (q) {
      list = list.filter((p) => productSearchHaystack(p).includes(q))
    }
    return list.slice(0, 120)
  }, [products, productQuery, category])

  const cartTotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart])
  const paidTotal = useMemo(
    () => PAY_KEYS.reduce((s, p) => s + (Number(pay[p.key]) || 0), 0),
    [pay],
  )
  const dueLeft = Math.max(0, cartTotal - paidTotal)
  const creditHeadroom = dealer
    ? Math.max(0, Number(dealer.creditLimit) - Number(dealer.totalDue))
    : 0

  const closePos = useCallback(() => {
    if (cart.length > 0 && posUi.behavior.confirmLeaveWithCart) {
      if (!window.confirm('Cart has items. Leave Wholesale POS?')) return
    }
    router.push('/dashboard/wholesale')
  }, [cart.length, posUi.behavior.confirmLeaveWithCart, router])

  const refreshLinePricing = useCallback(
    async (line: CartLine, dealerId: string) => {
      try {
        const [priceRes, atpRes] = await Promise.all([
          wholesaleApi.resolvePrice({
            dealerId,
            productId: line.productId,
            quantity: line.quantity,
            sellUnit: line.sellUnit,
          }),
          wholesaleApi
            .atp({
              productId: line.productId,
              branchId: branchId || undefined,
              sku: line.sku || undefined,
            })
            .catch(() => null),
        ])
        setCart((prev) =>
          prev.map((l) =>
            l.key === line.key
              ? {
                  ...l,
                  unitPrice: priceRes.data.unitPrice,
                  priceSource: priceRes.data.source,
                  atp: atpRes?.data?.atp ?? l.atp,
                  resolving: false,
                }
              : l,
          ),
        )
      } catch (e) {
        setCart((prev) =>
          prev.map((l) => (l.key === line.key ? { ...l, resolving: false } : l)),
        )
        toast.error(e instanceof Error ? e.message : 'Price resolve failed')
      }
    },
    [branchId],
  )

  const addProduct = useCallback(
    async (product: PosProduct, opts?: { sku?: string | null; imei?: string }) => {
      if (!dealer) {
        toast.error('Select a dealer first')
        setDealerOpen(true)
        return
      }
      if (product.trackImei) {
        const imei = opts?.imei || ''
        const key = `imei-${product.id}-${imei || Date.now()}`
        const line: CartLine = {
          key,
          productId: product.id,
          productName: product.name,
          sku: opts?.sku ?? product.sku,
          trackImei: true,
          sellUnit: 'PIECE',
          quantity: 1,
          unitPrice: 0,
          priceSource: null,
          atp: null,
          imei,
          imeiReserved: false,
          unitsPerBox: product.unitsPerBox ?? null,
          unitsPerCarton: product.unitsPerCarton ?? null,
          resolving: true,
        }
        setCart((prev) => [...prev, line])
        setMobileView('cart')
        await refreshLinePricing(line, dealer.id)
        setProductQuery('')
        productInputRef.current?.focus()
        return
      }

      const sellUnit: WholesaleSellUnit = 'PIECE'
      const existing = cart.find(
        (l) =>
          l.productId === product.id &&
          !l.trackImei &&
          l.sellUnit === sellUnit &&
          (l.sku || '') === (opts?.sku || product.sku || ''),
      )
      if (existing) {
        const nextQty = existing.quantity + 1
        setCart((prev) =>
          prev.map((l) =>
            l.key === existing.key ? { ...l, quantity: nextQty, resolving: true } : l,
          ),
        )
        await refreshLinePricing({ ...existing, quantity: nextQty }, dealer.id)
      } else {
        const key = `p-${product.id}-${opts?.sku || product.sku}-${Date.now()}`
        const line: CartLine = {
          key,
          productId: product.id,
          productName: product.name,
          sku: opts?.sku ?? product.sku,
          trackImei: false,
          sellUnit,
          quantity: 1,
          unitPrice: 0,
          priceSource: null,
          atp: null,
          imei: '',
          imeiReserved: false,
          unitsPerBox: product.unitsPerBox ?? null,
          unitsPerCarton: product.unitsPerCarton ?? null,
          resolving: true,
        }
        setCart((prev) => [...prev, line])
        await refreshLinePricing(line, dealer.id)
      }
      setMobileView('cart')
      setProductQuery('')
      productInputRef.current?.focus()
    },
    [cart, dealer, refreshLinePricing],
  )

  const handleProductEnter = async () => {
    const raw = productQuery.trim()
    if (!raw) return
    if (!dealer) {
      toast.error('Select a dealer first')
      setDealerOpen(true)
      return
    }

    if (isImeiCode(raw)) {
      const imei = normalizeScanCode(raw)
      try {
        const res = await productsApi.lookupCode(imei)
        const data = (res as { data?: { product?: PosProduct; imei?: string } }).data
        if (data?.product) {
          await addProduct(data.product, { imei })
          return
        }
      } catch {
        /* fall through */
      }
    }

    const hit = findProductByCode(products, raw)
    if (hit) {
      await addProduct(hit.product, {
        sku: hit.variation?.sku ?? hit.product.sku,
        imei: isImeiCode(raw) ? normalizeScanCode(raw) : undefined,
      })
      return
    }

    if (gridProducts[0] && productQuery.trim()) {
      await addProduct(gridProducts[0])
      return
    }

    toast.error('No product found for this barcode / search')
  }

  const updateQty = async (key: string, quantity: number) => {
    if (!dealer) return
    const qty = Math.max(0.01, quantity)
    const line = cart.find((l) => l.key === key)
    if (!line) return
    if (line.trackImei && qty !== 1) {
      toast.error('IMEI lines must be quantity 1')
      return
    }
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, quantity: qty, resolving: true } : l)))
    await refreshLinePricing({ ...line, quantity: qty }, dealer.id)
  }

  const updateSellUnit = async (key: string, sellUnit: WholesaleSellUnit) => {
    if (!dealer) return
    const line = cart.find((l) => l.key === key)
    if (!line || line.trackImei) return
    if (sellUnit === 'BOX' && !line.unitsPerBox) {
      toast.error('Product has no unitsPerBox configured')
      return
    }
    if (sellUnit === 'CARTON' && !line.unitsPerCarton) {
      toast.error('Product has no unitsPerCarton configured')
      return
    }
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, sellUnit, resolving: true } : l)))
    await refreshLinePricing({ ...line, sellUnit }, dealer.id)
  }

  const softReserve = async (key: string) => {
    const line = cart.find((l) => l.key === key)
    if (!line?.imei || line.imei.length < 8) {
      toast.error('Enter a valid IMEI first')
      return
    }
    try {
      await wholesaleApi.softReserveImei({ imei: normalizeScanCode(line.imei) })
      setCart((prev) =>
        prev.map((l) => (l.key === key ? { ...l, imeiReserved: true } : l)),
      )
      toast.success('IMEI soft-reserved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reserve failed')
    }
  }

  const checkout = async () => {
    if (!dealer) {
      toast.error('Select a dealer')
      setDealerOpen(true)
      return
    }
    if (!branchId) {
      toast.error('Select an active branch')
      return
    }
    if (!cart.length) {
      toast.error('Cart is empty')
      return
    }
    for (const line of cart) {
      if (line.trackImei && !line.imei.trim()) {
        toast.error(`IMEI required for ${line.productName}`)
        return
      }
      if (line.atp != null && stockQtyFor(line) > line.atp) {
        toast.error(`Insufficient ATP for ${line.productName}`)
        return
      }
    }
    if (paidTotal <= 0) {
      toast.error('Enter at least one payment amount')
      return
    }
    if (Number(pay.CREDIT) > 0 && dealer.cashOnly) {
      toast.error('Dealer is cash-only')
      return
    }
    if (Number(pay.CREDIT) > creditHeadroom + 0.01) {
      toast.error('Credit exceeds available limit')
      return
    }

    const payments = PAY_KEYS
      .map((p) => ({
        method: p.method,
        amount: Number(pay[p.key]) || 0,
      }))
      .filter((p) => p.amount > 0)

    setCheckingOut(true)
    try {
      const res = await wholesaleApi.checkout({
        dealerId: dealer.id,
        fulfillmentBranchId: branchId,
        notes: notes.trim() || null,
        lines: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          sellUnit: l.sellUnit,
          sku: l.sku,
          imei: l.trackImei ? normalizeScanCode(l.imei) : null,
        })),
        payments,
      })
      const inv = (res as {
        data?: {
          invoiceNumber?: string
          createdAt?: string
          subtotal?: number
          discount?: number
          total?: number
          lines?: Array<{
            productName: string
            quantity: number
            unitPrice: number
            total: number
            sku?: string | null
            imei?: string | null
          }>
          dealer?: { tradingName?: string | null; legalName?: string; phone?: string }
        }
      }).data

      toast.success(inv?.invoiceNumber ? `Invoiced ${inv.invoiceNumber}` : 'Checkout complete')

      try {
        const settings = getInvoiceSettings()
        const receipt: ThermalSale = {
          invoiceNumber: inv?.invoiceNumber || 'WHOLESALE',
          createdAt: inv?.createdAt,
          customerName:
            inv?.dealer?.tradingName ||
            inv?.dealer?.legalName ||
            dealer.tradingName ||
            dealer.legalName,
          customerPhone: inv?.dealer?.phone || dealer.phone,
          items: (inv?.lines || cart).map((l) => {
            const row = l as {
              productName?: string
              quantity?: number
              unitPrice?: number
              total?: number
              sku?: string | null
              imei?: string | null
            }
            const quantity = Number(row.quantity ?? 0)
            const unitPrice = Number(row.unitPrice ?? 0)
            return {
              productName: String(row.productName ?? ''),
              quantity,
              unitPrice,
              total: Number(row.total ?? unitPrice * quantity),
              sku: row.sku || undefined,
              imei: row.imei || undefined,
            }
          }),
          subtotal: Number(inv?.subtotal ?? cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)),
          discountAmount: Number(inv?.discount ?? 0),
          total: Number(inv?.total ?? cartTotal),
          paymentMethod: payments.map((p) => `${p.method} ${p.amount}`).join(' · '),
        }
        printThermalReceipt(receipt, settings)
      } catch {
        /* print best-effort */
      }

      setCart([])
      setPay({ CASH: '', CARD: '', BANK_TRANSFER: '', CREDIT: '' })
      setNotes('')
      const refreshed = await wholesaleApi.dealer(dealer.id)
      setDealer(refreshed.data)
      setDealers((prev) =>
        prev.map((d) => (d.id === refreshed.data.id ? refreshed.data : d)),
      )
      setMobileView('products')
      productInputRef.current?.focus()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  const onProductKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void handleProductEnter()
    }
    if (e.key === 'Escape') {
      setProductQuery('')
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dealerOpen) closePos()
      if (e.key === 'F9') {
        e.preventDefault()
        document.getElementById('wholesale-pos-checkout')?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePos, dealerOpen])

  if (!wholesaleOn) {
    return (
      <WholesaleFeatureGate>
        <div />
      </WholesaleFeatureGate>
    )
  }

  if (!canPos) {
    return (
      <div className="mx-auto mt-20 max-w-md text-center">
        <Lock className="mx-auto text-sky-600" />
        <h1 className="mt-4 text-xl font-bold">Wholesale POS access required</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          You need WHOLESALE_POS edit permission to use Counter POS.
        </p>
      </div>
    )
  }

  if (!mounted) return null

  const cashierName = authStorage.getUser()?.name || authStorage.getUser()?.email || 'Cashier'
  const cols = gridColsClass(posUi.productGrid.columnsDesktop)

  const shell = (
    <div
      className="pos-shell fixed inset-0 z-[100] flex flex-col overflow-hidden h-dvh max-h-dvh"
      data-pos={posUi.theme === 'hexa-light' ? 'light' : 'dark'}
    >
      <HexaPosLayout
        shopName="Wholesale"
        onClose={closePos}
        cashierName={cashierName}
        syncTime="Counter · B2B"
        search={productQuery}
        onSearchChange={setProductQuery}
        onSearchKeyDown={onProductKeyDown}
        searchRef={productInputRef}
        onScanClick={() => productInputRef.current?.focus()}
        navItems={[
          { id: 'products', label: 'Products', icon: Package },
          { id: 'cart', label: 'Cart', icon: ShoppingCart },
        ]}
        activeNavId={mobileView === 'cart' ? 'cart' : 'products'}
        onNavAction={(id) => {
          if (id === 'cart') setMobileView('cart')
          else setMobileView('products')
        }}
        layoutPrefs={{
          theme: posUi.theme,
          accent: posUi.accent,
          density: posUi.density,
          showSidebar: posUi.layout.showSidebar,
          showBottomActions: false,
          cartPosition: posUi.layout.cartPosition,
          cartWidth: posUi.layout.cartWidth,
        }}
        mobileView={mobileView}
        cartItemCount={cart.length}
        onMobileViewChange={setMobileView}
        customerSlot={
          <div className="relative w-full min-w-0">
            {dealer ? (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2 border"
                style={{ background: T.cardHover, borderColor: T.border }}
              >
                <Building2 size={15} style={{ color: T.purple }} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate" style={{ color: T.text }}>
                    {dealer.tradingName || dealer.legalName}
                    <span className="ml-1.5 font-mono text-[10px] opacity-70">{dealer.dealerCode}</span>
                  </p>
                  <p className="text-[10px] truncate" style={{ color: T.muted }}>
                    Due {formatCurrency(Number(dealer.totalDue))} · Avail{' '}
                    {formatCurrency(creditHeadroom)}
                    {dealer.cashOnly ? ' · Cash only' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDealer(null)
                    setDealerQuery('')
                    setDealerOpen(true)
                  }}
                  className="p-1 rounded-md"
                  style={{ color: T.muted }}
                  aria-label="Change dealer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Building2
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: T.muted }}
                  />
                  <input
                    value={dealerQuery}
                    onChange={(e) => {
                      setDealerQuery(e.target.value)
                      setDealerOpen(true)
                    }}
                    onFocus={() => setDealerOpen(true)}
                    placeholder="Select dealer…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none border"
                    style={{
                      background: T.bg,
                      borderColor: T.border,
                      color: T.text,
                    }}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && dealerMatches[0]) {
                        e.preventDefault()
                        setDealer(dealerMatches[0])
                        setDealerOpen(false)
                        setDealerQuery('')
                        productInputRef.current?.focus()
                      }
                    }}
                  />
                </div>
                {dealerOpen && dealerMatches.length > 0 && (
                  <div
                    className="absolute z-40 mt-1 w-full min-w-[260px] rounded-xl border shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
                    style={{ background: T.card, borderColor: T.border }}
                  >
                    {dealerMatches.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 border-b last:border-0 hover:opacity-90"
                        style={{ borderColor: T.border }}
                        onClick={() => {
                          setDealer(d)
                          setDealerOpen(false)
                          setDealerQuery('')
                          productInputRef.current?.focus()
                        }}
                      >
                        <p className="text-sm font-medium" style={{ color: T.text }}>
                          {d.tradingName || d.legalName}{' '}
                          <span className="font-mono text-[11px] opacity-60">{d.dealerCode}</span>
                        </p>
                        <p className="text-[11px]" style={{ color: T.muted }}>
                          Due {formatCurrency(Number(d.totalDue))} · Limit{' '}
                          {formatCurrency(Number(d.creditLimit))}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        }
        categoryBar={
          <div
            className="flex gap-1.5 overflow-x-auto px-2 sm:px-3 py-2 border-b shrink-0"
            style={{ borderColor: T.border }}
          >
            {categories.map((c) => {
              const active = c === category
              const Icon = c === 'All' ? Package : categoryIcon(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                  style={
                    active
                      ? {
                          background: `${T.purple}28`,
                          color: T.text,
                          boxShadow: `inset 0 0 0 1px ${T.purple}66`,
                        }
                      : { color: T.muted, background: T.card }
                  }
                >
                  <Icon size={12} style={{ color: active ? T.purple : T.muted }} />
                  {c}
                </button>
              )
            })}
          </div>
        }
        productGrid={
          <div className={`grid gap-2 sm:gap-3 ${cols}`}>
            {!dealer && (
              <div
                className="col-span-full rounded-xl border px-3 py-2 text-xs font-medium"
                style={{ borderColor: T.border, background: `${T.amber}14`, color: T.amber }}
              >
                Select a dealer above before checkout — you can browse products now.
              </div>
            )}
            {productsLoading && (
              <p className="col-span-full text-xs flex items-center gap-2" style={{ color: T.muted }}>
                <Loader2 size={14} className="animate-spin" /> Loading inventory…
              </p>
            )}
            {!productsLoading &&
              gridProducts.map((p) => {
                const stock = p.stock ?? 0
                const out = stock <= 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void addProduct(p)}
                    className="rounded-2xl border p-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                    style={{
                      background: T.card,
                      borderColor: T.border,
                      boxShadow: out ? undefined : `0 0 0 1px ${T.border}`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold leading-snug line-clamp-2" style={{ color: T.text }}>
                        {p.name}
                      </p>
                      {p.trackImei && (
                        <span
                          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shrink-0"
                          style={{ background: `${T.blue}22`, color: T.blue }}
                        >
                          IMEI
                        </span>
                      )}
                    </div>
                    {posUi.productGrid.showSku && (
                      <p className="mt-1 text-[10px] font-mono truncate" style={{ color: T.muted }}>
                        {p.sku}
                      </p>
                    )}
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <p className="text-sm font-extrabold tabular-nums" style={{ color: T.purple }}>
                        {formatCurrency(Number(p.wholesalePrice ?? 0))}
                      </p>
                      {posUi.productGrid.showStockBadge && (
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: out ? T.red : stock <= 4 ? T.amber : T.green }}
                        >
                          {out ? 'Out' : `${stock}`}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            {!productsLoading && gridProducts.length === 0 && (
              <p className="col-span-full text-center text-xs py-10" style={{ color: T.muted }}>
                {productsError
                  ? `Could not load products: ${productsError}`
                  : products.length === 0
                    ? 'No products in this branch inventory yet'
                    : 'No products match this search'}
              </p>
            )}
          </div>
        }
        pagination={<div />}
        bottomActions={null}
        cartPanel={
          <div className="flex flex-col h-full min-h-0">
            <div
              className="px-4 py-3 border-b flex items-center justify-between shrink-0"
              style={{ borderColor: T.border }}
            >
              <div>
                <p className="text-sm font-bold" style={{ color: T.text }}>
                  Cart
                </p>
                <p className="text-[10px]" style={{ color: T.muted }}>
                  {cart.length} line{cart.length === 1 ? '' : 's'} · Wholesale invoice
                </p>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  className="text-[11px] font-semibold"
                  style={{ color: T.red }}
                  onClick={() => setCart([])}
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-2">
              {cart.length === 0 ? (
                <div className="h-full flex items-center justify-center p-6 text-center">
                  <div>
                    <ScanLine className="mx-auto opacity-40" style={{ color: T.purple }} size={28} />
                    <p className="mt-3 text-sm font-medium" style={{ color: T.text }}>
                      Cart is empty
                    </p>
                    <p className="mt-1 text-xs" style={{ color: T.muted }}>
                      Search, scan, or tap a product
                    </p>
                  </div>
                </div>
              ) : (
                cart.map((line) => (
                  <div
                    key={line.key}
                    className="rounded-xl border p-3 space-y-2"
                    style={{ borderColor: T.border, background: T.bg }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold leading-snug" style={{ color: T.text }}>
                          {line.productName}
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: T.muted }}>
                          {line.sku || '—'}
                          {line.priceSource ? ` · ${line.priceSource}` : ''}
                          {line.atp != null ? ` · ATP ${line.atp}` : ''}
                          {line.resolving ? ' · …' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))}
                        className="p-1 rounded-md"
                        style={{ color: T.red }}
                        aria-label="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {line.trackImei && (
                      <div className="flex items-center gap-2">
                        <input
                          className="flex-1 rounded-lg px-2 py-1.5 text-xs font-mono border outline-none"
                          style={{ background: T.card, borderColor: T.border, color: T.text }}
                          placeholder="IMEI"
                          value={line.imei}
                          onChange={(e) =>
                            setCart((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, imei: e.target.value, imeiReserved: false }
                                  : l,
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          onClick={() => void softReserve(line.key)}
                          className="text-[10px] font-bold px-2 py-1.5 rounded-lg shrink-0"
                          style={{ background: `${T.blue}22`, color: T.blue }}
                        >
                          {line.imeiReserved ? 'Held' : 'Reserve'}
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-lg px-2 py-1.5 text-[11px] border outline-none"
                        style={{ background: T.card, borderColor: T.border, color: T.text }}
                        value={line.sellUnit}
                        disabled={line.trackImei}
                        onChange={(e) =>
                          void updateSellUnit(line.key, e.target.value as WholesaleSellUnit)
                        }
                      >
                        <option value="PIECE">Piece</option>
                        <option value="BOX" disabled={!line.unitsPerBox}>
                          Box
                        </option>
                        <option value="CARTON" disabled={!line.unitsPerCarton}>
                          Carton
                        </option>
                      </select>
                      <div className="flex items-center gap-1 ml-auto">
                        <button
                          type="button"
                          className="p-1 rounded-md border"
                          style={{ borderColor: T.border, color: T.text }}
                          onClick={() => void updateQty(line.key, line.quantity - 1)}
                          disabled={line.trackImei || line.quantity <= 1}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min={line.trackImei ? 1 : 0.01}
                          className="w-12 text-center rounded-lg py-1 text-xs border outline-none tabular-nums"
                          style={{ background: T.card, borderColor: T.border, color: T.text }}
                          value={line.quantity}
                          disabled={line.trackImei}
                          onChange={(e) => void updateQty(line.key, Number(e.target.value))}
                        />
                        <button
                          type="button"
                          className="p-1 rounded-md border"
                          style={{ borderColor: T.border, color: T.text }}
                          onClick={() => void updateQty(line.key, line.quantity + 1)}
                          disabled={line.trackImei}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between text-xs font-semibold tabular-nums">
                      <span style={{ color: T.muted }}>{formatCurrency(line.unitPrice)} / u</span>
                      <span style={{ color: T.text }}>{formatCurrency(lineTotal(line))}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div
              className="shrink-0 border-t p-3 space-y-3"
              style={{ borderColor: T.border, background: T.card }}
            >
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.muted }}>
                  Total
                </span>
                <span className="text-xl font-extrabold tabular-nums" style={{ color: T.text }}>
                  {formatCurrency(cartTotal)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]" style={{ color: T.muted }}>
                <span>Paid {formatCurrency(paidTotal)}</span>
                <span className="text-right">Due {formatCurrency(dueLeft)}</span>
                <span>Credit headroom</span>
                <span className="text-right">{formatCurrency(creditHeadroom)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PAY_KEYS.map((p) => (
                  <label key={p.key} className="block">
                    <span className="text-[10px] font-semibold" style={{ color: T.muted }}>
                      {p.label}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs border outline-none tabular-nums"
                      style={{ background: T.bg, borderColor: T.border, color: T.text }}
                      value={pay[p.key]}
                      onChange={(e) => setPay((prev) => ({ ...prev, [p.key]: e.target.value }))}
                      placeholder="0"
                      disabled={p.key === 'CREDIT' && !!dealer?.cashOnly}
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                className="text-[10px] font-semibold"
                style={{ color: T.purple }}
                onClick={() => {
                  const remaining = Math.max(
                    0,
                    cartTotal -
                      (Number(pay.CARD) || 0) -
                      (Number(pay.BANK_TRANSFER) || 0) -
                      (Number(pay.CREDIT) || 0),
                  )
                  setPay((prev) => ({ ...prev, CASH: remaining ? String(remaining) : '' }))
                }}
              >
                Fill remaining as cash
              </button>

              <textarea
                className="w-full rounded-lg px-2 py-1.5 text-xs border outline-none resize-none"
                style={{ background: T.bg, borderColor: T.border, color: T.text }}
                rows={2}
                placeholder="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <button
                id="wholesale-pos-checkout"
                type="button"
                onClick={() => void checkout()}
                disabled={checkingOut || !dealer || cart.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${T.purple}, ${T.purpleDark})`,
                  boxShadow: `0 8px 24px ${T.purple}40`,
                }}
              >
                {checkingOut ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ShoppingCart size={16} />
                )}
                Checkout · F9
              </button>
              <p className="text-[9px] text-center" style={{ color: T.muted }}>
                Wholesale invoice · COUNTER · same inventory as retail
              </p>
            </div>
          </div>
        }
      />
    </div>
  )

  return createPortal(shell, document.body)
}
