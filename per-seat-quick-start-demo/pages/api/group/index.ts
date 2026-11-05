import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { getTeamView } from '@/lib/group'
import { isSalableError } from '@/lib/salable'
import { contextSchema } from '@/lib/schemas'
import type { ApiErrorResponse, GroupSummary } from '@/lib/types'

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
 * The team's group, members and seats, for a user who is in it. A user
 * outside the group only learns that it is members-only. The group is
 * resolved from the live Team subscription on the server; the client never
 * sends Salable IDs.
 */
async function GET(
  req: NextApiRequest,
  res: NextApiResponse<GroupSummary | ApiErrorResponse>
) {
  const parsed = contextSchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  // The Personal tab has no group to show.
  if (parsed.data.tab !== 'team') {
    return res.status(200).json({ team: null, memberOnly: false })
  }

  try {
    const view = await getTeamView(parsed.data.granteeId)
    return res.status(200).json(view.group)
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
