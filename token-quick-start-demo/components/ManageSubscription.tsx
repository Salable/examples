import { getFormProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import { EXPORT_HD_ENTITLEMENT, GENERATE_ENTITLEMENT } from '@/lib/constants'
import { autoRenewSchema, subscriptionIdSchema } from '@/lib/schemas'
import type { Subscription } from '@/lib/types'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  subscription: Subscription
  onChange: () => void
  /** Salable finishes the cancel when Stripe confirms it, so the page polls briefly. */
  onCancelled: () => void
}

/**
 * Cancel and auto-renew controls. Its own component because it owns two form
 * hooks and is only rendered while a Starter subscription exists.
 */
export function ManageSubscription({
  subscription,
  onChange,
  onCancelled,
}: Props) {
  const nextStatus = subscription.cancelAtPeriodEnd ? 'enable' : 'disable'

  const autoRenew = useApiForm({
    schema: autoRenewSchema,
    action: '/api/subscription/auto-renew',
    onSuccess: onChange,
  })

  const cancel = useApiForm({
    schema: subscriptionIdSchema,
    action: '/api/subscription/cancel',
    confirm: `Cancel the Starter subscription now? The ${EXPORT_HD_ENTITLEMENT} entitlement is removed once Stripe confirms the cancellation. ${GENERATE_ENTITLEMENT} stays if a Token Top-Up has been bought; remaining tokens stay until they expire or you reset the demo.`,
    onSuccess: onCancelled,
  })

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Subscription</dt>
        <dd className="truncate font-mono text-xs" title={subscription.id}>
          {subscription.id}
        </dd>
        <dt className="text-zinc-500">Status</dt>
        <dd>{subscription.status ?? 'unknown'}</dd>
        <dt className="text-zinc-500">Started</dt>
        <dd suppressHydrationWarning>
          {subscription.startDate
            ? new Date(subscription.startDate).toLocaleString()
            : '—'}
        </dd>
        <dt className="text-zinc-500">Auto-renew</dt>
        <dd>{subscription.cancelAtPeriodEnd ? 'Off' : 'On'}</dd>
      </dl>

      <div className="flex flex-wrap gap-2">
        <form {...getFormProps(autoRenew.form)} noValidate>
          <input
            type="hidden"
            name={autoRenew.fields.id.name}
            value={subscription.id}
          />
          <input
            type="hidden"
            name={autoRenew.fields.status.name}
            value={nextStatus}
          />
          <Button
            type="submit"
            variant="secondary"
            pending={autoRenew.pending}
            pendingLabel="Updating…"
          >
            {nextStatus === 'disable'
              ? 'Turn off auto-renew'
              : 'Turn on auto-renew'}
          </Button>
        </form>

        <form {...getFormProps(cancel.form)} noValidate>
          <input
            type="hidden"
            name={cancel.fields.id.name}
            value={subscription.id}
          />
          <Button
            type="submit"
            variant="danger"
            pending={cancel.pending}
            pendingLabel="Cancelling…"
          >
            Cancel subscription
          </Button>
        </form>
      </div>

      <FormMessages
        errors={autoRenew.form.errors}
        errorId={autoRenew.form.errorId}
        message={autoRenew.message}
      />
      <FormMessages
        errors={cancel.form.errors}
        errorId={cancel.form.errorId}
        message={cancel.message}
      />
    </div>
  )
}
