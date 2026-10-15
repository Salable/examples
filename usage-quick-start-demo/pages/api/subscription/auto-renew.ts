import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { getSalable, isSalableError } from '@/lib/salable'
import { autoRenewSchema } from '@/lib/schemas'
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
  const parsed = autoRenewSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const { id, status } = parsed.data

  try {
    await getSalable()
      .api.subscriptions.byId(id)
      .autoRenew.put({ queryParameters: { status } })

    return res.status(200).json({
      message:
        status === 'disable'
          ? 'Auto-renew turned off. The subscription will cancel at the end of the period'
          : 'Auto-renew turned on',
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
