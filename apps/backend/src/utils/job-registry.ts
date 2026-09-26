/**
 * In-process registry for platform scheduled jobs.
 * Tracks last run status for admin System Health / ops control.
 * Single-node only (matches current job timers in server.ts).
 */

export type JobRunStatus = 'SUCCESS' | 'ERROR' | 'NEVER' | 'RUNNING'

export type JobDefinition = {
  id: string
  name: string
  schedule: string
  description?: string
  /** When false, job is registered but start*() may skip work */
  enabled?: boolean
}

export type JobSnapshot = JobDefinition & {
  enabled: boolean
  running: boolean
  lastStartedAt: string | null
  lastFinishedAt: string | null
  lastDurationMs: number | null
  lastStatus: JobRunStatus
  lastError: string | null
  runCount: number
  errorCount: number
}

type InternalJob = JobDefinition & {
  enabled: boolean
  running: boolean
  lastStartedAt: Date | null
  lastFinishedAt: Date | null
  lastDurationMs: number | null
  lastStatus: JobRunStatus
  lastError: string | null
  runCount: number
  errorCount: number
  runner: (() => Promise<unknown>) | null
}

const registry = new Map<string, InternalJob>()

function toSnapshot(j: InternalJob): JobSnapshot {
  return {
    id: j.id,
    name: j.name,
    schedule: j.schedule,
    description: j.description,
    enabled: j.enabled,
    running: j.running,
    lastStartedAt: j.lastStartedAt?.toISOString() ?? null,
    lastFinishedAt: j.lastFinishedAt?.toISOString() ?? null,
    lastDurationMs: j.lastDurationMs,
    lastStatus: j.lastStatus,
    lastError: j.lastError,
    runCount: j.runCount,
    errorCount: j.errorCount,
  }
}

export function registerJob(
  def: JobDefinition,
  runner?: () => Promise<unknown>,
): void {
  const existing = registry.get(def.id)
  registry.set(def.id, {
    id: def.id,
    name: def.name,
    schedule: def.schedule,
    description: def.description,
    enabled: def.enabled !== false,
    running: existing?.running ?? false,
    lastStartedAt: existing?.lastStartedAt ?? null,
    lastFinishedAt: existing?.lastFinishedAt ?? null,
    lastDurationMs: existing?.lastDurationMs ?? null,
    lastStatus: existing?.lastStatus ?? 'NEVER',
    lastError: existing?.lastError ?? null,
    runCount: existing?.runCount ?? 0,
    errorCount: existing?.errorCount ?? 0,
    runner: runner ?? existing?.runner ?? null,
  })
}

export function setJobRunner(id: string, runner: () => Promise<unknown>): void {
  const j = registry.get(id)
  if (!j) throw new Error(`Unknown job: ${id}`)
  j.runner = runner
}

export function listJobs(): JobSnapshot[] {
  return Array.from(registry.values())
    .map(toSnapshot)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function getJob(id: string): JobSnapshot | null {
  const j = registry.get(id)
  return j ? toSnapshot(j) : null
}

/**
 * Run a job while updating registry status.
 * Concurrent runs of the same job are rejected.
 */
export async function runTracked<T>(
  id: string,
  fn?: () => Promise<T>,
): Promise<{ ok: boolean; result?: T; error?: string; durationMs: number }> {
  const j = registry.get(id)
  if (!j) {
    return { ok: false, error: `Unknown job: ${id}`, durationMs: 0 }
  }
  if (j.running) {
    return { ok: false, error: 'Job already running', durationMs: 0 }
  }

  const runner = fn ?? j.runner
  if (!runner) {
    return { ok: false, error: 'No runner registered for this job', durationMs: 0 }
  }

  j.running = true
  j.lastStatus = 'RUNNING'
  j.lastStartedAt = new Date()
  j.lastError = null
  const started = Date.now()

  try {
    const result = (await runner()) as T
    const durationMs = Date.now() - started
    j.running = false
    j.lastFinishedAt = new Date()
    j.lastDurationMs = durationMs
    j.lastStatus = 'SUCCESS'
    j.lastError = null
    j.runCount += 1
    return { ok: true, result, durationMs }
  } catch (err) {
    const durationMs = Date.now() - started
    const message = err instanceof Error ? err.message : String(err)
    j.running = false
    j.lastFinishedAt = new Date()
    j.lastDurationMs = durationMs
    j.lastStatus = 'ERROR'
    j.lastError = message.slice(0, 500)
    j.runCount += 1
    j.errorCount += 1
    return { ok: false, error: message, durationMs }
  }
}

export async function triggerJob(id: string): Promise<{
  ok: boolean
  error?: string
  durationMs: number
  job: JobSnapshot | null
}> {
  const result = await runTracked(id)
  return {
    ok: result.ok,
    error: result.error,
    durationMs: result.durationMs,
    job: getJob(id),
  }
}
