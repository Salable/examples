import { useState, type ReactNode } from 'react'
import {
  SHARED_NOTEBOOKS_ENTITLEMENT,
  TEAM_NAME,
  type GranteeId,
} from '@/lib/constants'
import { Badge } from './Badge'
import { Button } from './Button'
import { FormMessages } from './FormMessages'
import { Panel } from './Panel'

type Props = {
  granteeId: GranteeId
  owner: string
  /** Whether the owner-scoped check returned the shared_notebooks entitlement for this user. */
  enabled: boolean
  /** Why the feature is locked and what unlocks it. */
  lockedHint: ReactNode
}

/**
 * The feature gated on a plain entitlement. Unlike the meter and token, which
 * the check returns automatically from a plan's line items, a plan has to
 * grant `shared_notebooks` explicitly and only Team does, so the same user is
 * locked out in their Personal workspace and let in on Team ACME. Pressing
 * the button pretends to share a notebook; nothing is sent to Salable, only
 * the entitlement check that unlocked it was real.
 */
export function SharedNotebooksFeature({
  granteeId,
  owner,
  enabled,
  lockedHint,
}: Props) {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')

  function run() {
    setState('running')
    // Pretend to do the work.
    window.setTimeout(() => setState('done'), 1_200)
  }

  return (
    <Panel
      title="Shared notebooks"
      description={
        <>
          Gated by the{' '}
          <code className="font-mono text-xs">
            {SHARED_NOTEBOOKS_ENTITLEMENT}
          </code>{' '}
          entitlement, which only the Team plan grants. It is declared on the
          plan rather than derived from a line item, so the check returns it
          with <code className="font-mono text-xs">type: entitlement</code>. The
          check is for the grantee{' '}
          <code className="font-mono text-xs">{granteeId}</code> scoped to the
          owner <code className="font-mono text-xs">{owner}</code>.
        </>
      }
      badge={
        enabled ? (
          <Badge tone="green">Access granted</Badge>
        ) : (
          <Badge tone="red">Requires Team</Badge>
        )
      }
    >
      {enabled ? (
        <div className="space-y-3">
          <Button
            type="button"
            onClick={run}
            pending={state === 'running'}
            pendingLabel="Sharing…"
          >
            Share a notebook
          </Button>
          <FormMessages
            message={
              state === 'done'
                ? `Shared "Q4 planning" with everyone in ${TEAM_NAME}. Nothing was sent to Salable; only the entitlement check was real.`
                : null
            }
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          <p>
            The entitlement check did not return an{' '}
            <span className="font-mono text-xs">entitlement</span> entry for{' '}
            <span className="font-mono text-xs">
              {SHARED_NOTEBOOKS_ENTITLEMENT}
            </span>
            , so the feature stays hidden.
          </p>
          <p className="mt-2">{lockedHint}</p>
        </div>
      )}
    </Panel>
  )
}
