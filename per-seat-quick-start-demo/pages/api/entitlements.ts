import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { resolveContext } from '@/lib/context'
import { getEntitlements } from '@/lib/entitlements'
import { isSalableError } from '@/lib/salable'
import { contextSchema } from '@/lib/schemas'
import type { ApiErrorResponse, Entitlement } from '@/lib/types'

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
 * Step 3 of the guide: which entitlements the user holds on this tab. The
 * check is scoped to the tab's owner, so a user in both their own group and
 * the team's only sees the access that owner's subscriptions grant.
 */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<{ entitlements: Entitlement[] } | ApiErrorResponse>
) {
  const parsed = contextSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const ctx = resolveContext(parsed.data.granteeId, parsed.data.tab)

  try {
    return res.status(200).json({
      entitlements: await getEntitlements(ctx.granteeId, ctx.owner),
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
