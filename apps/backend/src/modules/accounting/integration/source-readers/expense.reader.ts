import { prisma } from '../../../../config/database'

export async function readExpenseTransaction(tenantId: string, txId: string) {
  return prisma.transaction.findFirst({
    where: { id: txId, tenantId, type: 'EXPENSE' },
  })
}

