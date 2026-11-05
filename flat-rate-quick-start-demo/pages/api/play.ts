import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { AD_FREE_ENTITLEMENT, GRANTEE } from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { isSalableError } from '@/lib/salable'
import { playSchema } from '@/lib/schemas'
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
 * The feature the demo gates: playing a track without ads. The playback is
 * simulated; the entitlement check in front of it is real.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string } | ApiErrorResponse>
) {
  const parsed = playSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const { track } = parsed.data

  try {
    // Step 3: only allow the action when the grantee holds the
    // ad_free_listening entitlement. getEntitlements scopes the check to the
    // owner, so only company_acme's subscriptions count.
    const entitlements = await getEntitlements(GRANTEE)
    const hasAccess = entitlements.some((e) => e.value === AD_FREE_ENTITLEMENT)
    if (!hasAccess) {
      return res.status(403).json({
        error: `${GRANTEE} does not have the ${AD_FREE_ENTITLEMENT} entitlement. Subscribe to Pro to unlock it`,
      })
    }

    return res.status(200).json({
      message: `Played "${track}" with no ads. Nothing was streamed; only the entitlement check was real.`,
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
