import { getSalable, isSalableError } from './salable'
import type { Entitlement } from './types'

export async function getEntitlements(
  granteeId: string
): Promise<Entitlement[]> {
  try {
    const response = await getSalable().api.entitlements.check.get({
      queryParameters: { granteeId },
    })

    return (response?.data?.entitlements ?? []).flatMap((e) =>
      e.value
        ? [
            {
              value: e.value,
              type: e.type ?? null,
              expiryDate: e.expiryDate ?? null,
            },
          ]
        : []
    )
  } catch (err) {
    if (isSalableError(err) && err.responseStatusCode === 404) return []
    throw err
  }
}
