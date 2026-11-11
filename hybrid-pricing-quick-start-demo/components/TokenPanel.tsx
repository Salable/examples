import { TEAM_AI_CREDITS, TOKEN_SLUG } from '@/lib/constants'
import type { TokenBalance } from '@/lib/types'
import { Badge } from './Badge'
import { Panel } from './Panel'

type Props = {
  owner: string
  tokens: TokenBalance
  /** Whether the owner holds a live subscription, for the empty-state copy. */
  subscribed: boolean
}

/**
 * The team owner's ai_credits balance and every record behind it. Only shown
 * in the Team ACME workspace, since only the Team plan allocates tokens.
 */
export function TokenPanel({ owner, tokens, subscribed }: Props) {
  return (
    <Panel
      title="AI credit balance"
      description={
        <>
          Current balance for the token{' '}
          <code className="font-mono text-xs">{TOKEN_SLUG}</code> for the owner{' '}
          <code className="font-mono text-xs">{owner}</code>. The Team plan
          allocates {TEAM_AI_CREDITS} each billing cycle and resets the balance
          when the next one starts. Consuming is synchronous, so the balance
          drops as soon as a summary is paid for.
        </>
      }
      badge={
        <Badge tone={tokens.balance > 0 ? 'green' : 'zinc'}>
          {tokens.records.length}{' '}
          {tokens.records.length === 1 ? 'record' : 'records'}
        </Badge>
      }
    >
      <div className="mb-4 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">
          {tokens.balance.toLocaleString()}
        </span>
        <span className="text-sm text-zinc-500">{TOKEN_SLUG} remaining</span>
      </div>

      {tokens.records.length === 0 ? (
        <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          {subscribed
            ? 'No token records with a remaining balance. Salable grants the next allowance when the billing cycle resets.'
            : 'No token records yet. Subscribe to Team; Salable grants the first allowance when the subscription starts.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-black/10 dark:border-white/15">
                <th className="py-2 pr-4 font-medium">Record</th>
                <th className="py-2 pr-4 font-medium">Remaining</th>
                <th className="py-2 pr-4 font-medium">Expires</th>
                <th className="py-2 pr-4 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {tokens.records.map((record) => (
                <tr
                  key={record.recordId}
                  className="border-b border-black/5 last:border-0 dark:border-white/10"
                >
                  <td className="py-2 pr-4 font-mono text-xs">
                    {record.recordId}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">
                    {(record.remaining ?? 0).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4" suppressHydrationWarning>
                    {record.expiresAt
                      ? new Date(record.expiresAt).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="green">
                        {record.source?.type ?? 'unknown'}
                      </Badge>
                      {record.source?.id ? (
                        <span className="font-mono text-xs text-zinc-500">
                          {record.source.id}
                        </span>
                      ) : null}
                    </div>
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
