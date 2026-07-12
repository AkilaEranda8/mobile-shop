'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Plus, Trash2, Loader2, Package, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { deliveryApi, Courier } from '@/lib/delivery-api'
import { productsApi, customersApi } from '@/lib/api'

interface Props {
  couriers: Courier[]
  onClose: () => void
  onCreated: () => void
}

interface Item { description: string; quantity: number; unitPrice: number; productId?: string; stock?: number }
interface Product { id: string; name: string; sellingPrice: number; stock: number; sku: string }
interface Customer { id: string; name: string; phone: string; email?: string }

export default function CreateOrderModal({ couriers, onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    addressLine1: '', addressLine2: '', city: '', district: '', postalCode: '',
    deliveryCharge: 0, isCOD: false, codAmount: 0, notes: '',
  })
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, unitPrice: 0 }])
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [productSearch, setProductSearch] = useState<string[]>([''])
  const [showDropdown, setShowDropdown] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const customerDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    productsApi.list({ limit: '500' }).then((res: any) => {
      setProducts(res?.data?.data ?? res?.data ?? [])
    }).catch(() => {})
    customersApi.list({ limit: '500' }).then((res: any) => {
      setCustomers(res?.data?.data ?? res?.data ?? [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(null)
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node))
        setShowCustomerDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredCustomers = () => {
    const q = customerSearch.toLowerCase()
    if (!q) return customers.slice(0, 8)
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 8)
  }

  const selectCustomer = (c: Customer) => {
    set('customerName', c.name)
    set('customerPhone', c.phone)
    set('customerEmail', c.email ?? '')
    setCustomerSearch(c.name)
    setShowCustomerDropdown(false)
  }

  const filteredProducts = (idx: number) => {
    const q = productSearch[idx]?.toLowerCase() ?? ''
    if (!q) return products.slice(0, 8)
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    ).slice(0, 8)
  }

  const selectProduct = (idx: number, product: Product) => {
    setItems(i => i.map((it, n) => n === idx ? { ...it, description: product.name, unitPrice: product.sellingPrice, productId: product.id, stock: product.stock } : it))
    setProductSearch(s => s.map((v, n) => n === idx ? product.name : v))
    setShowDropdown(null)
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const addItem = () => {
    setItems(i => [...i, { description: '', quantity: 1, unitPrice: 0 }])
    setProductSearch(s => [...s, ''])
  }
  const removeItem = (idx: number) => {
    setItems(i => i.filter((_, n) => n !== idx))
    setProductSearch(s => s.filter((_, n) => n !== idx))
  }
  const updateItem = (idx: number, k: string, v: any) =>
    setItems(i => i.map((it, n) => n === idx ? { ...it, [k]: v } : it))

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const total    = subtotal + form.deliveryCharge

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customerName || !form.customerPhone || !form.addressLine1 || !form.city) {
      toast.error('Fill in required fields'); return
    }
    if (items.some(i => !i.description)) { toast.error('All items need a description'); return }
    const stockViolation = items.find(i => i.productId !== undefined && i.stock !== undefined && i.quantity > i.stock)
    if (stockViolation) {
      toast.error(`"${stockViolation.description}" has only ${stockViolation.stock} in stock — cannot order ${stockViolation.quantity}`)
      return
    }
    setSaving(true)
    try {
      await deliveryApi.createOrder({ ...form, items, subtotal })
      toast.success('Delivery order created!')
      onCreated()
    } catch (e: any) { toast.error(e?.message ?? 'Failed to create order') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0f1623] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#0f1623]">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-violet-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">New Delivery Order</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Customer */}
          <div ref={customerDropdownRef}>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Customer Details</p>
            {/* Customer search */}
            <div className="relative mb-3">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                className="input-field text-sm w-full pl-7"
                value={customerSearch}
                placeholder="Search existing customer..."
                onFocus={() => setShowCustomerDropdown(true)}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true) }}
              />
              {showCustomerDropdown && filteredCustomers().length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl shadow-2xl overflow-hidden"
                  style={{ background: '#1a2235', border: '1px solid var(--border-default)' }}>
                  {filteredCustomers().map(c => (
                    <button key={c.id} type="button"
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors"
                      onMouseDown={() => selectCustomer(c)}>
                      <div>
                        <p className="text-xs font-medium text-white">{c.name}</p>
                        <p className="text-[10px] text-slate-500">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Name *</label>
                <input className="input-field text-sm w-full" value={form.customerName}
                  onChange={e => { set('customerName', e.target.value); setCustomerSearch(e.target.value) }} placeholder="Customer name" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Phone *</label>
                <input className="input-field text-sm w-full" value={form.customerPhone}
                  onChange={e => set('customerPhone', e.target.value)} placeholder="077 xxx xxxx" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Email</label>
                <input className="input-field text-sm w-full" value={form.customerEmail}
                  onChange={e => set('customerEmail', e.target.value)} placeholder="optional" />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Delivery Address</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Address Line 1 *</label>
                <input className="input-field text-sm w-full" value={form.addressLine1}
                  onChange={e => set('addressLine1', e.target.value)} placeholder="Street, No." />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Address Line 2</label>
                <input className="input-field text-sm w-full" value={form.addressLine2}
                  onChange={e => set('addressLine2', e.target.value)} placeholder="Area, landmark" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">City *</label>
                <input className="input-field text-sm w-full" value={form.city}
                  onChange={e => set('city', e.target.value)} placeholder="Colombo" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">District</label>
                <input className="input-field text-sm w-full" value={form.district}
                  onChange={e => set('district', e.target.value)} placeholder="Western" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Postal Code</label>
                <input className="input-field text-sm w-full" value={form.postalCode}
                  onChange={e => set('postalCode', e.target.value)} placeholder="10350" />
              </div>
            </div>
          </div>

          {/* Items */}
          <div ref={dropdownRef}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Order Items</p>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                <Plus size={12} /> Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
                  {/* Product search row */}
                  <div className="relative">
                    <div className="relative">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        className="input-field text-sm w-full pl-7"
                        value={productSearch[i] ?? ''}
                        placeholder="Search product from inventory..."
                        onFocus={() => setShowDropdown(i)}
                        onChange={e => {
                          setProductSearch(s => s.map((v, n) => n === i ? e.target.value : v))
                          updateItem(i, 'description', e.target.value)
                          setShowDropdown(i)
                        }}
                      />
                    </div>
                    {showDropdown === i && filteredProducts(i).length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl shadow-2xl overflow-hidden"
                        style={{ background: '#1a2235', border: '1px solid var(--border-default)' }}>
                        {filteredProducts(i).map(p => (
                          <button key={p.id} type="button"
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors"
                            onMouseDown={() => selectProduct(i, p)}>
                            <div>
                              <p className="text-xs font-medium text-white">{p.name}</p>
                              <p className="text-[10px] text-slate-500">{p.sku} · Stock: {p.stock}</p>
                            </div>
                            <span className="text-xs font-semibold text-violet-400 ml-3 whitespace-nowrap">
                              LKR {p.sellingPrice.toLocaleString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Qty / Price / Total row */}
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-[10px] text-slate-500 mb-1 block">Description</label>
                      <input className="input-field text-xs w-full" value={item.description}
                        onChange={e => {
                          updateItem(i, 'description', e.target.value)
                          setItems(prev => prev.map((it, n) => n === i ? { ...it, productId: undefined, stock: undefined } : it))
                          setProductSearch(s => s.map((v, n) => n === i ? e.target.value : v))
                        }} placeholder="Item description" />
                    </div>
                    <div className="w-16">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-slate-500">Qty</label>
                        {item.stock !== undefined && (
                          <span className={`text-[9px] font-semibold ${item.quantity > item.stock ? 'text-red-400' : 'text-green-400'}`}>
                            /{item.stock}
                          </span>
                        )}
                      </div>
                      <input type="number" min={1} className={`input-field text-xs w-full ${item.stock !== undefined && item.quantity > item.stock ? 'border-red-500/50 text-red-400' : ''}`}
                        value={item.quantity} onChange={e => updateItem(i, 'quantity', +e.target.value)} />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] text-slate-500 mb-1 block">Unit Price</label>
                      <input type="number" min={0} className="input-field text-xs w-full" value={item.unitPrice}
                        onChange={e => updateItem(i, 'unitPrice', +e.target.value)} />
                    </div>
                    <div className="w-20 text-right">
                      <label className="text-[10px] text-slate-500 mb-1 block">Total</label>
                      <p className="text-xs font-semibold text-white pt-1">{(item.quantity * item.unitPrice).toLocaleString()}</p>
                    </div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="pt-4 text-red-400 hover:text-red-300">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {item.stock !== undefined && item.quantity > item.stock && (
                    <p className="text-[10px] text-red-400 mt-1">⚠ Only {item.stock} in stock — reduce quantity to continue</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Charges */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Delivery Charge (LKR)</label>
              <input type="number" min={0} className="input-field text-sm w-full" value={form.deliveryCharge}
                onChange={e => set('deliveryCharge', +e.target.value)} />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isCOD} onChange={e => set('isCOD', e.target.checked)}
                  className="rounded border-slate-600" />
                <span className="text-sm text-slate-300">Cash on Delivery (COD)</span>
              </label>
              {form.isCOD && (
                <input type="number" min={0} className="input-field text-sm w-full" value={form.codAmount}
                  onChange={e => set('codAmount', +e.target.value)} placeholder="COD Amount" />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Notes</label>
            <textarea rows={2} className="input-field text-sm w-full resize-none" value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Any special instructions..." />
          </div>

          {/* Summary */}
          <div className="rounded-xl p-3 space-y-1 text-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}><span>Subtotal</span><span>LKR {subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}><span>Delivery</span><span>LKR {form.deliveryCharge.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold pt-1" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
              <span>Total</span><span>LKR {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button type="submit" disabled={saving}
              className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}Create Order
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
