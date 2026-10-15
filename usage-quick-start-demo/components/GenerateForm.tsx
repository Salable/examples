import { getFormProps, getInputProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import { generateSchema } from '@/lib/schemas'
import { METER_SLUG } from '@/lib/constants'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

type Props = {
  /** Count on the current usage record. */
  current: number
  onChange: () => void
  /** Salable increments the record in the background, so the page polls briefly. */
  onRecorded: () => void
}

/**
 * Step 3: the generate form. Its own component because it owns a form hook and
 * is only rendered once the entitlement check passes. Each submit records the
 * number of images as usage against the meter.
 */
export function GenerateForm({ current, onChange, onRecorded }: Props) {
  const { form, fields, pending, message } = useApiForm({
    schema: generateSchema,
    action: '/api/usage/record',
    onSuccess: () => {
      onChange()
      onRecorded()
    },
    // A rejected record (e.g. entitlement revoked by a cancellation) means
    // our view is stale, so re-sync and let the panel lock itself.
    onError: onChange,
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={fields.increment.id} className="text-sm font-medium">
          Images to generate
        </label>
        <div className="flex gap-2">
          <input
            {...getInputProps(fields.increment, { type: 'number' })}
            key={fields.increment.key}
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="e.g. 5"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-white/20"
          />
          <Button type="submit" pending={pending} pendingLabel="Generating…">
            Generate
          </Button>
        </div>
        {fields.increment.errors?.length ? (
          <p
            id={fields.increment.errorId}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {fields.increment.errors.join(' ')}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            {current.toLocaleString()} {METER_SLUG} recorded this period
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
