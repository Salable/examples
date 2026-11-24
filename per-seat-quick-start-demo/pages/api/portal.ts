import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { TEAM_NAME } from '@/lib/constants'
import { contextPageParams, resolveContext } from '@/lib/context'
import { getContextSubscription } from '@/lib/group'
import { getSalable, isSalableError } from '@/lib/salable'
import { portalSchema } from '@/lib/schemas'
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
 * Opens Stripe's billing portal for the owner of the workspace's live
 * subscription. The portal belongs to the owner rather than the subscription,
 * so it is created from the subscription's `ownerId`, and in the Team ACME
 * workspace only a member of the team's group may open it. Its features are
 * chosen per session: here the customer can change their card and details
 * and see their invoices, while cancelling stays with the app's own button.
 * Each URL works once.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<{ url: string } | ApiErrorResponse>
) {
  const parsed = portalSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const ctx = resolveContext(parsed.data.granteeId, parsed.data.team)
  const appUrl = 'http://localhost:3000'

  try {
    const { subscription, memberOnly } = await getContextSubscription(ctx)
    if (memberOnly) {
      return res.status(403).json({
        error: `Only a member of ${TEAM_NAME} can manage its billing`,
      })
    }
    if (!subscription) {
      return res.status(404).json({ error: 'No live subscription to manage' })
    }
    if (!subscription.ownerId) {
      return res.status(502).json({ error: 'Subscription has no owner record' })
    }

    const response = await getSalable()
      .api.owners.byId(subscription.ownerId)
      .portal.post({
        // Send the customer back to the same user and team.
        returnUrl: `${appUrl}/?${contextPageParams(ctx)}`,
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
