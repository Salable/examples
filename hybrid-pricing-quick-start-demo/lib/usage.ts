import { METER_SLUG } from './constants'
import { getSalable, untypedString } from './salable'
import type { UsageRecord, UsageRecordStatus, UsageSummary } from './types'

const STATUSES = new Set<UsageRecordStatus>([
  'recorded',
  'current',
  'final',
  'overage',
])

/**
 * Step 6 of the guide: an owner's usage records for the pdf_exports meter.
 * Usage is per owner, so a user's Personal workspace and Team ACME each have
 * their own records even though both plans meter the same slug. The guide
 * only asks for `status: ['current']`; `final` is included too so the demo can
 * show a period being closed when a subscription is cancelled. Newest first,
 * so the current record is always on the first page. An owner Salable has not
 * seen yet simply gets an empty list. `undefined` fields become `null` so the
 * result can be passed through `getServerSideProps`.
 */
export async function getUsage(owner: string): Promise<UsageSummary> {
  const response = await getSalable().api.usageRecords.get({
    queryParameters: {
      owner,
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

function toStatus(node: unknown): UsageRecordStatus | null {
  const value = untypedString(node)
  return value && STATUSES.has(value as UsageRecordStatus)
    ? (value as UsageRecordStatus)
    : null
}
