type Props = {
  errors?: string[]
  errorId?: string
  message?: string | null
}

/** Form-level errors from Conform (`form.errors`) and a success message. */
export function FormMessages({ errors, errorId, message }: Props) {
  if (errors?.length) {
    return (
      <p
        id={errorId}
        role="alert"
        className="rounded-md border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
      >
        {errors.join(' ')}
      </p>
    )
  }

  if (message) {
    return (
      <p
        role="status"
        className="rounded-md border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
      >
        {message}
      </p>
    )
  }

  return null
}
