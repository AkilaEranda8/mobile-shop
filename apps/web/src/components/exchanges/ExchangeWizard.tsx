'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  X, Loader2, ArrowLeftRight, User, Smartphone, Search, ChevronRight, ChevronLeft,
  CheckCircle, Receipt, Printer,
} from 'lucide-react'
import { exchangesApi, customersApi, deviceCatalogApi, imeiApi, tenantApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { getInvoiceSettings, fetchInvoiceSettings, shopContextFromTenant, type InvoiceSettings, type ShopContext } from '@/lib/invoiceSettings'
import { authStorage } from '@/lib/auth'
import { buildReceiptFromApiSale, printReceipt, receiptPrintLabel } from '@/lib/printReceipt'
import InvoicePrint, { type InvoiceData } from '@/components/invoice/InvoicePrint'
import toast from 'react-hot-toast'

const CONDITIONS = [
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD',      label: 'Good' },
  { value: 'FAIR',      label: 'Fair' },
  { value: 'POOR',      label: 'Poor' },
]

const STEPS = ['Customer', 'Trade-in Phone', 'New Phone', 'Payment', 'Complete']

type StockItem = {
  imeiRecordId: string
  imei: string
  productId: string
  productName: string
  brand: string
  model: string
  storage?: string
  color?: string
  sellPrice: number
  variation?: string
}

function buildInvoiceFromSale(sale: any, settings: InvoiceSettings): InvoiceData {
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
    items: [
      ...(sale.items ?? []).map((i: any) => ({
        description: i.productName,
        details:     i.imei ? `IMEI: ${i.imei}` : undefined,
        price:       i.unitPrice,
        qty:         i.quantity,
      })),
      ...(sale.discount > 0 ? [{
        description: 'Trade-in credit',
        details:     sale.notes?.split('\n').find((l: string) => l.startsWith('Trade-in:')) ?? undefined,
        price:       -sale.discount,
        qty:         1,
      }] : []),
    ],
    bankName:       settings.bankName || '',
    accNumber:      settings.accNumber || '',
    accHolder:      settings.accHolder || '',
    swiftCode:      settings.swiftCode || '',
    taxRate:        0,
    discountRate:   sale.subtotal > 0 ? (sale.discount / sale.subtotal) * 100 : 0,
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

  const invoiceData = result?.sale ? buildInvoiceFromSale(result.sale, invSettings) : null

  const handlePrintReceipt = () => {
    if (!result?.sale) return
    printReceipt(
      buildReceiptFromApiSale(result.sale, {
        warranties: result.warranties,
        customerAddress: form.customerAddress || undefined,
      }),
      invSettings,
      thermalShopCtx,
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
        <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500 flex-shrink-0" />

        <div className="flex items-center justify-between p-5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ArrowLeftRight size={16} className="text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Device Exchange</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{STEPS[step]}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        {step < 4 && (
          <div className="px-5 pt-4 flex gap-1">
            {STEPS.slice(0, 4).map((s, i) => (
              <div key={s} className="h-1 flex-1 rounded-full transition-colors"
                style={{ background: i <= step ? '#f59e0b' : 'var(--border-subtle)' }} />
            ))}
          </div>
        )}

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* Step 0: Customer */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <User size={9} /> Customer Details
              </p>
              <div className="relative">
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                <input className="input-field" placeholder="Customer name" value={form.customerName}
                  onChange={e => searchCustomers(e.target.value)}
                  onFocus={() => custResults.length > 0 && setShowCustDrop(true)} />
                {searching && <Loader2 size={12} className="absolute right-3 top-9 animate-spin" style={{ color: 'var(--text-muted)' }} />}
                {showCustDrop && custResults.length > 0 && (
                  <div className="absolute z-30 top-full mt-1 w-full rounded-xl shadow-2xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
                    {custResults.map((c: any) => (
                      <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)}
                        className="w-full px-3 py-2.5 hover:bg-violet-500/10 text-left"
                        style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <p className="text-xs" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Mobile No *</label>
                <input className="input-field" placeholder="07XXXXXXXX" value={form.customerPhone}
                  onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Address</label>
                <textarea rows={2} className="input-field resize-none" placeholder="Customer address"
                  value={form.customerAddress}
                  onChange={e => setForm(p => ({ ...p, customerAddress: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Step 1: Trade-in */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Smartphone size={9} /> Buy Phone (from customer)
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">This phone will be added to stock as Exchange Purchase</p>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Product Name</label>
                <input className="input-field" placeholder="e.g. Samsung Galaxy A14"
                  value={form.oldProductName}
                  onChange={e => setForm(p => ({ ...p, oldProductName: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Brand *</label>
                  <select className="input-field" value={form.oldBrand}
                    onChange={e => {
                      const b = brands.find((x: any) => x.name === e.target.value)
                      setForm(p => ({ ...p, oldBrand: e.target.value, oldBrandId: b?.id ?? '', oldModel: '' }))
                    }}>
                    <option value="">Select brand</option>
                    {brands.map((b: any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Model *</label>
                  <select className="input-field" value={form.oldModel}
                    onChange={e => setForm(p => ({ ...p, oldModel: e.target.value }))} disabled={!form.oldBrand}>
                    <option value="">Select model</option>
                    {models.map((m: any) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>IMEI *</label>
                  <input className="input-field font-mono" placeholder="15 digits" maxLength={15}
                    value={form.oldImei} onChange={e => setForm(p => ({ ...p, oldImei: e.target.value.replace(/\D/g, '') }))} />
                  {oldImeiChecking && <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Loader2 size={10} className="animate-spin" /> Checking IMEI…</p>}
                  {oldImeiWarning && (
                    <p className={`text-[10px] mt-1 ${oldImeiWarning.includes('already') ? 'text-red-400' : 'text-amber-400'}`}>
                      {oldImeiWarning}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Condition</label>
                  <select className="input-field" value={form.oldCondition}
                    onChange={e => setForm(p => ({ ...p, oldCondition: e.target.value }))}>
                    {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Colour</label>
                  <input className="input-field" placeholder="e.g. Black" value={form.oldColor}
                    onChange={e => setForm(p => ({ ...p, oldColor: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Storage</label>
                  <input className="input-field" placeholder="e.g. 128GB" value={form.oldStorage}
                    onChange={e => setForm(p => ({ ...p, oldStorage: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Buy Price (LKR) *</label>
                  <input type="number" min="0" className="input-field" placeholder="Valuation amount"
                    value={form.buyPrice} onChange={e => setForm(p => ({ ...p, buyPrice: e.target.value }))} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select new phone */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Smartphone size={9} /> Select New Phone from Stock
              </p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input className="input-field pl-9" placeholder="Search IMEI, name, model..."
                  value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
              </div>
              {stockLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-amber-400" /></div>
              ) : stock.length === 0 ? (
                <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>No phones in stock</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stock.map(item => (
                    <button key={item.imeiRecordId} type="button"
                      onClick={() => setSelectedStock(item)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        selectedStock?.imeiRecordId === item.imeiRecordId
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'hover:opacity-90'
                      }`}
                      style={selectedStock?.imeiRecordId !== item.imeiRecordId
                        ? { background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }
                        : undefined}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.productName}</p>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.brand} {item.model}</p>
                          <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.imei}</p>
                          {(item.color || item.storage) && (
                            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{[item.storage, item.color].filter(Boolean).join(' · ')}</p>
                          )}
                        </div>
                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(item.sellPrice)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {step === 3 && selectedStock && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>New phone sell price</span><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(sellPrice)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Trade-in buy price</span><span className="text-amber-600 dark:text-amber-400 font-semibold">− {formatCurrency(buyPrice)}</span></div>
                <div className="flex justify-between pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="font-bold" style={{ color: 'var(--text-primary)' }}>Balance</span>
                  <span className={`font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {formatCurrency(Math.abs(balance))}
                    <span className="text-xs font-normal ml-1" style={{ color: 'var(--text-muted)' }}>
                      {balance >= 0 ? '(customer pays)' : '(shop refunds)'}
                    </span>
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Payment Method</label>
                  <select className="input-field" value={form.paymentMethod}
                    onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value as any }))}>
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Amount</label>
                  <input type="number" className="input-field" placeholder={String(balance)}
                    value={form.paidAmount}
                    onChange={e => setForm(p => ({ ...p, paidAmount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                <textarea rows={2} className="input-field resize-none" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && result && (
            <div className="text-center space-y-4 py-4">
              <CheckCircle size={48} className="mx-auto text-emerald-500" />
              <div>
                <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Exchange Complete</p>
                <p className="text-xs font-mono text-amber-600 dark:text-amber-400 mt-1">{result.exchange?.exchangeNumber}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Invoice: {result.sale?.invoiceNumber}</p>
              </div>
              <div className="rounded-xl p-3 text-left text-xs space-y-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                <p style={{ color: 'var(--text-muted)' }}>Trade-in added to stock · New phone marked sold</p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Balance: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(Math.abs(result.balance ?? result.exchange?.balanceAmount ?? 0))}</span>
                  {' '}{(result.balanceDirection ?? result.exchange?.balanceDirection) === 'SHOP_REFUNDS' ? 'refunded to customer' : 'paid by customer'}
                </p>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
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
          )}
        </div>

        {step < 4 && (
          <div className="flex gap-3 p-5 flex-shrink-0" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {step > 0 ? (
              <button type="button" onClick={() => setStep(s => s - 1)} className="btn-secondary flex items-center gap-1 text-sm">
                <ChevronLeft size={14} /> Back
              </button>
            ) : (
              <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-3 border-b">
              <span className="text-sm font-bold text-slate-800">Exchange Invoice</span>
              <button type="button" onClick={() => setShowInvoice(false)} className="p-1"><X size={18} /></button>
            </div>
            <InvoicePrint data={invoiceData} />
          </div>
        </div>
      )}
    </div>
  )
}
