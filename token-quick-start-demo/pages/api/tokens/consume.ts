import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import {
  GENERATE_ENTITLEMENT,
  GRANTEE,
  OWNER,
  TOKEN_SLUG,
} from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { getSalable, isSalableError } from '@/lib/salable'
import { consumeSchema } from '@/lib/schemas'
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

async function POST(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string } | ApiErrorResponse>
) {
  const parsed = consumeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const { amount } = parsed.data

  try {
    const entitlements = await getEntitlements(GRANTEE)
    if (!entitlements.some((e) => e.value === GENERATE_ENTITLEMENT)) {
      return res.status(403).json({
        error: `${GRANTEE} does not have the ${GENERATE_ENTITLEMENT} entitlement. Subscribe to Starter or buy a Token Top-Up to unlock it`,
      })
    }

    // Step 5: Consume tokens
    await getSalable().api.tokens.consume.post(
      { token: TOKEN_SLUG, owner: OWNER, amount },
      { headers: { 'Idempotency-Key': randomUUID() } }
    )

    return res.status(200).json({ message: `Consumed ${amount} ${TOKEN_SLUG}` })
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
