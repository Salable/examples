import type {
  BatchReceiptActionsResponseSchema_data,
  BatchSubscriptionActionsResponseSchema_data,
  BatchSubscriptionActionsResponseSchema_data_results,
} from '@salable/sdk/dist/sdk/models'
import type { NextApiRequest, NextApiResponse } from 'next'
import { GRANTEE, OWNER } from '@/lib/constants'
import { getSalable, isSalableError } from '@/lib/salable'
import type { ApiErrorResponse } from '@/lib/types'

type Deleted = {
  subscriptions: number
  receipts: number
  owner: boolean
  grantee: boolean
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
 * Deletes every subscription and receipt for the demo owner, then the owner
 * and grantee records themselves, so the next run starts from nothing but the
 * imported product. Deleting the subscriptions and owner cascades to the usage
 * records. The delete endpoints are only available in Salable test mode.
 */
async function POST(
  req: NextApiRequest,
  res: NextApiResponse<
    | { message: string; deleted: Deleted }
    | (ApiErrorResponse & { results?: BatchResult[] })
  >
) {
  const salable = getSalable()

  let receiptsDeletedResponse:
    BatchReceiptActionsResponseSchema_data | undefined | null
  let subscriptionsDeletedResponse:
    BatchSubscriptionActionsResponseSchema_data | undefined | null

  try {
    const subscriptions = await salable.api.subscriptions.get({
      queryParameters: { owner: OWNER, limit: '100' },
    })

    if (subscriptions?.data?.length) {
      const subscriptionIds = subscriptions.data.flatMap((s) =>
        s.id ? [s.id] : []
      )

      if (subscriptionIds.length) {
        subscriptionsDeletedResponse = (
          await salable.api.subscriptions.batch.post({
            action: 'delete',
            subscriptionIds,
          })
        )?.data
      }
    }

    // NOTE: Subscriptions cascade to their receipts, so this only finds receipts
    // that were not attached to a subscription.
    const receipts = await salable.api.receipts.get({
      queryParameters: { owner: [OWNER], limit: '100' },
    })

    if (receipts?.data?.length) {
      const receiptIds = receipts.data?.flatMap((r) => (r.id ? [r.id] : []))

      if (receiptIds.length) {
        receiptsDeletedResponse = (
          await salable.api.receipts.batch.post({
            action: 'delete',
            receiptIds,
          })
        )?.data
      }
    }

    // Salable created the owner and grantee on the first checkout. Their item
    // routes take Salable's own IDs, so look each up by the hardcoded value.
    const owner = (
      await salable.api.owners.get({ queryParameters: { search: OWNER } })
    )?.data?.find((o) => o.value === OWNER)
    if (owner?.id) await salable.api.owners.byId(owner.id).delete()

    const grantee = (
      await salable.api.grantees.get({ queryParameters: { search: GRANTEE } })
    )?.data?.find((g) => g.granteeId === GRANTEE)
    if (grantee?.id) await salable.api.grantees.byId(grantee.id).delete()

    const deleted: Deleted = {
      subscriptions: subscriptionsDeletedResponse?.succeeded ?? 0,
      receipts: receiptsDeletedResponse?.succeeded ?? 0,
      owner: Boolean(owner?.id),
      grantee: Boolean(grantee?.id),
    }

    const summary = `Deleted ${deleted.subscriptions} ${plural(deleted.subscriptions, 'subscription')}, ${deleted.receipts} ${plural(deleted.receipts, 'receipt')}, ${deleted.owner ? 1 : 0} owner and ${deleted.grantee ? 1 : 0} grantee`

    const failed =
      (subscriptionsDeletedResponse?.failed ?? 0) +
      (receiptsDeletedResponse?.failed ?? 0)

    if (failed > 0) {
      const results = [
        ...(subscriptionsDeletedResponse?.results ?? []),
        ...(receiptsDeletedResponse?.results ?? []),
      ].flatMap((r) =>
        r.id
          ? [
              {
                id: r.id,
                status: r.status ?? 'unknown',
                reason: r.reason ?? null,
              },
            ]
          : []
      )

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
