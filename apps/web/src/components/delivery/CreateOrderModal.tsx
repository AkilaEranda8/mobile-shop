'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Loader2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { deliveryApi, Courier } from '@/lib/delivery-api'

interface Props {
  couriers: Courier[]
  onClose: () => void
  onCreated: () => void
}

interface Item { description: string; quantity: number; unitPrice: number }

export default function CreateOrderModal({ couriers, onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '',
    addressLine1: '', addressLine2: '', city: '', district: '', postalCode: '',
    deliveryCharge: 0, isCOD: false, codAmount: 0, notes: '',
  })
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, unitPrice: 0 }])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const addItem = () => setItems(i => [...i, { description: '', quantity: 1, unitPrice: 0 }])
  const removeItem = (idx: number) => setItems(i => i.filter((_, n) => n !== idx))
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
            <h3 className="text-base font-semibold text-white">New Delivery Order</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Customer */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Customer Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name *</label>
                <input className="input-field text-sm w-full" value={form.customerName}
                  onChange={e => set('customerName', e.target.value)} placeholder="Customer name" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Phone *</label>
                <input className="input-field text-sm w-full" value={form.customerPhone}
                  onChange={e => set('customerPhone', e.target.value)} placeholder="077 xxx xxxx" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Email</label>
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
                <label className="block text-xs text-slate-400 mb-1">Address Line 1 *</label>
                <input className="input-field text-sm w-full" value={form.addressLine1}
                  onChange={e => set('addressLine1', e.target.value)} placeholder="Street, No." />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Address Line 2</label>
                <input className="input-field text-sm w-full" value={form.addressLine2}
                  onChange={e => set('addressLine2', e.target.value)} placeholder="Area, landmark" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">City *</label>
                <input className="input-field text-sm w-full" value={form.city}
                  onChange={e => set('city', e.target.value)} placeholder="Colombo" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">District</label>
                <input className="input-field text-sm w-full" value={form.district}
                  onChange={e => set('district', e.target.value)} placeholder="Western" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Postal Code</label>
                <input className="input-field text-sm w-full" value={form.postalCode}
                  onChange={e => set('postalCode', e.target.value)} placeholder="10350" />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Order Items</p>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                <Plus size={12} /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input className="input-field text-sm w-full" value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)} placeholder="Description" />
                  </div>
                  <div className="w-16">
                    <input type="number" min={1} className="input-field text-sm w-full" value={item.quantity}
                      onChange={e => updateItem(i, 'quantity', +e.target.value)} placeholder="Qty" />
                  </div>
                  <div className="w-24">
                    <input type="number" min={0} className="input-field text-sm w-full" value={item.unitPrice}
                      onChange={e => updateItem(i, 'unitPrice', +e.target.value)} placeholder="Price" />
                  </div>
                  <div className="w-20 text-right text-sm text-slate-300 pb-2">
                    {(item.quantity * item.unitPrice).toLocaleString()}
                  </div>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="pb-2 text-red-400 hover:text-red-300">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Charges */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Delivery Charge (LKR)</label>
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
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
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
