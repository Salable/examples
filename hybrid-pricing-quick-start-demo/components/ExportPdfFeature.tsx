import { getFormProps, getInputProps } from '@conform-to/react'
import type { ReactNode } from 'react'
import { useApiForm } from '@/hooks/useApiForm'
import {
  EXPORT_UNIT_CENTS,
  METER_SLUG,
  type GranteeId,
  type Team,
} from '@/lib/constants'
import { recordUsageSchema } from '@/lib/schemas'
import { Badge } from './Badge'
import { Button } from './Button'
import { FormMessages } from './FormMessages'
import { Panel } from './Panel'

type Props = {
  team: Team
  granteeId: GranteeId
  owner: string
  /** Whether the owner-scoped check returned the pdf_exports meter for this user. */
  enabled: boolean
  /** Count on the owner's current usage record. */
  current: number
  /** Why the feature is locked and what unlocks it. */
  lockedHint: ReactNode
  onChange: () => void
  /** Salable increments the record in the background, so the page polls for a while. */
  onRecorded: () => void
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/**
 * The metered feature. Both plans include the pdf_exports meter, so the
 * feature is unlocked in both workspaces; the rate each export is billed at
 * depends on which plan the owner holds. Each submit records the exports as
 * usage for the owner.
 */
export function ExportPdfFeature({
  team,
  granteeId,
  owner,
  enabled,
  current,
  lockedHint,
  onChange,
  onRecorded,
}: Props) {
  const planName = team === 'acme' ? 'Team' : 'Personal'

  return (
    <Panel
      title="Export PDF"
      description={
        <>
          Gated by the <code className="font-mono text-xs">{METER_SLUG}</code>{' '}
          meter, which both plans include at different rates. The check is for
          the grantee <code className="font-mono text-xs">{granteeId}</code>{' '}
          scoped to the owner <code className="font-mono text-xs">{owner}</code>
          , and each export is recorded as usage for that owner.
        </>
      }
      badge={
        enabled ? (
          <Badge tone="green">Access granted</Badge>
        ) : (
          <Badge tone="red">Requires {planName}</Badge>
        )
      }
    >
      {enabled ? (
        <ExportForm
          team={team}
          granteeId={granteeId}
          current={current}
          onChange={onChange}
          onRecorded={onRecorded}
        />
      ) : (
        <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          <p>
            The entitlement check did not return a{' '}
            <span className="font-mono text-xs">meter</span> entry for{' '}
            <span className="font-mono text-xs">{METER_SLUG}</span>, so the
            feature stays hidden.
          </p>
          <p className="mt-2">{lockedHint}</p>
        </div>
      )}
    </Panel>
  )
}

/** Its own component because it owns a form hook and is only rendered once the check passes. */
function ExportForm({
  team,
  granteeId,
  current,
  onChange,
  onRecorded,
}: Pick<Props, 'team' | 'granteeId' | 'current' | 'onChange' | 'onRecorded'>) {
  const { form, fields, pending, message } = useApiForm({
    schema: recordUsageSchema,
    action: '/api/usage/record',
    onSuccess: () => {
      onChange()
      onRecorded()
    },
    // A rejected record (e.g. access revoked by a cancellation or a removal
    // from the group) means our view is stale, so re-sync and let the panel
    // lock itself.
    onError: onChange,
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <input type="hidden" name={fields.granteeId.name} value={granteeId} />
      <input type="hidden" name={fields.team.name} value={team} />
      <div className="space-y-2">
        <div className="space-y-1">
          <label htmlFor={fields.increment.id} className="text-sm font-medium">
            Notes to export
          </label>
          <input
            {...getInputProps(fields.increment, { type: 'number' })}
            key={fields.increment.key}
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 2"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-white/20"
          />
          {fields.increment.errors?.length ? (
            <p
              id={fields.increment.errorId}
              className="text-sm text-red-600 dark:text-red-400"
            >
              {fields.increment.errors.join(' ')}
            </p>
          ) : null}
        </div>
        <Button type="submit" pending={pending} pendingLabel="Exporting…">
          Export to PDF
        </Button>
        <p className="text-xs text-zinc-500">
          {current.toLocaleString()} {METER_SLUG} recorded this period at{' '}
          {usd.format(EXPORT_UNIT_CENTS[team] / 100)} each on{' '}
          {team === 'acme' ? 'Team' : 'Personal'}
        </p>
      </div>
      <FormMessages
        errors={form.errors}
        errorId={form.errorId}
        message={message}
      />
    </form>
  )
}
