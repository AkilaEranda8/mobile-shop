'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  Building2, Loader2, Lock, Minus, Package, Plus, Search, ShoppingCart, Trash2, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ToolbarSearch } from '@/components/ui/toolbar-search'
import { printThermalReceipt, type ThermalSale } from '@/components/invoice/ThermalReceipt'
import { productsApi } from '@/lib/api'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import {
  findProductByCode,
  isImeiCode,
  normalizeScanCode,
  productSearchHaystack,
} from '@/lib/barcode-scan'
import { useActiveBranchId, useFeatureFlag, useProducts } from '@/lib/hooks'
import { useCanEditModule } from '@/lib/module-access'
import { formatCurrency } from '@/lib/utils'
import {
  wholesaleApi,
  type WholesaleDealer,
  type WholesalePaymentMethod,
  type WholesaleSellUnit,
} from '@/lib/wholesale-api'
import { WholesaleFeatureGate, fieldClass, fieldStyle } from './wholesale-ui'

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
  const wholesaleOn = useFeatureFlag('WHOLESALE')
  const canPos = useCanEditModule('WHOLESALE_POS')
  const branchId = useActiveBranchId()

  const { data: productsData, loading: productsLoading } = useProducts({ isActive: 'true' })
  const products = useMemo(
    () => ((productsData?.data ?? []) as PosProduct[]).filter((p) => p.isActive !== false),
    [productsData],
  )

  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [dealerQuery, setDealerQuery] = useState('')
  const [dealerOpen, setDealerOpen] = useState(false)
  const [dealer, setDealer] = useState<WholesaleDealer | null>(null)

  const [productQuery, setProductQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [notes, setNotes] = useState('')
  const [pay, setPay] = useState<PayAmounts>({
    CASH: '',
    CARD: '',
    BANK_TRANSFER: '',
    CREDIT: '',
  })
  const [checkingOut, setCheckingOut] = useState(false)
  const productInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    wholesaleApi
      .dealers({ limit: '500', status: 'ACTIVE', isActive: 'true' })
      .then((res) => setDealers(res.data ?? []))
      .catch((e: Error) => toast.error(e.message))
  }, [branchId])

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

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q || q.length < 1) return []
    return products
      .filter((p) => productSearchHaystack(p).includes(q))
      .slice(0, 10)
  }, [products, productQuery])

  const cartTotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart])
  const paidTotal = useMemo(
    () =>
      PAY_KEYS.reduce((s, p) => s + (Number(pay[p.key]) || 0), 0),
    [pay],
  )
  const dueLeft = Math.max(0, cartTotal - paidTotal)
  const creditHeadroom = dealer
    ? Math.max(0, Number(dealer.creditLimit) - Number(dealer.totalDue))
    : 0

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
        /* fall through to local scan */
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

    if (productMatches[0]) {
      await addProduct(productMatches[0])
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
          payments?: Array<{ method: string; amount: number }>
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
          items: (inv?.lines || cart).map((l) => ({
            productName: 'productName' in l ? String(l.productName) : (l as CartLine).productName,
            quantity: Number(l.quantity),
            unitPrice: Number(
              'unitPrice' in l ? l.unitPrice : (l as CartLine).unitPrice,
            ),
            total: Number('total' in l ? l.total : Number((l as CartLine).unitPrice) * Number(l.quantity)),
            sku: ('sku' in l ? l.sku : (l as CartLine).sku) || undefined,
            imei: ('imei' in l ? l.imei : (l as CartLine).imei) || undefined,
          })),
          subtotal: Number(inv?.subtotal ?? cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)),
          discountAmount: Number(inv?.discount ?? 0),
          total: Number(inv?.total ?? cartTotal),
          paymentMethod: payments.map((p) => `${p.method} ${p.amount}`).join(' · '),
        }
        printThermalReceipt(receipt, settings)
      } catch {
        // print is best-effort
      }

      setCart([])
      setPay({ CASH: '', CARD: '', BANK_TRANSFER: '', CREDIT: '' })
      setNotes('')
      // refresh dealer dues
      const refreshed = await wholesaleApi.dealer(dealer.id)
      setDealer(refreshed.data)
      setDealers((prev) =>
        prev.map((d) => (d.id === refreshed.data.id ? refreshed.data : d)),
      )
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
  }

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

  return (
    <WholesaleFeatureGate>
      <div className="flex flex-col gap-3 h-[calc(100vh-7rem)] min-h-[560px]">
        {/* Top bar — dealer */}
        <div
          className="card px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2 shrink-0">
            <ShoppingCart size={18} className="text-sky-600" />
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Wholesale Counter POS
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                B2B · keyboard-first · Fulfillment branch active
              </p>
            </div>
          </div>

          <div className="relative flex-1 max-w-xl">
            {dealer ? (
              <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--bg-subtle)' }}>
                <Building2 size={16} className="text-sky-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {dealer.tradingName || dealer.legalName}
                    <span className="ml-2 font-mono text-[11px] opacity-70">{dealer.dealerCode}</span>
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Outstanding {formatCurrency(Number(dealer.totalDue))} · Limit{' '}
                    {formatCurrency(Number(dealer.creditLimit))} · Available{' '}
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
                  className="p-1 rounded-md hover:opacity-80"
                  aria-label="Change dealer"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <ToolbarSearch
                  value={dealerQuery}
                  onChange={(v) => {
                    setDealerQuery(v)
                    setDealerOpen(true)
                  }}
                  placeholder="Search dealer by name, code, phone…"
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
                {dealerOpen && dealerMatches.length > 0 && (
                  <div
                    className="absolute z-20 mt-1 w-full rounded-xl border shadow-lg overflow-hidden"
                    style={{
                      background: 'var(--bg-elevated, #fff)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    {dealerMatches.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 hover:bg-sky-500/10 border-b last:border-0"
                        style={{ borderColor: 'var(--border-subtle)' }}
                        onClick={() => {
                          setDealer(d)
                          setDealerOpen(false)
                          setDealerQuery('')
                          productInputRef.current?.focus()
                        }}
                      >
                        <p className="text-sm font-medium">
                          {d.tradingName || d.legalName}{' '}
                          <span className="font-mono text-[11px] opacity-60">{d.dealerCode}</span>
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
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
        </div>

        {/* Main grid */}
        <div className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] gap-3 min-h-0">
          {/* Products + cart */}
          <div className="card flex flex-col min-h-0 overflow-hidden">
            <div className="p-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                />
                <input
                  ref={productInputRef}
                  type="search"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onKeyDown={onProductKeyDown}
                  disabled={!dealer}
                  placeholder={
                    dealer
                      ? 'Scan barcode / IMEI or search product — Enter to add'
                      : 'Select a dealer to start'
                  }
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={fieldStyle()}
                  autoComplete="off"
                />
              </div>
              {productQuery && productMatches.length > 0 && (
                <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
                  {productMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-sky-500/10 flex items-center justify-between gap-2 border-b last:border-0"
                      style={{ borderColor: 'var(--border-subtle)' }}
                      onClick={() => void addProduct(p)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {p.sku}
                          {p.trackImei ? ' · IMEI' : ''}
                          {p.unitsPerBox ? ` · box×${p.unitsPerBox}` : ''}
                          {p.unitsPerCarton ? ` · carton×${p.unitsPerCarton}` : ''}
                        </p>
                      </div>
                      <Package size={14} className="text-sky-600 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
              {productsLoading && (
                <p className="mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Loading catalog…
                </p>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {cart.length === 0 ? (
                <div className="h-full flex items-center justify-center p-8 text-center">
                  <div>
                    <Package className="mx-auto text-sky-500/50" size={32} />
                    <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Cart is empty
                    </p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Search or scan to add wholesale lines
                    </p>
                  </div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-[11px] uppercase tracking-wide text-left"
                      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
                    >
                      <th className="px-3 py-2 font-semibold">Product</th>
                      <th className="px-2 py-2 font-semibold w-24">UOM</th>
                      <th className="px-2 py-2 font-semibold w-28">Qty</th>
                      <th className="px-2 py-2 font-semibold w-28 text-right">Unit</th>
                      <th className="px-2 py-2 font-semibold w-28 text-right">Total</th>
                      <th className="px-2 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((line) => (
                      <tr
                        key={line.key}
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td className="px-3 py-2 align-top">
                          <p className="font-medium">{line.productName}</p>
                          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {line.sku || '—'}
                            {line.priceSource ? ` · ${line.priceSource}` : ''}
                            {line.atp != null ? ` · ATP ${line.atp}` : ''}
                            {line.resolving ? ' · …' : ''}
                          </p>
                          {line.trackImei && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <input
                                className={`${fieldClass()} !py-1.5 !text-xs font-mono max-w-[180px]`}
                                style={fieldStyle()}
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
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-sky-500/15 text-sky-700"
                              >
                                {line.imeiReserved ? 'Held' : 'Reserve'}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <select
                            className={`${fieldClass()} !py-1.5 !text-xs`}
                            style={fieldStyle()}
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
                        </td>
                        <td className="px-2 py-2 align-top">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1 rounded-md border"
                              style={{ borderColor: 'var(--border-subtle)' }}
                              onClick={() => void updateQty(line.key, line.quantity - 1)}
                              disabled={line.trackImei || line.quantity <= 1}
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min={line.trackImei ? 1 : 0.01}
                              step={line.trackImei ? 1 : 1}
                              className={`${fieldClass()} !py-1 !text-xs !px-1 w-14 text-center`}
                              style={fieldStyle()}
                              value={line.quantity}
                              disabled={line.trackImei}
                              onChange={(e) => void updateQty(line.key, Number(e.target.value))}
                            />
                            <button
                              type="button"
                              className="p-1 rounded-md border"
                              style={{ borderColor: 'var(--border-subtle)' }}
                              onClick={() => void updateQty(line.key, line.quantity + 1)}
                              disabled={line.trackImei}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-2 align-top text-right font-medium tabular-nums">
                          {formatCurrency(line.unitPrice)}
                        </td>
                        <td className="px-2 py-2 align-top text-right font-semibold tabular-nums">
                          {formatCurrency(lineTotal(line))}
                        </td>
                        <td className="px-2 py-2 align-top">
                          <button
                            type="button"
                            onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))}
                            className="p-1 rounded-md text-rose-500 hover:bg-rose-500/10"
                            aria-label="Remove line"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Payment panel */}
          <div className="card flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 border-b space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Cart total
                </span>
                <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {formatCurrency(cartTotal)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <div>Lines: {cart.length}</div>
                <div className="text-right">Paid: {formatCurrency(paidTotal)}</div>
                <div>Due left: {formatCurrency(dueLeft)}</div>
                <div className="text-right">Credit headroom: {formatCurrency(creditHeadroom)}</div>
              </div>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-auto">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Payments
              </p>
              {PAY_KEYS.map((p) => (
                <label key={p.key} className="flex items-center gap-3">
                  <span className="w-16 text-xs font-medium">{p.label}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={fieldClass()}
                    style={fieldStyle()}
                    value={pay[p.key]}
                    onChange={(e) => setPay((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder="0.00"
                    disabled={p.key === 'CREDIT' && !!dealer?.cashOnly}
                  />
                </label>
              ))}
              <button
                type="button"
                className="text-[11px] font-semibold text-sky-700"
                onClick={() => {
                  const remaining = Math.max(0, cartTotal - (Number(pay.CARD) || 0) - (Number(pay.BANK_TRANSFER) || 0) - (Number(pay.CREDIT) || 0))
                  setPay((prev) => ({ ...prev, CASH: remaining ? String(remaining) : '' }))
                }}
              >
                Fill remaining as cash
              </button>

              <label className="block text-xs space-y-1 pt-2">
                <span style={{ color: 'var(--text-muted)' }}>Notes</span>
                <textarea
                  className={fieldClass()}
                  style={fieldStyle()}
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
            </div>

            <div className="p-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => void checkout()}
                disabled={checkingOut || !dealer || cart.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50"
              >
                {checkingOut ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                Checkout
              </button>
              <p className="mt-2 text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                Posts wholesale invoice · source COUNTER · consumes ATP / IMEI
              </p>
            </div>
          </div>
        </div>
      </div>
    </WholesaleFeatureGate>
  )
}
