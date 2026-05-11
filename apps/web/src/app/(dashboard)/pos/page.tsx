'use client'

import { useState } from 'react'
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, Smartphone, Receipt, ScanLine, X } from 'lucide-react'
import { mockProducts, mockCustomers } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'

interface CartItem {
  productId: string
  name: string
  price: number
  quantity: number
  imei?: string
}

export default function POSPage() {
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI'>('UPI')
  const [imeiInput, setImeiInput] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)
  const [discount, setDiscount] = useState(0)
  const [completedSale, setCompletedSale] = useState(false)

  const filtered = mockProducts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const addToCart = (product: typeof mockProducts[0]) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id)
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { productId: product.id, name: product.name, price: product.sellingPrice, quantity: 1 }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.productId === id ? { ...i, quantity: i.quantity + delta } : i)
      .filter(i => i.quantity > 0)
    )
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)
  const discountAmount = (subtotal * discount) / 100
  const tax = Math.round((subtotal - discountAmount) * 0.18)
  const total = subtotal - discountAmount + tax

  const handleCheckout = () => {
    if (cart.length === 0) return
    setCompletedSale(true)
  }

  const handleNewSale = () => {
    setCart([])
    setCompletedSale(false)
    setSearch('')
    setDiscount(0)
    setSelectedCustomer(null)
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-8rem)]">
      {/* Left: Product Grid */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Point of Sale</h1>
          <span className="badge-status border border-green-500/20 bg-green-500/10 text-green-400 text-xs">LIVE</span>
        </div>

        {/* Search & IMEI */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search product by name or SKU..."
              className="input-field pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Scan IMEI"
              className="input-field pl-9 w-40"
              value={imeiInput}
              onChange={e => setImeiInput(e.target.value)}
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['All', 'Smartphones', 'Accessories', 'Tablets', 'Batteries', 'Screens'].map(cat => (
            <button key={cat} className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-slate-400 hover:border-violet-500/40 hover:text-violet-300 whitespace-nowrap transition-colors">
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock === 0}
                className={`text-left p-3.5 rounded-xl border transition-all ${product.stock === 0 ? 'border-white/5 opacity-40 cursor-not-allowed bg-white/2' : 'border-white/5 bg-[#0f1623] hover:border-violet-500/30 hover:bg-violet-500/5 active:scale-95'}`}
              >
                <div className="w-full h-14 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 rounded-lg mb-2.5 flex items-center justify-center">
                  <Smartphone size={22} className="text-violet-400 opacity-60" />
                </div>
                <p className="text-xs font-semibold text-slate-200 truncate">{product.name}</p>
                <p className="text-xs text-slate-500 truncate">{product.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm font-bold text-white">{formatCurrency(product.sellingPrice)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${product.stock < 5 ? 'text-red-400 border-red-500/20 bg-red-500/10' : 'text-green-400 border-green-500/20 bg-green-500/10'}`}>
                    {product.stock === 0 ? 'Out' : `${product.stock} left`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-80 xl:w-96 flex flex-col bg-[#0a0f1a] border border-white/5 rounded-2xl overflow-hidden flex-shrink-0">
        {completedSale ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mb-4">
              <Receipt size={28} className="text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Sale Complete!</h3>
            <p className="text-slate-400 text-sm mb-1">Total: <span className="font-bold text-white">{formatCurrency(total)}</span></p>
            <p className="text-slate-500 text-xs mb-6">Invoice #INV-2024-{Math.floor(Math.random() * 9000) + 1000} generated</p>
            <div className="flex gap-2 w-full">
              <button className="btn-secondary flex-1 text-sm">Print Invoice</button>
              <button className="btn-primary flex-1 text-sm" onClick={handleNewSale}>New Sale</button>
            </div>
          </div>
        ) : (
          <>
            {/* Cart Header */}
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-white">Cart ({cart.length})</h3>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-slate-500 hover:text-red-400 transition-colors">
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Customer select */}
              <select
                className="input-field text-sm"
                value={selectedCustomer || ''}
                onChange={e => setSelectedCustomer(e.target.value || null)}
              >
                <option value="">Walk-in Customer</option>
                {mockCustomers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>
                ))}
              </select>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                  <Receipt size={32} className="text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500">Add items to cart</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/3 border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{item.name}</p>
                      <p className="text-xs text-slate-500">{formatCurrency(item.price)} each</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateQty(item.productId, -1)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors">
                        <Minus size={11} />
                      </button>
                      <span className="text-xs font-bold text-white w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, 1)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-green-500/20 flex items-center justify-center text-slate-400 hover:text-green-400 transition-colors">
                        <Plus size={11} />
                      </button>
                    </div>
                    <span className="text-xs font-bold text-white min-w-[60px] text-right">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-white/5 space-y-3">
                {/* Discount */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 flex-1">Discount (%)</span>
                  <input
                    type="number"
                    min="0" max="50"
                    className="w-20 input-field text-xs py-1.5 text-center"
                    value={discount}
                    onChange={e => setDiscount(Math.min(50, Number(e.target.value)))}
                  />
                </div>

                {/* Summary */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Discount ({discount}%)</span><span>-{formatCurrency(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-400">
                    <span>GST 18%</span><span>{formatCurrency(tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white text-sm border-t border-white/10 pt-2">
                    <span>Total</span><span>{formatCurrency(total)}</span>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="grid grid-cols-3 gap-1.5">
                  {([['CASH', Banknote, 'Cash'], ['CARD', CreditCard, 'Card'], ['UPI', Smartphone, 'UPI']] as const).map(([method, Icon, label]) => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs transition-all ${paymentMethod === method ? 'border-violet-500 bg-violet-500/15 text-violet-300' : 'border-white/10 text-slate-500 hover:border-white/20'}`}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCheckout}
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                >
                  <Receipt size={15} />
                  Charge {formatCurrency(total)}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
