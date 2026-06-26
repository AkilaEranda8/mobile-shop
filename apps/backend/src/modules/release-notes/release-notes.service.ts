import { Request } from 'express'
import { prisma } from '../../config/database'
import { getPagination } from '../../utils/pagination'
import { AppError } from '../../middleware/error.middleware'

type TenantTarget = { id: string; plan: string }

const CATEGORY_MAP: Record<string, string> = {
  features: 'NEW_FEATURE',
  improvements: 'IMPROVEMENT',
  'bug-fixes': 'BUG_FIX',
  security: 'SECURITY',
  'coming-soon': 'COMING_SOON',
}

export function releaseVisibleToTenant(
  release: { active: boolean; status: string; targetType: string; targetPlans: string[]; targetTenants: string[] },
  tenant: TenantTarget,
): boolean {
  if (!release.active || release.status !== 'PUBLISHED') return false
  if (release.targetType === 'ALL') return true
  if (release.targetType === 'PACKAGES' && release.targetPlans.includes(tenant.plan)) return true
  if (release.targetType === 'COMPANIES' && release.targetTenants.includes(tenant.id)) return true
  return false
}

function itemCounts(items: { category: string }[]) {
  return {
    newFeatures: items.filter(i => i.category === 'NEW_FEATURE').length,
    improvements: items.filter(i => i.category === 'IMPROVEMENT').length,
    bugFixes: items.filter(i => i.category === 'BUG_FIX').length,
    securityUpdates: items.filter(i => i.category === 'SECURITY').length,
    comingSoon: items.filter(i => i.category === 'COMING_SOON').length,
  }
}

function emptyToNull(v?: string | null) {
  return v && v.trim() ? v.trim() : null
}

function mapReleaseWithMeta(
  release: {
    id: string
    version: string
    title: string
    summary: string
    releaseDate: Date
    status: string
    popupEnabled: boolean
    active: boolean
    targetType: string
    targetPlans: string[]
    targetTenants: string[]
    imageUrl: string | null
    videoUrl: string | null
    docUrl: string | null
    createdBy: string
    createdAt: Date
    updatedAt: Date
    items: Array<{
      id: string
      category: string
      module: string | null
      featureName: string
      description: string
      badge: string | null
      displayOrder: number
      imageUrl: string | null
      videoUrl: string | null
      docUrl: string | null
    }>
  },
  read?: { isRead: boolean; readAt: Date | null } | null,
) {
  const sortedItems = [...release.items].sort((a, b) => a.displayOrder - b.displayOrder)
  return {
    ...release,
    items: sortedItems,
    counts: itemCounts(sortedItems),
    isRead: read?.isRead ?? false,
    readAt: read?.readAt ?? null,
  }
}

async function getTenantOrThrow(tenantId: string): Promise<TenantTarget> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, plan: true },
  })
  if (!tenant) throw new AppError('Tenant not found', 404)
  return tenant
}

async function visibleReleaseWhere(tenant: TenantTarget) {
  const releases = await prisma.release.findMany({
    where: { status: 'PUBLISHED', active: true },
    select: {
      id: true,
      targetType: true,
      targetPlans: true,
      targetTenants: true,
      active: true,
      status: true,
    },
  })
  const visibleIds = releases
    .filter(r => releaseVisibleToTenant(r, tenant))
    .map(r => r.id)
  return visibleIds
}

export const releaseNotesService = {
  // ── Admin ──────────────────────────────────────────────────────────────────
  async adminList(req: Request) {
    const { skip, limit, page, search } = getPagination(req)
    const status = req.query.status as string | undefined
    const where: Record<string, unknown> = {}
    if (status && status !== 'ALL') where.status = status
    if (search) {
      where.OR = [
        { version: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ]
    }
    const [data, total] = await Promise.all([
      prisma.release.findMany({
        where,
        skip,
        take: limit,
        orderBy: { releaseDate: 'desc' },
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
          _count: { select: { items: true, reads: true } },
        },
      }),
      prisma.release.count({ where }),
    ])
    return {
      data: data.map(r => ({
        ...r,
        counts: itemCounts(r.items),
        itemCount: r._count.items,
        readCount: r._count.reads,
      })),
      total,
      page,
      limit,
    }
  },

  async adminGetById(id: string) {
    const release = await prisma.release.findUnique({
      where: { id },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    })
    if (!release) throw new AppError('Release not found', 404)
    return mapReleaseWithMeta(release)
  },

  async adminCreate(data: {
    version: string
    title: string
    summary: string
    releaseDate: string
    status?: string
    popupEnabled?: boolean
    active?: boolean
    targetType?: string
    targetPlans?: string[]
    targetTenants?: string[]
    imageUrl?: string | null
    videoUrl?: string | null
    docUrl?: string | null
    items?: Array<{
      category: string
      module?: string | null
      featureName: string
      description: string
      badge?: string | null
      displayOrder?: number
      imageUrl?: string | null
      videoUrl?: string | null
      docUrl?: string | null
    }>
  }, createdBy = 'Admin') {
    const { items = [], ...rest } = data
    const release = await prisma.release.create({
      data: {
        version: rest.version,
        title: rest.title,
        summary: rest.summary,
        releaseDate: new Date(rest.releaseDate),
        status: rest.status ?? 'DRAFT',
        popupEnabled: rest.popupEnabled ?? true,
        active: rest.active ?? true,
        targetType: rest.targetType ?? 'ALL',
        targetPlans: rest.targetPlans ?? [],
        targetTenants: rest.targetTenants ?? [],
        imageUrl: emptyToNull(rest.imageUrl),
        videoUrl: emptyToNull(rest.videoUrl),
        docUrl: emptyToNull(rest.docUrl),
        createdBy,
        items: {
          create: items.map((item, idx) => ({
            category: item.category,
            module: emptyToNull(item.module),
            featureName: item.featureName,
            description: item.description,
            badge: item.badge ?? null,
            displayOrder: item.displayOrder ?? idx,
            imageUrl: emptyToNull(item.imageUrl),
            videoUrl: emptyToNull(item.videoUrl),
            docUrl: emptyToNull(item.docUrl),
          })),
        },
      },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    })
    return mapReleaseWithMeta(release)
  },

  async adminUpdate(id: string, data: {
    version?: string
    title?: string
    summary?: string
    releaseDate?: string
    status?: string
    popupEnabled?: boolean
    active?: boolean
    targetType?: string
    targetPlans?: string[]
    targetTenants?: string[]
    imageUrl?: string | null
    videoUrl?: string | null
    docUrl?: string | null
    items?: Array<{
      category: string
      module?: string | null
      featureName: string
      description: string
      badge?: string | null
      displayOrder?: number
      imageUrl?: string | null
      videoUrl?: string | null
      docUrl?: string | null
    }>
  }) {
    const existing = await prisma.release.findUnique({ where: { id } })
    if (!existing) throw new AppError('Release not found', 404)

    const { items, ...rest } = data
    const updateData: Record<string, unknown> = {}
    if (rest.version !== undefined) updateData.version = rest.version
    if (rest.title !== undefined) updateData.title = rest.title
    if (rest.summary !== undefined) updateData.summary = rest.summary
    if (rest.releaseDate !== undefined) updateData.releaseDate = new Date(rest.releaseDate)
    if (rest.status !== undefined) updateData.status = rest.status
    if (rest.popupEnabled !== undefined) updateData.popupEnabled = rest.popupEnabled
    if (rest.active !== undefined) updateData.active = rest.active
    if (rest.targetType !== undefined) updateData.targetType = rest.targetType
    if (rest.targetPlans !== undefined) updateData.targetPlans = rest.targetPlans
    if (rest.targetTenants !== undefined) updateData.targetTenants = rest.targetTenants
    if (rest.imageUrl !== undefined) updateData.imageUrl = emptyToNull(rest.imageUrl)
    if (rest.videoUrl !== undefined) updateData.videoUrl = emptyToNull(rest.videoUrl)
    if (rest.docUrl !== undefined) updateData.docUrl = emptyToNull(rest.docUrl)

    await prisma.$transaction(async (tx) => {
      await tx.release.update({ where: { id }, data: updateData })
      if (items) {
        await tx.releaseItem.deleteMany({ where: { releaseId: id } })
        if (items.length) {
          await tx.releaseItem.createMany({
            data: items.map((item, idx) => ({
              releaseId: id,
              category: item.category,
              module: emptyToNull(item.module),
              featureName: item.featureName,
              description: item.description,
              badge: item.badge ?? null,
              displayOrder: item.displayOrder ?? idx,
              imageUrl: emptyToNull(item.imageUrl),
              videoUrl: emptyToNull(item.videoUrl),
              docUrl: emptyToNull(item.docUrl),
            })),
          })
        }
      }
    })

    return this.adminGetById(id)
  },

  async adminDelete(id: string) {
    const existing = await prisma.release.findUnique({ where: { id } })
    if (!existing) throw new AppError('Release not found', 404)
    await prisma.release.delete({ where: { id } })
  },

  async adminPublish(id: string) {
    const existing = await prisma.release.findUnique({ where: { id } })
    if (!existing) throw new AppError('Release not found', 404)
    const updated = await prisma.release.update({
      where: { id },
      data: { status: 'PUBLISHED' },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    })
    return mapReleaseWithMeta(updated)
  },

  // ── Tenant ─────────────────────────────────────────────────────────────────
  async tenantList(tenantId: string, req: Request) {
    const tenant = await getTenantOrThrow(tenantId)
    const visibleIds = await visibleReleaseWhere(tenant)
    if (!visibleIds.length) return { data: [], total: 0, page: 1, limit: 20 }

    const { skip, limit, page, search } = getPagination(req)
    const category = req.query.category as string | undefined

    const where: Record<string, unknown> = { id: { in: visibleIds } }
    if (search) {
      where.OR = [
        { version: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
        { items: { some: {
          OR: [
            { module: { contains: search, mode: 'insensitive' } },
            { featureName: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        } } },
      ]
    }
    if (category && category !== 'all') {
      const cat = CATEGORY_MAP[category]
      if (cat) {
        where.items = { some: { category: cat } }
      }
    }

    const [releases, total, reads] = await Promise.all([
      prisma.release.findMany({
        where,
        skip,
        take: limit,
        orderBy: { releaseDate: 'desc' },
        include: { items: { orderBy: { displayOrder: 'asc' } } },
      }),
      prisma.release.count({ where }),
      prisma.tenantReleaseRead.findMany({
        where: { tenantId, releaseId: { in: visibleIds } },
      }),
    ])

    const readMap = new Map(reads.map(r => [r.releaseId, r]))
    return {
      data: releases.map(r => mapReleaseWithMeta(r, readMap.get(r.id))),
      total,
      page,
      limit,
    }
  },

  async tenantLatest(tenantId: string) {
    const tenant = await getTenantOrThrow(tenantId)
    const visibleIds = await visibleReleaseWhere(tenant)
    if (!visibleIds.length) return null

    const release = await prisma.release.findFirst({
      where: { id: { in: visibleIds } },
      orderBy: { releaseDate: 'desc' },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    })
    if (!release) return null

    const read = await prisma.tenantReleaseRead.findUnique({
      where: { tenantId_releaseId: { tenantId, releaseId: release.id } },
    })
    return mapReleaseWithMeta(release, read)
  },

  async tenantUnreadPopup(tenantId: string) {
    const tenant = await getTenantOrThrow(tenantId)
    const visibleIds = await visibleReleaseWhere(tenant)
    if (!visibleIds.length) return null

    const reads = await prisma.tenantReleaseRead.findMany({
      where: { tenantId, releaseId: { in: visibleIds }, isRead: true },
      select: { releaseId: true },
    })
    const readIds = new Set(reads.map(r => r.releaseId))

    const release = await prisma.release.findFirst({
      where: {
        id: { in: visibleIds.filter(id => !readIds.has(id)) },
        popupEnabled: true,
      },
      orderBy: { releaseDate: 'desc' },
      select: { id: true, version: true, title: true, summary: true, releaseDate: true },
    })
    return release
  },

  async tenantGetById(tenantId: string, releaseId: string, categoryFilter?: string) {
    const tenant = await getTenantOrThrow(tenantId)
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    })
    if (!release || !releaseVisibleToTenant(release, tenant)) {
      throw new AppError('Release not found', 404)
    }

    let items = release.items
    if (categoryFilter && categoryFilter !== 'all') {
      const cat = CATEGORY_MAP[categoryFilter]
      if (cat) items = items.filter(i => i.category === cat)
    }

    const read = await prisma.tenantReleaseRead.findUnique({
      where: { tenantId_releaseId: { tenantId, releaseId } },
    })

    return mapReleaseWithMeta({ ...release, items }, read)
  },

  async tenantMarkRead(tenantId: string, releaseId: string) {
    const tenant = await getTenantOrThrow(tenantId)
    const release = await prisma.release.findUnique({ where: { id: releaseId } })
    if (!release || !releaseVisibleToTenant(release, tenant)) {
      throw new AppError('Release not found', 404)
    }

    const now = new Date()
    const record = await prisma.tenantReleaseRead.upsert({
      where: { tenantId_releaseId: { tenantId, releaseId } },
      create: { tenantId, releaseId, isRead: true, readAt: now },
      update: { isRead: true, readAt: now },
    })
    return record
  },
}
