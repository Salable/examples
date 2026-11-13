import { getFormProps, getInputProps } from '@conform-to/react'
import type { ReactNode } from 'react'
import { useApiForm } from '@/hooks/useApiForm'
import { TOKEN_SLUG, type GranteeId, type Team } from '@/lib/constants'
import { consumeTokensSchema } from '@/lib/schemas'
import { Badge } from './Badge'
import { Button } from './Button'
import { FormMessages } from './FormMessages'
import { Panel } from './Panel'

type Props = {
  team: Team
  granteeId: GranteeId
  owner: string
  /** Whether the owner-scoped check returned the ai_credits token for this user. */
  enabled: boolean
  /** The owner's current token balance. */
  balance: number
  /** Why the feature is locked and what unlocks it. */
  lockedHint: ReactNode
  onChange: () => void
}

/**
 * The token-gated feature. Both plans allocate ai_credits, so access depends
 * on whether the open workspace's owner holds a live subscription and, on
 * Team ACME, whether the user is in its group. Each submit consumes credits
 * from the owner's balance: the user's own in Personal, or the one every
 * member of the group shares in Team ACME.
 */
export function AiAssistantFeature({
  team,
  granteeId,
  owner,
  enabled,
  balance,
  lockedHint,
  onChange,
}: Props) {
  const planName = team === 'acme' ? 'Team' : 'Personal'
  return (
    <Panel
      title="AI assistant"
      description={
        <>
          Gated by the <code className="font-mono text-xs">{TOKEN_SLUG}</code>{' '}
          token, which both plans allocate in different amounts. The check is
          for the grantee <code className="font-mono text-xs">{granteeId}</code>{' '}
          scoped to the owner <code className="font-mono text-xs">{owner}</code>
          . Each summary consumes credits from that owner&apos;s balance.
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
        <ConsumeForm
          team={team}
          granteeId={granteeId}
          owner={owner}
          balance={balance}
          onChange={onChange}
        />
      ) : (
        <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          <p>
            The entitlement check did not return a{' '}
            <span className="font-mono text-xs">token</span> entry for{' '}
            <span className="font-mono text-xs">{TOKEN_SLUG}</span>, so the
            feature stays hidden.
          </p>
          <p className="mt-2">{lockedHint}</p>
        </div>
      )}
    </Panel>
  )
}

/** Its own component because it owns a form hook and is only rendered once the check passes. */
function ConsumeForm({
  team,
  granteeId,
  owner,
  balance,
  onChange,
}: Pick<Props, 'team' | 'granteeId' | 'owner' | 'balance' | 'onChange'>) {
  const { form, fields, pending, message } = useApiForm({
    schema: consumeTokensSchema,
    action: '/api/tokens/consume',
    // Consuming is synchronous, so the balance is already up to date.
    onSuccess: onChange,
    // A rejected consume (an empty balance, or access revoked) means our view
    // is stale, so re-sync and let the panel lock itself if it must.
    onError: onChange,
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <input type="hidden" name={fields.granteeId.name} value={granteeId} />
      <input type="hidden" name={fields.team.name} value={team} />
      <div className="space-y-2">
        <div className="space-y-1">
          <label htmlFor={fields.amount.id} className="text-sm font-medium">
            Credits to spend
          </label>
          <input
            {...getInputProps(fields.amount, { type: 'number' })}
            key={fields.amount.key}
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 10"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-white/20"
          />
          {fields.amount.errors?.length ? (
            <p
              id={fields.amount.errorId}
              className="text-sm text-red-600 dark:text-red-400"
            >
              {fields.amount.errors.join(' ')}
            </p>
          ) : null}
        </div>
        <Button type="submit" pending={pending} pendingLabel="Thinking…">
          Summarise my notes
        </Button>
        <p className="text-xs text-zinc-500">
          {balance.toLocaleString()} {TOKEN_SLUG} remaining for {owner}
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
