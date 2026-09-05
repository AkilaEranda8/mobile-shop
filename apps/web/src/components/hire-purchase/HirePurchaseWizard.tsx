'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CartItem } from '@/components/pos/types'
import { hirePurchaseApi } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { usePaymentMethods } from '@/lib/payment-methods'

type Props = {
  cart: CartItem[]
  branchId: string
  selectedCustomer?: { id?: string; name?: string; phone?: string; email?: string; address?: string } | null
  onClose: () => void
  onComplete: (result: any) => void
}

const periods = [3, 6, 12, 18, 24, 36, 48]

const C = {
  bg: '#0D1119',
  panel: '#141A24',
  elevated: '#1A2230',
  line: '#1E2633',
  text: '#F8FAFC',
  muted: '#94A3B8',
  label: '#CBD5E1',
  blue: '#3B82F6',
  green: '#22C55E',
  amber: '#F59E0B',
}

const inputStyle: CSSProperties = {
  color: C.text,
  WebkitTextFillColor: C.text,
  caretColor: C.text,
  background: C.elevated,
  borderColor: C.line,
}

export function HirePurchaseWizard({ cart, branchId, selectedCustomer, onClose, onComplete }: Props) {
  const device = cart[0]
  const methods = usePaymentMethods()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [calculation, setCalculation] = useState<any>(null)
  const [customer, setCustomer] = useState({
    name: selectedCustomer?.name ?? '',
    phone: selectedCustomer?.phone ?? '',
    email: selectedCustomer?.email ?? '',
    address: selectedCustomer?.address ?? '',
    nic: '', dateOfBirth: '', occupation: '', monthlyIncome: '', employer: '',
  })
  const [guarantor, setGuarantor] = useState({ name: '', nic: '', phone: '', address: '', relationship: '' })
  const [finance, setFinance] = useState({
    cashPrice: String(device?.price ?? 0),
    downPayment: '0',
    interestType: 'FLAT',
    interestRate: '12',
    processingFee: '0',
    insuranceFee: '0',
    documentFee: '0',
    otherCharges: '0',
    installmentMonths: '12',
    gracePeriodDays: '3',
    lateFee: '0',
    dueDay: String(new Date().getDate()),
    firstDueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  })
  const [downPaymentMethod, setDownPaymentMethod] = useState('CASH')

  const setCustomerField = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setCustomer(p => ({ ...p, [key]: e.target.value }))
  const setGuarantorField = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => setGuarantor(p => ({ ...p, [key]: e.target.value }))
  const setFinanceField = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFinance(p => ({ ...p, [key]: e.target.value }))

  useEffect(() => {
    if (step < 4) return
    const timer = window.setTimeout(() => {
      hirePurchaseApi.calculate({
        ...finance,
        cashPrice: Number(finance.cashPrice),
        downPayment: Number(finance.downPayment),
        interestRate: Number(finance.interestRate),
        processingFee: Number(finance.processingFee),
        insuranceFee: Number(finance.insuranceFee),
        documentFee: Number(finance.documentFee),
        otherCharges: Number(finance.otherCharges),
        installmentMonths: Number(finance.installmentMonths),
      }).then((r: any) => setCalculation(r.data ?? r)).catch((e: any) => toast.error(e.message))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [step, finance])

  const next = () => {
    if (step === 1 && (!customer.name.trim() || !customer.phone.trim() || !customer.nic.trim())) return toast.error('Customer name, phone and NIC are required')
    if (step === 2 && guarantor.name.trim() && (!guarantor.nic.trim() || !guarantor.phone.trim())) {
      return toast.error('Guarantor NIC and phone are required when a guarantor name is entered')
    }
    if (step === 3 && (!device || cart.length !== 1 || !device.imei || !device.productId)) return toast.error('Hire Purchase requires one IMEI-tracked device')
    setStep(p => Math.min(5, p + 1))
  }

  const submit = async () => {
    if (!calculation) return
    setLoading(true)
    try {
      const payload = {
        branchId,
        customerId: selectedCustomer?.id,
        customer: { ...customer, monthlyIncome: Number(customer.monthlyIncome) || undefined },
        guarantor: guarantor.name ? guarantor : undefined,
        device: {
          productId: device.productId,
          productName: device.name,
          imei: device.imei,
          color: device.variationLabel?.split(' / ')[0],
          storage: device.variationLabel?.split(' / ')[1],
        },
        finance: {
          ...finance,
          cashPrice: Number(finance.cashPrice),
          downPayment: Number(finance.downPayment),
          interestRate: Number(finance.interestRate),
          processingFee: Number(finance.processingFee),
          insuranceFee: Number(finance.insuranceFee),
          documentFee: Number(finance.documentFee),
          otherCharges: Number(finance.otherCharges),
          installmentMonths: Number(finance.installmentMonths),
          gracePeriodDays: Number(finance.gracePeriodDays),
          lateFee: Number(finance.lateFee),
          dueDay: Number(finance.dueDay),
        },
        downPaymentMethod,
      }
      const result: any = await hirePurchaseApi.createFromPos(payload)
      toast.success(`Agreement ${result.data?.agreement?.agreementNumber ?? ''} created`)
      onComplete(result.data ?? result)
    } catch (error: any) {
      toast.error(error.message || 'Hire purchase checkout failed')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'input-field hp-input mt-1'
  const stepLabels = ['Customer', 'Guarantor', 'Device', 'Finance', 'Review']
  const ui = (
    <div
      data-hp-wizard
      className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={onClose}
    >
      <div
        data-hp-panel
        data-pos="dark"
        role="dialog"
        aria-modal="true"
        aria-label="Hire Purchase Wizard"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border shadow-2xl"
        style={{ background: C.panel, borderColor: C.line, color: C.text }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b px-4 sm:px-5 py-3"
          style={{ background: C.panel, borderColor: C.line }}
        >
          <div className="flex items-start gap-2 min-w-0">
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" style={{ color: C.green }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: C.text }}>Hire Purchase Wizard</p>
              <p className="text-[11px] truncate" style={{ color: C.muted }}>Step {step} of 5 · {stepLabels[step - 1]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: C.muted }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1 px-4 sm:px-5 pt-4">
          {[1, 2, 3, 4, 5].map(n => (
            <div
              key={n}
              className="h-1 flex-1 rounded"
              style={{ background: n <= step ? C.green : C.elevated }}
            />
          ))}
        </div>

        <div className="min-h-[420px] p-5" style={{ color: C.text }}>
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold" style={{ color: C.text }}>Customer & KYC</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['name', 'Full Name *'], ['nic', 'NIC *'], ['phone', 'Mobile Number *'], ['email', 'Email'],
                  ['address', 'Address'], ['dateOfBirth', 'Date of Birth'], ['occupation', 'Occupation'],
                  ['monthlyIncome', 'Monthly Income'], ['employer', 'Employer'],
                ].map(([key, label]) => (
                  <label key={key} className="text-xs font-medium" style={{ color: C.label }}>
                    {label}
                    <input
                      type={key === 'dateOfBirth' ? 'date' : key === 'monthlyIncome' ? 'number' : 'text'}
                      className={inputClass}
                      style={inputStyle}
                      value={(customer as any)[key]}
                      onChange={setCustomerField(key)}
                    />
                  </label>
                ))}
              </div>
              <p className="text-xs" style={{ color: C.muted }}>
                Customer photo, NIC and proof-of-address can be uploaded from the agreement after creation.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold" style={{ color: C.text }}>
                Guarantor <span className="text-sm font-normal" style={{ color: C.muted }}>(optional)</span>
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['name', 'Name'], ['nic', 'NIC'], ['phone', 'Phone'], ['address', 'Address'], ['relationship', 'Relationship'],
                ].map(([key, label]) => (
                  <label key={key} className="text-xs font-medium" style={{ color: C.label }}>
                    {label}
                    <input className={inputClass} style={inputStyle} value={(guarantor as any)[key]} onChange={setGuarantorField(key)} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h3 className="text-lg font-bold" style={{ color: C.text }}>Device</h3>
              {device && (
                <div className="border-l-2 pl-5" style={{ borderColor: C.green }}>
                  <SmartphoneIcon />
                  <h4 className="mt-3 text-xl font-bold" style={{ color: C.text }}>{device.name}</h4>
                  <p className="mt-1 font-mono text-sm" style={{ color: C.text }}>{device.imei || 'No IMEI selected'}</p>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>
                    {device.variationLabel || 'Default variation'} · {formatCurrency(device.price)}
                  </p>
                </div>
              )}
              <p
                className="rounded-lg border p-3 text-xs"
                style={{ borderColor: `${C.amber}33`, background: `${C.amber}14`, color: '#FCD34D' }}
              >
                The IMEI is locked atomically when the agreement is created and cannot be sold twice.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold" style={{ color: C.text }}>Finance</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ['cashPrice', 'Cash Price'], ['downPayment', 'Down Payment'], ['interestRate', 'Interest %'],
                  ['processingFee', 'Processing Fee'], ['insuranceFee', 'Insurance Fee'], ['documentFee', 'Document Fee'],
                  ['otherCharges', 'Other Charges'], ['gracePeriodDays', 'Grace Period (days)'], ['lateFee', 'Late Fee'],
                  ['dueDay', 'Due Day'], ['firstDueDate', 'First Due Date'],
                ].map(([key, label]) => (
                  <label key={key} className="text-xs font-medium" style={{ color: C.label }}>
                    {label}
                    <input
                      type={key === 'firstDueDate' ? 'date' : 'number'}
                      className={inputClass}
                      style={inputStyle}
                      value={(finance as any)[key]}
                      onChange={setFinanceField(key)}
                    />
                  </label>
                ))}
                <label className="text-xs font-medium" style={{ color: C.label }}>
                  Interest Type
                  <select className={inputClass} style={inputStyle} value={finance.interestType} onChange={setFinanceField('interestType')}>
                    <option value="NONE">No Interest</option>
                    <option value="FLAT">Flat Rate</option>
                    <option value="REDUCING">Reducing Balance</option>
                  </select>
                </label>
                <label className="text-xs font-medium" style={{ color: C.label }}>
                  Period
                  <select className={inputClass} style={inputStyle} value={finance.installmentMonths} onChange={setFinanceField('installmentMonths')}>
                    {periods.map(p => <option key={p} value={p}>{p} Months</option>)}
                  </select>
                </label>
              </div>
              {calculation && (
                <div className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4" style={{ borderColor: C.line }}>
                  {[
                    ['Finance Amount', calculation.financeAmount],
                    ['Interest', calculation.interestAmount],
                    ['Monthly', calculation.monthlyInstallment],
                    ['Total Payable', calculation.totalPayable],
                  ].map(([l, v]) => (
                    <div key={String(l)}>
                      <p className="text-xs" style={{ color: C.muted }}>{l}</p>
                      <p className="mt-1 font-bold" style={{ color: C.text }}>{formatCurrency(Number(v))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <ShieldCheck style={{ color: C.green }} />
                <div>
                  <h3 className="text-lg font-bold" style={{ color: C.text }}>Review agreement</h3>
                  <p className="text-xs" style={{ color: C.muted }}>
                    Confirm before creating the sale, agreement and installment schedule.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Summary label="Customer" value={`${customer.name} · ${customer.nic}`} />
                <Summary label="Device" value={`${device.name} · ${device.imei}`} />
                <Summary label="Finance Amount" value={formatCurrency(calculation?.financeAmount ?? 0)} />
                <Summary label="Monthly Installment" value={`${formatCurrency(calculation?.monthlyInstallment ?? 0)} × ${finance.installmentMonths}`} />
                <Summary label="Total Payable" value={formatCurrency(calculation?.totalPayable ?? 0)} />
                <Summary label="First Due Date" value={finance.firstDueDate} />
              </div>
              <label className="block text-xs font-medium" style={{ color: C.label }}>
                Down payment method
                <select
                  className={`${inputClass} max-w-sm`}
                  style={inputStyle}
                  value={downPaymentMethod}
                  onChange={e => setDownPaymentMethod(e.target.value)}
                >
                  {methods.map(m => <option key={m.id} value={m.key}>{m.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between border-t p-5"
          style={{ borderColor: C.line, background: C.bg }}
        >
          <button
            type="button"
            onClick={() => step === 1 ? onClose() : setStep(p => p - 1)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-bold border transition-colors hover:bg-white/5"
            style={{ background: C.elevated, borderColor: C.line, color: C.label }}
          >
            <ArrowLeft size={15} /> {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 5 ? (
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-bold text-white transition-colors hover:opacity-95"
              style={{ background: C.blue }}
            >
              Next <ArrowRight size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading || !calculation}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-40 hover:opacity-95"
              style={{ background: C.blue }}
            >
              {loading ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Create Agreement
            </button>
          )}
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(ui, document.body)
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b pb-2" style={{ borderColor: '#1E2633' }}>
      <p className="text-[10px] uppercase" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="mt-1 font-semibold" style={{ color: '#F8FAFC' }}>{value}</p>
    </div>
  )
}

function SmartphoneIcon() {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}>
      <ShieldCheck size={20} />
    </div>
  )
}
