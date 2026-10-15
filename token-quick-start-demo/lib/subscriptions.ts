import { OWNER, getPlanIds } from './constants'
import { getSalable } from './salable'
import type { SubscriptionSummary } from './types'

const LIVE_STATUSES = new Set(['active', 'past_due', 'trialling', 'trialing'])

/**
 * The owner's live Starter subscription, if any. `plans` filters server-side
 * to subscriptions that include the Starter plan; top-ups are not needed here.
 */
export async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const response = await getSalable().api.subscriptions.get({
    queryParameters: { owner: OWNER, plans: [getPlanIds().starter] },
  })

  const starter = response?.data?.find((s) => LIVE_STATUSES.has(s.status ?? ''))

  return {
    starter: starter?.id
      ? {
          id: starter.id,
          status: starter.status ?? null,
          startDate: starter.startDate ?? null,
          cancelAtPeriodEnd: starter.cancelAtPeriodEnd ?? null,
          cancelledAt: starter.cancelledAt ?? null,
          isPerpetual: starter.isPerpetual ?? null,
        }
      : null,
  }
}
