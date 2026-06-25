'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  X, Loader2, ArrowLeftRight, User, Smartphone, ChevronRight, ChevronLeft,
  CheckCircle, Receipt, Printer, Check, CreditCard,
} from 'lucide-react'
import { exchangesApi, customersApi, deviceCatalogApi, imeiApi, tenantApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { getInvoiceSettings, fetchInvoiceSettings, shopContextFromTenant, type InvoiceSettings, type ShopContext } from '@/lib/invoiceSettings'
import { authStorage } from '@/lib/auth'
import { buildReceiptFromApiSale, printReceipt, receiptPrintLabel } from '@/lib/printReceipt'
import {
  tradeInFromExchange,
  tradeInFromSale,
  tradeInDetailLines,
  tradeInLineLabel,
  soldVariantFromExchange,
  soldVariantFromSale,
  soldItemDetailLines,
  soldConditionFromSale,
  productNameWithVariant,
  type ExchangeTradeInBill,
} from '@/lib/exchangeBill'
import InvoicePrint, { type InvoiceData } from '@/components/invoice/InvoicePrint'
import { ExchangeStockPicker, type ExchangeStockItem } from '@/components/exchanges/ExchangeStockPicker'
import toast from 'react-hot-toast'

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD',      label: 'Good' },
  { value: 'FAIR',      label: 'Fair' },
  { value: 'POOR',      label: 'Poor' },
]

const WIZARD_STEPS = [
  { n: 1, label: 'Customer', icon: User },
  { n: 2, label: 'Trade-in', icon: Smartphone },
  { n: 3, label: 'New Phone', icon: Smartphone },
  { n: 4, label: 'Payment', icon: CreditCard },
] as const

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
      {children}
    </label>
  )
}

function SectionCard({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
        <Icon size={16} className="text-amber-500" />
        <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h4>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

type StockItem = ExchangeStockItem

function buildInvoiceFromSale(
  sale: any,
  settings: InvoiceSettings,
  tradeIn?: ExchangeTradeInBill | null,
  exchange?: { newStorage?: string | null; newColor?: string | null; soldVariation?: string | null } | null,
  warranties?: any[],
): InvoiceData {
  const resolvedTradeIn = tradeIn ?? tradeInFromSale(sale)
  const fromExchange = soldVariantFromExchange(exchange)
  const soldVar = (fromExchange.storage || fromExchange.color) ? fromExchange : soldVariantFromSale(sale)
  const soldCondition = soldConditionFromSale(sale) ?? 'BRAND_NEW'
  const warrantyList = warranties ?? sale.warranties ?? []

  const soldItems = (sale.items ?? []).map((i: any) => {
    const warranty = warrantyList.find((w: any) => w.imei === i.imei) ?? warrantyList[0]
    const warrantyMonths = Number(i.warrantyMonths ?? warranty?.monthsDuration ?? 0) || undefined
    return {
      description: productNameWithVariant(i.productName, soldVar.storage, soldVar.color),
      details: soldItemDetailLines({
        storage: soldVar.storage,
        color: soldVar.color,
        imei: i.imei,
        condition: soldCondition,
        warrantyMonths,
        warrantyEndDate: warranty?.endDate,
        saleDate: sale.createdAt,
        includeVariant: false,
      }).join(' · ') || undefined,
      price:       i.unitPrice,
      qty:         i.quantity,
    }
  })

  const tradeInItems = resolvedTradeIn
    ? [{
        description: tradeInLineLabel(resolvedTradeIn),
        details: tradeInDetailLines(resolvedTradeIn).join(' · ') || undefined,
        price: -resolvedTradeIn.creditAmount,
        qty: 1,
      }]
    : sale.discount > 0
      ? [{
          description: 'Trade-in credit',
          details: sale.notes?.split('\n').find((l: string) => l.startsWith('Trade-in:')) ?? undefined,
          price: -sale.discount,
          qty: 1,
        }]
      : []

  return {
    companyName:     settings.shopName || 'Shop',
    companySlogan:   settings.slogan,
    companyLogo:     settings.logo,
    companyAddress:  settings.address || '',
    companyPhone:    settings.phone || '',
    companyEmail:    settings.email || '',
    companyWebsite:  settings.website || '',
    invoiceNumber:   sale.invoiceNumber,
    dueDate:         new Date(sale.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
    customerName:    sale.customerName || 'Customer',
    customerEmail:   '',
    customerAddress: sale.customerPhone ? `Phone: ${sale.customerPhone}` : '',
    items: [...soldItems, ...tradeInItems],
    bankName:       settings.bankName || '',
    accNumber:      settings.accNumber || '',
    accHolder:      settings.accHolder || '',
    swiftCode:      settings.swiftCode || '',
    taxRate:        0,
    discountRate: resolvedTradeIn ? 0 : sale.subtotal > 0 ? (sale.discount / sale.subtotal) * 100 : 0,
    terms:          settings.terms?.length ? settings.terms : ['Thank you for your business!'],
    signatoryName:  settings.signatoryName || settings.shopName || '',
    signatoryTitle: settings.signatoryTitle || 'Authorised Signatory',
  }
}

export function ExchangeWizard({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockSearch, setStockSearch] = useState('')
  const [stock, setStock] = useState<StockItem[]>([])
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null)
  const [result, setResult] = useState<any>(null)
  const [invSettings, setInvSettings] = useState<InvoiceSettings>(() => getInvoiceSettings())
  const [thermalShopCtx, setThermalShopCtx] = useState<ShopContext | undefined>(undefined)
  const [showInvoice, setShowInvoice] = useState(false)

  const [custResults, setCustResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [showCustDrop, setShowCustDrop] = useState(false)
  const [oldImeiWarning, setOldImeiWarning] = useState<string | null>(null)
  const [oldImeiChecking, setOldImeiChecking] = useState(false)
  const [brands, setBrands] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])

  const [form, setForm] = useState({
    customerId:       '',
    customerName:     '',
    customerPhone:    '',
    customerAddress:  '',
    oldProductName:   '',
    oldBrand:         '',
    oldBrandId:       '',
    oldModel:         '',
    oldImei:          '',
    oldColor:         '',
    oldStorage:       '',
    oldCondition:     'GOOD',
    buyPrice:         '',
    paymentMethod:    'CASH' as const,
    paidAmount:       '',
    notes:            '',
  })

  useEffect(() => {
    deviceCatalogApi.listBrands().then((r: any) => setBrands(r.data ?? r ?? [])).catch(() => {})
    const user = authStorage.getUser()
    if (!user?.tenantId) return
    const branchId = user.branchIds?.[0]
    const loadSettings = () => {
      Promise.all([
        fetchInvoiceSettings(user.tenantId, branchId),
        tenantApi.get(user.tenantId).catch(() => null),
      ]).then(([settings, tenantRes]) => {
        setInvSettings(settings)
        const tenant = (tenantRes as any)?.data ?? tenantRes
        setThermalShopCtx(shopContextFromTenant(tenant, branchId))
      }).catch(() => {})
    }
    loadSettings()
    window.addEventListener('invoice-settings-updated', loadSettings)
    return () => window.removeEventListener('invoice-settings-updated', loadSettings)
  }, [])

  useEffect(() => {
    if (form.oldBrandId) {
      deviceCatalogApi.listModels(form.oldBrandId).then((r: any) => setModels(r.data ?? r ?? [])).catch(() => {})
    } else setModels([])
  }, [form.oldBrandId])

  const sellPrice = selectedStock?.sellPrice ?? 0
  const buyPrice  = parseFloat(form.buyPrice) || 0
  const balance   = sellPrice - buyPrice

  useEffect(() => {
    if (step !== 2) return
    setStockLoading(true)
    const t = setTimeout(() => {
      exchangesApi.listAvailableStock({
        search: stockSearch || undefined,
        excludeImei: /^\d{15}$/.test(form.oldImei) ? form.oldImei : undefined,
      })
        .then((r: any) => {
          const items = (r.data ?? r ?? []) as StockItem[]
          setStock(items.filter(i => i.imei !== form.oldImei))
        })
        .catch(() => setStock([]))
        .finally(() => setStockLoading(false))
    }, 300)
    return () => clearTimeout(t)
  }, [step, stockSearch, form.oldImei])

  useEffect(() => {
    if (step !== 3 || form.paidAmount) return
    setForm(p => ({ ...p, paidAmount: String(balance) }))
  }, [step, balance, form.paidAmount])

  useEffect(() => {
    if (!/^\d{15}$/.test(form.oldImei)) {
      setOldImeiWarning(null)
      return
    }
    setOldImeiChecking(true)
    const t = setTimeout(() => {
      imeiApi.lookup(form.oldImei)
        .then((r: any) => {
          const data = r.data ?? r
          const rec = data.record
          if (!rec) {
            setOldImeiWarning(null)
            return
          }
          if (rec.status === 'IN_STOCK') {
            setOldImeiWarning('This IMEI is already in your stock — cannot accept as trade-in')
          } else if (rec.status === 'SOLD') {
            setOldImeiWarning('Previously sold from this shop — will be re-added to stock on exchange')
          } else {
            setOldImeiWarning(`IMEI status: ${rec.status} — verify before accepting`)
          }
        })
        .catch(() => setOldImeiWarning(null))
        .finally(() => setOldImeiChecking(false))
    }, 400)
    return () => clearTimeout(t)
  }, [form.oldImei])

  const searchCustomers = (q: string) => {
    setForm(p => ({ ...p, customerName: q }))
    if (q.length < 2) { setCustResults([]); return }
    setSearching(true)
    customersApi.search(q).then((r: any) => {
      setCustResults(r.data ?? r ?? [])
      setShowCustDrop(true)
    }).catch(() => {}).finally(() => setSearching(false))
  }

  const selectCustomer = (c: any) => {
    setForm(p => ({
      ...p,
      customerId:      c.id,
      customerName:    c.name,
      customerPhone:   c.phone ?? '',
      customerAddress: c.address ?? '',
    }))
    setShowCustDrop(false)
    setCustResults([])
  }

  const canNext = useMemo(() => {
    if (step === 0) return form.customerName.trim() && form.customerPhone.trim().length >= 7
    if (step === 1) return form.oldBrand && form.oldModel && /^\d{15}$/.test(form.oldImei) && buyPrice >= 0 && !oldImeiWarning?.includes('already in your stock')
    if (step === 2) return !!selectedStock
    if (step === 3) return true
    return false
  }, [step, form, buyPrice, selectedStock, oldImeiWarning])

  const handleComplete = async () => {
    if (!selectedStock) return
    setLoading(true)
    try {
      const res: any = await exchangesApi.complete({
        customerId:      form.customerId || undefined,
        customerName:      form.customerName,
        customerPhone:     form.customerPhone,
        customerAddress:   form.customerAddress || undefined,
        oldProductName:    form.oldProductName || undefined,
        oldBrand:          form.oldBrand,
        oldModel:          form.oldModel,
        oldImei:           form.oldImei,
        oldColor:          form.oldColor || undefined,
        oldStorage:        form.oldStorage || undefined,
        oldCondition:      form.oldCondition,
        buyPrice,
        soldProductId:     selectedStock.productId,
        soldImei:          selectedStock.imei,
        soldVariation:     selectedStock.variation,
        soldSellPrice:     selectedStock.sellPrice,
        paymentMethod:     form.paymentMethod,
        paidAmount:        form.paidAmount ? parseFloat(form.paidAmount) : balance,
        notes:             form.notes || undefined,
      })
      const data = res.data ?? res
      setResult(data)
      setStep(4)
      toast.success('Exchange completed!')
      onSaved()
    } catch (err: any) {
      toast.error(err?.message ?? 'Exchange failed')
    } finally {
      setLoading(false)
    }
  }

  const tradeIn = result?.exchange ? tradeInFromExchange(result.exchange) : null
  const invoiceData = result?.sale
    ? buildInvoiceFromSale(result.sale, invSettings, tradeIn, result.exchange, result.warranties)
    : null

  const handlePrintReceipt = () => {
    if (!result?.sale) return
    printReceipt(
      buildReceiptFromApiSale(result.sale, {
        warranties: result.warranties,
        customerAddress: form.customerAddress || undefined,
        tradeIn,
        soldVariant: soldVariantFromExchange(result.exchange),
        soldCondition: selectedStock?.condition ?? soldConditionFromSale(result.sale) ?? 'BRAND_NEW',
      }),
      invSettings,
      thermalShopCtx,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[96vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-5 border-b sticky top-0 z-20"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.25)' }}>
              <ArrowLeftRight size={18} style={{ color: '#d97706' }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {step === 4 ? 'Exchange Complete' : 'New Exchange'}
              </h3>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                {step === 4
                  ? (result?.exchange?.exchangeNumber ?? 'Saved successfully')
                  : 'Trade-in, sell from stock, and invoice in one flow'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-rose-500/10 hover:text-rose-500 flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Stepper */}
        {step < 4 && (
          <div className="px-5 sm:px-6 py-4 border-b overflow-x-auto" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center min-w-max">
              {WIZARD_STEPS.map(({ n, label }, i) => {
                const active = step === n - 1
                const done = step > n - 1
                return (
                  <div key={n} className={`flex items-center ${i < WIZARD_STEPS.length - 1 ? 'flex-1' : ''}`}>
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          done || active ? 'bg-amber-500 text-white' : ''
                        }`}
                        style={!done && !active ? { border: '2px solid var(--border-subtle)', color: 'var(--text-muted)' } : active ? { boxShadow: '0 0 0 3px rgba(245,158,11,0.2)' } : undefined}
                      >
                        {done ? <Check size={12} /> : n}
                      </div>
                      <span
                        className={`text-xs font-semibold hidden sm:inline ${active ? 'text-amber-600 dark:text-amber-400' : done ? 'text-amber-500/80' : ''}`}
                        style={!active && !done ? { color: 'var(--text-muted)' } : undefined}
                      >
                        {label}
                      </span>
                    </div>
                    {i < WIZARD_STEPS.length - 1 && (
                      <div className="flex-1 h-px mx-2 sm:mx-3 transition-all min-w-[12px]"
                        style={{ background: done ? 'rgba(245,158,11,0.45)' : 'var(--border-subtle)' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="p-5 sm:p-6 flex-1">
          {/* Step 0: Customer */}
          {step === 0 && (
            <SectionCard icon={User} title="Customer Details">
              <div className="relative">
                <FieldLabel>Name *</FieldLabel>
                <input className="input-field w-full" placeholder="Customer name" value={form.customerName}
                  onChange={e => searchCustomers(e.target.value)}
                  onFocus={() => custResults.length > 0 && setShowCustDrop(true)} />
                {searching && <Loader2 size={12} className="absolute right-3 top-9 animate-spin" style={{ color: 'var(--text-muted)' }} />}
                {showCustDrop && custResults.length > 0 && (
                  <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    {custResults.map((c: any) => (
                      <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)}
                        className="w-full px-3 py-2.5 hover:bg-amber-500/10 text-left"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Mobile No *</FieldLabel>
                <input className="input-field w-full" placeholder="07XXXXXXXX" value={form.customerPhone}
                  onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Address</FieldLabel>
                <textarea rows={2} className="input-field w-full resize-none" placeholder="Customer address"
                  value={form.customerAddress}
                  onChange={e => setForm(p => ({ ...p, customerAddress: e.target.value }))} />
              </div>
            </SectionCard>
          )}

          {/* Step 1: Trade-in */}
          {step === 1 && (
            <SectionCard icon={Smartphone} title="Trade-in Phone (Buy from Customer)">
              <p className="text-xs rounded-lg px-3 py-2 text-amber-700 dark:text-amber-300"
                style={{ background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)' }}>
                This phone will be added to stock as an exchange purchase.
              </p>
              <div>
                <FieldLabel>Product Name</FieldLabel>
                <input className="input-field w-full" placeholder="e.g. Samsung Galaxy A14"
                  value={form.oldProductName}
                  onChange={e => setForm(p => ({ ...p, oldProductName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Brand *</FieldLabel>
                  <select className="input-field w-full" value={form.oldBrand}
                    onChange={e => {
                      const b = brands.find((x: any) => x.name === e.target.value)
                      setForm(p => ({ ...p, oldBrand: e.target.value, oldBrandId: b?.id ?? '', oldModel: '' }))
                    }}>
                    <option value="">Select brand</option>
                    {brands.map((b: any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Model *</FieldLabel>
                  <select className="input-field w-full" value={form.oldModel}
                    onChange={e => setForm(p => ({ ...p, oldModel: e.target.value }))} disabled={!form.oldBrand}>
                    <option value="">Select model</option>
                    {models.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>IMEI *</FieldLabel>
                  <input className="input-field w-full font-mono" placeholder="15 digits" maxLength={15}
                    value={form.oldImei} onChange={e => setForm(p => ({ ...p, oldImei: e.target.value.replace(/\D/g, '') }))} />
                  {oldImeiChecking && (
                    <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      <Loader2 size={10} className="animate-spin" /> Checking IMEI…
                    </p>
                  )}
                  {oldImeiWarning && (
                    <p className={`text-[10px] mt-1 ${oldImeiWarning.includes('already') ? 'text-rose-500' : 'text-amber-600 dark:text-amber-400'}`}>
                      {oldImeiWarning}
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>Condition</FieldLabel>
                  <select className="input-field w-full" value={form.oldCondition}
                    onChange={e => setForm(p => ({ ...p, oldCondition: e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Colour</FieldLabel>
                  <input className="input-field w-full" placeholder="e.g. Black" value={form.oldColor}
                    onChange={e => setForm(p => ({ ...p, oldColor: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>Storage</FieldLabel>
                  <input className="input-field w-full" placeholder="e.g. 128GB" value={form.oldStorage}
                    onChange={e => setForm(p => ({ ...p, oldStorage: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Buy Price (LKR) *</FieldLabel>
                  <input type="number" min="0" className="input-field w-full" placeholder="Valuation amount"
                    value={form.buyPrice} onChange={e => setForm(p => ({ ...p, buyPrice: e.target.value }))} />
                </div>
              </div>
            </SectionCard>
          )}

          {/* Step 2: Select new phone */}
          {step === 2 && (
            <SectionCard icon={Smartphone} title="Select New Phone from Stock">
              <ExchangeStockPicker
                stock={stock}
                loading={stockLoading}
                search={stockSearch}
                onSearchChange={setStockSearch}
                selected={selectedStock}
                onSelect={setSelectedStock}
              />
            </SectionCard>
          )}

          {/* Step 3: Payment */}
          {step === 3 && selectedStock && (
            <SectionCard icon={CreditCard} title="Payment & Balance">
              <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex justify-between gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>New phone sell price</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(sellPrice)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>Trade-in buy price</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">− {formatCurrency(buyPrice)}</span>
                </div>
                <div className="flex justify-between gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Balance</span>
                  <span className={`font-bold text-right ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(Math.abs(balance))}
                    <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                      {balance >= 0 ? '(customer pays)' : '(shop refunds)'}
                    </span>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Payment Method</FieldLabel>
                  <select className="input-field w-full" value={form.paymentMethod}
                    onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value as any }))}>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Amount</FieldLabel>
                  <input type="number" className="input-field w-full" placeholder={String(balance)}
                    value={form.paidAmount}
                    onChange={e => setForm(p => ({ ...p, paidAmount: e.target.value }))} />
                </div>
              </div>
              <div>
                <FieldLabel>Notes</FieldLabel>
                <textarea rows={2} className="input-field w-full resize-none" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </SectionCard>
          )}

          {/* Step 4: Success */}
          {step === 4 && result && (
            <div className="rounded-xl border overflow-hidden text-center" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="p-8 space-y-4">
                <CheckCircle size={52} className="mx-auto text-emerald-500" />
                <div>
                  <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Exchange Complete</p>
                  <p className="text-xs font-mono text-amber-600 dark:text-amber-400 mt-1">{result.exchange?.exchangeNumber}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Invoice: {result.sale?.invoiceNumber}</p>
                </div>
                <div className="rounded-xl p-4 text-left text-xs space-y-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  <p style={{ color: 'var(--text-muted)' }}>Trade-in added to stock · New phone marked sold</p>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Balance: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(Math.abs(result.balance ?? result.exchange?.balanceAmount ?? 0))}</span>
                    {' '}{(result.balanceDirection ?? result.exchange?.balanceDirection) === 'SHOP_REFUNDS' ? 'refunded to customer' : 'paid by customer'}
                  </p>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button type="button" onClick={() => setShowInvoice(true)}
                      className="btn-secondary text-sm flex items-center justify-center gap-2">
                      <Receipt size={14} /> View Invoice
                    </button>
                    <button type="button" onClick={handlePrintReceipt}
                      className="text-sm flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold border transition-colors bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                      <Printer size={14} /> {receiptPrintLabel(invSettings)}
                    </button>
                  </div>
                  <button type="button" onClick={onClose} className="btn-primary text-sm w-full">Done</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {step < 4 && (
          <div className="sticky bottom-0 flex gap-3 px-5 sm:px-6 py-4 border-t"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            {step > 0 ? (
              <button type="button" onClick={() => setStep(s => s - 1)}
                className="flex items-center justify-center gap-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
                <ChevronLeft size={14} /> Back
              </button>
            ) : (
              <button type="button" onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
                Cancel
              </button>
            )}
            <button type="button" disabled={!canNext || loading}
              onClick={() => step === 3 ? handleComplete() : setStep(s => s + 1)}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : step === 3 ? <ArrowLeftRight size={14} /> : <ChevronRight size={14} />}
              {loading ? 'Processing…' : step === 3 ? 'Complete Exchange' : 'Next'}
            </button>
          </div>
        )}
      </div>

      {showInvoice && invoiceData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Exchange Invoice</h3>
              <button type="button" onClick={() => setShowInvoice(false)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 bg-white">
              <InvoicePrint data={invoiceData} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
