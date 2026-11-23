import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { resolveContext } from '@/lib/context'
import { getTeamView } from '@/lib/group'
import { isSalableError } from '@/lib/salable'
import { contextSchema } from '@/lib/schemas'
import { getSubscriptionSummary } from '@/lib/subscriptions'
import type { ApiErrorResponse, SubscriptionSummary } from '@/lib/types'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<unknown>
) {
  switch (req.method) {
    case 'GET':
      return GET(req, res)
    default:
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

/**
 * The team owner's live subscription to the team's plan, used to switch
 * Subscribe and Manage. In the Team ACME workspace it is only returned to a
 * member of the team's group.
 */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<SubscriptionSummary | ApiErrorResponse>
) {
  const parsed = contextSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const ctx = resolveContext(parsed.data.granteeId, parsed.data.team)

  try {
    if (ctx.team === 'acme') {
      const view = await getTeamView(ctx.granteeId)
      return res.status(200).json(view.subscription)
    }
    return res
      .status(200)
      .json(await getSubscriptionSummary(ctx.owner, ctx.team))
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
