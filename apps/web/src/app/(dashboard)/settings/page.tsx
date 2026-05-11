'use client'

import { useState } from 'react'
import { Save, Building2, User, Bell, Shield, Palette, Globe, CreditCard, Users } from 'lucide-react'

const tabs = [
  { key: 'shop', label: 'Shop Info', icon: Building2 },
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'billing', label: 'Billing', icon: CreditCard },
  { key: 'team', label: 'Team', icon: Users },
]

const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!value)}
    className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-violet-600' : 'bg-white/10'}`}
  >
    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
)

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('shop')
  const [shopName, setShopName] = useState('Mobile Hub Chennai')
  const [phone, setPhone] = useState('+91 98765 43210')
  const [email, setEmail] = useState('contact@mobilehub.com')
  const [gstin, setGstin] = useState('33AABCM1234F1Z5')
  const [currency, setCurrency] = useState('INR')
  const [timezone, setTimezone] = useState('Asia/Kolkata')
  const [notifications, setNotifications] = useState({ lowStock: true, newRepair: true, repairReady: true, dailySummary: true, paymentReceived: true, warrantyExpiry: false })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your shop configuration</p>
        </div>
        <button onClick={handleSave} className={`btn-primary text-sm flex items-center gap-2 transition-all ${saved ? 'bg-green-600 border-green-500' : ''}`}>
          <Save size={14} />{saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <nav className="card p-2 space-y-0.5">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${activeTab === tab.key ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {activeTab === 'shop' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3">Shop Information</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Shop Name</label>
                  <input value={shopName} onChange={e => setShopName(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">GSTIN</label>
                  <input value={gstin} onChange={e => setGstin(e.target.value)} className="input-field font-mono" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Currency</label>
                  <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-field">
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Timezone</label>
                  <select value={timezone} onChange={e => setTimezone(e.target.value)} className="input-field">
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Address</label>
                <textarea className="input-field resize-none" rows={3} defaultValue="42, 3rd Avenue, Anna Nagar, Chennai - 600040, Tamil Nadu" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Invoice Footer Note</label>
                <textarea className="input-field resize-none" rows={2} defaultValue="Thank you for shopping with us! All sales are subject to our terms and conditions." />
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="card p-6 space-y-4">
              <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3">Notification Preferences</h2>
              {[
                { key: 'lowStock', label: 'Low Stock Alerts', desc: 'Get notified when products fall below minimum stock level' },
                { key: 'newRepair', label: 'New Repair Intake', desc: 'Alert when a new repair ticket is created' },
                { key: 'repairReady', label: 'Repair Ready for Pickup', desc: 'Notify when a repair is completed and ready' },
                { key: 'dailySummary', label: 'Daily Summary Report', desc: 'Receive end-of-day sales and repair summary' },
                { key: 'paymentReceived', label: 'Payment Received', desc: 'Confirmation when a payment is processed' },
                { key: 'warrantyExpiry', label: 'Warranty Expiry Reminders', desc: 'Alert 30 days before warranty expires' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-white/3">
                  <div>
                    <p className="text-sm text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <Toggle
                    value={notifications[item.key as keyof typeof notifications]}
                    onChange={v => setNotifications(prev => ({ ...prev, [item.key]: v }))}
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3">Security Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Current Password</label>
                  <input type="password" className="input-field max-w-sm" placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">New Password</label>
                  <input type="password" className="input-field max-w-sm" placeholder="Enter new password" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5">Confirm New Password</label>
                  <input type="password" className="input-field max-w-sm" placeholder="Confirm new password" />
                </div>
                <button className="btn-primary text-sm">Update Password</button>
              </div>
              <div className="pt-4 border-t border-white/5">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Two-Factor Authentication</h3>
                <p className="text-xs text-slate-500 mb-3">Add an extra layer of security to your account. When enabled, you will need to enter a 6-digit code from your authenticator app in addition to your password.</p>
                <button className="btn-secondary text-sm">Enable 2FA</button>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="card p-6 space-y-6">
              <h2 className="text-base font-semibold text-white border-b border-white/5 pb-3">Billing & Subscription</h2>
              <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider">Current Plan</p>
                    <p className="text-2xl font-bold text-white mt-1">PRO</p>
                    <p className="text-sm text-slate-400">₹2,499/month · Billed monthly</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded-full">ACTIVE</span>
                    <p className="text-xs text-slate-500 mt-2">Renews Jun 1, 2024</p>
                  </div>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { name: 'Starter', price: '₹999', features: ['1 Branch', '2 Staff', '500 Products'] },
                  { name: 'Pro', price: '₹2,499', features: ['5 Branches', '10 Staff', 'Unlimited Products'], current: true },
                  { name: 'Enterprise', price: '₹8,500', features: ['Unlimited Branches', 'Unlimited Staff', 'Custom Integrations'] },
                ].map(plan => (
                  <div key={plan.name} className={`card p-4 ${plan.current ? 'border-violet-500/40 bg-violet-500/5' : ''}`}>
                    <p className="font-semibold text-slate-100">{plan.name}</p>
                    <p className="text-xl font-bold text-white mt-1">{plan.price}<span className="text-xs text-slate-500">/mo</span></p>
                    <ul className="mt-3 space-y-1.5">
                      {plan.features.map(f => <li key={f} className="text-xs text-slate-400">{f}</li>)}
                    </ul>
                    <button className={`w-full mt-4 text-xs py-2 rounded-lg transition-colors ${plan.current ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                      {plan.current ? 'Current Plan' : 'Upgrade'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeTab === 'profile' || activeTab === 'appearance' || activeTab === 'team') && (
            <div className="card p-6">
              <h2 className="text-base font-semibold text-white mb-4">{tabs.find(t => t.key === activeTab)?.label}</h2>
              <p className="text-sm text-slate-500">This section is under construction. Full functionality coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
