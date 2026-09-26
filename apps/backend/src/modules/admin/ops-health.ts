/**
 * Admin ops health helpers — real probes, no secrets in responses.
 */
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { execFile as execFileCb } from 'child_process'
import { env } from '../../config/env'
import { prisma } from '../../config/database'
import { redis } from '../../config/redis'
import { getMaintenanceStatus } from '../../utils/platform-config'
import { listJobs } from '../../utils/job-registry'

const execFile = promisify(execFileCb)

export type ProbeStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'DISABLED' | 'UNKNOWN'

export type ServiceProbe = {
  status: ProbeStatus
  responseTimeMs: number
  detail?: string
}

function classifyLatency(ms: number, healthyMax: number, degradedMax: number): ProbeStatus {
  if (ms < healthyMax) return 'HEALTHY'
  if (ms < degradedMax) return 'DEGRADED'
  return 'DEGRADED'
}

export async function probeDatabase(): Promise<ServiceProbe> {
  const start = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const ms = Date.now() - start
    return { status: classifyLatency(ms, 100, 500), responseTimeMs: ms }
  } catch (err) {
    return {
      status: 'DOWN',
      responseTimeMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'database probe failed',
    }
  }
}

export async function probeRedis(): Promise<ServiceProbe> {
  const start = Date.now()
  try {
    const pong = await redis.ping()
    const ms = Date.now() - start
    if (pong !== 'PONG') {
      return { status: 'DEGRADED', responseTimeMs: ms, detail: `unexpected ping reply` }
    }
    return { status: classifyLatency(ms, 50, 200), responseTimeMs: ms }
  } catch (err) {
    return {
      status: 'DOWN',
      responseTimeMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'redis probe failed',
    }
  }
}

export async function probeKeycloak(): Promise<ServiceProbe> {
  const enabled = env.KEYCLOAK_AUTH_ENABLED === 'true'
  if (!enabled || !env.KEYCLOAK_URL) {
    return {
      status: 'DISABLED',
      responseTimeMs: 0,
      detail: enabled ? 'KEYCLOAK_URL not set' : 'Keycloak auth disabled',
    }
  }

  const start = Date.now()
  const base = env.KEYCLOAK_URL.replace(/\/$/, '')
  const url = `${base}/realms/${env.KC_REALM}/.well-known/openid-configuration`
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    const ms = Date.now() - start
    if (!res.ok) {
      return { status: 'DOWN', responseTimeMs: ms, detail: `HTTP ${res.status}` }
    }
    return { status: classifyLatency(ms, 300, 1500), responseTimeMs: ms }
  } catch (err) {
    return {
      status: 'DOWN',
      responseTimeMs: Date.now() - start,
      detail: err instanceof Error ? err.message : 'keycloak probe failed',
    }
  }
}

export async function collectServiceHealth(): Promise<Record<string, ServiceProbe>> {
  const apiStart = Date.now()
  const [database, redisProbe, keycloak] = await Promise.all([
    probeDatabase(),
    probeRedis(),
    probeKeycloak(),
  ])
  return {
    api: { status: 'HEALTHY', responseTimeMs: Date.now() - apiStart },
    database,
    redis: redisProbe,
    keycloak,
  }
}

export type DiskMount = {
  path: string
  totalBytes: number | null
  freeBytes: number | null
  usedPercent: number | null
  available: boolean
  detail?: string
}

async function statfsSafe(target: string): Promise<DiskMount> {
  try {
    // Node 18.15+ / 19+
    const statfs = (fs as typeof fs & {
      promises: { statfs?: (p: string) => Promise<{ bsize: number; blocks: number; bavail: number }> }
    }).promises.statfs
    if (!statfs) {
      return { path: target, totalBytes: null, freeBytes: null, usedPercent: null, available: false, detail: 'statfs unavailable' }
    }
    const s = await statfs(target)
    const total = s.bsize * s.blocks
    const free = s.bsize * s.bavail
    const usedPercent = total > 0 ? Math.round(((total - free) / total) * 1000) / 10 : null
    return { path: target, totalBytes: total, freeBytes: free, usedPercent, available: true }
  } catch (err) {
    return {
      path: target,
      totalBytes: null,
      freeBytes: null,
      usedPercent: null,
      available: false,
      detail: err instanceof Error ? err.message : 'disk probe failed',
    }
  }
}

export type BackupStatus = {
  available: boolean
  directory: string
  latestFile: string | null
  latestBytes: number | null
  latestCreatedAt: string | null
  formatVersion: string | null
  status: 'ok' | 'stale' | 'missing' | 'unavailable'
  ageHours: number | null
  detail?: string
  recentCount48h: number
}

export async function collectBackupStatus(): Promise<BackupStatus> {
  const directory = process.env.HEXALYTE_BACKUP_DIR || '/var/backups/hexalyte/db'
  const staleHours = Number(process.env.HEXALYTE_BACKUP_STALE_HOURS || 36)

  try {
    if (!fs.existsSync(directory)) {
      return {
        available: false,
        directory,
        latestFile: null,
        latestBytes: null,
        latestCreatedAt: null,
        formatVersion: null,
        status: 'unavailable',
        ageHours: null,
        recentCount48h: 0,
        detail: 'Backup directory not mounted in API container — check host cron + optional volume mount',
      }
    }

    const names = await fs.promises.readdir(directory)
    const encFiles = names.filter((n) => n.endsWith('.dump.enc'))
    if (!encFiles.length) {
      return {
        available: true,
        directory,
        latestFile: null,
        latestBytes: null,
        latestCreatedAt: null,
        formatVersion: null,
        status: 'missing',
        ageHours: null,
        recentCount48h: 0,
        detail: 'No encrypted dumps found',
      }
    }

    const withStat = await Promise.all(
      encFiles.map(async (name) => {
        const full = path.join(directory, name)
        const st = await fs.promises.stat(full)
        return { name, full, mtime: st.mtime, size: st.size }
      }),
    )
    withStat.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    const latest = withStat[0]
    const ageHours = (Date.now() - latest.mtime.getTime()) / 3_600_000
    const recentCount48h = withStat.filter((f) => Date.now() - f.mtime.getTime() < 48 * 3_600_000).length

    let formatVersion: string | null = null
    let metaCreated: string | null = null
    const metaPath = latest.full.replace(/\.dump\.enc$/, '.meta')
    if (fs.existsSync(metaPath)) {
      const metaText = await fs.promises.readFile(metaPath, 'utf8')
      for (const line of metaText.split(/\r?\n/)) {
        if (line.startsWith('format_version=')) formatVersion = line.slice('format_version='.length).trim()
        if (line.startsWith('created_at=')) metaCreated = line.slice('created_at='.length).trim()
      }
    }

    const status: BackupStatus['status'] =
      latest.size < 1024 ? 'missing' : ageHours > staleHours ? 'stale' : 'ok'

    return {
      available: true,
      directory,
      latestFile: latest.name,
      latestBytes: latest.size,
      latestCreatedAt: metaCreated || latest.mtime.toISOString(),
      formatVersion,
      status,
      ageHours: Math.round(ageHours * 10) / 10,
      recentCount48h,
    }
  } catch (err) {
    return {
      available: false,
      directory,
      latestFile: null,
      latestBytes: null,
      latestCreatedAt: null,
      formatVersion: null,
      status: 'unavailable',
      ageHours: null,
      recentCount48h: 0,
      detail: err instanceof Error ? err.message : 'backup status failed',
    }
  }
}

export type DockerContainerRow = {
  name: string
  image: string
  status: string
  state: string
}

export async function collectDockerStatus(): Promise<{
  available: boolean
  containers: DockerContainerRow[]
  detail?: string
}> {
  if (process.env.HEXALYTE_OPS_DOCKER !== '1') {
    return {
      available: false,
      containers: [],
      detail: 'Docker introspection disabled (set HEXALYTE_OPS_DOCKER=1 and mount docker.sock only if intentionally required)',
    }
  }
  try {
    const { stdout } = await execFile(
      'docker',
      ['ps', '--format', '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.State}}'],
      { timeout: 5000, maxBuffer: 1024 * 1024 },
    )
    const containers = stdout
      .trim()
      .split(/\n/)
      .filter(Boolean)
      .map((line) => {
        const [name, image, status, state] = line.split('\t')
        return { name: name || '', image: image || '', status: status || '', state: state || '' }
      })
    return { available: true, containers }
  } catch (err) {
    return {
      available: false,
      containers: [],
      detail: err instanceof Error ? err.message : 'docker ps failed',
    }
  }
}

export async function collectOpsOverview() {
  const [services, backup, diskRoot, diskBackup, docker, maintenance] = await Promise.all([
    collectServiceHealth(),
    collectBackupStatus(),
    statfsSafe('/'),
    statfsSafe(process.env.HEXALYTE_BACKUP_ROOT || '/var/backups/hexalyte'),
    collectDockerStatus(),
    getMaintenanceStatus(),
  ])

  const jobs = listJobs()
  const mem = process.memoryUsage()

  return {
    checkedAt: new Date().toISOString(),
    timezone: 'Asia/Colombo',
    maintenance: {
      enabled: maintenance.enabled,
      message: maintenance.message,
    },
    services,
    jobs,
    backup,
    disk: {
      root: diskRoot,
      backups: diskBackup,
    },
    docker,
    host: {
      hostname: process.env.HOSTNAME || null,
      nodeVersion: process.version,
      platform: process.platform,
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      publicHints: {
        // Informational only — not a live network probe
        documentedServerIp: process.env.HEXALYTE_PUBLIC_IP || '157.180.113.249',
        appDir: process.env.HEXALYTE_APP_DIR || '/opt/hexalyte',
      },
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024),
      },
    },
  }
}
