import { getFormProps, getInputProps } from '@conform-to/react'
import { useState } from 'react'
import { useApiForm } from '@/hooks/useApiForm'
import { consumeSchema } from '@/lib/schemas'
import { METER_SLUG, TOKEN_SLUG } from '@/lib/constants'
import type { BilledAs, ConsumeResponse } from '@/lib/types'
import { Badge } from './Badge'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  /** Remaining token balance for the owner. */
  balance: number
  /** Count on the current usage record: overage recorded this period. */
  currentUsage: number
  onChange: () => void
  /** Salable increments the usage record in the background, so the page polls briefly. */
  onRecorded: () => void
}

/**
 * The generate form. Its own component because it owns a form hook and is
 * only rendered once the entitlement check passes. Each submit asks the API
 * to consume tokens, which falls back to recording overage usage once the
 * balance is exhausted; the response says which happened.
 */
export function ConsumeForm({
  balance,
  currentUsage,
  onChange,
  onRecorded,
}: Props) {
  const [billedAs, setBilledAs] = useState<BilledAs | null>(null)

  const { form, fields, pending, message } = useApiForm<
    typeof consumeSchema,
    ConsumeResponse
  >({
    schema: consumeSchema,
    action: '/api/consume',
    onSuccess: (json) => {
      setBilledAs(json.billedAs)
      onChange()
      if (json.billedAs === 'usage') onRecorded()
    },
    // A rejected request (e.g. entitlement revoked by a cancellation) means
    // our view is stale, so re-sync and let the panel lock itself.
    onError: () => {
      setBilledAs(null)
      onChange()
    },
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={fields.amount.id} className="text-sm font-medium">
          Images to generate
        </label>
        <div className="flex gap-2">
          <input
            {...getInputProps(fields.amount, { type: 'number' })}
            key={fields.amount.key}
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 400"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-white/20"
          />
          <Button type="submit" pending={pending} pendingLabel="Generating…">
            Generate
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
            {balance.toLocaleString()} {TOKEN_SLUG} tokens remaining ·{' '}
            {currentUsage.toLocaleString()} {METER_SLUG} overage recorded this
            period
          </p>
        )}
      </div>

      {balance === 0 ? (
        <p
          role="status"
          className="rounded-md border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
        >
          The token balance is exhausted. The next generation is billed as
          overage usage.
        </p>
      ) : null}

      {message && billedAs ? (
        <div className="flex items-start gap-2">
          <Badge tone={billedAs === 'tokens' ? 'green' : 'amber'}>
            {billedAs === 'tokens' ? 'Tokens' : 'Overage'}
          </Badge>
          <div className="min-w-0 flex-1">
            <FormMessages message={message} />
          </div>
        </div>
      ) : (
        <FormMessages
          errors={form.errors}
          errorId={form.errorId}
          message={message}
        />
      )}
    </form>
  )
}
