import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import {
  GENERATE_ENTITLEMENT,
  GRANTEE,
  METER_SLUG,
  OWNER,
  TOKEN_SLUG,
} from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { getSalable, isSalableError } from '@/lib/salable'
import { consumeSchema } from '@/lib/schemas'
import type { ApiErrorResponse, ConsumeResponse } from '@/lib/types'

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
 * Generate images, paying with the included tokens first and falling back to
 * metered overage once they run out:
 *
 * 1. Check the grantee holds the entitlement.
 * 2. Try to consume `amount` tokens. Salable deducts them and answers 204, or
 *    rejects the whole request with 422 "Insufficient token balance" and
 *    deducts nothing.
 * 3. On that 422, record `amount` as usage against the meter instead. Salable
 *    answers 204 straight away and increments the usage record in the
 *    background; the count is invoiced at the end of the billing period.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<ConsumeResponse | ApiErrorResponse>
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
    // 1. Only let the grantee generate images with the entitlement.
    const entitlements = await getEntitlements(GRANTEE)
    if (!entitlements.some((e) => e.value === GENERATE_ENTITLEMENT)) {
      return res.status(403).json({
        error: `${GRANTEE} does not have the ${GENERATE_ENTITLEMENT} entitlement. Subscribe to Pro to unlock it`,
      })
    }

    // Pretend the images were generated here, then bill for them.

    // 2. Consume the included tokens. The Idempotency-Key means a retried
    // request cannot deduct the same generation twice.
    const consumed = await consumeTokens(amount)
    if (consumed) {
      return res.status(200).json({
        billedAs: 'tokens',
        message: `Consumed ${amount} ${TOKEN_SLUG} tokens`,
      })
    }

    // 3. Out of tokens: record the whole amount as overage usage.
    await getSalable().api.usage.record.post(
      { owner: OWNER, meterSlug: METER_SLUG, increment: amount },
      { headers: { 'Idempotency-Key': randomUUID() } }
    )

    return res.status(200).json({
      billedAs: 'usage',
      message: `Token balance exhausted, so ${amount} ${METER_SLUG} were recorded as overage usage. Salable processes usage asynchronously, so the count may take a moment to update`,
    })
  } catch (err) {
    if (isSalableError(err)) {
      // No usage record exists for the owner and meter: there is no Pro
      // subscription, or Stripe's webhook has not arrived yet.
      if (err.responseStatusCode === 404) {
        return res.status(404).json({
          error: `Salable has no usage record for ${OWNER} on ${METER_SLUG}. The Pro subscription may still be processing; wait a moment and refresh`,
        })
      }
      return res
        .status(err.responseStatusCode ?? 500)
        .json({ error: err.title ?? 'Unexpected error' })
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}

/**
 * Consume `amount` tokens for the owner. Returns false when Salable rejects
 * the request with 422 (insufficient balance), which is the signal to bill
 * the generation as overage instead. Any other error propagates.
 */
async function consumeTokens(amount: number): Promise<boolean> {
  try {
    await getSalable().api.tokens.consume.post(
      { token: TOKEN_SLUG, owner: OWNER, amount },
      { headers: { 'Idempotency-Key': randomUUID() } }
    )
    return true
  } catch (err) {
    if (isSalableError(err) && err.responseStatusCode === 422) return false
    throw err
  }
}
