import { getFormProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import { checkoutSchema } from '@/lib/schemas'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  label: string
}

/** Step 2: generate a Stripe Checkout link for the Pro plan and redirect to it. */
export function CheckoutForm({ label }: Props) {
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
      <input type="hidden" name={fields.plan.name} value="pro" />
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
