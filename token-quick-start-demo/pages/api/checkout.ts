import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { GRANTEE, OWNER, getPlanIds } from '@/lib/constants'
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

  const { plan } = parsed.data
  const isRecurring = plan === 'starter'
  const appUrl = 'http://localhost:3000'

  try {
    // Step 4: Generate a Stripe Checkout link.
    // The top-up is a one-off purchase, so interval and intervalCount are null.
    // Paying for it produces a receipt and a token record. Because the plan
    // has "Create a perpetual subscription" enabled (isPerpetual in
    // product.yaml), Salable also creates a perpetual subscription, which is
    // what keeps image_tokens in the owner-scoped entitlement check without a
    // Starter subscription. Without that setting the tokens could still be
    // spent while Starter is valid, but would not grant access on their own.
    const response = await getSalable().api.checkout.post({
      planId: getPlanIds()[plan],
      owner: OWNER,
      grantee: GRANTEE,
      interval: isRecurring ? 'month' : null,
      intervalCount: isRecurring ? 1 : null,
      currency: 'USD',
      successUrl: `${appUrl}/?checkout=success`,
      cancelUrl: `${appUrl}/?checkout=cancelled`,
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
