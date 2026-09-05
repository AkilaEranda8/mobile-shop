'use client'

import { Cpu, Package } from 'lucide-react'
import type { ImeiProductType } from '@/lib/productImei'
import { inferImeiProductType } from '@/lib/productImei'

interface ImeiProductTypeSelectorProps {
  value: ImeiProductType
  onChange: (type: ImeiProductType) => void
  categoryName?: string
  deviceModel?: string
  hasVariants?: boolean
  compact?: boolean
  hideIntro?: boolean
}

export function ImeiProductTypeSelector({
  value,
  onChange,
  categoryName,
  deviceModel,
  hasVariants,
  compact,
  hideIntro,
}: ImeiProductTypeSelectorProps) {
  const suggestion = inferImeiProductType({ categoryName, deviceModel, hasVariants })

  const options: {
    type: ImeiProductType
    icon: typeof Cpu
    title: string
    desc: string
    accent: string
  }[] = [
    {
      type: 'device',
      icon: Cpu,
      title: 'Serialized unit',
      desc: 'Serial / IMEI required at POS sale & stock receive',
      accent: 'var(--brand-light)',
    },
    {
      type: 'accessory',
      icon: Package,
      title: 'No serial',
      desc: 'Accessories, parts, cables — quantity + barcode only',
      accent: '#64748b',
    },
  ]

  return (
    <div>
      {!hideIntro && (
        <>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
            Serial Number Tracking <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.45 }}>
            Both work: <strong style={{ color: 'var(--text-secondary)' }}>Serial Number</strong> (laptops, PCs)
            {' '}and <strong style={{ color: 'var(--text-secondary)' }}>15-digit IMEI</strong> (phones). Pick serialized if each unit has a unique ID.
          </p>
        </>
      )}
      <div style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', gap: 8 }}>
        {options.map(opt => {
          const selected = value === opt.type
          const Icon = opt.icon
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => onChange(opt.type)}
              style={{
                flex: 1,
                textAlign: 'left',
                padding: compact ? '10px 12px' : '12px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                background: selected ? `${opt.accent}14` : 'var(--bg-subtle)',
                border: `2px solid ${selected ? opt.accent : 'var(--border-default)'}`,
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selected ? `${opt.accent}22` : 'var(--bg-card)',
                  border: `1px solid ${selected ? `${opt.accent}44` : 'var(--border-subtle)'}`,
                }}>
                  <Icon size={16} style={{ color: selected ? opt.accent : 'var(--text-muted)' }} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{opt.title}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.desc}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {suggestion && suggestion !== value && (
        <p style={{ fontSize: 10, color: 'var(--status-warn)', marginTop: 8 }}>
          Tip: &quot;{categoryName || deviceModel}&quot; is usually{' '}
          {suggestion === 'device' ? 'a serialized unit (serial / IMEI)' : 'a product without serial tracking'}.
        </p>
      )}
    </div>
  )
}
