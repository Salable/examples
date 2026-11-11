import type {
  BatchReceiptActionsResponseSchema_data,
  BatchSubscriptionActionsResponseSchema_data,
  BatchSubscriptionActionsResponseSchema_data_results,
} from '@salable/sdk/dist/sdk/models'
import type { NextApiRequest, NextApiResponse } from 'next'
import { GRANTEE_IDS, TEAM_OWNER, USERS } from '@/lib/constants'
import { getSalable, isSalableError } from '@/lib/salable'
import type { ApiErrorResponse } from '@/lib/types'

/** Every owner the demo can create: each user's Personal owner plus the team. */
const OWNERS = [USERS.user_alice.id, USERS.user_bob.id, TEAM_OWNER]

type Deleted = {
  subscriptions: number
  receipts: number
  groups: number
  owners: number
  grantees: number
}
type BatchResult = Required<
  Pick<
    BatchSubscriptionActionsResponseSchema_data_results,
    'id' | 'status' | 'reason'
  >
>

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
 * Deletes every subscription, receipt and group for each demo owner, then
 * the owner and grantee records themselves, so the next run starts from
 * nothing but the imported product. Subscriptions go first because a group
 * cannot be deleted while a live subscription's plan is attached to it. The
 * delete endpoints are only available in Salable test mode.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<
    | { message: string; deleted: Deleted }
    | (ApiErrorResponse & { results?: BatchResult[] })
  >
) {
  const salable = getSalable()

  const deleted: Deleted = {
    subscriptions: 0,
    receipts: 0,
    groups: 0,
    owners: 0,
    grantees: 0,
  }
  let failed = 0
  const results: BatchResult[] = []

  function record(
    response:
      | BatchSubscriptionActionsResponseSchema_data
      | BatchReceiptActionsResponseSchema_data
      | undefined
      | null
  ) {
    failed += response?.failed ?? 0
    for (const r of response?.results ?? []) {
      if (r.id) {
        results.push({
          id: r.id,
          status: r.status ?? 'unknown',
          reason: r.reason ?? null,
        })
      }
    }
    return response?.succeeded ?? 0
  }

  try {
    for (const owner of OWNERS) {
      const subscriptions = await salable.api.subscriptions.get({
        queryParameters: { owner, limit: '100' },
      })
      const subscriptionIds = (subscriptions?.data ?? []).flatMap((s) =>
        s.id ? [s.id] : []
      )
      if (subscriptionIds.length) {
        deleted.subscriptions += record(
          (
            await salable.api.subscriptions.batch.post({
              action: 'delete',
              subscriptionIds,
            })
          )?.data
        )
      }

      // NOTE: Subscriptions cascade to their receipts, so this only finds
      // receipts that were not attached to a subscription.
      const receipts = await salable.api.receipts.get({
        queryParameters: { owner: [owner], limit: '100' },
      })
      const receiptIds = (receipts?.data ?? []).flatMap((r) =>
        r.id ? [r.id] : []
      )
      if (receiptIds.length) {
        deleted.receipts += record(
          (
            await salable.api.receipts.batch.post({
              action: 'delete',
              receiptIds,
            })
          )?.data
        )
      }

      // Every checkout created a new group for its owner, including ones
      // left behind by cancelled subscriptions, so delete them all.
      const groups = await salable.api.groups.get({
        queryParameters: { owner, limit: '100' },
      })
      for (const group of groups?.data ?? []) {
        if (!group.id) continue
        await salable.api.groups.byId(group.id).delete()
        deleted.groups += 1
      }

      // Salable created the owner on the first checkout. Its item route takes
      // Salable's own ID, so look it up by the hardcoded value.
      const ownerRecord = (
        await salable.api.owners.get({ queryParameters: { search: owner } })
      )?.data?.find((o) => o.value === owner)
      if (ownerRecord?.id) {
        await salable.api.owners.byId(ownerRecord.id).delete()
        deleted.owners += 1
      }
    }

    for (const granteeId of GRANTEE_IDS) {
      const grantee = (
        await salable.api.grantees.get({
          queryParameters: { search: granteeId },
        })
      )?.data?.find((g) => g.granteeId === granteeId)
      if (grantee?.id) {
        await salable.api.grantees.byId(grantee.id).delete()
        deleted.grantees += 1
      }
    }

    const summary = `Deleted ${deleted.subscriptions} ${plural(deleted.subscriptions, 'subscription')}, ${deleted.receipts} ${plural(deleted.receipts, 'receipt')}, ${deleted.groups} ${plural(deleted.groups, 'group')}, ${deleted.owners} ${plural(deleted.owners, 'owner')} and ${deleted.grantees} ${plural(deleted.grantees, 'grantee')}`

    if (failed > 0) {
      return res.status(502).json({
        error: `${summary}, but ${failed} failed`,
        results,
      })
    }

    return res.status(200).json({ message: summary, deleted })
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

function plural(count: number, word: string) {
  return count === 1 ? word : `${word}s`
}
