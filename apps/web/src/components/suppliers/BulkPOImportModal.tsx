'use client'

import { useMemo, useRef, useState } from 'react'
import { Download, FileUp, Loader2, Package, X, CheckCircle, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { suppliersApi } from '@/lib/api'
import { getActiveBranchId } from '@/lib/active-branch'
import { formatCurrency } from '@/lib/utils'
import type { Supplier } from '@/types'
import {
  downloadPoCsvTemplate,
  parsePoCsv,
  validatePoCsvRows,
  type PoCatalogProduct,
  type PoCsvValidatedRow,
  type ResolvedPoCsvItem,
} from '@/lib/poCsvImport'

export function BulkPOImportModal({
  suppliers,
  products,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[]
  products: PoCatalogProduct[]
  onClose: () => void
  onSaved: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [notes, setNotes] = useState('')
  const [validated, setValidated] = useState<PoCsvValidatedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const accepted = useMemo(() => validated.filter(r => r.ok && r.item), [validated])
  const rejected = useMemo(() => validated.filter(r => !r.ok), [validated])
  const items = useMemo(
    () => accepted.map(r => r.item!).filter(Boolean) as ResolvedPoCsvItem[],
    [accepted],
  )
  const subtotal = items.reduce((s, i) => s + i.total, 0)

  const onFile = async (file: File) => {
    const text = await file.text()
    const { rows, warnings } = parsePoCsv(text)
    setParseWarnings(warnings)
    setFileName(file.name)
    if (!rows.length) {
      setValidated([])
      toast.error('No data rows found in CSV')
      return
    }
    const results = validatePoCsvRows(rows, products)
    setValidated(results)
    const ok = results.filter(r => r.ok).length
    const bad = results.length - ok
    if (bad > 0) {
      toast.error(`${bad} row(s) rejected — only existing inventory/variants are allowed`)
    } else {
      toast.success(`${ok} row(s) matched inventory`)
    }
  }

  const handleSubmit = async () => {
    if (!supplierId) {
      toast.error('Select a supplier')
      return
    }
    if (!items.length) {
      toast.error('No valid rows to import — all rows were rejected')
      return
    }
    setLoading(true)
    try {
      const selectedSupplier = suppliers.find(s => s.id === supplierId)
      await suppliersApi.createPO({
        supplierId,
        supplierName: selectedSupplier?.name ?? '',
        items: items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitCost: i.unitCost,
          total: i.total,
          receivedQuantity: 0,
          storage: i.storage,
          colorName: i.colorName,
          sku: i.sku,
        })),
        branchId: getActiveBranchId() || undefined,
        subtotal,
        tax: 0,
        total: subtotal,
        paidAmount: 0,
        dueAmount: subtotal,
        expectedDelivery: expectedDelivery || undefined,
        notes: notes
          ? notes
          : rejected.length
            ? `Bulk import (${rejected.length} row(s) rejected)`
            : undefined,
        status: 'DRAFT',
      })
      toast.success(
        rejected.length
          ? `PO created with ${items.length} item(s) — ${rejected.length} row(s) rejected`
          : `Purchase Order created with ${items.length} item(s)`,
      )
      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create purchase order')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-y-auto border"
        style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-default)' }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 sm:px-5 py-3 border-b sticky top-0 z-10"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-start gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0"
              style={{ background: 'var(--sidebar-active-bg)', borderColor: 'var(--sidebar-active-border)' }}
            >
              <FileUp size={16} className="accent-text" />
            </div>
            <div>
              <p className="text-sm font-semibold">Bulk Import Purchase Order</p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Only rows that match existing inventory products &amp; variants are accepted
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadPoCsvTemplate}
              className="btn-secondary text-sm inline-flex items-center gap-1.5"
            >
              <Download size={14} /> Download Template
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-primary text-sm inline-flex items-center gap-1.5"
            >
              <FileUp size={14} /> Upload CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
                e.target.value = ''
              }}
            />
          </div>

          <p className="text-[11px] rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>
            Columns: <span className="font-mono">sku, productName, storage, colorName, quantity, unitCost</span>.
            Prefer <strong>variant SKU</strong>. Products with variants must include a matching variant — unknown rows are rejected.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Supplier</label>
              <select
                className="input-field"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
              >
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Expected delivery</label>
              <input
                type="date"
                className="input-field"
                value={expectedDelivery}
                onChange={e => setExpectedDelivery(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Notes (optional)</label>
            <input
              className="input-field"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Bulk import notes…"
            />
          </div>

          {fileName && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              File: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{fileName}</span>
              {' · '}{accepted.length} accepted · {rejected.length} rejected
            </p>
          )}

          {parseWarnings.map(w => (
            <p key={w} className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={12} /> {w}
            </p>
          ))}

          {validated.length > 0 && (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="bg-emerald-600 text-white px-3 py-2 text-[11px] font-semibold uppercase tracking-wide flex justify-between">
                <span>Import preview</span>
                <span>{formatCurrency(subtotal)} total</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 border-b" style={{ background: 'var(--bg-subtle)', borderColor: 'var(--border-subtle)' }}>
                    <tr style={{ color: 'var(--text-secondary)' }}>
                      <th className="px-3 py-2 text-left">Line</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validated.map(r => (
                      <tr key={r.line} className="border-b last:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-muted)' }}>{r.line}</td>
                        <td className="px-3 py-2">
                          {r.ok ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle size={12} /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                              <AlertCircle size={12} /> Rejected
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {r.ok && r.item ? (
                            <div>
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.item.productName}</p>
                              <p className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                                {[r.item.sku, r.item.storage, r.item.colorName].filter(Boolean).join(' · ') || r.item.productId.slice(0, 8)}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                                {r.raw.sku || r.raw.productName || '—'}
                              </p>
                              <p className="text-[10px] text-red-500">{r.errors.join(' · ')}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{r.item?.quantity ?? r.raw.quantity ?? '—'}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {r.item ? formatCurrency(r.item.unitCost) : (r.raw.unitCost || '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button
              type="button"
              disabled={loading || !items.length || !supplierId}
              onClick={() => void handleSubmit()}
              className="btn-primary flex-1 text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              {loading
                ? 'Creating…'
                : rejected.length
                  ? `Create PO (${items.length} accepted, ${rejected.length} skipped)`
                  : `Create PO (${items.length} items)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
