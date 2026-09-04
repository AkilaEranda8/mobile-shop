import { EventEmitter } from 'events'

type SseClient = {
  id: string
  write: (event: string, data: unknown) => void
}

/**
 * In-process SSE hub (single-node). Multi-instance would need Redis pub/sub.
 */
class SupportSseHub {
  private readonly bus = new EventEmitter()
  private readonly clients = new Map<string, Set<SseClient>>()

  constructor() {
    this.bus.setMaxListeners(200)
  }

  subscribe(channel: string, client: SseClient): () => void {
    let set = this.clients.get(channel)
    if (!set) {
      set = new Set()
      this.clients.set(channel, set)
    }
    set.add(client)
    return () => {
      set!.delete(client)
      if (set!.size === 0) this.clients.delete(channel)
    }
  }

  publish(channel: string, event: string, data: unknown) {
    const set = this.clients.get(channel)
    if (!set) return
    for (const c of set) {
      try {
        c.write(event, data)
      } catch {
        /* client gone */
      }
    }
  }

  sessionChannel(sessionId: string) {
    return `chat:session:${sessionId}`
  }

  adminInboxChannel() {
    return 'chat:admin:inbox'
  }
}

export const supportSseHub = new SupportSseHub()

export function writeSse(res: import('express').Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

export function initSseHeaders(res: import('express').Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
}
