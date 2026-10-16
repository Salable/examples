import { getFormProps } from '@conform-to/react'
import type { GetServerSideProps, InferGetServerSidePropsType } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button } from '@/components/Button'
import { CheckoutForm } from '@/components/CheckoutForm'
import { ConsumeForm } from '@/components/ConsumeForm'
import { FormMessages } from '@/components/FormMessages'
import { ManageSubscription } from '@/components/ManageSubscription'
import { Panel } from '@/components/Panel'
import { useApiForm } from '@/hooks/useApiForm'
import {
  GRANTEE,
  INCLUDED_TOKENS,
  METER_SLUG,
  OVERAGE_UNIT_AMOUNT_CENTS,
  OWNER,
  PLAN_AMOUNT_CENTS,
  TOKEN_SLUG,
} from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { isSalableError } from '@/lib/salable'
import { resetSchema } from '@/lib/schemas'
import { getSubscriptionSummary } from '@/lib/subscriptions'
import { getTokenBalance } from '@/lib/tokens'
import { getUsage } from '@/lib/usage'
import type {
  ApiErrorResponse,
  Entitlement,
  Subscription,
  SubscriptionSummary,
  TokenBalance,
  UsageRecordStatus,
  UsageSummary,
} from '@/lib/types'

/** Server-rendered first values for the four reads, or the error if Salable could not be reached. */
type Props = {
  entitlements: Entitlement[] | null
  subscription: SubscriptionSummary | null
  tokens: TokenBalance | null
  usage: UsageSummary | null
  error: string | null
  /** True when Stripe has just sent the browser back to `/?checkout=success`. */
  polling: boolean
}

// Salable applies a purchase, a cancellation or a recorded usage increment in
// the background, so the page polls for a while after each. Purchases land in
// a few seconds; a queued usage increment can take around half a minute.
// Token consumption is synchronous and needs no polling.
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 40_000

const STATUS_TONES: Record<UsageRecordStatus, BadgeTone> = {
  current: 'green',
  final: 'zinc',
  recorded: 'amber',
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export const getServerSideProps = (async ({ query }) => {
  const polling = query.checkout === 'success'
  try {
    const [entitlements, subscription, tokens, usage] = await Promise.all([
      getEntitlements(GRANTEE),
      getSubscriptionSummary(),
      getTokenBalance(),
      getUsage(),
    ])
    return {
      props: {
        entitlements,
        subscription,
        tokens,
        usage,
        error: null,
        polling,
      },
    }
  } catch (err) {
    return {
      props: {
        entitlements: null,
        subscription: null,
        tokens: null,
        usage: null,
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
  usage: initialUsage,
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
  const tokens = useSWR<TokenBalance>('/api/tokens/balance', fetcher, {
    fallbackData: initialTokens ?? undefined,
    ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
  })
  const usage = useSWR<UsageSummary>('/api/usage/records', fetcher, {
    fallbackData: initialUsage ?? undefined,
    ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
  })

  async function refresh(): Promise<void> {
    await Promise.all([
      entitlements.mutate(),
      subscription.mutate(),
      tokens.mutate(),
      usage.mutate(),
    ])
  }

  // The Refresh button tracks its own pending state rather than SWR's
  // `isValidating`, which is hidden while the page polls (e.g. right after
  // checkout) so the button does not flicker every poll.
  const [refreshing, setRefreshing] = useState(false)
  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  // Reset demo: deletes every subscription and receipt for the owner.
  const reset = useApiForm({
    schema: resetSchema,
    action: '/api/reset',
    confirm: `Delete every subscription and receipt for ${OWNER}, then the ${OWNER} owner and ${GRANTEE} grantee records? This removes all granted tokens and usage records and cannot be undone.`,
    onSuccess: refresh,
  })

  // The owner-scoped check returns the Pro plan's token and meter as two
  // entries sharing the image_generations slug, told apart by type. Generating
  // needs both: tokens to consume and the meter to record overage against.
  const hasTokens =
    entitlements.data?.entitlements.some(
      (e) => e.type === 'token' && e.value === TOKEN_SLUG
    ) ?? false
  const hasMeter =
    entitlements.data?.entitlements.some(
      (e) => e.type === 'meter' && e.value === METER_SLUG
    ) ?? false
  const canGenerate = hasTokens && hasMeter
  // Which of the two entries the locked state should point at.
  const missingAccess = [!hasTokens && 'token', !hasMeter && 'meter']
    .filter(Boolean)
    .join(' and ')

  const loaded = Boolean(
    entitlements.data && subscription.data && tokens.data && usage.data
  )
  const isValidating =
    entitlements.isValidating ||
    subscription.isValidating ||
    tokens.isValidating ||
    usage.isValidating
  const error =
    entitlements.error ?? subscription.error ?? tokens.error ?? usage.error
  const errorMessage =
    error instanceof Error ? error.message : loaded ? null : initialError

  // Stripe sends the browser back to `/?checkout=cancelled` when the reader
  // backs out of checkout. A successful checkout needs no notice: the polling
  // above updates the page on its own.
  const checkoutCancelled = router.query.checkout === 'cancelled'

  const balance = tokens.data?.balance ?? 0
  const currentCount = usage.data?.current?.count ?? 0

  return (
    <>
      <Head>
        <title>Salable PAYG Token Overage</title>
        <meta
          name="description"
          content="Demo of pay-as-you-go overage with Salable: a monthly token allowance, with further usage billed on a meter once the tokens run out."
        />
      </Head>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {/* Identity strip: confirms the hardcoded owner / grantee. */}
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
                  Salable PAYG Token Overage
                </h1>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Pay-as-you-go overage demo. Each generation consumes from the
                plan&apos;s{' '}
                <a
                  className="cursor-pointer underline decoration-zinc-400 underline-offset-2 hover:decoration-current"
                  href="https://salable.app/docs/token-billing"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  token
                </a>{' '}
                allowance first; once Salable answers 422 for an empty balance,
                it is recorded as{' '}
                <a
                  className="cursor-pointer underline decoration-zinc-400 underline-offset-2 hover:decoration-current"
                  href="https://salable.app/docs/metered-usage"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  metered usage
                </a>{' '}
                instead.
              </p>
            </div>
            <dl className="flex flex-wrap gap-2 text-sm">
              {[
                ['Owner', OWNER],
                ['Grantee', GRANTEE],
                ['Token', TOKEN_SLUG],
                ['Meter', METER_SLUG],
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
              onClick={() => void handleRefresh()}
              pending={refreshing || (isValidating && !isPolling)}
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
              onClick={() => void handleRefresh()}
              className="mt-3 cursor-pointer text-xs font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </section>
        ) : null}

        {entitlements.data && subscription.data && tokens.data && usage.data ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {/* The owner-scoped entitlement check gates the generate form. */}
              <Panel
                title="Generate images"
                description={
                  <>
                    Gated by the{' '}
                    <code className="font-mono text-xs">{TOKEN_SLUG}</code>{' '}
                    token and the{' '}
                    <code className="font-mono text-xs">{METER_SLUG}</code>{' '}
                    meter for{' '}
                    <code className="font-mono text-xs">{GRANTEE}</code>. An
                    owner-scoped entitlement check returns them as two entries
                    sharing one slug, told apart by type. Each generation
                    consumes tokens; once the balance is empty it is recorded
                    against the meter as overage.
                  </>
                }
                badge={
                  canGenerate ? (
                    <Badge tone="green">Access granted</Badge>
                  ) : (
                    <Badge tone="red">Requires Pro</Badge>
                  )
                }
              >
                {canGenerate ? (
                  <ConsumeForm
                    balance={balance}
                    currentUsage={currentCount}
                    onChange={refresh}
                    onRecorded={() => setIsPolling(true)}
                  />
                ) : (
                  <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                    <p>
                      <span className="font-mono text-xs">{GRANTEE}</span> does
                      not have access to the{' '}
                      <span className="font-mono text-xs">{TOKEN_SLUG}</span>{' '}
                      {missingAccess}, so the generation UI stays hidden.
                    </p>
                    <p className="mt-2">Subscribe to Pro to unlock it.</p>
                  </div>
                )}
              </Panel>

              {/* Checkout for the Pro plan, or manage it once it exists. */}
              <PlanPanel
                subscription={subscription.data.pro}
                description={
                  <>
                    {usd.format(PLAN_AMOUNT_CENTS / 100)} per month includes{' '}
                    {INCLUDED_TOKENS.toLocaleString()}{' '}
                    <code className="font-mono text-xs">{TOKEN_SLUG}</code>{' '}
                    tokens, reset each cycle. Beyond that,{' '}
                    {usd.format(OVERAGE_UNIT_AMOUNT_CENTS / 100)} per image is
                    billed as metered usage at the end of the period. Puts the{' '}
                    <code className="font-mono text-xs">{TOKEN_SLUG}</code>{' '}
                    token and meter in the entitlement check.
                  </>
                }
                onChange={refresh}
                onCancelled={() => setIsPolling(true)}
              />
            </div>

            {/* The owner's token balance and every record behind it. */}
            <Panel
              title="Token balance"
              description={
                <>
                  Balance for owner{' '}
                  <code className="font-mono text-xs">{OWNER}</code>, token{' '}
                  <code className="font-mono text-xs">{TOKEN_SLUG}</code>.
                  Consuming is synchronous: the balance drops as soon as a
                  generation is paid for with tokens.
                </>
              }
              badge={
                <Badge tone={balance > 0 ? 'green' : 'zinc'}>
                  {tokens.data.records.length}{' '}
                  {tokens.data.records.length === 1 ? 'record' : 'records'}
                </Badge>
              }
            >
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums tracking-tight">
                  {balance.toLocaleString()}
                </span>
                <span className="text-sm text-zinc-500">
                  {TOKEN_SLUG} tokens remaining
                </span>
              </div>

              {tokens.data.records.length === 0 ? (
                <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                  No token records yet. Subscribe to Pro to be granted{' '}
                  {INCLUDED_TOKENS.toLocaleString()} tokens.
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

            {/* The owner's overage this period and every usage record behind it. */}
            <Panel
              title="Overage usage this period"
              description={
                <>
                  Usage records for owner{' '}
                  <code className="font-mono text-xs">{OWNER}</code>, meter{' '}
                  <code className="font-mono text-xs">{METER_SLUG}</code>.
                  Salable increments the current record in the background, so a
                  count can take up to half a minute to appear.
                </>
              }
              badge={
                <Badge tone={usage.data.current ? 'green' : 'zinc'}>
                  {usage.data.records.length}{' '}
                  {usage.data.records.length === 1 ? 'record' : 'records'}
                </Badge>
              }
            >
              <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-semibold tabular-nums tracking-tight">
                    {currentCount.toLocaleString()}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {METER_SLUG} at{' '}
                    {usd.format(OVERAGE_UNIT_AMOUNT_CENTS / 100)} each
                  </span>
                </div>
                <span className="text-sm text-zinc-500">
                  Estimated overage charge{' '}
                  <span className="font-medium tabular-nums text-foreground">
                    {usd.format(
                      (currentCount * OVERAGE_UNIT_AMOUNT_CENTS) / 100
                    )}
                  </span>
                </span>
              </div>

              {usage.data.records.length === 0 ? (
                <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                  No usage records yet. Salable creates the record when the Pro
                  subscription starts; it stays at 0 until the token balance is
                  exhausted.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr className="border-b border-black/10 dark:border-white/15">
                        <th className="py-2 pr-4 font-medium">Record</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Count</th>
                        <th className="py-2 pr-4 font-medium">Created</th>
                        <th className="py-2 pr-4 font-medium">Finalised</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.data.records.map((record) => (
                        <tr
                          key={record.id}
                          className="border-b border-black/5 last:border-0 dark:border-white/10"
                        >
                          <td className="py-2 pr-4 font-mono text-xs">
                            {record.id}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge
                              tone={
                                record.status
                                  ? STATUS_TONES[record.status]
                                  : 'zinc'
                              }
                            >
                              {record.status ?? 'unknown'}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 tabular-nums">
                            {record.count.toLocaleString()}
                          </td>
                          <td className="py-2 pr-4" suppressHydrationWarning>
                            {record.createdAt
                              ? new Date(record.createdAt).toLocaleString()
                              : '—'}
                          </td>
                          <td className="py-2 pr-4" suppressHydrationWarning>
                            {record.recordedAt
                              ? new Date(record.recordedAt).toLocaleString()
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {/* Reset: test-mode-only deletes that cascade to the token and usage records. */}
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
                    Token and usage records are removed with them, leaving only
                    the imported product.
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
 * A Subscribe panel until the owner holds a live Pro subscription, then a
 * Manage panel for that subscription.
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
