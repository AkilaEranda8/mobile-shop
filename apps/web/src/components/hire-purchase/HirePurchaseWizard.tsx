'use client'

import { useEffect, useState } from 'react'
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

  const inputClass = 'input-field'
  const stepLabels = ['Customer', 'Guarantor', 'Device', 'Finance', 'Review']
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border shadow-2xl" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-4 sm:px-5 py-3" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-start gap-2 min-w-0">
            <ShieldCheck size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">Hire Purchase Wizard</p>
              <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>Step {step} of 5 · {stepLabels[step - 1]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-subtle)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex gap-1 px-4 sm:px-5 pt-4">{[1, 2, 3, 4, 5].map(n => <div key={n} className={`h-1 flex-1 rounded ${n <= step ? 'bg-emerald-500' : ''}`} style={n > step ? { background: 'var(--bg-subtle)' } : undefined} />)}</div>
        <div className="min-h-[420px] p-5">
          {step === 1 && <div className="space-y-4"><h3 className="text-lg font-bold">Customer & KYC</h3><div className="grid gap-3 sm:grid-cols-2">{[
            ['name', 'Full Name *'], ['nic', 'NIC *'], ['phone', 'Mobile Number *'], ['email', 'Email'],
            ['address', 'Address'], ['dateOfBirth', 'Date of Birth'], ['occupation', 'Occupation'],
            ['monthlyIncome', 'Monthly Income'], ['employer', 'Employer'],
          ].map(([key, label]) => <label key={key} className="text-xs">{label}<input type={key === 'dateOfBirth' ? 'date' : key === 'monthlyIncome' ? 'number' : 'text'} className={`${inputClass} mt-1`} value={(customer as any)[key]} onChange={setCustomerField(key)} /></label>)}</div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Customer photo, NIC and proof-of-address can be uploaded from the agreement after creation.</p></div>}
          {step === 2 && <div className="space-y-4"><h3 className="text-lg font-bold">Guarantor <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>(optional)</span></h3><div className="grid gap-3 sm:grid-cols-2">{[
            ['name', 'Name'], ['nic', 'NIC'], ['phone', 'Phone'], ['address', 'Address'], ['relationship', 'Relationship'],
          ].map(([key, label]) => <label key={key} className="text-xs">{label}<input className={`${inputClass} mt-1`} value={(guarantor as any)[key]} onChange={setGuarantorField(key)} /></label>)}</div></div>}
          {step === 3 && <div className="space-y-5"><h3 className="text-lg font-bold">Device</h3>{device && <div className="border-l-2 border-emerald-500 pl-5"><SmartphoneIcon /><h4 className="mt-3 text-xl font-bold">{device.name}</h4><p className="mt-1 font-mono text-sm">{device.imei || 'No IMEI selected'}</p><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{device.variationLabel || 'Default variation'} · {formatCurrency(device.price)}</p></div>}<p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600">The IMEI is locked atomically when the agreement is created and cannot be sold twice.</p></div>}
          {step === 4 && <div className="space-y-4"><h3 className="text-lg font-bold">Finance</h3><div className="grid gap-3 sm:grid-cols-3">{[
            ['cashPrice', 'Cash Price'], ['downPayment', 'Down Payment'], ['interestRate', 'Interest %'],
            ['processingFee', 'Processing Fee'], ['insuranceFee', 'Insurance Fee'], ['documentFee', 'Document Fee'],
            ['otherCharges', 'Other Charges'], ['gracePeriodDays', 'Grace Period (days)'], ['lateFee', 'Late Fee'],
            ['dueDay', 'Due Day'], ['firstDueDate', 'First Due Date'],
          ].map(([key, label]) => <label key={key} className="text-xs">{label}<input type={key === 'firstDueDate' ? 'date' : 'number'} className={`${inputClass} mt-1`} value={(finance as any)[key]} onChange={setFinanceField(key)} /></label>)}
            <label className="text-xs">Interest Type<select className={`${inputClass} mt-1`} value={finance.interestType} onChange={setFinanceField('interestType')}><option value="NONE">No Interest</option><option value="FLAT">Flat Rate</option><option value="REDUCING">Reducing Balance</option></select></label>
            <label className="text-xs">Period<select className={`${inputClass} mt-1`} value={finance.installmentMonths} onChange={setFinanceField('installmentMonths')}>{periods.map(p => <option key={p} value={p}>{p} Months</option>)}</select></label>
          </div>{calculation && <div className="grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4" style={{ borderColor: 'var(--border-subtle)' }}>{[['Finance Amount', calculation.financeAmount], ['Interest', calculation.interestAmount], ['Monthly', calculation.monthlyInstallment], ['Total Payable', calculation.totalPayable]].map(([l, v]) => <div key={String(l)}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</p><p className="mt-1 font-bold">{formatCurrency(Number(v))}</p></div>)}</div>}</div>}
          {step === 5 && <div className="space-y-5"><div className="flex items-center gap-3"><ShieldCheck className="text-emerald-600" /><div><h3 className="text-lg font-bold">Review agreement</h3><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Confirm before creating the sale, agreement and installment schedule.</p></div></div><div className="grid gap-3 sm:grid-cols-2"><Summary label="Customer" value={`${customer.name} · ${customer.nic}`} /><Summary label="Device" value={`${device.name} · ${device.imei}`} /><Summary label="Finance Amount" value={formatCurrency(calculation?.financeAmount ?? 0)} /><Summary label="Monthly Installment" value={`${formatCurrency(calculation?.monthlyInstallment ?? 0)} × ${finance.installmentMonths}`} /><Summary label="Total Payable" value={formatCurrency(calculation?.totalPayable ?? 0)} /><Summary label="First Due Date" value={finance.firstDueDate} /></div><label className="block text-xs">Down payment method<select className={`${inputClass} mt-1 max-w-sm`} value={downPaymentMethod} onChange={e => setDownPaymentMethod(e.target.value)}>{methods.map(m => <option key={m.id} value={m.key}>{m.label}</option>)}</select></label></div>}
        </div>
        <div className="flex items-center justify-between border-t p-5" style={{ borderColor: 'var(--border-subtle)' }}>
          <button type="button" onClick={() => step === 1 ? onClose() : setStep(p => p - 1)} className="btn-secondary"><ArrowLeft size={15} /> {step === 1 ? 'Cancel' : 'Back'}</button>
          {step < 5 ? <button type="button" onClick={next} className="btn-primary">Next <ArrowRight size={15} /></button> : <button type="button" onClick={submit} disabled={loading || !calculation} className="btn-primary">{loading ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} Create Agreement</button>}
        </div>
      </div>
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}><p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</p><p className="mt-1 font-semibold">{value}</p></div>
}

function SmartphoneIcon() {
  return <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600"><ShieldCheck size={20} /></div>
}

