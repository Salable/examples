import { EXPORT_UNIT_CENTS, METER_SLUG, type Team } from '@/lib/constants'
import type { UsageRecordStatus, UsageSummary } from '@/lib/types'
import { Badge, type BadgeTone } from './Badge'
import { Panel } from './Panel'

type Props = {
  team: Team
  owner: string
  usage: UsageSummary
  /** Whether the owner holds a live subscription, for the empty-state copy. */
  subscribed: boolean
}

const STATUS_TONES: Record<UsageRecordStatus, BadgeTone> = {
  current: 'green',
  final: 'zinc',
  recorded: 'amber',
  overage: 'amber',
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/**
 * Step 6 of the guide: the owner's pdf_exports usage this period and every
 * record behind it. Usage is per owner, so the Personal and Team workspaces
 * show separate records for the same meter, each billed at its own plan's
 * rate.
 */
export function UsagePanel({ team, owner, usage, subscribed }: Props) {
  const planName = team === 'acme' ? 'Team' : 'Personal'
  const unitCents = EXPORT_UNIT_CENTS[team]
  const currentCount = usage.current?.count ?? 0

  return (
    <Panel
      title="Export usage this period"
      description={
        <>
          Usage records for the owner{' '}
          <code className="font-mono text-xs">{owner}</code> using the meter{' '}
          <code className="font-mono text-xs">{METER_SLUG}</code>. Salable
          increments the current record in the background, so a count can take
          up to half a minute to appear.
        </>
      }
      badge={
        <Badge tone={usage.current ? 'green' : 'zinc'}>
          {usage.records.length}{' '}
          {usage.records.length === 1 ? 'record' : 'records'}
        </Badge>
      }
    >
      <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tabular-nums tracking-tight">
            {currentCount.toLocaleString()}
          </span>
          <span className="text-sm text-zinc-500">
            {METER_SLUG} at {usd.format(unitCents / 100)} each on {planName}
          </span>
        </div>
        <span className="text-sm text-zinc-500">
          Estimated charge{' '}
          <span className="font-medium tabular-nums text-foreground">
            {usd.format((currentCount * unitCents) / 100)}
          </span>
        </span>
      </div>

      <p className="mb-4 rounded-md border border-black/10 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">
        Same meter, different rate: Personal bills{' '}
        <span className="font-medium text-foreground">
          {usd.format(EXPORT_UNIT_CENTS.personal / 100)}
        </span>{' '}
        and Team bills{' '}
        <span className="font-medium text-foreground">
          {usd.format(EXPORT_UNIT_CENTS.acme / 100)}
        </span>{' '}
        per export. Which applies depends only on the owner the usage is
        recorded for.
      </p>

      {usage.records.length === 0 ? (
        <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          {subscribed
            ? `Salable is creating the usage record for the new subscription. The page polls for it; press Refresh if it does not appear.`
            : `No usage records yet. Subscribe to ${planName}; Salable creates the record when the subscription starts.`}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-black/10 dark:border-white/15">
                <th className="py-2 pr-4 font-medium">Record</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Count</th>
                <th className="py-2 pr-4 font-medium">Created</th>
                <th className="py-2 pr-4 font-medium">Finalised</th>
              </tr>
            </thead>
            <tbody>
              {usage.records.map((record) => (
                <tr
                  key={record.id}
                  className="border-b border-black/5 last:border-0 dark:border-white/10"
                >
                  <td className="py-2 pr-4 font-mono text-xs">{record.id}</td>
                  <td className="py-2 pr-4">
                    <Badge
                      tone={
                        record.status ? STATUS_TONES[record.status] : 'zinc'
                      }
                    >
                      {record.status ?? 'unknown'}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 tabular-nums">
                    {record.count.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4" suppressHydrationWarning>
                    {record.createdAt
                      ? new Date(record.createdAt).toLocaleString()
                      : '—'}
                  </td>
                  <td className="py-2 pr-4" suppressHydrationWarning>
                    {record.recordedAt
                      ? new Date(record.recordedAt).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
