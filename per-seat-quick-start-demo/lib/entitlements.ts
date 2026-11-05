import { getSalable, isSalableError } from './salable'
import type { Entitlement, EntitlementType } from './types'

/**
 * The grantee's current entitlements, scoped to the owner. The check is
 * always owner-scoped: a grantee can belong to groups under several owners
 * (here, their own Personal owner and `team_acme`), and without `owner`
 * Salable would return the union of every subscription they can reach. Passing
 * the tab's owner is what makes the same user see different access on each
 * tab. It also makes Salable include the owner's meter and token slugs as
 * `type: 'meter'` / `type: 'token'` entries, though this demo only has plain
 * entitlements.
 */
export async function getEntitlements(
  granteeId: string,
  owner: string
): Promise<Entitlement[]> {
  try {
    const response = await getSalable().api.entitlements.check.get({
      queryParameters: { granteeId, owner },
    })

    return (response?.data?.entitlements ?? []).flatMap((e) =>
      e.value
        ? [
            {
              value: e.value,
              // The SDK widens `type` to string; Salable only ever returns
              // 'entitlement', 'meter' or 'token'.
              type: (e.type as EntitlementType | undefined) ?? null,
              expiryDate: e.expiryDate ?? null,
            },
          ]
        : []
    )
  } catch (err) {
    // 404: the owner or grantee has no record yet (e.g. team_acme before
    // anyone buys Team, or Bob before he is added to a group), i.e. nothing
    // has been bought, so there is nothing to be entitled to.
    if (isSalableError(err) && err.responseStatusCode === 404) return []
    throw err
  }
}
