import type { ErrorResponseBody } from '@salable/sdk/dist/sdk/models'
import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod'
import { TEAM_NAME, TEAM_OWNER, USERS } from '@/lib/constants'
import { getTeamView } from '@/lib/group'
import { getSalable, isSalableError } from '@/lib/salable'
import { memberActionSchema } from '@/lib/schemas'
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
 * Step 6 of the guide: add a user to the team's group, or remove one. Adding
 * passes the Team plan's meter and token checks for them straight away with no
 * checkout; removing takes it away again. Only a member of the group may
 * change it, and the group is resolved from the live Team subscription, so
 * the request names the acting user, the target user and the action.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<{ message: string } | ApiErrorResponse>
) {
  const parsed = memberActionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    })
  }

  const { viewer, granteeId, action } = parsed.data
  const user = USERS[granteeId]

  try {
    const { group } = await getTeamView(viewer)
    if (group.memberOnly) {
      return res.status(403).json({
        error: `Only a member of ${TEAM_NAME} can change its members`,
      })
    }
    if (!group.team) {
      return res.status(400).json({
        error: `${TEAM_OWNER} has no live Team subscription, so there is no group to manage`,
      })
    }

    // The body is a list of actions, so several changes can be applied in one
    // call. Salable creates the grantee record on `add` if it is new.
    await getSalable()
      .api.groups.byId(group.team.groupId)
      .grantees.post(
        action === 'add'
          ? [{ type: 'add', granteeId: user.id, name: user.name }]
          : [{ type: 'remove', granteeId: user.id }]
      )

    return res.status(200).json({
      message:
        action === 'add'
          ? `${user.name} added to ${TEAM_NAME}`
          : `${user.name} removed from ${TEAM_NAME}`,
    })
  } catch (err) {
    if (isSalableError(err)) {
      return res
        .status(err.responseStatusCode ?? 500)
        .json({ error: actionError(err) ?? err.title ?? 'Unexpected error' })
    }
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Unexpected error',
    })
  }
}

/**
 * When an action is rejected, e.g. the group is full or the grantee is
 * already a member, the reason is on the first entry of `errors` rather than
 * in the generic `title`. The SDK keeps those entries' fields in
 * `additionalData`.
 */
function actionError(err: ErrorResponseBody): string | null {
  const message = err.errors?.[0]?.additionalData?.message
  return typeof message === 'string' ? message : null
}
