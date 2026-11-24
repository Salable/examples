import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { getSalable, isSalableError } from '@/lib/salable'
import { subscriptionIdSchema } from '@/lib/schemas'
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
 * Opens Stripe's billing portal for the owner of a subscription. The portal
 * belongs to the owner rather than the subscription, so it is created from
 * the subscription's `ownerId`, and its features are chosen per session: here
 * the customer can change their card and details and see their invoices,
 * while cancelling stays with the app's own button. Each URL works once.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<{ url: string } | ApiErrorResponse>
) {
  const parsed = subscriptionIdSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const appUrl = 'http://localhost:3000'

  try {
    const salable = getSalable()

    const subscription = await salable.api.subscriptions
      .byId(parsed.data.id)
      .get()
    const ownerId = subscription?.data?.ownerId
    if (!ownerId) {
      return res.status(502).json({ error: 'Subscription has no owner record' })
    }

    const response = await salable.api.owners.byId(ownerId).portal.post({
      returnUrl: `${appUrl}/`,
      features: {
        paymentMethodUpdate: { enabled: true },
        customerUpdate: {
          enabled: true,
          allowedUpdates: ['name', 'email', 'address'],
        },
        invoiceHistory: { enabled: true },
      },
    })

    const url = response?.data?.url
    if (!url) {
      return res
        .status(502)
        .json({ error: 'Salable did not return a portal URL' })
    }

    return res.status(200).json({ url })
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
