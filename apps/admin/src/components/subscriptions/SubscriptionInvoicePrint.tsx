'use client'

import { LOGO_BASE64 } from '@/lib/logo-base64'
import type { SubscriptionRow } from '@/lib/api'
import type { SubscriptionInvoiceData } from '@/lib/subscription-invoice'

export default function SubscriptionInvoicePrint({
  sub,
  inv,
  id = 'hx-invoice-print',
}: {
  sub: SubscriptionRow
  inv: SubscriptionInvoiceData
  id?: string
}) {
  return (
    <div id={id} style={{ width: 595, margin: '0 auto', background: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)', padding: '40px 48px' }}>
      <div style={{ fontFamily: 'system-ui, sans-serif', width: '100%', background: '#fff', color: '#111' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_BASE64} alt="Hexalyte Innovation" style={{ height: 100, objectFit: 'contain', flexShrink: 0 }} />
            <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>Hexalyte Innovation (Pvt) Ltd</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>www.hexalyte.com</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>info@hexalyte.com</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>+94 70 3130100</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#111', letterSpacing: -1 }}>INVOICE</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>#{inv.invoiceNo}</div>
          </div>
        </div>

        <div style={{ height: 2, background: '#f3f4f6', marginBottom: 28 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Bill To</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{sub.name}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{sub.ownerEmail}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Issue Date</div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{inv.issueDate}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>Valid Until</div>
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{inv.dueDate}</div>
            </div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #e5e7eb' }}>Description</th>
              <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #e5e7eb' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, borderBottom: '2px solid #e5e7eb' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '14px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>Hexalyte {inv.planLabel} Plan</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{inv.periodLabel} subscription · Rs. {inv.mrr.toLocaleString()} / month</div>
              </td>
              <td style={{ textAlign: 'center', padding: '14px', fontSize: 13, color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{inv.months}</td>
              <td style={{ textAlign: 'right', padding: '14px', fontSize: 13, fontWeight: 700, color: '#111', borderBottom: '1px solid #f3f4f6' }}>Rs. {inv.total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
          <div style={{ width: 220 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: '#6b7280' }}>
              <span>Subtotal ({inv.months} × Rs. {inv.mrr.toLocaleString()})</span><span>Rs. {inv.total.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: '#6b7280' }}>
              <span>Tax (0%)</span><span>Rs. 0</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', marginTop: 4, background: '#111', borderRadius: 8, fontSize: 14, fontWeight: 800, color: '#fff' }}>
              <span>Total ({inv.periodLabel})</span><span>Rs. {inv.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px', marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Bank Transfer Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
            {[
              ['Bank', 'Commercial Bank'],
              ['Account Name', 'Akila Eranda Gankewela'],
              ['Account Number', '2000124779'],
              ['SWIFT Code', 'CCEYLKLX'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#9ca3af', minWidth: 110 }}>{label}:</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#111' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20, fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
          Thank you for choosing Hexalyte Innovation (Pvt) Ltd · info@hexalyte.com · +94 70 3130100 · www.hexalyte.com
        </div>
      </div>
    </div>
  )
}
