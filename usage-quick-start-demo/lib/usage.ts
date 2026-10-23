import { METER_SLUG, OWNER } from './constants'
import { getSalable } from './salable'
import type { UsageRecord, UsageRecordStatus, UsageSummary } from './types'

const STATUSES = new Set<UsageRecordStatus>([
  'recorded',
  'current',
  'final',
  'overage',
])

/**
 * Step 5 of the guide: the owner's usage records for one meter. The guide only
 * asks for `status: ['current']`; `final` is included too so the demo can show
 * a period being closed when the Pro subscription is cancelled. Newest first,
 * so the current record is always on the first page. An owner Salable has not
 * seen yet simply gets an empty list. `undefined` fields become `null` so the
 * result can be passed through `getServerSideProps`.
 */
export async function getUsage(): Promise<UsageSummary> {
  const response = await getSalable().api.usageRecords.get({
    queryParameters: {
      owner: OWNER,
      meterSlug: METER_SLUG,
      status: ['current', 'final', 'overage', 'recorded'],
      sort: 'desc',
      limit: '25',
    },
  })

  const records: UsageRecord[] = (response?.data ?? []).flatMap((r) =>
    r.id
      ? [
          {
            id: r.id,
            status: toStatus(r.status),
            count: r.count ?? 0,
            recordedAt: r.recordedAt ?? null,
            createdAt: r.createdAt ?? null,
            updatedAt: r.updatedAt ?? null,
          },
        ]
      : []
  )

  return {
    current: records.find((r) => r.status === 'current') ?? null,
    records,
  }
}

/**
 * The SDK types `status` as a kiota untyped node, which arrives either as the
 * plain string or as an object wrapping it. Read it without depending on
 * kiota's helpers.
 */
function toStatus(node: unknown): UsageRecordStatus | null {
  let value = node
  if (value && typeof value === 'object') {
    value =
      'getValue' in value && typeof value.getValue === 'function'
        ? value.getValue()
        : (value as { value?: unknown }).value
  }
  return typeof value === 'string' && STATUSES.has(value as UsageRecordStatus)
    ? (value as UsageRecordStatus)
    : null
}
