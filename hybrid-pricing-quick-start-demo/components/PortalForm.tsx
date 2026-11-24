import { getFormProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import type { GranteeId, Team } from '@/lib/constants'
import { portalSchema } from '@/lib/schemas'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  granteeId: GranteeId
  team: Team
}

/**
 * Open Stripe's billing portal for the owner of the workspace's subscription
 * and redirect to it. The owner is resolved on the server from the user and
 * team, like every other request.
 */
export function PortalForm({ granteeId, team }: Props) {
  const { form, fields, pending } = useApiForm<
    typeof portalSchema,
    { url: string }
  >({
    schema: portalSchema,
    action: '/api/portal',
    onSuccess: ({ url }) => window.location.assign(url),
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <input type="hidden" name={fields.granteeId.name} value={granteeId} />
      <input type="hidden" name={fields.team.name} value={team} />
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
