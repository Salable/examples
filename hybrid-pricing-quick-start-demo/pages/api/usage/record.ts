import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { METER_SLUG, TEAM_NAME } from '@/lib/constants'
import { resolveContext } from '@/lib/context'
import { getEntitlements } from '@/lib/entitlements'
import { getSalable, isSalableError } from '@/lib/salable'
import { recordUsageSchema } from '@/lib/schemas'
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
 * Export PDF: record the exports as usage against the pdf_exports meter for
 * the team's owner. Both plans meter the slug, so which rate is charged
 * depends only on which owner the usage is recorded for.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string } | ApiErrorResponse>
) {
  const parsed = recordUsageSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const { increment } = parsed.data
  const ctx = resolveContext(parsed.data.granteeId, parsed.data.team)
  const planName = ctx.team === 'acme' ? 'Team' : 'Personal'

  try {
    // Step 5 of the guide: the owner-scoped check returns the meter slug with
    // type 'meter'. Check both, because a token can share the same slug. For
    // Team ACME this also covers membership: a user outside the group gets
    // no meter entry for team_acme.
    const entitlements = await getEntitlements(ctx.granteeId, ctx.owner)
    const canExport = entitlements.some(
      (e) => e.type === 'meter' && e.value === METER_SLUG
    )
    if (!canExport) {
      return res.status(403).json({
        error:
          ctx.team === 'acme'
            ? `${ctx.granteeId} does not have access to the ${METER_SLUG} meter for ${ctx.owner}. Subscribe to Team, or have a member of ${TEAM_NAME} add them to the group`
            : `${ctx.granteeId} does not have access to the ${METER_SLUG} meter. Subscribe to ${planName} to unlock it`,
      })
    }

    // Pretend the PDFs were exported here, then record the usage.

    // Step 4 of the guide: record usage for the owner. Salable answers 204
    // straight away and increments the usage record in the background. The
    // Idempotency-Key means a retried request cannot count the same exports
    // twice.
    await getSalable().api.usage.record.post(
      { owner: ctx.owner, meterSlug: METER_SLUG, increment },
      { headers: { 'Idempotency-Key': randomUUID() } }
    )

    return res.status(200).json({
      message: `Recorded ${increment} ${METER_SLUG} for ${ctx.owner}. Salable processes usage asynchronously, so the count may take a moment to update`,
    })
  } catch (err) {
    if (isSalableError(err)) {
      // No usage record exists for the owner and meter: there is no live
      // subscription, or Stripe's webhook has not arrived yet.
      if (err.responseStatusCode === 404) {
        return res.status(404).json({
          error: `Salable has no usage record for ${ctx.owner} on ${METER_SLUG}. The ${planName} subscription may still be processing; wait a moment and refresh`,
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
