import type { NextApiRequest, NextApiResponse } from 'next'
import { isSalableError } from '@/lib/salable'
import { getUsage } from '@/lib/usage'
import type { ApiErrorResponse, UsageSummary } from '@/lib/types'

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

/** Step 5 of the guide: the owner's usage records for the meter. */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<UsageSummary | ApiErrorResponse>
) {
  try {
    return res.status(200).json(await getUsage())
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
