import { getFormProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import type { GranteeId, Tab } from '@/lib/constants'
import { checkoutSchema } from '@/lib/schemas'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  label: string
  granteeId: GranteeId
  tab: Tab
}

/**
 * Step 2: generate a Stripe Checkout link for the tab's plan, bought by the
 * current user, and redirect to it.
 */
export function CheckoutForm({ label, granteeId, tab }: Props) {
  const { form, fields, pending } = useApiForm<
    typeof checkoutSchema,
    { url: string }
  >({
    schema: checkoutSchema,
    action: '/api/checkout',
    onSuccess: ({ url }) => window.location.assign(url),
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <input type="hidden" name={fields.granteeId.name} value={granteeId} />
      <input type="hidden" name={fields.tab.name} value={tab} />
      <FormMessages errors={form.errors} errorId={form.errorId} />
      <Button
        type="submit"
        pending={pending}
        pendingLabel="Redirecting to Stripe…"
      >
        {label}
      </Button>
    </form>
  )
}
