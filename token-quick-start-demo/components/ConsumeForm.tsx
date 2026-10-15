import { getFormProps, getInputProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import { consumeSchema } from '@/lib/schemas'
import { TOKEN_SLUG } from '@/lib/constants'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  balance: number
  onChange: () => void
}

/**
 * Step 5: the consume form. Its own component because it owns a form hook and
 * is only rendered once the entitlement check passes.
 */
export function ConsumeForm({ balance, onChange }: Props) {
  const { form, fields, pending, message } = useApiForm({
    schema: consumeSchema,
    action: '/api/tokens/consume',
    onSuccess: onChange,
    // A rejected consume (e.g. entitlement revoked by a cancellation) means
    // our view is stale, so re-sync and let the panel lock itself.
    onError: onChange,
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={fields.amount.id} className="text-sm font-medium">
          Tokens to consume
        </label>
        <div className="flex gap-2">
          <input
            {...getInputProps(fields.amount, { type: 'number' })}
            key={fields.amount.key}
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 25"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-white/20"
          />
          <Button type="submit" pending={pending} pendingLabel="Consuming…">
            Consume
          </Button>
        </div>
        {fields.amount.errors?.length ? (
          <p
            id={fields.amount.errorId}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {fields.amount.errors.join(' ')}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            {balance.toLocaleString()} {TOKEN_SLUG} available
          </p>
        )}
      </div>
      <FormMessages
        errors={form.errors}
        errorId={form.errorId}
        message={message}
      />
    </form>
  )
}
