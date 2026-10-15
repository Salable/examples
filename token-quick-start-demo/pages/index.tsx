import { getFormProps } from '@conform-to/react'
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { CheckoutForm } from '@/components/CheckoutForm'
import { ConsumeForm } from '@/components/ConsumeForm'
import { FormMessages } from '@/components/FormMessages'
import { ManageSubscription } from '@/components/ManageSubscription'
import { Panel } from '@/components/Panel'
import { useApiForm } from '@/hooks/useApiForm'
import {
  EXPORT_HD_ENTITLEMENT,
  GENERATE_ENTITLEMENT,
  GRANTEE,
  OWNER,
  TOKEN_SLUG,
} from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { isSalableError } from '@/lib/salable'
import { resetSchema } from '@/lib/schemas'
import { getSubscriptionSummary } from '@/lib/subscriptions'
import { getTokenBalance } from '@/lib/tokens'
import type {
  ApiErrorResponse,
  Entitlement,
  SubscriptionSummary,
  TokenBalance,
} from '@/lib/types'

/** Server-rendered first values for the three reads, or the error if Salable could not be reached. */
type Props = {
  entitlements: Entitlement[] | null
  subscription: SubscriptionSummary | null
  tokens: TokenBalance | null
  error: string | null
  /** True when Stripe has just sent the browser back to `/?checkout=success`. */
  polling: boolean
}

// Salable applies a purchase or cancellation when Stripe's webhook arrives, a
// few seconds later, so the page polls briefly after either.
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 6_000

export const getServerSideProps = (async ({ query }) => {
  const polling = query.checkout === 'success'
  try {
    const [entitlements, subscription, tokens] = await Promise.all([
      getEntitlements(GRANTEE),
      getSubscriptionSummary(),
      getTokenBalance(),
    ])
    return {
      props: { entitlements, subscription, tokens, error: null, polling },
    }
  } catch (err) {
    return {
      props: {
        entitlements: null,
        subscription: null,
        tokens: null,
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
  tokens: initialTokens,
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

  // NOTE: Export HD is a simulated feature, it only
  // exists to show a panel gated on an entitlement the top-up does not grant.
  const [exportHd, setExportHd] = useState<'idle' | 'exporting' | 'done'>(
    'idle'
  )

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
  const tokens = useSWR<TokenBalance>('/api/tokens/balance', fetcher, {
    fallbackData: initialTokens ?? undefined,
    ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
  })

  function refresh() {
    void entitlements.mutate()
    void subscription.mutate()
    void tokens.mutate()
  }

  // Reset demo: deletes every subscription and receipt for the owner.
  const reset = useApiForm({
    schema: resetSchema,
    action: '/api/reset',
    confirm: `Delete every subscription and receipt for ${OWNER}, then the ${OWNER} owner and ${GRANTEE} grantee records? This removes all granted tokens and cannot be undone.`,
    onSuccess: refresh,
  })

  function handleExportHd() {
    setExportHd('exporting')
    // Pretend to render the file.
    window.setTimeout(() => setExportHd('done'), 1_200)
  }

  const starter = subscription.data?.starter ?? null
  // Step 6 of the guide: the grantee has access if the entitlement is present.
  // Both plans grant generate_images; only Starter grants export_hd.
  const canGenerate =
    entitlements.data?.entitlements.some(
      (e) => e.value === GENERATE_ENTITLEMENT
    ) ?? false
  const canExportHd =
    entitlements.data?.entitlements.some(
      (e) => e.value === EXPORT_HD_ENTITLEMENT
    ) ?? false

  const loaded = Boolean(entitlements.data && subscription.data && tokens.data)
  const isValidating =
    entitlements.isValidating ||
    subscription.isValidating ||
    tokens.isValidating
  const error = entitlements.error ?? subscription.error ?? tokens.error
  const errorMessage =
    error instanceof Error ? error.message : loaded ? null : initialError

  // Stripe sends the browser back to `/?checkout=cancelled` when the reader
  // backs out of checkout. A successful checkout needs no notice: the polling
  // above updates the page on its own.
  const checkoutCancelled = router.query.checkout === 'cancelled'

  return (
    <>
      <Head>
        <title>Salable Token Quick Start</title>
        <meta
          name="description"
          content="Demo of token-based billing with Salable: subscribe, consume tokens, top up, and reset."
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
                  Salable Token Quick Start
                </h1>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Token-based billing demo. Every panel maps to a step in the{' '}
                <a
                  className="cursor-pointer underline decoration-zinc-400 underline-offset-2 hover:decoration-current"
                  href="https://salable.app/docs/token-quick-start?lang=sdk"
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
                ['Token', TOKEN_SLUG],
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
                and copy the printed plan IDs into .env.local.
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

        {entitlements.data && subscription.data && tokens.data ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-6">
                {/* Steps 5 and 6: the entitlement check gates the consume form. */}
                <Panel
                  title="Consume tokens"
                  description={
                    <>
                      Gated by the{' '}
                      <code className="font-mono text-xs">
                        {GENERATE_ENTITLEMENT}
                      </code>{' '}
                      entitlement for{' '}
                      <code className="font-mono text-xs">{GRANTEE}</code>. Both
                      plans grant it.
                    </>
                  }
                  badge={
                    canGenerate ? (
                      <Badge tone="green">Access granted</Badge>
                    ) : (
                      <Badge tone="red">No access</Badge>
                    )
                  }
                >
                  {canGenerate ? (
                    <ConsumeForm
                      balance={tokens.data.balance}
                      onChange={refresh}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                      <p>
                        <span className="font-mono text-xs">{GRANTEE}</span>{' '}
                        does not have the{' '}
                        <span className="font-mono text-xs">
                          {GENERATE_ENTITLEMENT}
                        </span>{' '}
                        entitlement, so the generation UI stays hidden.
                      </p>
                      <p className="mt-2">
                        Subscribe to Starter or buy a Token Top-Up to unlock it.
                      </p>
                    </div>
                  )}
                </Panel>

                {/* A second gate on an entitlement only the recurring plan grants. The export is simulated. */}
                <Panel
                  title="Export HD"
                  description={
                    <>
                      Gated by the{' '}
                      <code className="font-mono text-xs">
                        {EXPORT_HD_ENTITLEMENT}
                      </code>{' '}
                      entitlement, which only the Starter plan grants. The
                      export itself is simulated.
                    </>
                  }
                  badge={
                    canExportHd ? (
                      <Badge tone="green">Access granted</Badge>
                    ) : (
                      <Badge tone="red">Requires Starter</Badge>
                    )
                  }
                >
                  {canExportHd ? (
                    <div className="space-y-3">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Pretend an image has been generated and export it at
                        full resolution.
                      </p>
                      <Button
                        type="button"
                        onClick={handleExportHd}
                        pending={exportHd === 'exporting'}
                        pendingLabel="Exporting…"
                      >
                        Export image in HD
                      </Button>
                      <FormMessages
                        message={
                          exportHd === 'done'
                            ? 'Exported image.png at 3840×2160. Nothing was sent to Salable; only the entitlement check was real.'
                            : null
                        }
                      />
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                      <p>
                        <span className="font-mono text-xs">{GRANTEE}</span>{' '}
                        does not have the{' '}
                        <span className="font-mono text-xs">
                          {EXPORT_HD_ENTITLEMENT}
                        </span>{' '}
                        entitlement. Token Top-Ups do not include it.
                      </p>
                      <p className="mt-2">
                        Subscribe to the Starter plan to unlock HD export.
                      </p>
                    </div>
                  )}
                </Panel>
              </div>

              <div className="space-y-6">
                {/* Step 4: checkout for the Starter plan, or manage it once it exists. */}
                {starter ? (
                  <Panel
                    title="Manage subscription"
                    description="Starter plan for the owner."
                    badge={
                      starter.cancelAtPeriodEnd ? (
                        <Badge tone="amber">Cancels at period end</Badge>
                      ) : (
                        <Badge
                          tone={
                            starter.status === 'active'
                              ? 'green'
                              : starter.status === 'past_due'
                                ? 'amber'
                                : 'zinc'
                          }
                        >
                          {starter.status?.replace('_', ' ') ?? 'unknown'}
                        </Badge>
                      )
                    }
                  >
                    <ManageSubscription
                      subscription={starter}
                      onChange={refresh}
                      onCancelled={() => setIsPolling(true)}
                    />
                  </Panel>
                ) : (
                  <Panel
                    title="Subscribe to Starter"
                    description="$29 / month. Grants 1,000 image_tokens each cycle plus the generate_images and export_hd entitlements. The only plan that unlocks Export HD."
                    badge={<Badge tone="zinc">Not subscribed</Badge>}
                  >
                    <div className="space-y-3">
                      <CheckoutForm
                        plan="starter"
                        label="Subscribe to Starter"
                      />
                      <p className="text-xs text-zinc-500">
                        Use Stripe test card 4242 4242 4242 4242 with any future
                        expiry.
                      </p>
                    </div>
                  </Panel>
                )}

                {/* Step 4 again, one-off variant. Each purchase creates a perpetual subscription, so it works without Starter. */}
                <Panel
                  title="Token Top-Up"
                  description="$29 one-off. Adds 1,000 image_tokens and creates a perpetual subscription that grants generate_images, so it works without Starter."
                  badge={<Badge tone="zinc">One-off</Badge>}
                >
                  <div className="space-y-3">
                    <CheckoutForm plan="topup" label="Buy 1,000 tokens" />
                    <p className="text-xs text-zinc-500">
                      Use Stripe test card 4242 4242 4242 4242 with any future
                      expiry.
                    </p>
                  </div>
                </Panel>
              </div>
            </div>

            {/* Step 7: the owner's token balance and every record behind it. */}
            <Panel
              title="Token balance"
              description={
                <>
                  Balance for owner{' '}
                  <code className="font-mono text-xs">{OWNER}</code>, token{' '}
                  <code className="font-mono text-xs">{TOKEN_SLUG}</code>.
                </>
              }
              badge={
                <Badge tone={tokens.data.balance > 0 ? 'green' : 'zinc'}>
                  {tokens.data.records.length}{' '}
                  {tokens.data.records.length === 1 ? 'record' : 'records'}
                </Badge>
              }
            >
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums tracking-tight">
                  {tokens.data.balance.toLocaleString()}
                </span>
                <span className="text-sm text-zinc-500">
                  {TOKEN_SLUG} remaining
                </span>
              </div>

              {tokens.data.records.length === 0 ? (
                <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                  No token records yet. Subscribe to Starter or buy a top-up to
                  grant tokens.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr className="border-b border-black/10 dark:border-white/15">
                        <th className="py-2 pr-4 font-medium">Record</th>
                        <th className="py-2 pr-4 font-medium">Remaining</th>
                        <th className="py-2 pr-4 font-medium">Expires</th>
                        <th className="py-2 pr-4 font-medium">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokens.data.records.map((record) => (
                        <tr
                          key={record.recordId}
                          className="border-b border-black/5 last:border-0 dark:border-white/10"
                        >
                          <td className="py-2 pr-4 font-mono text-xs">
                            {record.recordId}
                          </td>
                          <td className="py-2 pr-4 tabular-nums">
                            {(record.remaining ?? 0).toLocaleString()}
                          </td>
                          <td className="py-2 pr-4" suppressHydrationWarning>
                            {record.expiresAt
                              ? new Date(record.expiresAt).toLocaleString()
                              : 'Never'}
                          </td>
                          <td className="py-2 pr-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                tone={
                                  record.source?.type?.includes('receipt')
                                    ? 'amber'
                                    : 'green'
                                }
                              >
                                {record.source?.type ?? 'unknown'}
                              </Badge>
                              {record.source?.id ? (
                                <span className="font-mono text-xs text-zinc-500">
                                  {record.source?.id}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {/* Reset: test-mode-only deletes that cascade to the token records. */}
            <footer className="rounded-xl border border-dashed border-black/15 p-5 dark:border-white/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-sm">
                  <h2 className="font-semibold">Reset demo</h2>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    Deletes all subscriptions and receipts for{' '}
                    <code className="font-mono text-xs">{OWNER}</code>, then the
                    owner and{' '}
                    <code className="font-mono text-xs">{GRANTEE}</code> grantee
                    records, using Salable&apos;s test mode delete endpoints.
                    Token records are removed with them, leaving only the
                    imported product.
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

/** SWR fetcher: GET a JSON endpoint and surface the API's error message on failure. */
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const body: ApiErrorResponse = await res.json()
    throw new Error(body.error ?? 'Failed to load demo state')
  }
  return res.json()
}
