import { getFormProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import { subscriptionIdSchema } from '@/lib/schemas'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  subscriptionId: string
}

/** Open Stripe's billing portal for the subscription's owner and redirect to it. */
export function PortalForm({ subscriptionId }: Props) {
  const { form, fields, pending } = useApiForm<
    typeof subscriptionIdSchema,
    { url: string }
  >({
    schema: subscriptionIdSchema,
    action: '/api/portal',
    onSuccess: ({ url }) => window.location.assign(url),
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <input type="hidden" name={fields.id.name} value={subscriptionId} />
      <Button
        type="submit"
        variant="secondary"
        className="w-full"
        pending={pending}
        pendingLabel="Opening Stripe…"
      >
        Manage billing
      </Button>
      <FormMessages errors={form.errors} errorId={form.errorId} />
    </form>
  )
}
