import { TEAM_OWNER, TEAM_SEATS_SLUG } from './constants'
import { getSalable, isSalableError } from './salable'
import { getSubscriptionSummary } from './subscriptions'
import type { Subscription, TeamSummary, TeamView } from './types'

/**
 * Step 2 of the guide: the Team ACME workspace as one user sees it. Being in
 * the group is what authorises a user to see and manage the team's
 * subscription, so a user outside the group gets neither the subscription nor
 * the member list, only `memberOnly: true`. Without a live Team subscription
 * there is no group to be in, and anyone may start one.
 */
export async function getTeamView(granteeId: string): Promise<TeamView> {
  const { subscription, team } = await loadTeam()

  if (team && !isTeamMember(team, granteeId)) {
    return {
      subscription: { subscription: null, memberOnly: true },
      group: { team: null, memberOnly: true },
    }
  }

  return {
    subscription: { subscription, memberOnly: false },
    group: { team, memberOnly: false },
  }
}

export function isTeamMember(team: TeamSummary, granteeId: string): boolean {
  return team.members.some((m) => m.granteeId === granteeId)
}

/**
 * The live Team subscription and the group behind it. Checkout created the
 * group for `team_acme` with the buyer as its first member, and every Team
 * checkout creates a new one, so the group is always found through the live
 * subscription rather than by listing the owner's groups. The seat count is
 * the quantity on the per-seat line item of the live subscription's plan; the
 * group's `subscriptionPlans` also lists plans from cancelled subscriptions,
 * so they are matched on the subscription ID.
 */
async function loadTeam(): Promise<{
  subscription: Subscription | null
  team: TeamSummary | null
}> {
  const { subscription } = await getSubscriptionSummary(TEAM_OWNER, 'acme')
  if (!subscription?.groupId) return { subscription, team: null }

  try {
    const response = await getSalable()
      .api.groups.byId(subscription.groupId)
      .get({
        queryParameters: { expand: ['memberships', 'subscriptionPlans'] },
      })

    const group = response?.data
    if (!group?.id) return { subscription, team: null }

    const members = (group.memberships?.data ?? [])
      .flatMap((m) =>
        // A membership's own `granteeId` is Salable's internal ID; the ID
        // this app knows the user by is on the expanded grantee.
        m.grantee?.granteeId
          ? [
              {
                granteeId: m.grantee.granteeId,
                name: m.grantee.name ?? null,
                joinedAt: m.createdAt ?? null,
              },
            ]
          : []
      )
      .sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''))

    // The Team plan combines three line items (per-seat, metered and token),
    // so the seat count is the quantity on the per-seat one specifically. A
    // subscription's line items do not carry the plan line item's slug or
    // price type (`type` is only `unit` or `metered`), so the per-seat one is
    // matched through the Stripe product the plan line item was created with.
    const subscriptionPlan = group.subscriptionPlans?.data?.find(
      (p) => p.subscriptionId === subscription.id
    )
    const seatsProductId = subscriptionPlan?.plan?.lineItems?.data?.find(
      (li) => li.slug === TEAM_SEATS_SLUG
    )?.stripeProductId
    const seats =
      subscriptionPlan?.subscriptionPlanLineItems?.data?.find(
        (item) =>
          seatsProductId != null &&
          item.lineItemStripeProductId === seatsProductId
      )?.quantity ?? null

    return {
      subscription,
      team: { groupId: group.id, name: group.name ?? null, seats, members },
    }
  } catch (err) {
    // 404: the group was deleted in the dashboard. Treat it as no team.
    if (isSalableError(err) && err.responseStatusCode === 404) {
      return { subscription, team: null }
    }
    throw err
  }
}
