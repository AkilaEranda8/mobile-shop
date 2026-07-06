'use client'

import { TrendingUp, Package, Wrench } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { buildRepairPartsReport, type RepairPartsReport } from '@/lib/repair-parts-report.util'
import type { RepairTicket } from '@/types'

type Props = {
  repair: Pick<RepairTicket, 'estimatedCost' | 'spareParts' | 'actualCost' | 'status' | 'ticketNumber' | 'deviceBrand' | 'deviceModel'>
  getBuyPrice?: (productId: string) => number | undefined
  compact?: boolean
}

function SummaryRow({
  label,
  value,
  bold,
  highlight,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  highlight?: 'green' | 'violet'
  muted?: boolean
}) {
  const color =
    highlight === 'green' ? 'text-green-600 dark:text-green-400'
    : highlight === 'violet' ? 'text-violet-600 dark:text-violet-400'
    : muted ? 'var(--text-muted)' : 'var(--text-primary)'
  return (
    <div className="flex justify-between items-center gap-3 text-xs">
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
      <span className={bold ? 'font-black text-sm' : 'font-semibold'} style={{ color }}>{value}</span>
    </div>
  )
}

export function getRepairPartsReport(props: Props): RepairPartsReport {
  return buildRepairPartsReport(props.repair, props.getBuyPrice)
}

export default function RepairPartsProfitPanel({ repair, getBuyPrice, compact }: Props) {
  const report = buildRepairPartsReport(repair, getBuyPrice)
  const hasParts = report.lines.length > 0

  if (!hasParts && report.serviceCharge <= 0) {
    return (
      <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add service charge and spare parts to see profit breakdown.</p>
      </div>
    )
  }

  const th: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    padding: '8px 10px',
    textAlign: 'left',
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
        <TrendingUp size={13} className="text-emerald-500" />
        <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          Parts &amp; Profit Report
        </p>
      </div>

      <div className={compact ? 'p-3 space-y-3' : 'p-4 space-y-4'}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Customer Quote', value: formatCurrency(report.serviceCharge), icon: Wrench, color: 'text-violet-500' },
            { label: 'Parts Sell', value: formatCurrency(report.partsSellTotal), icon: Package, color: 'text-cyan-500' },
            { label: 'Parts Profit', value: formatCurrency(report.partsProfit), icon: TrendingUp, color: 'text-emerald-500' },
            { label: 'Net Job Profit', value: formatCurrency(report.totalProfit), icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg p-2.5 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={11} className={color} />
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
              </div>
              <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{value}</p>
            </div>
          ))}
        </div>

        {hasParts && (
          <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={th}>Part</th>
                  <th style={{ ...th, textAlign: 'center', width: 48 }}>Qty</th>
                  <th style={{ ...th, textAlign: 'right', width: 88 }}>Buy</th>
                  <th style={{ ...th, textAlign: 'right', width: 88 }}>Sell</th>
                  <th style={{ ...th, textAlign: 'right', width: 88 }}>Profit</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line, i) => (
                  <tr key={line.id ?? i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '9px 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{line.productName}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>{line.quantity}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, textAlign: 'right', color: 'var(--text-muted)' }}>{formatCurrency(line.unitBuy)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, textAlign: 'right', color: 'var(--text-secondary)' }}>{formatCurrency(line.unitSell)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 12, textAlign: 'right', fontWeight: 700, color: line.lineProfit >= 0 ? '#16a34a' : '#dc2626' }}>
                      {formatCurrency(line.lineProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-subtle)' }}>
                  <td colSpan={2} style={{ padding: '9px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Parts total</td>
                  <td style={{ padding: '9px 10px', fontSize: 11, textAlign: 'right', fontWeight: 700, color: 'var(--text-muted)' }}>{formatCurrency(report.partsBuyTotal)}</td>
                  <td style={{ padding: '9px 10px', fontSize: 11, textAlign: 'right', fontWeight: 700, color: 'var(--text-secondary)' }}>{formatCurrency(report.partsSellTotal)}</td>
                  <td style={{ padding: '9px 10px', fontSize: 11, textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(report.partsProfit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="rounded-lg p-3 space-y-2 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
          <SummaryRow label="Customer quote (estimate)" value={formatCurrency(report.serviceCharge)} />
          {hasParts && (
            <>
              <SummaryRow label="Parts inventory cost (buy)" value={formatCurrency(report.partsBuyTotal)} muted />
              <SummaryRow label="Parts sell value (inventory)" value={formatCurrency(report.partsSellTotal)} />
              <SummaryRow label="Parts profit (sell − buy)" value={formatCurrency(report.partsProfit)} highlight="green" />
              <SummaryRow
                label="Labour from quote (quote − parts sell)"
                value={formatCurrency(report.labourFromEstimate)}
                bold
                highlight={report.labourFromEstimate >= 0 ? 'violet' : undefined}
              />
            </>
          )}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <SummaryRow label="Net job profit (quote − parts buy)" value={formatCurrency(report.totalProfit)} bold highlight="green" />
          </div>
        </div>

        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Customer pays the quote only. Parts buy/sell are tracked for your margin — stock deducts on payment.
        </p>
      </div>
    </div>
  )
}
