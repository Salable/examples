import { useState, type ReactNode } from 'react'
import { Badge } from './Badge'
import { Button } from './Button'
import { FormMessages } from './FormMessages'
import { Panel } from './Panel'

type Props = {
  title: string
  description: ReactNode
  /** The entitlement slug the feature is gated on, for the locked message. */
  entitlement: string
  /** Whether the current user holds the entitlement on the current team. */
  enabled: boolean
  /** Shown in the locked badge, e.g. "Requires Team". */
  requires: string
  /** Why the feature is locked and what unlocks it. */
  lockedHint: ReactNode
  buttonLabel: string
  pendingLabel: string
  doneMessage: string
}

/**
 * A feature that only exists to show a panel gated on an entitlement. Pressing
 * the button pretends to do the work; nothing is sent to Salable, only the
 * entitlement check that unlocked it was real.
 */
export function SimulatedFeature({
  title,
  description,
  entitlement,
  enabled,
  requires,
  lockedHint,
  buttonLabel,
  pendingLabel,
  doneMessage,
}: Props) {
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')

  function run() {
    setState('running')
    // Pretend to do the work.
    window.setTimeout(() => setState('done'), 1_200)
  }

  return (
    <Panel
      title={title}
      description={description}
      badge={
        enabled ? (
          <Badge tone="green">Access granted</Badge>
        ) : (
          <Badge tone="red">{requires}</Badge>
        )
      }
    >
      {enabled ? (
        <div className="space-y-3">
          <Button
            type="button"
            onClick={run}
            pending={state === 'running'}
            pendingLabel={pendingLabel}
          >
            {buttonLabel}
          </Button>
          <FormMessages
            message={
              state === 'done'
                ? `${doneMessage} Nothing was sent to Salable; only the entitlement check was real.`
                : null
            }
          />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          <p>
            The entitlement check did not return{' '}
            <span className="font-mono text-xs">{entitlement}</span>, so the
            feature stays hidden.
          </p>
          <p className="mt-2">{lockedHint}</p>
        </div>
      )}
    </Panel>
  )
}
