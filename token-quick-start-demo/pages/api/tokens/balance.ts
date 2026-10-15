import type { NextApiRequest, NextApiResponse } from 'next'
import { isSalableError } from '@/lib/salable'
import { getTokenBalance } from '@/lib/tokens'
import type { ApiErrorResponse, TokenBalance } from '@/lib/types'

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

/** Step 7 of the guide: the owner's token balance and its records. */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<TokenBalance | ApiErrorResponse>
) {
  try {
    return res.status(200).json(await getTokenBalance())
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
