import { OWNER, getProPlanId } from './constants'
import { getSalable } from './salable'
import type { Subscription, SubscriptionSummary } from './types'

const LIVE_STATUSES = new Set(['active', 'past_due', 'trialling', 'trialing'])

/**
 * The owner's live Pro subscription, if any. `plans` filters server-side to
 * subscriptions that include the Pro plan.
 */
export async function getSubscriptionSummary(): Promise<SubscriptionSummary> {
  const response = await getSalable().api.subscriptions.get({
    queryParameters: { owner: OWNER, plans: [getProPlanId()] },
  })

  const live = response?.data?.find((s) => LIVE_STATUSES.has(s.status ?? ''))

  const pro: Subscription | null = live?.id
    ? {
        id: live.id,
        status: live.status ?? null,
        startDate: live.startDate ?? null,
        cancelAtPeriodEnd: live.cancelAtPeriodEnd ?? null,
        cancelledAt: live.cancelledAt ?? null,
        isPerpetual: live.isPerpetual ?? null,
      }
    : null

  return { pro }
}
