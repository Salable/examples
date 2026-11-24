import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { TEAM_NAME } from '@/lib/constants'
import { resolveContext } from '@/lib/context'
import { getContextSubscription } from '@/lib/group'
import { getInvoices } from '@/lib/invoices'
import { isSalableError } from '@/lib/salable'
import { contextSchema } from '@/lib/schemas'
import type { ApiErrorResponse, Invoice } from '@/lib/types'

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
 * The invoices behind the workspace's live subscription. The subscription is
 * resolved from the user and team rather than taken from the request, and in
 * the Team ACME workspace the invoices are only returned to a member of the
 * team's group, like the subscription itself. An owner without a subscription
 * gets an empty list rather than an error, so the panel stays quiet while a
 * cancellation settles.
 */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<{ data: Invoice[] } | ApiErrorResponse>
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
    const { subscription, memberOnly } = await getContextSubscription(ctx)
    if (memberOnly) {
      return res.status(403).json({
        error: `Only a member of ${TEAM_NAME} can see its invoices`,
      })
    }
    const data = subscription ? await getInvoices(subscription.id) : []
    return res.status(200).json({ data })
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
