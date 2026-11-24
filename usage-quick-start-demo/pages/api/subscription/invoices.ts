import type { NextApiRequest, NextApiResponse } from 'next'
import { getInvoices } from '@/lib/invoices'
import { isSalableError } from '@/lib/salable'
import { getSubscriptionSummary } from '@/lib/subscriptions'
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
 * The invoices behind the owner's live Pro subscription. The subscription is
 * looked up here rather than taken from the request, and an owner without one
 * gets an empty list rather than an error, so the panel stays quiet while a
 * cancellation settles.
 */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<{ data: Invoice[] } | ApiErrorResponse>
) {
  try {
    const { pro } = await getSubscriptionSummary()
    const data = pro ? await getInvoices(pro.id) : []
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
