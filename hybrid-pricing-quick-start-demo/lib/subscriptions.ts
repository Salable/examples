import { getPlanIds, type Team } from './constants'
import { getSalable } from './salable'
import type { Subscription, SubscriptionSummary } from './types'

export const LIVE_STATUSES = new Set([
  'active',
  'past_due',
  'trialling',
  'trialing',
])

/**
 * The owner's live subscription to the team's plan, if any. `plans` filters
 * server-side to subscriptions that include that plan, and expanding
 * `subscriptionPlans` exposes the group the plan grants access to.
 */
export async function getSubscriptionSummary(
  owner: string,
  team: Team
): Promise<SubscriptionSummary> {
  const planId = getPlanIds()[team]

  const response = await getSalable().api.subscriptions.get({
    queryParameters: { owner, plans: [planId], expand: ['subscriptionPlans'] },
  })

  const live = response?.data?.find((s) => LIVE_STATUSES.has(s.status ?? ''))
  const plan =
    live?.subscriptionPlans?.data?.find((p) => p.planId === planId) ??
    live?.subscriptionPlans?.data?.[0]

  const subscription: Subscription | null = live?.id
    ? {
        id: live.id,
        status: live.status ?? null,
        startDate: live.startDate ?? null,
        cancelAtPeriodEnd: live.cancelAtPeriodEnd ?? null,
        cancelledAt: live.cancelledAt ?? null,
        isPerpetual: live.isPerpetual ?? null,
        groupId: plan?.groupId ?? null,
      }
    : null

  return { subscription, memberOnly: false }
}
