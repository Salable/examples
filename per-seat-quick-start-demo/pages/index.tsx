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
import { ContextSwitcher } from '@/components/ContextSwitcher'
import { FormMessages } from '@/components/FormMessages'
import { ManageSubscription } from '@/components/ManageSubscription'
import { Panel } from '@/components/Panel'
import { SimulatedFeature } from '@/components/SimulatedFeature'
import { TeamMembers } from '@/components/TeamMembers'
import { useApiForm } from '@/hooks/useApiForm'
import {
  AI_ASSISTANT_ENTITLEMENT,
  EXPORT_PDF_ENTITLEMENT,
  GRANTEE_IDS,
  PERSONAL_PRICE_CENTS,
  TEAM_NAME,
  TEAM_OWNER,
  TEAM_SEAT_PRICE_CENTS,
  TEAM_SEATS,
  USERS,
  type GranteeId,
  type Tab,
} from '@/lib/constants'
import {
  contextFromQuery,
  contextSearchParams,
  resolveContext,
  type Context,
} from '@/lib/context'
import { getEntitlements } from '@/lib/entitlements'
import { getTeamView } from '@/lib/group'
import { isSalableError } from '@/lib/salable'
import { resetSchema } from '@/lib/schemas'
import { getSubscriptionSummary } from '@/lib/subscriptions'
import type {
  ApiErrorResponse,
  Entitlement,
  GroupSummary,
  Subscription,
  SubscriptionSummary,
} from '@/lib/types'

/** Server-rendered first values for the reads, or the error if Salable could not be reached. */
type Props = Context & {
  entitlements: Entitlement[] | null
  subscription: SubscriptionSummary | null
  /** Only read on the Team tab; null on the Personal tab. */
  group: GroupSummary | null
  error: string | null
  /** True when Stripe has just sent the browser back to `/?checkout=success`. */
  polling: boolean
}

// Salable applies a purchase or a cancellation in the background once Stripe
// confirms it, so the page polls for a while after each. Both land in a few
// seconds.
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 10_000

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const OWNERS = [USERS.user_alice.id, USERS.user_bob.id, TEAM_OWNER]

export const getServerSideProps = (async ({ query }) => {
  const { granteeId, tab } = contextFromQuery(query)
  const ctx = resolveContext(granteeId, tab)
  const polling = query.checkout === 'success'
  try {
    // On the Team tab the subscription is part of the member-only view.
    const [entitlements, view] = await Promise.all([
      getEntitlements(ctx.granteeId, ctx.owner),
      tab === 'team'
        ? getTeamView(ctx.granteeId)
        : getSubscriptionSummary(ctx.owner, ctx.tab).then((subscription) => ({
            subscription,
            group: null,
          })),
    ])
    return {
      props: {
        granteeId,
        tab,
        entitlements,
        subscription: view.subscription,
        group: view.group,
        error: null,
        polling,
      },
    }
  } catch (err) {
    return {
      props: {
        granteeId,
        tab,
        entitlements: null,
        subscription: null,
        group: null,
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
  granteeId: initialGranteeId,
  tab: initialTab,
  entitlements: initialEntitlements,
  subscription: initialSubscription,
  group: initialGroup,
  error: initialError,
  polling: initialPolling,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter()

  // The user and tab live in the URL so they survive a reload and the round
  // trip to Stripe. Switching is a shallow replace: no server render, the SWR
  // keys below change and the page refetches for the new context.
  const ctx = contextFromQuery(router.query)
  const { owner } = resolveContext(ctx.granteeId, ctx.tab)
  const qs = contextSearchParams(ctx)
  // The server-rendered values only apply while the context they were read
  // for is the one on screen.
  const sameAsServer =
    ctx.granteeId === initialGranteeId && ctx.tab === initialTab

  function switchContext(next: Context) {
    void router.replace(
      { pathname: '/', query: { grantee: next.granteeId, tab: next.tab } },
      undefined,
      { shallow: true }
    )
  }

  const [isPolling, setIsPolling] = useState(initialPolling)
  useEffect(() => {
    if (!isPolling) return
    const timer = window.setTimeout(() => setIsPolling(false), POLL_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [isPolling])

  const entitlements = useSWR<{ entitlements: Entitlement[] }>(
    `/api/entitlements?${qs}`,
    fetcher,
    {
      fallbackData:
        sameAsServer && initialEntitlements
          ? { entitlements: initialEntitlements }
          : undefined,
      ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
    }
  )
  const subscription = useSWR<SubscriptionSummary>(
    `/api/subscription?${qs}`,
    fetcher,
    {
      fallbackData:
        sameAsServer && initialSubscription ? initialSubscription : undefined,
      ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
    }
  )
  // The group is only read on the Team tab, and only shown to its members.
  const group = useSWR<GroupSummary>(
    ctx.tab === 'team' ? `/api/group?${qs}` : null,
    fetcher,
    {
      fallbackData: sameAsServer && initialGroup ? initialGroup : undefined,
      ...(isPolling && { refreshInterval: POLL_INTERVAL_MS }),
    }
  )

  function refresh() {
    void entitlements.mutate()
    void subscription.mutate()
    void group.mutate()
  }

  // Reset demo: deletes everything the demo created for every owner.
  const reset = useApiForm({
    schema: resetSchema,
    action: '/api/reset',
    confirm: `Delete every subscription, receipt and group for ${OWNERS.join(', ')}, then those owner records and the ${GRANTEE_IDS.join(' and ')} grantee records? This cannot be undone.`,
    onSuccess: refresh,
  })

  // Step 3 of the guide: the owner-scoped check returns the entitlements the
  // tab's live subscription grants this user. Export PDF is on both plans; the
  // AI assistant is only on Team.
  const canExportPdf =
    entitlements.data?.entitlements.some(
      (e) => e.value === EXPORT_PDF_ENTITLEMENT
    ) ?? false
  const canUseAi =
    entitlements.data?.entitlements.some(
      (e) => e.value === AI_ASSISTANT_ENTITLEMENT
    ) ?? false

  const loaded = Boolean(
    entitlements.data &&
    subscription.data &&
    (ctx.tab === 'personal' || group.data)
  )
  const isValidating =
    entitlements.isValidating || subscription.isValidating || group.isValidating
  const error = entitlements.error ?? subscription.error ?? group.error
  const errorMessage =
    error instanceof Error ? error.message : loaded ? null : initialError

  // Stripe sends the browser back to `/?checkout=cancelled` when the reader
  // backs out of checkout. A successful checkout needs no notice: the polling
  // above updates the page on its own.
  const checkoutCancelled = router.query.checkout === 'cancelled'

  const liveSubscription = subscription.data?.subscription ?? null
  // On the Team tab, a live subscription the user is not allowed to see is
  // reported as members-only rather than returned.
  const memberOnly = subscription.data?.memberOnly ?? false
  const team = group.data?.team ?? null

  const locked = {
    tab: ctx.tab,
    granteeId: ctx.granteeId,
    subscribed: Boolean(liveSubscription) || memberOnly,
    isMember: !memberOnly,
  }

  return (
    <>
      <Head>
        <title>Salable Per-Seat Quick Start</title>
        <meta
          name="description"
          content="Demo of per-seat billing with Salable: subscribe a team, add and remove members against the seat count, and gate features per user and owner."
        />
      </Head>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {/* Identity strip: who the page is viewing as, and the owner and grantee that resolves to. */}
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
                  Salable Per-Seat Quick Start
                </h1>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Per-seat billing demo. Every panel maps to a step in the{' '}
                <a
                  className="cursor-pointer underline decoration-zinc-400 underline-offset-2 hover:decoration-current"
                  href="https://salable.app/docs/per-seat-quick-start?lang=sdk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  quick start guide
                </a>
                .
              </p>
            </div>
            <ContextSwitcher
              granteeId={ctx.granteeId}
              tab={ctx.tab}
              onChange={switchContext}
            />
            <dl className="flex flex-wrap gap-2 text-sm">
              {[
                ['Owner', owner],
                ['Grantee', ctx.granteeId],
                ['Plan', ctx.tab === 'team' ? 'Team' : 'Personal'],
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
              onClick={() => switchContext(ctx)}
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

        {!loaded && !errorMessage ? (
          <p
            role="status"
            className="rounded-xl border border-dashed border-black/15 p-5 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400"
          >
            Loading {USERS[ctx.granteeId].name}&apos;s{' '}
            {ctx.tab === 'team' ? TEAM_NAME : 'Personal'} tab from Salable…
          </p>
        ) : null}

        {loaded && subscription.data ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-6">
                {/* Step 3: two features gated on entitlements. The check is owner-scoped, so each tab answers for its own owner. */}
                <SimulatedFeature
                  key={`export-${qs}`}
                  title="Export PDF"
                  description={
                    <>
                      Gated by the{' '}
                      <code className="font-mono text-xs">
                        {EXPORT_PDF_ENTITLEMENT}
                      </code>{' '}
                      entitlement, which both plans grant. The check is for{' '}
                      <code className="font-mono text-xs">{ctx.granteeId}</code>{' '}
                      scoped to owner{' '}
                      <code className="font-mono text-xs">{owner}</code>.
                    </>
                  }
                  entitlement={EXPORT_PDF_ENTITLEMENT}
                  enabled={canExportPdf}
                  requires={
                    ctx.tab === 'team' ? 'Requires Team' : 'Requires Personal'
                  }
                  lockedHint={lockedHint({ ...locked, teamOnly: false })}
                  buttonLabel="Export notes as PDF"
                  pendingLabel="Exporting…"
                  doneMessage="Exported notes.pdf with 3 pages."
                />

                <SimulatedFeature
                  key={`ai-${qs}`}
                  title="AI assistant"
                  description={
                    <>
                      Gated by the{' '}
                      <code className="font-mono text-xs">
                        {AI_ASSISTANT_ENTITLEMENT}
                      </code>{' '}
                      entitlement, which only the Team plan grants. The same
                      user is locked out here on their Personal tab and let in
                      on {TEAM_NAME}, from one entitlement check with a
                      different owner.
                    </>
                  }
                  entitlement={AI_ASSISTANT_ENTITLEMENT}
                  enabled={canUseAi}
                  requires="Requires Team"
                  lockedHint={lockedHint({ ...locked, teamOnly: true })}
                  buttonLabel="Summarise my notes"
                  pendingLabel="Thinking…"
                  doneMessage="Summarised 3 notes into 5 bullet points."
                />
              </div>

              <div className="space-y-6">
                {memberOnly ? (
                  // Being in the group is what authorises a user to see and
                  // manage the team's subscription, so an outsider gets no
                  // details at all, only how to get in.
                  <Panel
                    title={TEAM_NAME}
                    description={
                      <>
                        The team&apos;s subscription and members are only shown
                        to members of its group. The server withheld them for{' '}
                        <code className="font-mono text-xs">
                          {ctx.granteeId}
                        </code>
                        .
                      </>
                    }
                    badge={<Badge tone="red">Not a member</Badge>}
                  >
                    <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                      Switch to a member of {TEAM_NAME} and add{' '}
                      {USERS[ctx.granteeId].name} from their members panel, then
                      come back here. No checkout is needed.
                    </p>
                  </Panel>
                ) : (
                  // Step 2: checkout for the tab's plan, or manage it once it exists.
                  <PlanPanel
                    tab={ctx.tab}
                    granteeId={ctx.granteeId}
                    owner={owner}
                    subscription={liveSubscription}
                    onChange={refresh}
                    onCancelled={() => setIsPolling(true)}
                  />
                )}
              </div>
            </div>

            {/* Step 4: the group behind the Team subscription, and who is in it. Members only. */}
            {ctx.tab === 'team' && !memberOnly ? (
              <Panel
                title={`${TEAM_NAME} members`}
                description={
                  <>
                    The group Salable created for{' '}
                    <code className="font-mono text-xs">{TEAM_OWNER}</code> at
                    checkout, with the buyer as its first member. Everyone in it
                    receives the Team plan&apos;s entitlements, and the seat
                    count caps how many can be added.
                  </>
                }
                badge={
                  team ? (
                    <Badge tone="green">Group active</Badge>
                  ) : (
                    <Badge tone="zinc">No group</Badge>
                  )
                }
              >
                {team ? (
                  <TeamMembers
                    team={team}
                    viewer={ctx.granteeId}
                    onChange={refresh}
                    onChanged={() => setIsPolling(true)}
                  />
                ) : (
                  <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
                    {liveSubscription
                      ? 'Salable is creating the group for the new subscription. The page polls for it; press Refresh if it does not appear.'
                      : `No live Team subscription. Subscribe to Team and Salable creates a group owned by ${TEAM_OWNER} with ${USERS[ctx.granteeId].name} in it.`}
                  </p>
                )}
              </Panel>
            ) : null}

            {/* Reset: test-mode-only deletes for every owner the demo can create. */}
            <footer className="rounded-xl border border-dashed border-black/15 p-5 dark:border-white/20">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-sm">
                  <h2 className="font-semibold">Reset demo</h2>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    Deletes every subscription, receipt and group for{' '}
                    {OWNERS.map((o, i) => (
                      <span key={o}>
                        {i > 0 ? ', ' : ''}
                        <code className="font-mono text-xs">{o}</code>
                      </span>
                    ))}
                    , then those owner records and both grantee records, using
                    Salable&apos;s test mode delete endpoints. Only the imported
                    product is left.
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

/** Why a feature is locked on this tab for this user, and what unlocks it. */
function lockedHint({
  tab,
  granteeId,
  subscribed,
  isMember,
  teamOnly,
}: {
  tab: Tab
  granteeId: GranteeId
  subscribed: boolean
  isMember: boolean
  /** The entitlement is only on the Team plan. */
  teamOnly: boolean
}): ReactNode {
  if (tab === 'personal') {
    return teamOnly ? (
      <>
        Only the Team plan grants it. Switch to {TEAM_NAME}, where it is
        included for every member of the group.
      </>
    ) : (
      <>Subscribe to Personal to unlock it.</>
    )
  }
  if (!subscribed) {
    return <>Subscribe to Team to unlock it for everyone in the group.</>
  }
  if (!isMember) {
    return (
      <>
        <span className="font-mono text-xs">{granteeId}</span> is not in the{' '}
        {TEAM_NAME} group. Switch to a member and add them; no checkout is
        needed.
      </>
    )
  }
  return <>Press Refresh to re-run the entitlement check.</>
}

/**
 * Step 2: a Subscribe panel until the tab's owner holds a live subscription
 * to the tab's plan, then a Manage panel for that subscription.
 */
function PlanPanel({
  tab,
  granteeId,
  owner,
  subscription,
  onChange,
  onCancelled,
}: {
  tab: Tab
  granteeId: GranteeId
  owner: string
  subscription: Subscription | null
  onChange: () => void
  onCancelled: () => void
}) {
  const name = tab === 'team' ? 'Team' : 'Personal'

  if (subscription) {
    return (
      <Panel
        title={`Manage ${name}`}
        description={
          <>
            {name} plan for owner{' '}
            <code className="font-mono text-xs">{owner}</code>.
          </>
        }
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
          planName={name}
          onChange={onChange}
          onCancelled={onCancelled}
        />
      </Panel>
    )
  }

  return (
    <Panel
      title={`Subscribe to ${name}`}
      description={
        tab === 'team' ? (
          <>
            {usd.format(TEAM_SEAT_PRICE_CENTS / 100)} per seat per month, billed
            to <code className="font-mono text-xs">{TEAM_OWNER}</code>. Checkout
            buys {TEAM_SEATS} seats (
            {usd.format((TEAM_SEAT_PRICE_CENTS * TEAM_SEATS) / 100)} per month)
            and creates a group with{' '}
            <code className="font-mono text-xs">{granteeId}</code> in it. Grants{' '}
            <code className="font-mono text-xs">{EXPORT_PDF_ENTITLEMENT}</code>{' '}
            and{' '}
            <code className="font-mono text-xs">
              {AI_ASSISTANT_ENTITLEMENT}
            </code>{' '}
            to every member.
          </>
        ) : (
          <>
            {usd.format(PERSONAL_PRICE_CENTS / 100)} per month, billed to{' '}
            <code className="font-mono text-xs">{owner}</code>. Grants the{' '}
            <code className="font-mono text-xs">{EXPORT_PDF_ENTITLEMENT}</code>{' '}
            entitlement to{' '}
            <code className="font-mono text-xs">{granteeId}</code> only.
          </>
        )
      }
      badge={<Badge tone="zinc">Not subscribed</Badge>}
    >
      <div className="space-y-3">
        <CheckoutForm
          label={`Subscribe to ${name}`}
          granteeId={granteeId}
          tab={tab}
        />
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
