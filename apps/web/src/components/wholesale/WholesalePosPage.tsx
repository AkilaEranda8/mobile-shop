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
  Check,
  Clock,
  CreditCard,
  History,
  Loader2,
  Lock,
  Minus,
  Package,
  Plus,
  Printer,
  ScanLine,
  Search,
  Settings,
  Share2,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { printThermalReceipt, type ThermalSale } from '@/components/invoice/ThermalReceipt'
import { productsApi, imeiApi } from '@/lib/api'
import { authStorage } from '@/lib/auth'
import {
  getActiveBranchId,
  getBranchLabel,
  getVisibleBranches,
  setActiveBranchId,
} from '@/lib/active-branch'
import {
  findProductByCode,
  isImeiCode,
  normalizeScanCode,
  productSearchHaystack,
} from '@/lib/barcode-scan'
import { useActiveBranchId, useFeatureFlag, useProducts } from '@/lib/hooks'
import { useCanEditModule } from '@/lib/module-access'
import { getInvoiceSettings } from '@/lib/invoiceSettings'
import { formatCurrency } from '@/lib/utils'
import {
  wholesaleApi,
  type WholesaleDealer,
  type WholesalePaymentMethod,
  type WholesaleSellUnit,
} from '@/lib/wholesale-api'
import { WholesaleFeatureGate } from './wholesale-ui'
import './wholesale-pos.css'

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
  imageUrl?: string | null
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
  brandName?: string
  categoryName?: string
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
  lineDiscount: number
}

type PayAmounts = Record<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT', string>

type HoldOrder = {
  id: string
  createdAt: string
  cashier: string
  dealerId: string
  dealerName: string
  branchId: string | null
  cart: CartLine[]
  pay: PayAmounts
  cartDiscount: number
  notes: string
  amount: number
}

type RecentSale = {
  id: string
  invoiceNumber: string
  dealerName: string
  amount: number
  payment: string
  cashier: string
  time: string
  status: string
  dayKey: string
}

type SuccessInvoice = {
  invoiceNumber: string
  dealerName: string
  total: number
  payment: string
  createdAt?: string
  lines: Array<{
    productName: string
    quantity: number
    unitPrice: number
    total: number
    sku?: string
    imei?: string
  }>
  subtotal: number
  discount: number
}

const PAY_KEYS: Array<{ key: keyof PayAmounts; method: WholesalePaymentMethod; label: string }> = [
  { key: 'CASH', method: 'CASH', label: 'Cash' },
  { key: 'CARD', method: 'CARD', label: 'Card' },
  { key: 'BANK_TRANSFER', method: 'BANK_TRANSFER', label: 'Bank' },
  { key: 'CREDIT', method: 'CREDIT', label: 'Credit' },
]

const CATEGORY_CHIPS = [
  'All',
  'Phones',
  'Accessories',
  'Chargers',
  'Cables',
  'Batteries',
  'Covers',
  'Displays',
  'Spare Parts',
  'Audio',
  'Others',
]

const HOLD_KEY = 'wpos_holds'
const RECENT_KEY = 'wpos_recent'

function lineTotal(line: CartLine) {
  return Math.max(0, line.unitPrice * line.quantity - (line.lineDiscount || 0))
}

function stockQtyFor(line: CartLine) {
  if (line.sellUnit === 'BOX') return line.quantity * (line.unitsPerBox || 0)
  if (line.sellUnit === 'CARTON') return line.quantity * (line.unitsPerCarton || 0)
  return line.quantity
}

function priceSourceLabel(source: string | null) {
  if (source === 'DEALER_OVERRIDE') return 'Dealer Price'
  if (source === 'TIER_QTY_BREAK') return 'Qty Break'
  if (source === 'TIER_LIST') return 'Tier Price'
  if (source === 'PRODUCT_WHOLESALE') return 'Wholesale Price'
  return source || 'Wholesale Price'
}

function displayWholesalePrice(p: PosProduct) {
  const wp = Number(p.wholesalePrice)
  if (Number.isFinite(wp) && wp > 0) return wp
  return null
}

function dayKeyNow() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota */
  }
}

function storageScope() {
  const u = authStorage.getUser()
  return `${u?.tenantId || 't'}_${u?.id || 'u'}`
}

export function WholesalePosPage() {
  const router = useRouter()
  const wholesaleOn = useFeatureFlag('WHOLESALE')
  const canPos = useCanEditModule('WHOLESALE_POS')
  const branchId = useActiveBranchId()

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

  const user = authStorage.getUser()
  const branches = useMemo(() => getVisibleBranches(user), [user])
  const branchLabel = getBranchLabel(branches, branchId ?? branches[0]?.id) || 'Select branch'

  const [dealers, setDealers] = useState<WholesaleDealer[]>([])
  const [dealerQuery, setDealerQuery] = useState('')
  const [dealerPickerOpen, setDealerPickerOpen] = useState(false)
  const [dealer, setDealer] = useState<WholesaleDealer | null>(null)

  const [productQuery, setProductQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [cart, setCart] = useState<CartLine[]>([])
  const [cartDiscount, setCartDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [pay, setPay] = useState<PayAmounts>({
    CASH: '',
    CARD: '',
    BANK_TRANSFER: '',
    CREDIT: '',
  })
  const [splitPayment, setSplitPayment] = useState(false)
  const [activePayMethod, setActivePayMethod] = useState<keyof PayAmounts>('CASH')
  const [checkingOut, setCheckingOut] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [clock, setClock] = useState('')

  const [holdOpen, setHoldOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [holds, setHolds] = useState<HoldOrder[]>([])
  const [recent, setRecent] = useState<RecentSale[]>([])
  const [success, setSuccess] = useState<SuccessInvoice | null>(null)

  const [imeiModal, setImeiModal] = useState<{
    product: PosProduct
    required: number
    selected: string[]
    query: string
    available: Array<{ imei: string; model?: string; condition?: string; status?: string }>
    loading: boolean
  } | null>(null)

  const productInputRef = useRef<HTMLInputElement>(null)
  const dealerInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleString(undefined, {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const scope = storageScope()
    setHolds(loadJson<HoldOrder[]>(`${HOLD_KEY}_${scope}`, []))
    setRecent(loadJson<RecentSale[]>(`${RECENT_KEY}_${scope}`, []).slice(0, 50))
  }, [])

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

  const gridProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    let list = products
    if (category !== 'All') {
      if (category === 'Others') {
        const known = CATEGORY_CHIPS.filter((c) => c !== 'All' && c !== 'Others').map((c) =>
          c.toLowerCase(),
        )
        list = list.filter((p) => {
          const cn = (p.categoryName || '').toLowerCase()
          return !known.some((k) => cn.includes(k.toLowerCase()) || cn === k)
        })
      } else {
        const needle = category.toLowerCase()
        list = list.filter((p) => (p.categoryName || '').toLowerCase().includes(needle))
      }
    }
    if (q) {
      list = list.filter((p) => productSearchHaystack(p).includes(q))
    }
    return list.slice(0, 120)
  }, [products, productQuery, category])

  const subtotal = useMemo(() => cart.reduce((s, l) => s + lineTotal(l), 0), [cart])
  const tax = 0
  const grandTotal = Math.max(0, subtotal - Math.max(0, cartDiscount) + tax)
  const paidTotal = useMemo(
    () => PAY_KEYS.reduce((s, p) => s + (Number(pay[p.key]) || 0), 0),
    [pay],
  )
  const dueLeft = Math.max(0, grandTotal - paidTotal)
  const creditHeadroom = dealer
    ? Math.max(0, Number(dealer.creditLimit) - Number(dealer.totalDue))
    : 0
  const creditAfter =
    Number(dealer?.totalDue || 0) + (Number(pay.CREDIT) || 0)
  const creditExceeded =
    Number(pay.CREDIT) > 0 && Number(pay.CREDIT) > creditHeadroom + 0.01

  const itemCount = cart.length
  const unitCount = cart.reduce((s, l) => s + stockQtyFor(l), 0)

  const todayStats = useMemo(() => {
    const day = dayKeyNow()
    const rows = recent.filter((r) => r.dayKey === day)
    const sales = rows.reduce((s, r) => s + r.amount, 0)
    const credit = rows
      .filter((r) => r.payment.toUpperCase().includes('CREDIT'))
      .reduce((s, r) => s + r.amount, 0)
    return {
      sales,
      invoices: rows.length,
      credit,
      collected: 0,
    }
  }, [recent])

  const closePos = useCallback(() => {
    if (cart.length > 0) {
      if (!window.confirm('Cart has items. Leave Wholesale POS?')) return
    }
    router.push('/dashboard/wholesale')
  }, [cart.length, router])

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

  const openImeiPicker = async (product: PosProduct, required = 1) => {
    if (!dealer) {
      toast.error('Select a dealer first')
      setDealerPickerOpen(true)
      return
    }
    setImeiModal({
      product,
      required,
      selected: [],
      query: '',
      available: [],
      loading: true,
    })
    try {
      const params: Record<string, string> = {
        productId: product.id,
        status: 'IN_STOCK',
        limit: '200',
      }
      if (branchId) params.branchId = branchId
      const res = await imeiApi.list(params)
      const rows = ((res as { data?: unknown[] }).data ?? []) as Array<Record<string, unknown>>
      setImeiModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              available: rows.map((r) => ({
                imei: String(r.imei ?? ''),
                model: String(r.model ?? product.name),
                condition: String(r.condition ?? r.grade ?? '—'),
                status: String(r.status ?? 'IN_STOCK'),
              })),
            }
          : prev,
      )
    } catch {
      setImeiModal((prev) => (prev ? { ...prev, loading: false } : prev))
    }
  }

  const addProductLines = useCallback(
    async (
      product: PosProduct,
      opts?: { sku?: string | null; imeis?: string[]; sellUnit?: WholesaleSellUnit; qty?: number },
    ) => {
      if (!dealer) {
        toast.error('Select a dealer first')
        setDealerPickerOpen(true)
        return
      }

      if (product.trackImei) {
        const imeis = opts?.imeis?.filter(Boolean) ?? []
        if (!imeis.length) {
          await openImeiPicker(product, opts?.qty || 1)
          return
        }
        const newLines: CartLine[] = []
        for (const imei of imeis) {
          const key = `imei-${product.id}-${imei}`
          if (cart.some((l) => l.imei === imei)) {
            toast.error(`IMEI ${imei} already in cart`)
            continue
          }
          newLines.push({
            key,
            productId: product.id,
            productName: product.name,
            sku: opts?.sku ?? product.sku,
            brandName: product.brandName,
            categoryName: product.categoryName,
            trackImei: true,
            sellUnit: 'PIECE',
            quantity: 1,
            unitPrice: displayWholesalePrice(product) ?? 0,
            priceSource: null,
            atp: null,
            imei: normalizeScanCode(imei),
            imeiReserved: false,
            unitsPerBox: product.unitsPerBox ?? null,
            unitsPerCarton: product.unitsPerCarton ?? null,
            resolving: true,
            lineDiscount: 0,
          })
        }
        if (!newLines.length) return
        setCart((prev) => [...prev, ...newLines])
        setSideOpen(true)
        for (const line of newLines) {
          try {
            await wholesaleApi.softReserveImei({ imei: line.imei })
            setCart((prev) =>
              prev.map((l) => (l.key === line.key ? { ...l, imeiReserved: true } : l)),
            )
          } catch {
            /* reserve best-effort; checkout will enforce */
          }
          await refreshLinePricing(line, dealer.id)
        }
        setProductQuery('')
        productInputRef.current?.focus()
        return
      }

      const sellUnit: WholesaleSellUnit = opts?.sellUnit || 'PIECE'
      const addQty = opts?.qty || 1
      const existing = cart.find(
        (l) =>
          l.productId === product.id &&
          !l.trackImei &&
          l.sellUnit === sellUnit &&
          (l.sku || '') === (opts?.sku || product.sku || ''),
      )
      if (existing) {
        const nextQty = existing.quantity + addQty
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
          brandName: product.brandName,
          categoryName: product.categoryName,
          trackImei: false,
          sellUnit,
          quantity: addQty,
          unitPrice: displayWholesalePrice(product) ?? 0,
          priceSource: null,
          atp: null,
          imei: '',
          imeiReserved: false,
          unitsPerBox: product.unitsPerBox ?? null,
          unitsPerCarton: product.unitsPerCarton ?? null,
          resolving: true,
          lineDiscount: 0,
        }
        setCart((prev) => [...prev, line])
        await refreshLinePricing(line, dealer.id)
      }
      setSideOpen(true)
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
      setDealerPickerOpen(true)
      return
    }

    if (isImeiCode(raw)) {
      const imei = normalizeScanCode(raw)
      try {
        const res = await productsApi.lookupCode(imei)
        const data = (res as { data?: { product?: PosProduct; imei?: string } }).data
        if (data?.product) {
          await addProductLines(data.product, { imeis: [imei] })
          return
        }
      } catch {
        /* fall through */
      }
    }

    const hit = findProductByCode(products, raw)
    if (hit) {
      if (hit.product.trackImei) {
        await addProductLines(hit.product, {
          sku: hit.variation?.sku ?? hit.product.sku,
          imeis: isImeiCode(raw) ? [normalizeScanCode(raw)] : undefined,
        })
      } else {
        await addProductLines(hit.product, {
          sku: hit.variation?.sku ?? hit.product.sku,
        })
      }
      return
    }

    if (gridProducts[0] && productQuery.trim()) {
      await addProductLines(gridProducts[0])
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

  const removeLine = (key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key))
  }

  const fillPayMethod = (method: keyof PayAmounts) => {
    setActivePayMethod(method)
    if (!splitPayment) {
      setPay({
        CASH: method === 'CASH' ? String(grandTotal || '') : '',
        CARD: method === 'CARD' ? String(grandTotal || '') : '',
        BANK_TRANSFER: method === 'BANK_TRANSFER' ? String(grandTotal || '') : '',
        CREDIT: method === 'CREDIT' ? String(grandTotal || '') : '',
      })
    }
  }

  const persistHolds = (next: HoldOrder[]) => {
    setHolds(next)
    saveJson(`${HOLD_KEY}_${storageScope()}`, next)
  }

  const persistRecent = (next: RecentSale[]) => {
    setRecent(next)
    saveJson(`${RECENT_KEY}_${storageScope()}`, next)
  }

  const holdCart = useCallback(() => {
    if (!cart.length) {
      toast.error('Cart is empty')
      return
    }
    if (!dealer) {
      toast.error('Select a dealer first')
      return
    }
    const hold: HoldOrder = {
      id: `WH-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      cashier: user?.name || user?.email || 'Cashier',
      dealerId: dealer.id,
      dealerName: dealer.tradingName || dealer.legalName,
      branchId: branchId || null,
      cart,
      pay,
      cartDiscount,
      notes,
      amount: Math.max(
        0,
        cart.reduce((s, l) => s + lineTotal(l), 0) - Math.max(0, cartDiscount),
      ),
    }
    persistHolds([hold, ...holds].slice(0, 40))
    setCart([])
    setPay({ CASH: '', CARD: '', BANK_TRANSFER: '', CREDIT: '' })
    setCartDiscount(0)
    setNotes('')
    toast.success(`Held ${hold.id}`)
  }, [branchId, cart, cartDiscount, dealer, holds, notes, pay, user?.email, user?.name])

  const resumeHold = (hold: HoldOrder) => {
    const d = dealers.find((x) => x.id === hold.dealerId)
    if (d) setDealer(d)
    else {
      wholesaleApi
        .dealer(hold.dealerId)
        .then((res) => setDealer(res.data))
        .catch(() => toast.error('Dealer for hold not found'))
    }
    setCart(hold.cart)
    setPay(hold.pay)
    setCartDiscount(hold.cartDiscount || 0)
    setNotes(hold.notes || '')
    persistHolds(holds.filter((h) => h.id !== hold.id))
    setHoldOpen(false)
    setSideOpen(true)
    toast.success(`Resumed ${hold.id}`)
  }

  const deleteHold = (id: string) => {
    persistHolds(holds.filter((h) => h.id !== id))
  }

  const resetSale = () => {
    setCart([])
    setPay({ CASH: '', CARD: '', BANK_TRANSFER: '', CREDIT: '' })
    setCartDiscount(0)
    setNotes('')
    setSuccess(null)
    setSideOpen(false)
    productInputRef.current?.focus()
  }

  const checkout = async () => {
    if (!dealer) {
      toast.error('Select a dealer')
      setDealerPickerOpen(true)
      return
    }
    if (!branchId) {
      toast.error('Select a warehouse / branch')
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
        toast.error(`Insufficient stock for ${line.productName}`)
        return
      }
    }
    if (Math.abs(paidTotal - grandTotal) > 0.05) {
      toast.error(
        dueLeft > 0
          ? `Payment incomplete — balance ${formatCurrency(dueLeft)}`
          : 'Payment exceeds invoice total',
      )
      return
    }
    if (paidTotal <= 0) {
      toast.error('Enter payment amounts')
      return
    }
    if (Number(pay.CREDIT) > 0 && dealer.cashOnly) {
      toast.error('Dealer is cash-only')
      return
    }
    if (creditExceeded) {
      toast.error('Credit exceeds available limit')
      return
    }

    const discountPool = Math.max(0, cartDiscount)
    const lineBases = cart.map((l) => Math.max(0, l.unitPrice * l.quantity))
    const baseSum = lineBases.reduce((s, n) => s + n, 0) || 1
    let allocated = 0
    const lineDiscounts = lineBases.map((base, i) => {
      if (i === lineBases.length - 1) return Math.max(0, round2(discountPool - allocated))
      const share = round2((discountPool * base) / baseSum)
      allocated += share
      return share
    })

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
        lines: cart.map((l, i) => ({
          productId: l.productId,
          quantity: l.quantity,
          sellUnit: l.sellUnit,
          sku: l.sku,
          imei: l.trackImei ? normalizeScanCode(l.imei) : null,
          discount: lineDiscounts[i] || undefined,
        })),
        payments,
      })
      const inv = (
        res as {
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
        }
      ).data

      const invoiceNumber = inv?.invoiceNumber || 'WHOLESALE'
      const paymentLabel = payments.map((p) => `${p.method} ${p.amount}`).join(' · ')
      const dealerName =
        inv?.dealer?.tradingName ||
        inv?.dealer?.legalName ||
        dealer.tradingName ||
        dealer.legalName
      const total = Number(inv?.total ?? grandTotal)

      const successPayload: SuccessInvoice = {
        invoiceNumber,
        dealerName,
        total,
        payment: paymentLabel,
        createdAt: inv?.createdAt,
        lines: (inv?.lines || cart).map((l) => {
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
            sku: row.sku ? String(row.sku) : undefined,
            imei: row.imei ? String(row.imei) : undefined,
          }
        }),
        subtotal: Number(inv?.subtotal ?? subtotal),
        discount: Number(inv?.discount ?? cartDiscount),
      }
      setSuccess(successPayload)

      persistRecent(
        [
          {
            id: `${invoiceNumber}-${Date.now()}`,
            invoiceNumber,
            dealerName,
            amount: total,
            payment: paymentLabel,
            cashier: user?.name || user?.email || 'Cashier',
            time: new Date().toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            }),
            status: 'POSTED',
            dayKey: dayKeyNow(),
          },
          ...recent,
        ].slice(0, 50),
      )

      try {
        const settings = getInvoiceSettings()
        const receipt: ThermalSale = {
          invoiceNumber,
          createdAt: inv?.createdAt,
          customerName: dealerName,
          customerPhone: inv?.dealer?.phone || dealer.phone,
          items: successPayload.lines,
          subtotal: successPayload.subtotal,
          discountAmount: successPayload.discount,
          total,
          paymentMethod: paymentLabel,
        }
        printThermalReceipt(receipt, settings)
      } catch {
        /* print best-effort */
      }

      setCart([])
      setPay({ CASH: '', CARD: '', BANK_TRANSFER: '', CREDIT: '' })
      setCartDiscount(0)
      setNotes('')
      const refreshed = await wholesaleApi.dealer(dealer.id)
      setDealer(refreshed.data)
      setDealers((prev) =>
        prev.map((d) => (d.id === refreshed.data.id ? refreshed.data : d)),
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Checkout failed')
    } finally {
      setCheckingOut(false)
    }
  }

  const printSuccess = () => {
    if (!success) return
    try {
      const settings = getInvoiceSettings()
      printThermalReceipt(
        {
          invoiceNumber: success.invoiceNumber,
          createdAt: success.createdAt,
          customerName: success.dealerName,
          items: success.lines,
          subtotal: success.subtotal,
          discountAmount: success.discount,
          total: success.total,
          paymentMethod: success.payment,
        },
        settings,
      )
    } catch {
      toast.error('Print failed')
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
      if (e.key === 'Escape') {
        if (success) {
          setSuccess(null)
          return
        }
        if (imeiModal) {
          setImeiModal(null)
          return
        }
        if (holdOpen) {
          setHoldOpen(false)
          return
        }
        if (recentOpen) {
          setRecentOpen(false)
          return
        }
        if (sideOpen && window.innerWidth <= 1024) {
          setSideOpen(false)
          return
        }
        closePos()
        return
      }

      if (e.key === 'F1') {
        e.preventDefault()
        productInputRef.current?.focus()
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        setDealerPickerOpen(true)
        dealerInputRef.current?.focus()
        return
      }
      if (e.key === 'F3') {
        e.preventDefault()
        productInputRef.current?.focus()
        setProductQuery('')
        return
      }
      if (e.key === 'F4') {
        e.preventDefault()
        holdCart()
        return
      }
      if (e.key === 'F9') {
        e.preventDefault()
        document.getElementById('wholesale-pos-checkout')?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePos, success, imeiModal, holdOpen, recentOpen, sideOpen, holdCart])

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

  const cashierName = user?.name || user?.email || 'Cashier'
  const cashierRole = user?.role || 'CASHIER'

  const shell = (
    <div
      className="wpos-shell fixed inset-0 z-[100] flex flex-col overflow-hidden h-dvh max-h-dvh"
      data-wpos="dark"
      data-pos="dark"
    >
      {/* Header */}
      <header className="wpos-header">
        <div className="wpos-brand">
          <div className="wpos-brand-mark">HX</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight">Hexa POS</span>
              <span className="wpos-chip is-b2b">B2B</span>
            </div>
            <div className="text-[0.65rem] text-[var(--wpos-muted)]">Wholesale POS</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button type="button" className="wpos-mode-btn is-active">
            Counter Sales
          </button>
          <button
            type="button"
            className="wpos-mode-btn"
            onClick={() => router.push('/rep')}
          >
            Rep / Van Sales
          </button>
          <button
            type="button"
            className="wpos-mode-btn"
            onClick={() => router.push('/dashboard/wholesale/orders')}
          >
            Delivery Orders
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <label className="wpos-util gap-1.5">
            <Building2 size={14} />
            <select
              className="bg-transparent border-0 outline-none text-[0.72rem] font-semibold max-w-[180px]"
              value={branchId || ''}
              onChange={(e) => {
                const id = e.target.value
                if (!id) return
                if (cart.length && !window.confirm('Changing branch clears pricing/ATP. Continue?')) {
                  return
                }
                setActiveBranchId(id, 'assigned')
                setCart((prev) => prev.map((l) => ({ ...l, atp: null, resolving: true })))
              }}
            >
              {!branchId && <option value="">Select branch</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <button type="button" className="wpos-util" onClick={() => setHoldOpen(true)}>
            <Clock size={14} />
            Hold Orders
            {holds.length > 0 && <span className="badge">{holds.length}</span>}
          </button>
          <button type="button" className="wpos-util" onClick={() => setRecentOpen(true)}>
            <History size={14} />
            Recent Sales
          </button>
          <button
            type="button"
            className="wpos-util"
            onClick={() => router.push('/dashboard/wholesale/settings')}
            title="Wholesale settings"
          >
            <Settings size={14} />
            Settings
          </button>

          <div className="wpos-util gap-2">
            <div className="w-6 h-6 rounded-full bg-[var(--wpos-accent)] text-white text-[0.65rem] font-bold grid place-items-center">
              {cashierName.slice(0, 1).toUpperCase()}
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-[0.7rem] font-semibold text-[var(--wpos-text)]">{cashierName}</div>
              <div className="text-[0.58rem]">{cashierRole}</div>
            </div>
          </div>

          <span className="text-[0.65rem] text-[var(--wpos-faint)] hidden md:inline">{clock}</span>
          <button type="button" className="wpos-util" onClick={closePos} title="Close (ESC)">
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="wpos-body">
        <section className="wpos-catalog">
          <div className="wpos-search-row">
            <div className="wpos-search">
              <Search size={16} className="text-[var(--wpos-faint)]" />
              <input
                ref={productInputRef}
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={onProductKeyDown}
                placeholder="Search product, SKU, barcode, IMEI... (F1)"
                autoFocus
              />
            </div>
            <button
              type="button"
              className="wpos-btn wpos-btn-primary"
              onClick={() => {
                productInputRef.current?.focus()
                void handleProductEnter()
              }}
            >
              <ScanLine size={15} />
              Scan
            </button>
          </div>

          <div className="wpos-cats">
            {CATEGORY_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                className={`wpos-cat${category === c ? ' is-active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="wpos-grid">
            {productsLoading && (
              <div className="col-span-full flex items-center justify-center py-16 text-[var(--wpos-muted)] gap-2">
                <Loader2 className="animate-spin" size={18} /> Loading products…
              </div>
            )}
            {!productsLoading && gridProducts.length === 0 && (
              <div className="col-span-full text-center py-16 text-[var(--wpos-muted)] text-sm">
                No products match this search
              </div>
            )}
            {gridProducts.map((p) => {
              const wp = displayWholesalePrice(p)
              const isAcc =
                (p.categoryName || '').toLowerCase().includes('accessor') ||
                (p.categoryName || '').toLowerCase().includes('cable') ||
                (p.categoryName || '').toLowerCase().includes('charger')
              return (
                <article key={p.id} className="wpos-pcard">
                  <div className="wpos-pthumb">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" />
                    ) : (
                      <Package size={22} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[0.78rem] font-semibold leading-snug line-clamp-2">
                      {p.name}
                    </div>
                    <div className="text-[0.62rem] text-[var(--wpos-faint)] mt-0.5">
                      SKU: {p.sku || '—'}
                      {p.brandName ? ` · ${p.brandName}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.trackImei && <span className="wpos-chip is-imei">IMEI</span>}
                    <span className="wpos-chip">{p.categoryName || (p.trackImei ? 'Phone' : 'Product')}</span>
                  </div>
                  <div className="mt-auto">
                    {wp != null ? (
                      <div className="text-[0.9rem] font-bold text-[#93c5fd]">
                        {formatCurrency(wp)}
                        {isAcc && p.unitsPerBox ? (
                          <div className="text-[0.65rem] font-medium text-[var(--wpos-muted)] mt-0.5">
                            {formatCurrency(wp)} / Piece
                            <br />
                            {formatCurrency(wp * p.unitsPerBox)} / Box ({p.unitsPerBox})
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-[0.75rem] text-[var(--wpos-faint)]">Price on add</div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="text-[0.65rem] text-[var(--wpos-muted)]">
                        Stock: {p.stock ?? '—'}
                      </span>
                      <button
                        type="button"
                        className="wpos-btn wpos-btn-primary !h-8 !px-2.5 !text-[0.7rem]"
                        onClick={() => void addProductLines(p)}
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <div className={`wpos-side${sideOpen ? ' is-open' : ''}`} role="complementary">
          <div className="wpos-side-scroll">
            {/* Dealer */}
            <div>
              <div className="wpos-section-title">
                <span>1. Select Dealer (F2)</span>
                <button
                  type="button"
                  className="wpos-btn wpos-btn-ghost !h-7 !text-[0.65rem]"
                  onClick={() => router.push('/dashboard/wholesale/dealers')}
                >
                  <UserPlus size={12} /> New Dealer
                </button>
              </div>
              <div className="mt-2 relative">
                <div className="wpos-search !h-9">
                  <Search size={14} className="text-[var(--wpos-faint)]" />
                  <input
                    ref={dealerInputRef}
                    value={dealerQuery}
                    onChange={(e) => {
                      setDealerQuery(e.target.value)
                      setDealerPickerOpen(true)
                    }}
                    onFocus={() => setDealerPickerOpen(true)}
                    placeholder="Search dealer by name, code, phone…"
                  />
                </div>
                {dealerPickerOpen && (
                  <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-[var(--wpos-border)] bg-[var(--wpos-elevated)] shadow-xl max-h-56 overflow-auto">
                    {dealerMatches.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-[var(--wpos-accent-soft)] border-b border-[var(--wpos-border)] last:border-0"
                        onClick={() => {
                          setDealer(d)
                          setDealerQuery('')
                          setDealerPickerOpen(false)
                          if (cart.length) {
                            cart.forEach((l) => {
                              void refreshLinePricing(l, d.id)
                            })
                          }
                        }}
                      >
                        <div className="text-[0.78rem] font-semibold">
                          {d.tradingName || d.legalName}
                        </div>
                        <div className="text-[0.62rem] text-[var(--wpos-faint)]">
                          {d.dealerCode} · {d.phone}
                        </div>
                      </button>
                    ))}
                    {!dealerMatches.length && (
                      <div className="px-3 py-3 text-[0.75rem] text-[var(--wpos-muted)]">
                        No dealers found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {dealer ? (
                <div className="wpos-dealer-card mt-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[0.88rem] truncate">
                        {dealer.tradingName || dealer.legalName}
                      </div>
                      <div className="text-[0.65rem] text-[var(--wpos-faint)]">
                        Dealer Code: {dealer.dealerCode}
                      </div>
                    </div>
                    <span className="wpos-chip is-ok">{dealer.status}</span>
                  </div>
                  <div className="wpos-metric-grid">
                    <div className="wpos-metric">
                      <label>Credit Limit</label>
                      <strong>{formatCurrency(dealer.creditLimit)}</strong>
                    </div>
                    <div className="wpos-metric">
                      <label>Outstanding</label>
                      <strong className="text-[var(--wpos-rose)]">
                        {formatCurrency(dealer.totalDue)}
                      </strong>
                    </div>
                    <div className="wpos-metric">
                      <label>Available</label>
                      <strong className="text-[var(--wpos-green)]">
                        {formatCurrency(creditHeadroom)}
                      </strong>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.68rem]">
                    <div>
                      <span className="text-[var(--wpos-faint)]">Price Tier</span>
                      <div className="font-semibold text-[var(--wpos-gold)]">
                        {dealer.tier?.name || 'Standard'}
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--wpos-faint)]">Payment Terms</span>
                      <div className="font-semibold">{dealer.paymentTermsDays} Days</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[var(--wpos-faint)]">Contact</span>
                      <div className="font-semibold">{dealer.phone}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="wpos-btn wpos-btn-ghost !h-7 !text-[0.65rem]"
                      onClick={() => router.push(`/dashboard/wholesale/dealers?id=${dealer.id}`)}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      className="wpos-btn wpos-btn-ghost !h-7 !text-[0.65rem]"
                      onClick={() => router.push('/dashboard/wholesale/collections')}
                    >
                      Outstanding
                    </button>
                    <button
                      type="button"
                      className="wpos-btn wpos-btn-ghost !h-7 !text-[0.65rem]"
                      onClick={() => setRecentOpen(true)}
                    >
                      Sales History
                    </button>
                    <button
                      type="button"
                      className="wpos-btn wpos-btn-ghost !h-7 !text-[0.65rem]"
                      onClick={() => {
                        setDealer(null)
                        setDealerQuery('')
                      }}
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-dashed border-[var(--wpos-border)] p-3 text-[0.75rem] text-[var(--wpos-muted)]">
                  Dealer selection is required before checkout.
                </div>
              )}
            </div>

            {/* Cart */}
            <div>
              <div className="wpos-section-title">
                <span>
                  2. Cart · {itemCount} Items · {unitCount} Units
                </span>
              </div>
              <div className="mt-1">
                {cart.length === 0 && (
                  <div className="text-[0.75rem] text-[var(--wpos-muted)] py-4 text-center">
                    Scan or add products to start
                  </div>
                )}
                {cart.map((line) => (
                  <div key={line.key} className="wpos-cart-line">
                    <div className="min-w-0">
                      <div className="text-[0.78rem] font-semibold truncate">{line.productName}</div>
                      <div className="text-[0.62rem] text-[var(--wpos-faint)]">
                        {line.sku || '—'}
                        {line.resolving ? ' · pricing…' : line.priceSource ? ` · ${priceSourceLabel(line.priceSource)}` : ''}
                      </div>
                      {line.trackImei && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`wpos-chip ${line.imei ? 'is-ok' : 'is-imei'}`}>
                            {line.imei ? `IMEI ${line.imei}` : 'IMEI Required'}
                          </span>
                          {line.imeiReserved && <span className="wpos-chip is-ok">Reserved</span>}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {!line.trackImei && (
                          <select
                            className="h-7 rounded-md bg-[var(--wpos-elevated)] border border-[var(--wpos-border)] text-[0.65rem] px-1.5"
                            value={line.sellUnit}
                            onChange={(e) =>
                              void updateSellUnit(line.key, e.target.value as WholesaleSellUnit)
                            }
                          >
                            <option value="PIECE">Piece</option>
                            {line.unitsPerBox ? (
                              <option value="BOX">Box ({line.unitsPerBox})</option>
                            ) : null}
                            {line.unitsPerCarton ? (
                              <option value="CARTON">Carton ({line.unitsPerCarton})</option>
                            ) : null}
                          </select>
                        )}
                        {!line.trackImei && (
                          <div className="wpos-qty">
                            <button
                              type="button"
                              onClick={() => void updateQty(line.key, line.quantity - 1)}
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              value={line.quantity}
                              onChange={(e) => {
                                const v = Number(e.target.value)
                                if (Number.isFinite(v)) void updateQty(line.key, v)
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => void updateQty(line.key, line.quantity + 1)}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}
                        {line.atp != null && (
                          <span className="text-[0.6rem] text-[var(--wpos-faint)]">
                            ATP {line.atp}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[0.72rem] text-[var(--wpos-muted)]">
                        {formatCurrency(line.unitPrice)}
                      </div>
                      <div className="text-[0.85rem] font-bold">{formatCurrency(lineTotal(line))}</div>
                      <button
                        type="button"
                        className="mt-1 text-[var(--wpos-rose)]"
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 space-y-1.5 text-[0.78rem]">
                <div className="flex justify-between">
                  <span className="text-[var(--wpos-muted)]">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[var(--wpos-muted)]">Discount</span>
                  <input
                    type="number"
                    min={0}
                    className="w-28 h-8 rounded-md bg-[var(--wpos-elevated)] border border-[var(--wpos-border)] px-2 text-right text-[0.78rem]"
                    value={cartDiscount || ''}
                    onChange={(e) => setCartDiscount(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--wpos-muted)]">Tax</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between items-end pt-1 border-t border-[var(--wpos-border)]">
                  <span className="font-bold text-[0.7rem] uppercase tracking-wide text-[var(--wpos-faint)]">
                    Total
                  </span>
                  <span className="text-xl font-extrabold text-[var(--wpos-green)]">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment */}
            <div>
              <div className="wpos-section-title">
                <span>3. Payment (F9)</span>
                <label className="flex items-center gap-1.5 text-[0.65rem] font-semibold text-[var(--wpos-muted)] normal-case tracking-normal">
                  <input
                    type="checkbox"
                    checked={splitPayment}
                    onChange={(e) => setSplitPayment(e.target.checked)}
                  />
                  Split Payment
                </label>
              </div>

              {dealer && Number(pay.CREDIT) > 0 && (
                <div className="mt-2 rounded-xl border border-[var(--wpos-border)] bg-[var(--wpos-card)] p-2.5 text-[0.7rem] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[var(--wpos-faint)]">Outstanding</span>
                    <span>{formatCurrency(dealer.totalDue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--wpos-faint)]">Current Invoice (credit)</span>
                    <span>{formatCurrency(Number(pay.CREDIT) || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--wpos-faint)]">After Sale</span>
                    <span>{formatCurrency(creditAfter)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--wpos-faint)]">Available Credit</span>
                    <span className="text-[var(--wpos-green)]">{formatCurrency(creditHeadroom)}</span>
                  </div>
                </div>
              )}

              {creditExceeded && (
                <div className="wpos-warn mt-2">
                  CREDIT LIMIT EXCEEDED — change payment or request approval.
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="wpos-btn wpos-btn-secondary !h-8 !text-[0.7rem]"
                      onClick={() => fillPayMethod('CASH')}
                    >
                      Change Payment
                    </button>
                    <button
                      type="button"
                      className="wpos-btn wpos-btn-ghost !h-8 !text-[0.7rem]"
                      onClick={() => toast('Ask a manager to raise credit limit or approve override.')}
                    >
                      Request Approval
                    </button>
                  </div>
                </div>
              )}

              <div className="wpos-pay-grid mt-2">
                {PAY_KEYS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={`wpos-pay-btn${activePayMethod === p.key || Number(pay[p.key]) > 0 ? ' is-active' : ''}`}
                    onClick={() => fillPayMethod(p.key)}
                    disabled={p.key === 'CREDIT' && creditExceeded && !splitPayment}
                  >
                    <CreditCard size={12} className="inline mr-1 opacity-70" />
                    {p.label}
                  </button>
                ))}
              </div>

              {(splitPayment || paidTotal > 0) && (
                <div className="mt-2 space-y-1.5">
                  {PAY_KEYS.map((p) => (
                    <div key={p.key} className="flex items-center gap-2">
                      <span className="w-16 text-[0.68rem] text-[var(--wpos-muted)]">{p.label}</span>
                      <input
                        type="number"
                        min={0}
                        className="flex-1 h-8 rounded-md bg-[var(--wpos-elevated)] border border-[var(--wpos-border)] px-2 text-[0.78rem]"
                        value={pay[p.key]}
                        onChange={(e) =>
                          setPay((prev) => ({ ...prev, [p.key]: e.target.value }))
                        }
                        disabled={p.key === 'CREDIT' && creditExceeded}
                      />
                    </div>
                  ))}
                  <div className="flex justify-between text-[0.75rem] pt-1">
                    <span className="text-[var(--wpos-muted)]">Paid / Balance</span>
                    <span>
                      {formatCurrency(paidTotal)} /{' '}
                      <span className={dueLeft > 0.05 ? 'text-[var(--wpos-rose)]' : 'text-[var(--wpos-green)]'}>
                        {formatCurrency(dueLeft)}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className="wpos-btn wpos-btn-ghost !h-10 !text-[0.72rem]"
                  onClick={() => {
                    if (!cart.length) {
                      toast.error('Nothing to save')
                      return
                    }
                    holdCart()
                    toast.success('Draft saved as hold')
                  }}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="wpos-btn wpos-btn-amber !h-10 !text-[0.72rem]"
                  onClick={holdCart}
                >
                  Hold
                </button>
                <button
                  id="wholesale-pos-checkout"
                  type="button"
                  className="wpos-btn wpos-btn-primary !h-10 !text-[0.75rem] col-span-3 sm:col-span-1"
                  style={{ gridColumn: '1 / -1' }}
                  disabled={checkingOut || !dealer || !cart.length || creditExceeded}
                  onClick={() => void checkout()}
                >
                  {checkingOut ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  Complete Wholesale Sale
                </button>
              </div>
            </div>
          </div>

          {sideOpen && (
            <div className="p-3 border-t border-[var(--wpos-border)] md:hidden">
              <button
                type="button"
                className="wpos-btn wpos-btn-ghost w-full !h-10"
                onClick={() => setSideOpen(false)}
              >
                Close cart
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="wpos-footer">
        <div className="wpos-stat">
          <div>
            <strong>{formatCurrency(todayStats.sales)}</strong>
            <span>Today&apos;s Wholesale Sales</span>
          </div>
        </div>
        <div className="wpos-stat">
          <div>
            <strong>{todayStats.invoices}</strong>
            <span>Invoices</span>
          </div>
        </div>
        <div className="wpos-stat">
          <div>
            <strong>{formatCurrency(todayStats.credit)}</strong>
            <span>Credit Sales</span>
          </div>
        </div>
        <div className="wpos-stat">
          <div>
            <strong>{formatCurrency(todayStats.collected)}</strong>
            <span>Outstanding Collected</span>
          </div>
        </div>
        <div className="ml-auto text-[0.62rem] text-[var(--wpos-faint)] hidden lg:block">
          F1 Search · F2 Dealer · F3 Scan · F4 Hold · F9 Checkout · ESC Close
          {branchLabel ? ` · ${branchLabel}` : ''}
        </div>
      </footer>

      {/* Mobile cart bar */}
      <div className="wpos-mobile-cart-bar">
        <button
          type="button"
          className="flex-1 wpos-btn wpos-btn-secondary !h-11 justify-between px-3"
          onClick={() => setSideOpen(true)}
        >
          <span>
            {itemCount} Items · {formatCurrency(grandTotal)}
          </span>
          <span>View Cart</span>
        </button>
      </div>

      {/* Modals */}
      {imeiModal && (
        <div className="wpos-overlay" onClick={() => setImeiModal(null)}>
          <div className="wpos-modal p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-bold">Select IMEI</h2>
                <p className="text-[0.75rem] text-[var(--wpos-muted)]">
                  {imeiModal.product.name} · Required {imeiModal.required} · Selected{' '}
                  {imeiModal.selected.length}
                </p>
              </div>
              <button type="button" className="wpos-util" onClick={() => setImeiModal(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="wpos-search mb-2">
              <ScanLine size={14} />
              <input
                value={imeiModal.query}
                onChange={(e) =>
                  setImeiModal((prev) => (prev ? { ...prev, query: e.target.value } : prev))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && imeiModal.query.trim()) {
                    const code = normalizeScanCode(imeiModal.query.trim())
                    setImeiModal((prev) => {
                      if (!prev) return prev
                      if (prev.selected.includes(code)) return prev
                      if (prev.selected.length >= prev.required) return prev
                      return { ...prev, selected: [...prev.selected, code], query: '' }
                    })
                  }
                }}
                placeholder="Search / Scan IMEI"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-auto rounded-xl border border-[var(--wpos-border)]">
              {imeiModal.loading && (
                <div className="p-6 text-center text-[var(--wpos-muted)] text-sm">
                  <Loader2 className="inline animate-spin mr-2" size={14} /> Loading…
                </div>
              )}
              {!imeiModal.loading &&
                imeiModal.available
                  .filter((r) =>
                    !imeiModal.query.trim()
                      ? true
                      : r.imei.toLowerCase().includes(imeiModal.query.trim().toLowerCase()),
                  )
                  .map((row) => {
                    const on = imeiModal.selected.includes(row.imei)
                    return (
                      <button
                        key={row.imei}
                        type="button"
                        className={`w-full flex items-center justify-between px-3 py-2 border-b border-[var(--wpos-border)] text-left ${on ? 'bg-[var(--wpos-accent-soft)]' : ''}`}
                        onClick={() => {
                          setImeiModal((prev) => {
                            if (!prev) return prev
                            if (on) {
                              return {
                                ...prev,
                                selected: prev.selected.filter((x) => x !== row.imei),
                              }
                            }
                            if (prev.selected.length >= prev.required) return prev
                            return { ...prev, selected: [...prev.selected, row.imei] }
                          })
                        }}
                      >
                        <div>
                          <div className="text-[0.8rem] font-semibold font-mono">{row.imei}</div>
                          <div className="text-[0.62rem] text-[var(--wpos-faint)]">
                            {row.model} · {row.condition} · {row.status}
                          </div>
                        </div>
                        {on && <Check size={16} className="text-[var(--wpos-green)]" />}
                      </button>
                    )
                  })}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="wpos-btn wpos-btn-ghost !h-10"
                onClick={() => setImeiModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wpos-btn wpos-btn-primary !h-10"
                disabled={imeiModal.selected.length !== imeiModal.required}
                onClick={() => {
                  const { product, selected } = imeiModal
                  setImeiModal(null)
                  void addProductLines(product, { imeis: selected })
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {holdOpen && (
        <div className="wpos-overlay" onClick={() => setHoldOpen(false)}>
          <div className="wpos-modal wpos-modal-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Hold Orders</h2>
              <button type="button" className="wpos-util" onClick={() => setHoldOpen(false)}>
                <X size={14} />
              </button>
            </div>
            {!holds.length && (
              <div className="py-10 text-center text-[var(--wpos-muted)] text-sm">No held orders</div>
            )}
            <div className="space-y-2">
              {holds.map((h) => (
                <div
                  key={h.id}
                  className="rounded-xl border border-[var(--wpos-border)] bg-[var(--wpos-card)] p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="font-semibold text-[0.85rem]">{h.id}</div>
                    <div className="text-[0.7rem] text-[var(--wpos-muted)]">
                      {h.dealerName} · {h.cart.length} items · {formatCurrency(h.amount)}
                    </div>
                    <div className="text-[0.62rem] text-[var(--wpos-faint)]">
                      {new Date(h.createdAt).toLocaleString()} · {h.cashier}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="wpos-btn wpos-btn-primary !h-9 !text-[0.72rem]"
                      onClick={() => resumeHold(h)}
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      className="wpos-btn wpos-btn-danger !h-9 !text-[0.72rem]"
                      onClick={() => deleteHold(h.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {recentOpen && (
        <div className="wpos-overlay" onClick={() => setRecentOpen(false)}>
          <div className="wpos-modal wpos-modal-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Recent Wholesale Sales</h2>
              <button type="button" className="wpos-util" onClick={() => setRecentOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-left text-[0.75rem]">
                <thead className="text-[var(--wpos-faint)]">
                  <tr>
                    <th className="py-2 pr-2">Invoice</th>
                    <th className="py-2 pr-2">Dealer</th>
                    <th className="py-2 pr-2">Amount</th>
                    <th className="py-2 pr-2">Payment</th>
                    <th className="py-2 pr-2">Cashier</th>
                    <th className="py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-[var(--wpos-border)]">
                      <td className="py-2 pr-2 font-semibold">{r.invoiceNumber}</td>
                      <td className="py-2 pr-2">{r.dealerName}</td>
                      <td className="py-2 pr-2">{formatCurrency(r.amount)}</td>
                      <td className="py-2 pr-2">{r.payment}</td>
                      <td className="py-2 pr-2">{r.cashier}</td>
                      <td className="py-2">{r.time}</td>
                    </tr>
                  ))}
                  {!recent.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[var(--wpos-muted)]">
                        No recent wholesale sales in this session
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="wpos-overlay">
          <div className="wpos-modal p-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[var(--wpos-green-soft)] text-[var(--wpos-green)] grid place-items-center mb-3">
              <Check size={22} />
            </div>
            <h2 className="text-lg font-bold">Wholesale Invoice Created</h2>
            <p className="text-[var(--wpos-accent)] font-mono font-bold mt-1">
              {success.invoiceNumber}
            </p>
            <div className="mt-4 text-left rounded-xl border border-[var(--wpos-border)] bg-[var(--wpos-card)] p-3 text-[0.8rem] space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--wpos-muted)]">Dealer</span>
                <span className="font-semibold">{success.dealerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--wpos-muted)]">Total</span>
                <span className="font-bold text-[var(--wpos-green)]">
                  {formatCurrency(success.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--wpos-muted)]">Payment</span>
                <span>{success.payment}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--wpos-muted)]">Stock</span>
                <span className="text-[var(--wpos-green)]">Updated</span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="wpos-btn wpos-btn-secondary !h-10" onClick={printSuccess}>
                <Printer size={14} /> Print Invoice
              </button>
              <button
                type="button"
                className="wpos-btn wpos-btn-ghost !h-10"
                onClick={() => {
                  const blob = new Blob(
                    [
                      `${success.invoiceNumber}\n${success.dealerName}\n${formatCurrency(success.total)}\n${success.payment}`,
                    ],
                    { type: 'text/plain' },
                  )
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${success.invoiceNumber}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                Download
              </button>
              <button
                type="button"
                className="wpos-btn wpos-btn-ghost !h-10"
                onClick={async () => {
                  const text = `Wholesale Invoice ${success.invoiceNumber}\n${success.dealerName}\n${formatCurrency(success.total)}\n${success.payment}`
                  try {
                    if (navigator.share) await navigator.share({ title: success.invoiceNumber, text })
                    else {
                      await navigator.clipboard.writeText(text)
                      toast.success('Copied to clipboard')
                    }
                  } catch {
                    /* cancelled */
                  }
                }}
              >
                <Share2 size={14} /> Share
              </button>
              <button
                type="button"
                className="wpos-btn wpos-btn-primary !h-10"
                onClick={resetSale}
              >
                New Wholesale Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return createPortal(shell, document.body)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
