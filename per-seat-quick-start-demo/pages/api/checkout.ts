import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { TEAM_SEATS, TEAM_SEATS_SLUG, getPlanIds } from '@/lib/constants'
import { contextSearchParams, resolveContext } from '@/lib/context'
import { getSalable, isSalableError } from '@/lib/salable'
import { checkoutSchema } from '@/lib/schemas'
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
  res: NextApiResponse<{ url: string } | ApiErrorResponse>
) {
  const parsed = checkoutSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const ctx = resolveContext(parsed.data.granteeId, parsed.data.team)
  const appUrl = 'http://localhost:3000'
  // Send Stripe back to the same user and team so the page polls the right
  // context for the new subscription.
  const returnTo = contextSearchParams(ctx)

  try {
    // Step 2 of the guide: generate a Stripe Checkout link for the team's plan.
    // `grantee` is the user's ID rather than a group ID, so Salable creates a
    // new group for the owner containing them. In the Team ACME workspace the
    // group is owned by team_acme, and `metadata` buys 2 seats up front so a
    // teammate can be added to the group later without changing the quantity.
    const response = await getSalable().api.checkout.post({
      planId: getPlanIds()[ctx.team],
      owner: ctx.owner,
      grantee: ctx.granteeId,
      interval: 'month',
      intervalCount: 1,
      currency: 'USD',
      ...(ctx.team === 'acme' && {
        metadata: {
          additionalData: { [TEAM_SEATS_SLUG]: { quantity: TEAM_SEATS } },
        },
      }),
      successUrl: `${appUrl}/?checkout=success&${returnTo}`,
      cancelUrl: `${appUrl}/?checkout=cancelled&${returnTo}`,
    })

    const url = response?.data?.url
    if (!url) {
      return res
        .status(502)
        .json({ error: 'Salable did not return a checkout URL' })
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
