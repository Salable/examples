import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { TEAM_NAME } from '@/lib/constants'
import { resolveContext } from '@/lib/context'
import { getTeamView } from '@/lib/group'
import { isSalableError } from '@/lib/salable'
import { contextSchema } from '@/lib/schemas'
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

/**
 * The team owner's pdf_exports usage records. In the Team ACME workspace they
 * are only returned to a member of the team's group, like the subscription.
 */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<UsageSummary | ApiErrorResponse>
) {
  const parsed = contextSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const ctx = resolveContext(parsed.data.granteeId, parsed.data.team)

  try {
    if (ctx.team === 'acme') {
      const { group } = await getTeamView(ctx.granteeId)
      if (group.memberOnly) {
        return res.status(403).json({
          error: `Only a member of ${TEAM_NAME} can see its usage`,
        })
      }
    }
    return res.status(200).json(await getUsage(ctx.owner))
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
