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
import { FormMessages } from '@/components/FormMessages'
import { GenerateForm } from '@/components/GenerateForm'
import { ManageSubscription } from '@/components/ManageSubscription'
import { Panel } from '@/components/Panel'
import { useApiForm } from '@/hooks/useApiForm'
import {
  EXPORT_HD_ENTITLEMENT,
  GRANTEE,
  METER_SLUG,
  OWNER,
  PRIORITY_ENTITLEMENT,
  UNIT_AMOUNT_CENTS,
} from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { isSalableError } from '@/lib/salable'
import { resetSchema } from '@/lib/schemas'
import { getSubscriptionSummary } from '@/lib/subscriptions'
import { getUsage } from '@/lib/usage'
import type {
  ApiErrorResponse,
  Entitlement,
  Subscription,
  SubscriptionSummary,
  UsageRecordStatus,
  UsageSummary,
} from '@/lib/types'

/** Server-rendered first values for the three reads, or the error if Salable could not be reached. */
type Props = {
  entitlements: Entitlement[] | null
  subscription: SubscriptionSummary | null
  usage: UsageSummary | null
  error: string | null
  /** True when Stripe has just sent the browser back to `/?checkout=success`. */
  polling: boolean
}

// Salable applies a purchase, a cancellation or a recorded usage increment in
// the background, so the page polls for a while after each. Purchases land in
// a few seconds; a queued usage increment can take around half a minute.
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
    const [entitlements, subscription, usage] = await Promise.all([
      getEntitlements(GRANTEE),
      getSubscriptionSummary(),
      getUsage(),
    ])
    return {
      props: { entitlements, subscription, usage, error: null, polling },
    }
  } catch (err) {
    return {
      props: {
        entitlements: null,
        subscription: null,
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

  // NOTE: Export HD is a simulated feature, it only exists to show a second
  // panel gated on an entitlement, one that unlocks a feature without
  // recording any usage against the meter.
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
  const usage = useSWR<UsageSummary>('/api/usage/records', fetcher, {
    fallbackData: initialUsage ?? undefined,
    ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
  })

  function refresh() {
    void entitlements.mutate()
    void subscription.mutate()
    void usage.mutate()
  }

  // Reset demo: deletes every subscription and receipt for the owner.
  const reset = useApiForm({
    schema: resetSchema,
    action: '/api/reset',
    confirm: `Delete every subscription and receipt for ${OWNER}, then the ${OWNER} owner and ${GRANTEE} grantee records? This removes all usage records and cannot be undone.`,
    onSuccess: refresh,
  })

  function handleExportHd() {
    setExportHd('exporting')
    // Pretend to render the file.
    window.setTimeout(() => setExportHd('done'), 1_200)
  }

  // Step 4 of the guide: the owner-scoped check returns the image_generations
  // meter slug with type 'meter' while the Pro subscription is active. Check
  // both type and value, because a token can share a meter's slug. Export HD
  // is gated on a plain entitlement the Pro plan also grants.
  const canGenerate =
    entitlements.data?.entitlements.some(
      (e) => e.type === 'meter' && e.value === METER_SLUG
    ) ?? false
  const canExportHd =
    entitlements.data?.entitlements.some(
      (e) => e.value === EXPORT_HD_ENTITLEMENT
    ) ?? false

  const loaded = Boolean(entitlements.data && subscription.data && usage.data)
  const isValidating =
    entitlements.isValidating || subscription.isValidating || usage.isValidating
  const error = entitlements.error ?? subscription.error ?? usage.error
  const errorMessage =
    error instanceof Error ? error.message : loaded ? null : initialError

  // Stripe sends the browser back to `/?checkout=cancelled` when the reader
  // backs out of checkout. A successful checkout needs no notice: the polling
  // above updates the page on its own.
  const checkoutCancelled = router.query.checkout === 'cancelled'

  const currentCount = usage.data?.current?.count ?? 0

  return (
    <>
      <Head>
        <title>Salable Usage Quick Start</title>
        <meta
          name="description"
          content="Demo of usage-based billing with Salable: subscribe, record usage against a meter, display usage, and reset."
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
                  Salable Usage Quick Start
                </h1>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Usage-based billing demo. Every panel maps to a step in the{' '}
                <a
                  className="cursor-pointer underline decoration-zinc-400 underline-offset-2 hover:decoration-current"
                  href="https://salable.app/docs/usage-quick-start?lang=sdk"
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

        {entitlements.data && subscription.data && usage.data ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-6">
                {/* Steps 3 and 4: the owner-scoped entitlement check gates the generate form. */}
                <Panel
                  title="Generate images"
                  description={
                    <>
                      Gated by the{' '}
                      <code className="font-mono text-xs">{METER_SLUG}</code>{' '}
                      meter for{' '}
                      <code className="font-mono text-xs">{GRANTEE}</code>,
                      returned by an owner-scoped entitlement check while the
                      Pro plan is active. No separate entitlement is needed.
                      Each generation is recorded as usage against the meter.
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
                    <GenerateForm
                      current={currentCount}
                      onChange={refresh}
                      onRecorded={() => setIsPolling(true)}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                      <p>
                        <span className="font-mono text-xs">{GRANTEE}</span>{' '}
                        does not have access to the{' '}
                        <span className="font-mono text-xs">{METER_SLUG}</span>{' '}
                        meter, so the generation UI stays hidden.
                      </p>
                      <p className="mt-2">Subscribe to Pro to unlock it.</p>
                    </div>
                  )}
                </Panel>

                {/* A second gate, on an entitlement that unlocks a feature without recording usage. The export is simulated. */}
                <Panel
                  title="Export HD"
                  description={
                    <>
                      Gated by the{' '}
                      <code className="font-mono text-xs">
                        {EXPORT_HD_ENTITLEMENT}
                      </code>{' '}
                      entitlement, which the Pro plan also grants. The export
                      itself is simulated and records no usage.
                    </>
                  }
                  badge={
                    canExportHd ? (
                      <Badge tone="green">Access granted</Badge>
                    ) : (
                      <Badge tone="red">Requires Pro</Badge>
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
                        entitlement.
                      </p>
                      <p className="mt-2">
                        Subscribe to Pro to unlock HD export.
                      </p>
                    </div>
                  )}
                </Panel>
              </div>

              <div className="space-y-6">
                {/* Step 2: checkout for the Pro plan, or manage it once it exists. */}
                <PlanPanel
                  subscription={subscription.data.pro}
                  description={
                    <>
                      {usd.format(UNIT_AMOUNT_CENTS / 100)} per image
                      generation, billed monthly on usage. Grants the{' '}
                      <code className="font-mono text-xs">{METER_SLUG}</code>{' '}
                      meter plus the{' '}
                      <code className="font-mono text-xs">
                        {EXPORT_HD_ENTITLEMENT}
                      </code>{' '}
                      and{' '}
                      <code className="font-mono text-xs">
                        {PRIORITY_ENTITLEMENT}
                      </code>{' '}
                      entitlements.
                    </>
                  }
                  onChange={refresh}
                  onCancelled={() => setIsPolling(true)}
                />
              </div>
            </div>

            {/* Step 5: the owner's usage this period and every record behind it. */}
            <Panel
              title="Usage this period"
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
                    {METER_SLUG} at {usd.format(UNIT_AMOUNT_CENTS / 100)} each
                  </span>
                </div>
                <span className="text-sm text-zinc-500">
                  Estimated charge{' '}
                  <span className="font-medium tabular-nums text-foreground">
                    {usd.format((currentCount * UNIT_AMOUNT_CENTS) / 100)}
                  </span>
                </span>
              </div>

              {usage.data.records.length === 0 ? (
                <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                  No usage records yet. Subscribe to Pro; Salable creates the
                  record when the subscription starts.
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

            {/* Reset: test-mode-only deletes that cascade to the usage records. */}
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
                    Usage records are removed with them, leaving only the
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
