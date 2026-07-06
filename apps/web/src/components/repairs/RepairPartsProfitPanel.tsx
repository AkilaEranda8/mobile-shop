'use client'

import { TrendingUp, Package, Wrench, Equal, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { buildRepairPartsReport, type RepairPartsReport } from '@/lib/repair-parts-report.util'
import type { RepairTicket } from '@/types'

type Props = {
  repair: Pick<RepairTicket, 'estimatedCost' | 'spareParts' | 'actualCost' | 'status' | 'ticketNumber' | 'deviceBrand' | 'deviceModel'>
  getBuyPrice?: (productId: string) => number | undefined
  /** Live discount while collecting payment (before delivered) */
  pendingDiscount?: number
  compact?: boolean
}

function SummaryRow({
  label,
  value,
  bold,
  highlight,
  muted,
  sub,
}: {
  label: string
  value: string
  bold?: boolean
  highlight?: 'green' | 'violet' | 'amber'
  muted?: boolean
  sub?: string
}) {
  const color =
    highlight === 'green' ? 'text-green-600 dark:text-green-400'
    : highlight === 'violet' ? 'text-violet-600 dark:text-violet-400'
    : highlight === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : muted ? 'var(--text-muted)' : 'var(--text-primary)'
  return (
    <div className="flex justify-between items-start gap-3 text-xs">
      <div>
        <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</span>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      <span className={`${bold ? 'font-black text-sm' : 'font-semibold'} shrink-0`} style={{ color }}>{value}</span>
    </div>
  )
}

function FormulaChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border ${className ?? ''}`} style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
      {children}
    </span>
  )
}

export function getRepairPartsReport(props: Props): RepairPartsReport {
  return buildRepairPartsReport(props.repair, props.getBuyPrice, {
    pendingDiscount: props.pendingDiscount,
  })
}

export default function RepairPartsProfitPanel({ repair, getBuyPrice, pendingDiscount, compact }: Props) {
  const report = buildRepairPartsReport(repair, getBuyPrice, { pendingDiscount })
  const hasParts = report.lines.length > 0
  const labourShare = report.labourShare
  const partsMargin = report.partsMargin
  const netProfit = report.netProfit
  const quote = report.serviceCharge
  const discount = report.discount
  const collected = report.customerRevenue
  const hasDiscount = discount > 0

  if (!hasParts && quote <= 0) {
    return (
      <div className="rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Add a customer quote and spare parts to see the profit breakdown.</p>
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

  const topCards = hasParts
    ? [
        { label: hasDiscount ? 'Collected' : 'Customer Quote', sub: hasDiscount ? `Quote ${formatCurrency(quote)}` : 'Before discount', value: formatCurrency(collected), icon: Wrench, color: 'text-violet-500' },
        { label: 'Labour Share', sub: hasDiscount ? 'Collected − parts sell' : 'Quote − parts sell', value: formatCurrency(labourShare), icon: Wrench, color: 'text-indigo-500' },
        { label: 'Parts Margin', sub: 'Sell − buy', value: formatCurrency(partsMargin), icon: Package, color: 'text-cyan-500' },
        { label: 'Net Profit', sub: hasDiscount ? 'After discount' : 'Labour + margin', value: formatCurrency(netProfit), icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
      ]
    : [
        { label: hasDiscount ? 'Collected' : 'Customer Quote', sub: hasDiscount ? `Discount −${formatCurrency(discount)}` : 'Customer pays', value: formatCurrency(collected), icon: Wrench, color: 'text-violet-500' },
        { label: 'Net Profit', sub: hasDiscount ? 'After discount' : 'No parts used', value: formatCurrency(netProfit), icon: TrendingUp, color: 'text-green-600 dark:text-green-400' },
      ]

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
        <TrendingUp size={13} className="text-emerald-500" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Parts &amp; Profit Report
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Internal — customer invoice uses quote only</p>
        </div>
      </div>

      <div className={compact ? 'p-3 space-y-3' : 'p-4 space-y-4'}>
        <div className={`grid gap-2 ${hasParts ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
          {topCards.map(({ label, sub, value, icon: Icon, color }) => (
            <div key={label} className="rounded-lg p-2.5 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={11} className={color} />
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</span>
              </div>
              <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
            </div>
          ))}
        </div>

        {hasParts && labourShare < 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            Parts sell ({formatCurrency(report.partsSellTotal)}) exceeds {hasDiscount ? 'collected amount' : 'quote'} ({formatCurrency(hasDiscount ? collected : quote)}).
          </div>
        )}

        {hasParts && (
          <>
            <div className="rounded-lg border p-3 flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
              <FormulaChip>{formatCurrency(quote)} quote</FormulaChip>
              {hasDiscount && (
                <>
                  <Minus size={12} style={{ color: 'var(--text-muted)' }} />
                  <FormulaChip className="text-red-600">{formatCurrency(discount)} discount</FormulaChip>
                </>
              )}
              {hasDiscount && (
                <>
                  <Equal size={12} style={{ color: 'var(--text-muted)' }} />
                  <FormulaChip>{formatCurrency(collected)} collected</FormulaChip>
                </>
              )}
              <Equal size={12} style={{ color: 'var(--text-muted)' }} />
              <FormulaChip>{formatCurrency(report.partsSellTotal)} parts sell</FormulaChip>
              <Plus size={12} style={{ color: 'var(--text-muted)' }} />
              <FormulaChip>{formatCurrency(labourShare)} labour</FormulaChip>
            </div>

            <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--border-subtle)' }}>
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={th}>Part</th>
                    <th style={{ ...th, textAlign: 'center', width: 48 }}>Qty</th>
                    <th style={{ ...th, textAlign: 'right', width: 88 }}>Buy</th>
                    <th style={{ ...th, textAlign: 'right', width: 88 }}>Sell (ref)</th>
                    <th style={{ ...th, textAlign: 'right', width: 88 }}>Margin</th>
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
                    <td style={{ padding: '9px 10px', fontSize: 11, textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>{formatCurrency(partsMargin)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        <div className="rounded-lg p-3 space-y-2.5 border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-subtle)' }}>
          <SummaryRow label="① Customer quote" value={formatCurrency(quote)} sub="Original estimate" />
          {hasDiscount && (
            <SummaryRow label="② Discount" value={`−${formatCurrency(discount)}`} highlight="amber" sub="Given at payment" />
          )}
          <SummaryRow
            label={hasDiscount ? '③ Collected from customer' : '② Collected from customer'}
            value={formatCurrency(collected)}
            bold={hasDiscount}
            highlight={hasDiscount ? 'violet' : undefined}
          />
          {hasParts && (
            <>
              <SummaryRow label="Parts sell (inventory reference)" value={formatCurrency(report.partsSellTotal)} muted sub="Not added on top of quote" />
              <SummaryRow
                label="Labour share"
                value={formatCurrency(labourShare)}
                highlight={labourShare >= 0 ? 'violet' : 'amber'}
                sub={hasDiscount ? 'Collected − parts sell' : 'Quote − parts sell'}
                bold
              />
              <SummaryRow label="Parts inventory cost" value={formatCurrency(report.partsBuyTotal)} muted />
              <SummaryRow label="Parts margin" value={formatCurrency(partsMargin)} highlight="green" sub="Parts sell − buy" />
            </>
          )}
          <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
            {hasParts && (
              <SummaryRow
                label="Net profit (labour + parts margin)"
                value={formatCurrency(netProfit)}
                sub={`${formatCurrency(labourShare)} + ${formatCurrency(partsMargin)}`}
                bold
                highlight="green"
              />
            )}
            <SummaryRow
              label={hasParts ? 'Same as: collected − parts buy' : 'Net profit'}
              value={formatCurrency(netProfit)}
              sub={hasParts || hasDiscount ? `${formatCurrency(collected)} − ${formatCurrency(report.partsBuyTotal)}` : undefined}
              muted={hasParts}
              bold={!hasParts}
              highlight={!hasParts ? 'green' : undefined}
            />
          </div>
        </div>

        <p className="text-[10px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Discount reduces collected amount and net profit. Parts margin stays the same; labour share absorbs the discount.
        </p>
      </div>
    </div>
  )
}

function Minus({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={style}>
      <path d="M5 12h14" />
    </svg>
  )
}

function Plus({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={style}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
