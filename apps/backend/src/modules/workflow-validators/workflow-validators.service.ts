import { AppError } from '../../middleware/error.middleware'
import { isWorkflowValidatorsEnabled } from './workflow-validators.feature'
import { PO_STATUSES, PO_TRANSITIONS, REPAIR_STATUSES, REPAIR_TRANSITIONS } from './workflow-validators.graphs'
import type {
  PurchaseOrderStatus,
  RepairStatus,
  TransitionContext,
  TransitionDecision,
  WorkflowEntityType,
} from './workflow-validators.types'

function isRepairStatus(s: string): s is RepairStatus {
  return (REPAIR_STATUSES as string[]).includes(s)
}

function isPoStatus(s: string): s is PurchaseOrderStatus {
  return (PO_STATUSES as string[]).includes(s)
}

/**
 * Pure transition check — no DB, no side effects.
 * Always enforces hard rules (e.g. DELIVERED not via status API).
 * Graph edges are advisory unless assert*IfEnabled is used with flag ON.
 */
export function canTransition(
  entityType: WorkflowEntityType,
  from: string,
  to: string,
  context: TransitionContext = {},
): TransitionDecision {
  if (from === to) return { allowed: true }

  if (entityType === 'RepairTicket') {
    if (!isRepairStatus(to)) {
      return { allowed: false, reason: `Invalid repair status: ${to}` }
    }
    if (!isRepairStatus(from)) {
      return { allowed: false, reason: `Invalid current repair status: ${from}` }
    }

    if (to === 'DELIVERED') {
      if (context.via === 'collect_payment') {
        if (from === 'CANCELLED') {
          return { allowed: false, reason: 'Cannot deliver a cancelled repair' }
        }
        return { allowed: true }
      }
      return {
        allowed: false,
        reason: 'Use Collect Payment to complete and deliver this repair',
      }
    }

    if (from === 'DELIVERED' || from === 'CANCELLED') {
      return { allowed: false, reason: `Cannot change status of a ${from.toLowerCase()} repair` }
    }

    const allowed = REPAIR_TRANSITIONS[from]
    if (!allowed.includes(to)) {
      return {
        allowed: false,
        reason: `Invalid repair transition: ${from} → ${to}`,
      }
    }
    return { allowed: true }
  }

  if (entityType === 'PurchaseOrder') {
    if (!isPoStatus(to)) {
      return { allowed: false, reason: `Invalid purchase order status: ${to}` }
    }
    if (!isPoStatus(from)) {
      return { allowed: false, reason: `Invalid current purchase order status: ${from}` }
    }
    if (from === 'CLOSED') {
      return { allowed: false, reason: 'Cannot change status of a closed purchase order' }
    }
    const allowed = PO_TRANSITIONS[from]
    if (!allowed.includes(to)) {
      return {
        allowed: false,
        reason: `Invalid purchase order transition: ${from} → ${to}`,
      }
    }
    return { allowed: true }
  }

  return { allowed: false, reason: `Unknown workflow entity: ${entityType}` }
}

/** Hard rules only — always applied (matches pre-existing repairs.service guard). */
export function assertRepairStatusUpdateHardRules(
  from: string,
  to: string,
  context: TransitionContext = {},
): void {
  if (to === 'DELIVERED') {
    // Collect Payment is the only allowed path to DELIVERED (with or without workflow flag).
    if (context.via === 'collect_payment') {
      if (from === 'CANCELLED') {
        throw new AppError('Cannot deliver a cancelled repair', 400)
      }
      return
    }
    throw new AppError('Use Collect Payment to complete and deliver this repair', 400)
  }
  if (from === to) return
}

/**
 * When WORKFLOW_VALIDATORS is ON: enforce full graph.
 * When OFF: only hard rules (DELIVERED blocked on status update, allowed via collect_payment).
 */
export async function assertRepairTransitionIfEnabled(
  tenantId: string,
  from: string,
  to: string,
  context: TransitionContext = {},
): Promise<void> {
  if (!(await isWorkflowValidatorsEnabled(tenantId))) {
    assertRepairStatusUpdateHardRules(from, to, context)
    return
  }
  const decision = canTransition('RepairTicket', from, to, context)
  if (!decision.allowed) throw new AppError(decision.reason ?? 'Invalid status transition', 400)
}

export async function assertPurchaseOrderTransitionIfEnabled(
  tenantId: string,
  from: string,
  to: string,
  context: TransitionContext = {},
): Promise<void> {
  if (!(await isWorkflowValidatorsEnabled(tenantId))) return
  const decision = canTransition('PurchaseOrder', from, to, context)
  if (!decision.allowed) throw new AppError(decision.reason ?? 'Invalid status transition', 400)
}
