import { Salable } from '@salable/sdk'
import type { ErrorResponseBody } from '@salable/sdk/dist/sdk/models'

let instance: Salable | undefined

/**
 * Server-only Salable client, created lazily so a missing key surfaces as a
 * readable setup error on the page instead of crashing at import time.
 */
export function getSalable() {
  if (instance) return instance

  const secretKey = process.env.SALABLE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      'Missing SALABLE_SECRET_KEY. Duplicate .env.example as .env.local and add your Salable test mode secret key.'
    )
  }

  instance = new Salable(secretKey)
  return instance
}

/**
 * The SDK throws the API's error body for failed requests: a plain object
 * (not an `Error` instance) carrying `responseStatusCode` and an end-user
 * `title`. Anything else in a catch block is one of our own errors.
 */
export function isSalableError(err: unknown): err is ErrorResponseBody {
  return (
    typeof err === 'object' &&
    err !== null &&
    'responseStatusCode' in err &&
    typeof err.responseStatusCode === 'number'
  )
}
