'use client'

import { useState, useEffect } from 'react'
import { LogIn, Search, Trash2, RefreshCw, Database, ScrollText, MessageSquare, Plus, AlertTriangle, Clock } from 'lucide-react'
import { fetchTenants, type TenantRow } from '@/lib/api'
import type { TenantNote } from '@/types'

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const TABS = ['Impersonation', 'Debug Tools', 'Support Notes']

export default function SupportToolsPage() {
  const [tab, setTab] = useState('Impersonation')
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [searchTenant, setSearchTenant] = useState('')
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  const [impersonateConfirm, setImpersonateConfirm] = useState(false)
  const [notes, setNotes] = useState<TenantNote[]>([])
  const [noteForm, setNoteForm] = useState({ tenantId: '', note: '', ticketRef: '' })
  const [clearCacheId, setClearCacheId] = useState<string | null>(null)

  useEffect(() => {
    fetchTenants().then(d => setTenants(d.data)).catch(() => {})
  }, [])

  const filteredTenants = tenants.filter(t =>
    t.name.toLowerCase().includes(searchTenant.toLowerCase()) ||
    t.ownerEmail.toLowerCase().includes(searchTenant.toLowerCase())
  )
  const selectedTenant = tenants.find(t => t.id === selectedTenantId)

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Support Tools</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Impersonation */}
      {tab === 'Impersonation' && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="section-title">Select Tenant</h3>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-3">
              <Search size={14} className="text-gray-400" />
              <input className="bg-transparent text-sm outline-none flex-1 placeholder-gray-400"
                placeholder="Search tenant..."
                value={searchTenant} onChange={e => setSearchTenant(e.target.value)} />
            </div>
            <div className="space-y-1 max-h-[280px] overflow-y-auto">
              {filteredTenants.filter(t => t.status === 'ACTIVE' || t.status === 'TRIAL').map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTenantId(t.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${selectedTenantId === t.id ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${selectedTenantId === t.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
                    {t.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${selectedTenantId === t.id ? 'text-white' : 'text-gray-800'}`}>{t.name}</p>
                    <p className={`text-[10px] truncate ${selectedTenantId === t.id ? 'text-white/70' : 'text-gray-400'}`}>{t.ownerEmail}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {selectedTenant ? (
              <>
                <div className="card p-5">
                  <h3 className="section-title">Session Details</h3>
                  <dl className="space-y-2 text-sm mb-5">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Tenant</dt>
                      <dd className="font-medium text-gray-800">{selectedTenant.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Login As</dt>
                      <dd className="font-medium text-gray-800">{selectedTenant.ownerName}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Session Limit</dt>
                      <dd className="flex items-center gap-1 font-medium text-amber-600"><Clock size={12} />30 minutes</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Billing Access</dt>
                      <dd className="badge-red text-[10px]">Blocked</dd>
                    </div>
                  </dl>
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">This session will be fully audit logged. Session auto-expires after 30 minutes.</p>
                  </div>
                  <button onClick={() => setImpersonateConfirm(true)} className="btn-primary w-full justify-center">
                    <LogIn size={14} />Start Impersonation Session
                  </button>
                </div>
              </>
            ) : (
              <div className="card p-10 text-center">
                <LogIn size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Select a tenant to impersonate</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Tools */}
      {tab === 'Debug Tools' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 max-w-sm">
            <Search size={14} className="text-gray-400" />
            <input className="bg-transparent text-sm outline-none flex-1 placeholder-gray-400"
              placeholder="Search tenant for debug..." />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {tenants.slice(0, 6).map(t => (
              <div key={t.id} className="card p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-bold text-gray-700">{t.name.charAt(0)}</div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{t.name}</p>
                    <p className="text-[10px] text-gray-400">{t.ownerEmail}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <ScrollText size={11} />View Errors
                  </button>
                  <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <ScrollText size={11} />API Logs
                  </button>
                  <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <Database size={11} />DB Health
                  </button>
                  <button className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <RefreshCw size={11} />Force Sync
                  </button>
                  <button
                    onClick={() => setClearCacheId(t.id)}
                    className="col-span-2 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={11} />Clear Redis Cache
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Support Notes */}
      {tab === 'Support Notes' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="section-title">Add Note</h3>
            <div className="space-y-3">
              <select className="input text-sm" value={noteForm.tenantId}
                onChange={e => setNoteForm({ ...noteForm, tenantId: e.target.value })}>
                <option value="">Select tenant...</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <textarea className="input resize-none" rows={3} placeholder="Internal support note..."
                value={noteForm.note} onChange={e => setNoteForm({ ...noteForm, note: e.target.value })} />
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Ticket ref (e.g. TKT-1234)"
                  value={noteForm.ticketRef} onChange={e => setNoteForm({ ...noteForm, ticketRef: e.target.value })} />
                <button
                  onClick={() => {
                    if (!noteForm.tenantId || !noteForm.note) return
                    setNotes(prev => [{
                      id: `tn-${Date.now()}`,
                      tenantId: noteForm.tenantId,
                      note: noteForm.note,
                      adminName: 'Support Admin',
                      ticketRef: noteForm.ticketRef || undefined,
                      createdAt: new Date().toISOString(),
                    }, ...prev])
                    setNoteForm({ tenantId: '', note: '', ticketRef: '' })
                  }}
                  className="btn-primary text-sm"
                >
                  <Plus size={14} />Add
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {notes.map(n => {
              const noteTenant = tenants.find(t => t.id === n.tenantId)
              return (
                <div key={n.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="badge-gray text-[10px]">{noteTenant?.name ?? n.tenantId}</span>
                      {n.ticketRef && <span className="badge-blue text-[10px]">{n.ticketRef}</span>}
                      <span className="text-xs font-medium text-gray-700">{n.adminName}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDateTime(n.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{n.note}</p>
                </div>
              )
            })}
            {notes.length === 0 && (
              <div className="card p-10 text-center">
                <MessageSquare size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No support notes yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Impersonate confirm */}
      {impersonateConfirm && selectedTenant && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Start Impersonation?</h3>
            <p className="text-sm text-gray-600 mb-4">
              You will log in as <strong>{selectedTenant.ownerName}</strong> from <strong>{selectedTenant.name}</strong>.
              Session is fully logged and expires in 30 minutes.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setImpersonateConfirm(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => setImpersonateConfirm(false)} className="btn-primary">Confirm & Start</button>
            </div>
          </div>
        </div>
      )}

      {/* Clear cache confirm */}
      {clearCacheId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Clear Redis Cache</h3>
            <p className="text-sm text-gray-600 mb-4">
              Flush all cached data for <strong>{tenants.find(t => t.id === clearCacheId)?.name}</strong>. This may cause temporary slowness.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setClearCacheId(null)} className="btn-secondary">Cancel</button>
              <button onClick={() => setClearCacheId(null)} className="btn-danger text-sm">Clear Cache</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
