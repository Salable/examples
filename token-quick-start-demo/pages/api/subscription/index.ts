import type { NextApiRequest, NextApiResponse } from 'next'
import { isSalableError } from '@/lib/salable'
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

/** The owner's live Starter subscription, used to switch Subscribe and Manage. */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<SubscriptionSummary | ApiErrorResponse>
) {
  try {
    return res.status(200).json(await getSubscriptionSummary())
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
