import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { GRANTEE, METER_SLUG, OWNER } from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { getSalable, isSalableError } from '@/lib/salable'
import { generateSchema } from '@/lib/schemas'
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
  const parsed = generateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const { increment } = parsed.data

  try {
    // Step 4: the owner-scoped check returns the meter slug with type
    // 'meter'. Check both, because a token can share the same slug.
    const entitlements = await getEntitlements(GRANTEE)
    const canGenerateImages = entitlements.some(
      (e) => e.type === 'meter' && e.value === METER_SLUG
    )
    if (!canGenerateImages) {
      return res.status(403).json({
        error: `${GRANTEE} does not have access to the ${METER_SLUG} meter. Subscribe to Pro to unlock it`,
      })
    }

    // Pretend the images were generated here, then record the usage.

    // Step 3: Record usage. Salable answers 204 straight away and increments
    // the usage record in the background. The Idempotency-Key means a retried
    // request cannot count the same generation twice.
    await getSalable().api.usage.record.post(
      { owner: OWNER, meterSlug: METER_SLUG, increment },
      { headers: { 'Idempotency-Key': randomUUID() } }
    )

    return res.status(200).json({
      message: `Recorded ${increment} ${METER_SLUG}. Salable processes usage asynchronously, so the current count may not immediately reflect increments`,
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
