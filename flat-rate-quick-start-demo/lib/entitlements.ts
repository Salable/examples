import { OWNER } from './constants'
import { getSalable, isSalableError } from './salable'
import type { Entitlement, EntitlementType } from './types'

/**
 * The grantee's current entitlements, scoped to the owner. Passing `owner`
 * makes Salable include the token and meter slugs of the owner's active
 * plans as entries with `type: 'token'` and `type: 'meter'`, alongside the
 * plain `type: 'entitlement'` entries, so token and meter backed features
 * can be gated without a separate entitlement.
 */
export async function getEntitlements(
  granteeId: string
): Promise<Entitlement[]> {
  try {
    const response = await getSalable().api.entitlements.check.get({
      queryParameters: { granteeId, owner: OWNER },
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
    // 404: the owner or grantee has no record yet, i.e. nothing has been
    // bought, so there is nothing to be entitled to.
    if (isSalableError(err) && err.responseStatusCode === 404) return []
    throw err
  }
}
