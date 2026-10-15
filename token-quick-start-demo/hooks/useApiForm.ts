import { useForm, type SubmissionResult } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4'
import { useState } from 'react'
import type { z } from 'zod'
import { apiErrorSchema } from '@/lib/schemas'
import type { ApiErrorResponse } from '@/lib/types'

type UseApiFormOptions<S extends z.ZodObject, TResponse> = {
  schema: S
  /** API route to POST the validated values to as JSON. */
  action: string
  /** Optional `window.confirm` prompt shown before submitting. */
  confirm?: string
  onSuccess?: (json: TResponse) => void | Promise<void>
  /** Called when the API responded with a non-2xx status. */
  onError?: (json: ApiErrorResponse) => void | Promise<void>
}

/**
 * Conform + zod for client-side validation. On submit the parsed values are
 * POSTed as JSON to a plain Next.js API route; a non-2xx response is mapped
 * back onto the form so `form.errors` / `fields.x.errors` show it.
 */
export function useApiForm<
  S extends z.ZodObject,
  TResponse extends Record<string, unknown> = { message?: string },
>({
  schema,
  action,
  confirm,
  onSuccess,
  onError,
}: UseApiFormOptions<S, TResponse>) {
  const [lastResult, setLastResult] = useState<SubmissionResult>()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [form, fields] = useForm<z.input<S>, z.output<S>, string[]>({
    lastResult,
    constraint: getZodConstraint(schema),
    shouldValidate: 'onSubmit',
    shouldRevalidate: 'onInput',
    onValidate({ formData }) {
      return parseWithZod(formData, { schema })
    },
    onSubmit(event, { submission }) {
      event.preventDefault()
      if (submission?.status !== 'success') return
      if (confirm && !window.confirm(confirm)) return
      void submit(submission.value)
    },
  })

  async function submit(value: z.output<S>) {
    setPending(true)
    setMessage(null)
    setLastResult(undefined)

    try {
      const res = await fetch(action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      })
      if (!res.ok) {
        const parsed = apiErrorSchema.safeParse(await res.json())
        const failure: ApiErrorResponse = parsed.success
          ? parsed.data
          : { error: 'Request failed' }
        // Conform reads errors keyed by field name; '' is the form itself.
        setLastResult({
          status: 'error',
          error: failure.fieldErrors ?? { '': [failure.error] },
        })
        await onError?.(failure)
        return
      }

      const json: TResponse = await res.json()
      setMessage(typeof json.message === 'string' ? json.message : null)
      form.reset()
      await onSuccess?.(json)
    } catch {
      setLastResult({
        status: 'error',
        error: { '': ['Network error. Please try again'] },
      })
    } finally {
      setPending(false)
    }
  }

  return { form, fields, pending, message }
}
