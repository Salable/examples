import type { NextApiRequest, NextApiResponse } from 'next'
import { GRANTEE } from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { isSalableError } from '@/lib/salable'
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

/** Step 6 of the guide: which entitlements the grantee currently holds. */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<{ entitlements: Entitlement[] } | ApiErrorResponse>
) {
  try {
    return res
      .status(200)
      .json({ entitlements: await getEntitlements(GRANTEE) })
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
