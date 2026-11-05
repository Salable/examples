import { getFormProps, getSelectProps } from '@conform-to/react'
import { useApiForm } from '@/hooks/useApiForm'
import { playSchema } from '@/lib/schemas'
import { Button } from './Button'
import { FormMessages } from './FormMessages'

/** A fixed catalogue; nothing is streamed, so the titles are only labels. */
const TRACKS = ['Midnight Static', 'Paper Lanterns', 'Low Tide Radio'] as const

type Props = {
  onChange: () => void
}

/**
 * Step 3: the ad-free player. Its own component because it owns a form hook
 * and is only rendered once the entitlement check passes. Each submit asks the
 * server to play a track, and the server repeats the entitlement check before
 * allowing it.
 */
export function PlayForm({ onChange }: Props) {
  const { form, fields, pending, message } = useApiForm({
    schema: playSchema,
    action: '/api/play',
    // Conform writes this back into the select when the form resets after a
    // submit, so it returns to the first track rather than an empty value.
    defaultValue: { track: TRACKS[0] },
    onSuccess: onChange,
    // A rejected play (e.g. entitlement revoked by a cancellation) means our
    // view is stale, so re-sync and let the panel lock itself.
    onError: onChange,
  })

  return (
    <form {...getFormProps(form)} noValidate className="space-y-3">
      <div className="space-y-1">
        <label htmlFor={fields.track.id} className="text-sm font-medium">
          Track
        </label>
        <select
          {...getSelectProps(fields.track)}
          key={fields.track.key}
          className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm aria-invalid:border-red-500 dark:border-white/20"
        >
          {TRACKS.map((track) => (
            <option key={track} value={track}>
              {track}
            </option>
          ))}
        </select>
        {fields.track.errors?.length ? (
          <p
            id={fields.track.errorId}
            className="text-sm text-red-600 dark:text-red-400"
          >
            {fields.track.errors.join(' ')}
          </p>
        ) : (
          <p className="text-xs text-zinc-500">
            Playback is simulated; only the entitlement check is real.
          </p>
        )}
      </div>
      <Button type="submit" pending={pending} pendingLabel="Playing…">
        Play ad-free
      </Button>
      <FormMessages
        errors={form.errors}
        errorId={form.errorId}
        message={message}
      />
    </form>
  )
}
