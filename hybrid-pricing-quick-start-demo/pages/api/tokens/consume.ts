import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { TEAM_NAME, TOKEN_SLUG } from '@/lib/constants'
import { resolveContext } from '@/lib/context'
import { getEntitlements } from '@/lib/entitlements'
import { getSalable, isSalableError } from '@/lib/salable'
import { consumeTokensSchema } from '@/lib/schemas'
import type { ApiErrorResponse } from '@/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<unknown>
) {
  switch (req.method) {
    case 'POST':
      return POST(req, res)
    default:
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

/**
 * AI assistant: consume ai_credits from the team owner's balance. Both plans
 * have a token line item, so the check fails only where the owner has no
 * live subscription or, in Team ACME, for anyone outside the group.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string } | ApiErrorResponse>
) {
  const parsed = consumeTokensSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const { amount } = parsed.data
  const ctx = resolveContext(parsed.data.granteeId, parsed.data.team)

  try {
    // The owner-scoped check returns the token slug with type 'token'. Check
    // both, because a meter can share the same slug.
    const entitlements = await getEntitlements(ctx.granteeId, ctx.owner)
    const canUseAi = entitlements.some(
      (e) => e.type === 'token' && e.value === TOKEN_SLUG
    )
    if (!canUseAi) {
      return res.status(403).json({
        error:
          ctx.team === 'acme'
            ? `${ctx.granteeId} does not have access to the ${TOKEN_SLUG} token for ${ctx.owner}. Subscribe to Team, or have a member of ${TEAM_NAME} add them to the group`
            : `${ctx.granteeId} does not have access to the ${TOKEN_SLUG} token. Subscribe to Personal`,
      })
    }

    // Pretend the notes were summarised here, then pay for it with credits.
    // Consuming is synchronous: Salable rejects the request with 422 if the
    // balance cannot cover it, and nothing is deducted.
    await getSalable().api.tokens.consume.post(
      { token: TOKEN_SLUG, owner: ctx.owner, amount },
      { headers: { 'Idempotency-Key': randomUUID() } }
    )

    return res.status(200).json({
      message: `Consumed ${amount} ${TOKEN_SLUG} from ${ctx.owner}`,
    })
  } catch (err) {
    if (isSalableError(err)) {
      return res
        .status(err.responseStatusCode ?? 500)
        .json({ error: err.title ?? 'Unexpected error' })
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}
