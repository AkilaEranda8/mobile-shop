'use client'

import { Toaster } from 'react-hot-toast'

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4500,
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          fontSize: 13,
        },
      }}
    />
  )
}
