import { getFormProps } from '@conform-to/react'
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { CheckoutForm } from '@/components/CheckoutForm'
import { FormMessages } from '@/components/FormMessages'
import { ManageSubscription } from '@/components/ManageSubscription'
import { Panel } from '@/components/Panel'
import { PlayForm } from '@/components/PlayForm'
import { useApiForm } from '@/hooks/useApiForm'
import {
  AD_FREE_ENTITLEMENT,
  GRANTEE,
  OWNER,
  PLAN_AMOUNT_CENTS,
} from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { isSalableError } from '@/lib/salable'
import { resetSchema } from '@/lib/schemas'
import { getSubscriptionSummary } from '@/lib/subscriptions'
import type {
  ApiErrorResponse,
  Entitlement,
  Subscription,
  SubscriptionSummary,
} from '@/lib/types'

/** Server-rendered first values for the two reads, or the error if Salable could not be reached. */
type Props = {
  entitlements: Entitlement[] | null
  subscription: SubscriptionSummary | null
  error: string | null
  /** True when Stripe has just sent the browser back to `/?checkout=success`. */
  polling: boolean
}

// Salable applies a purchase or cancellation when Stripe's webhook arrives, a
// few seconds later, so the page polls briefly after either.
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 6_000

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export const getServerSideProps = (async ({ query }) => {
  const polling = query.checkout === 'success'
  try {
    const [entitlements, subscription] = await Promise.all([
      getEntitlements(GRANTEE),
      getSubscriptionSummary(),
    ])
    return {
      props: { entitlements, subscription, error: null, polling },
    }
  } catch (err) {
    return {
      props: {
        entitlements: null,
        subscription: null,
        error: isSalableError(err)
          ? (err.title ?? 'Unexpected error')
          : err instanceof Error
            ? err.message
            : 'Unexpected error',
        polling,
      },
    }
  }
}) satisfies GetServerSideProps<Props>

export default function Home({
  entitlements: initialEntitlements,
  subscription: initialSubscription,
  error: initialError,
  polling: initialPolling,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter()

  const [isPolling, setIsPolling] = useState(initialPolling)
  useEffect(() => {
    if (!isPolling) return
    const timer = window.setTimeout(() => setIsPolling(false), POLL_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [isPolling])

  const entitlements = useSWR<{ entitlements: Entitlement[] }>(
    '/api/entitlements',
    fetcher,
    {
      fallbackData: initialEntitlements
        ? { entitlements: initialEntitlements }
        : undefined,
      ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
    }
  )
  const subscription = useSWR<SubscriptionSummary>(
    '/api/subscription',
    fetcher,
    {
      fallbackData: initialSubscription ?? undefined,
      ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
    }
  )

  function refresh() {
    void entitlements.mutate()
    void subscription.mutate()
  }

  // Reset demo: deletes every subscription and receipt for the owner.
  const reset = useApiForm({
    schema: resetSchema,
    action: '/api/reset',
    confirm: `Delete every subscription and receipt for ${OWNER}, then the ${OWNER} owner and ${GRANTEE} grantee records? This cannot be undone.`,
    onSuccess: refresh,
  })

  // Step 3 of the guide: the grantee can listen ad-free while the entitlement
  // check, scoped to the owner, returns the ad_free_listening entitlement.
  // The Pro plan grants it, so it appears once the subscription is active and
  // disappears once the subscription is cancelled.
  const canListenAdFree =
    entitlements.data?.entitlements.some(
      (e) => e.value === AD_FREE_ENTITLEMENT
    ) ?? false

  const loaded = Boolean(entitlements.data && subscription.data)
  const isValidating = entitlements.isValidating || subscription.isValidating
  const error = entitlements.error ?? subscription.error
  const errorMessage =
    error instanceof Error ? error.message : loaded ? null : initialError

  // Stripe sends the browser back to `/?checkout=cancelled` when the reader
  // backs out of checkout. A successful checkout needs no notice: the polling
  // above updates the page on its own.
  const checkoutCancelled = router.query.checkout === 'cancelled'

  return (
    <>
      <Head>
        <title>Salable Flat-Rate Quick Start</title>
        <meta
          name="description"
          content="Demo of flat-rate billing with Salable: subscribe to a fixed monthly plan, gate a feature on its entitlement, cancel and reset."
        />
      </Head>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {/* Identity strip: confirms the hardcoded owner / grantee from the guide. */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-3">
                <Image
                  src="/salable.svg"
                  alt="Salable"
                  width={36}
                  height={36}
                />
                <h1 className="text-2xl font-semibold tracking-tight">
                  Salable Flat-Rate Quick Start
                </h1>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Flat-rate billing demo. Every panel maps to a step in the{' '}
                <a
                  className="cursor-pointer underline decoration-zinc-400 underline-offset-2 hover:decoration-current"
                  href="https://salable.app/docs/flat-rate-quick-start?lang=sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  quick start guide
                </a>
                .
              </p>
            </div>
            <dl className="flex flex-wrap gap-2 text-sm">
              {[
                ['Owner', OWNER],
                ['Grantee', GRANTEE],
                ['Entitlement', AD_FREE_ENTITLEMENT],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 rounded-md border border-black/10 bg-zinc-50 px-2.5 py-1 dark:border-white/15 dark:bg-zinc-900"
                >
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="font-mono text-xs font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end">
            <Button
              variant="secondary"
              onClick={refresh}
              pending={isValidating && !isPolling}
              pendingLabel="Refreshing…"
            >
              Refresh
            </Button>
          </div>
        </header>

        {checkoutCancelled ? (
          <div
            role="status"
            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-500/30 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200"
          >
            <span>Checkout cancelled. Nothing was purchased.</span>
            <button
              type="button"
              onClick={() =>
                void router.replace('/', undefined, { shallow: true })
              }
              className="cursor-pointer text-xs font-medium underline underline-offset-2"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {errorMessage ? (
          <section
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-50 p-5 text-sm text-red-900 dark:bg-red-500/10 dark:text-red-200"
          >
            <h2 className="font-semibold">Salable could not be reached</h2>
            <p className="mt-1">{errorMessage}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-red-800 dark:text-red-200/90">
              <li>
                Duplicate .env.example as .env.local and add your test mode
                secret key.
              </li>
              <li>
                Run{' '}
                <code className="font-mono text-xs">
                  npm run import:salable-product
                </code>{' '}
                and copy the printed plan ID into .env.local.
              </li>
              <li>
                Restart <code className="font-mono text-xs">npm run dev</code>.
              </li>
            </ol>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 cursor-pointer text-xs font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </section>
        ) : null}

        {entitlements.data && subscription.data ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {/* Step 3: the entitlement check gates the player. The playback is simulated. */}
              <Panel
                title="Ad-free listening"
                description={
                  <>
                    Gated by the{' '}
                    <code className="font-mono text-xs">
                      {AD_FREE_ENTITLEMENT}
                    </code>{' '}
                    entitlement for{' '}
                    <code className="font-mono text-xs">{GRANTEE}</code>,
                    returned by an owner-scoped entitlement check while the Pro
                    subscription is active. The player is simulated.
                  </>
                }
                badge={
                  canListenAdFree ? (
                    <Badge tone="green">Access granted</Badge>
                  ) : (
                    <Badge tone="red">Requires Pro</Badge>
                  )
                }
              >
                {canListenAdFree ? (
                  <PlayForm onChange={refresh} />
                ) : (
                  <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                    <p>
                      <span className="font-mono text-xs">{GRANTEE}</span> does
                      not have the{' '}
                      <span className="font-mono text-xs">
                        {AD_FREE_ENTITLEMENT}
                      </span>{' '}
                      entitlement, so ads play between tracks and the ad-free
                      player stays hidden.
                    </p>
                    <p className="mt-2">Subscribe to Pro to unlock it.</p>
                  </div>
                )}
              </Panel>

              {/* Step 2: checkout for the Pro plan, or manage it once it exists. */}
              <PlanPanel
                subscription={subscription.data.pro}
                description={
                  <>
                    {usd.format(PLAN_AMOUNT_CENTS / 100)} per month, billed at a
                    flat rate. Grants the{' '}
                    <code className="font-mono text-xs">
                      {AD_FREE_ENTITLEMENT}
                    </code>{' '}
                    entitlement.
                  </>
                }
                onChange={refresh}
                onCancelled={() => setIsPolling(true)}
              />
            </div>

            {/* Step 3 again: the raw result of the check that gates the player. */}
            <Panel
              title="Entitlement check"
              description={
                <>
                  Result of{' '}
                  <code className="font-mono text-xs">entitlements.check</code>{' '}
                  for grantee{' '}
                  <code className="font-mono text-xs">{GRANTEE}</code>, scoped
                  to owner <code className="font-mono text-xs">{OWNER}</code>.
                  This is the call that gates the player.
                </>
              }
              badge={
                <Badge
                  tone={
                    entitlements.data.entitlements.length ? 'green' : 'zinc'
                  }
                >
                  {entitlements.data.entitlements.length}{' '}
                  {entitlements.data.entitlements.length === 1
                    ? 'entitlement'
                    : 'entitlements'}
                </Badge>
              }
            >
              {entitlements.data.entitlements.length === 0 ? (
                <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                  No entitlements. Subscribe to Pro and{' '}
                  <code className="font-mono text-xs">
                    {AD_FREE_ENTITLEMENT}
                  </code>{' '}
                  appears once Stripe confirms the payment.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr className="border-b border-black/10 dark:border-white/15">
                        <th className="py-2 pr-4 font-medium">Entitlement</th>
                        <th className="py-2 pr-4 font-medium">Type</th>
                        <th className="py-2 pr-4 font-medium">Expires</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entitlements.data.entitlements.map((entitlement) => (
                        <tr
                          key={`${entitlement.type}:${entitlement.value}`}
                          className="border-b border-black/5 last:border-0 dark:border-white/10"
                        >
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs">
                                {entitlement.value}
                              </span>
                              {entitlement.value === AD_FREE_ENTITLEMENT ? (
                                <Badge tone="green">Gates the player</Badge>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            {entitlement.type ?? 'unknown'}
                          </td>
                          <td className="py-2 pr-4" suppressHydrationWarning>
                            {entitlement.expiryDate
                              ? new Date(
                                  entitlement.expiryDate
                                ).toLocaleString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {/* Reset: test-mode-only deletes. */}
            <footer className="rounded-xl border border-dashed border-black/15 p-5 dark:border-white/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-sm">
                  <h2 className="font-semibold">Reset demo</h2>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    Deletes all subscriptions and receipts for{' '}
                    <code className="font-mono text-xs">{OWNER}</code>, then the
                    owner and{' '}
                    <code className="font-mono text-xs">{GRANTEE}</code> grantee
                    records, using Salable&apos;s test mode delete endpoints,
                    leaving only the imported product.
                  </p>
                </div>
                <form
                  {...getFormProps(reset.form)}
                  noValidate
                  className="shrink-0"
                >
                  <input
                    type="hidden"
                    name={reset.fields.confirm.name}
                    value="yes"
                  />
                  <Button
                    type="submit"
                    variant="danger"
                    pending={reset.pending}
                    pendingLabel="Resetting…"
                  >
                    Reset demo
                  </Button>
                </form>
              </div>
              <div className="mt-3">
                <FormMessages
                  errors={reset.form.errors}
                  errorId={reset.form.errorId}
                  message={reset.message}
                />
              </div>
            </footer>
          </>
        ) : null}
      </main>
    </>
  )
}

/**
 * Step 2: a Subscribe panel until the owner holds a live Pro subscription,
 * then a Manage panel for that subscription.
 */
function PlanPanel({
  subscription,
  description,
  onChange,
  onCancelled,
}: {
  subscription: Subscription | null
  description: ReactNode
  onChange: () => void
  onCancelled: () => void
}) {
  if (subscription) {
    return (
      <Panel
        title="Manage Pro"
        description="Pro plan for the owner."
        badge={
          subscription.cancelAtPeriodEnd ? (
            <Badge tone="amber">Cancels at period end</Badge>
          ) : (
            <Badge
              tone={
                subscription.status === 'active'
                  ? 'green'
                  : subscription.status === 'past_due'
                    ? 'amber'
                    : 'zinc'
              }
            >
              {subscription.status?.replace('_', ' ') ?? 'unknown'}
            </Badge>
          )
        }
      >
        <ManageSubscription
          subscription={subscription}
          onChange={onChange}
          onCancelled={onCancelled}
        />
      </Panel>
    )
  }

  return (
    <Panel
      title="Subscribe to Pro"
      description={description}
      badge={<Badge tone="zinc">Not subscribed</Badge>}
    >
      <div className="space-y-3">
        <CheckoutForm label="Subscribe to Pro" />
        <p className="text-xs text-zinc-500">
          Use Stripe test card 4242 4242 4242 4242 with any future expiry.
        </p>
      </div>
    </Panel>
  )
}

/** SWR fetcher: GET a JSON endpoint and surface the API's error message on failure. */
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body: ApiErrorResponse = await res.json()
    throw new Error(body.error ?? 'Failed to load demo state')
  }
  return res.json()
}
