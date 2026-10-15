import { OWNER, TOKEN_SLUG } from './constants'
import { getSalable, isSalableError } from './salable'
import type { TokenBalance } from './types'

/**
 * Step 7 of the guide: the owner's balance for one token slug, with the
 * records behind it. `undefined` fields become `null` so the result can be
 * passed through `getServerSideProps`.
 */
export async function getTokenBalance(): Promise<TokenBalance> {
  let response
  try {
    response = await getSalable().api.tokens.balance.get({
      queryParameters: { owner: OWNER, token: TOKEN_SLUG },
    })
  } catch (err) {
    // Salable answers 404 for an owner it has never seen, which is the state
    // after a reset: no tokens yet.
    if (isSalableError(err) && err.responseStatusCode === 404) {
      return { balance: 0, records: [] }
    }
    throw err
  }

  const token =
    response?.data?.find((t) => t.token === TOKEN_SLUG) ?? response?.data?.[0]

  return {
    balance: token?.balance ?? 0,
    records: (token?.records ?? []).map((r) => ({
      recordId: r.recordId ?? null,
      remaining: r.remaining ?? null,
      expiresAt: r.expiresAt ?? null,
      source: r.source
        ? {
            type: r.source.type ?? null,
            id: r.source.id ?? null,
            itemId: r.source.itemId ?? null,
          }
        : null,
    })),
  }
}
