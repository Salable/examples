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
import { ViewerSwitcher, TeamSwitcher } from '@/components/ContextSwitcher'
import { FormMessages } from '@/components/FormMessages'
import { ManageSubscription } from '@/components/ManageSubscription'
import { Panel } from '@/components/Panel'
import { ResourceTooltip } from '@/components/ResourceTooltip'
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
  type Team,
} from '@/lib/constants'
import {
  contextFromQuery,
  contextSearchParams,
  resolveContext,
  type Context,
} from '@/lib/context'
import { getEntitlements } from '@/lib/entitlements'
import { getTeamView } from '@/lib/group'
import type { ResourceKey } from '@/lib/resources'
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
  /** Only read in the Team ACME workspace; null in Personal. */
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
  const { granteeId, team } = contextFromQuery(query)
  const ctx = resolveContext(granteeId, team)
  const polling = query.checkout === 'success'
  try {
    // In the Team ACME workspace the subscription is part of the member-only
    // view.
    const [entitlements, view] = await Promise.all([
      getEntitlements(ctx.granteeId, ctx.owner),
      team === 'acme'
        ? getTeamView(ctx.granteeId)
        : getSubscriptionSummary(ctx.owner, ctx.team).then((subscription) => ({
            subscription,
            group: null,
          })),
    ])
    return {
      props: {
        granteeId,
        team,
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
        team,
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
  team: initialTeam,
  entitlements: initialEntitlements,
  subscription: initialSubscription,
  group: initialGroup,
  error: initialError,
  polling: initialPolling,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter()

  // The user and team live in the URL so they survive a reload and the round
  // trip to Stripe. Switching is a shallow replace: no server render, the SWR
  // keys below change and the page refetches for the new context.
  const ctx = contextFromQuery(router.query)
  const { owner } = resolveContext(ctx.granteeId, ctx.team)
  const qs = contextSearchParams(ctx)
  // The server-rendered values only apply while the context they were read
  // for is the one on screen.
  const sameAsServer =
    ctx.granteeId === initialGranteeId && ctx.team === initialTeam

  function switchContext(next: Context) {
    void router.replace(
      { pathname: '/', query: { grantee: next.granteeId, team: next.team } },
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
  // The group is only read in the Team ACME workspace, and only shown to its
  // members.
  const group = useSWR<GroupSummary>(
    ctx.team === 'acme' ? `/api/group?${qs}` : null,
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
  // team's live subscription grants this user. Export PDF is on both plans; the
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
    (ctx.team === 'personal' || group.data)
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
  // In the Team ACME workspace, a live subscription the user is not allowed to
  // see is reported as members-only rather than returned.
  const memberOnly = subscription.data?.memberOnly ?? false
  const team = group.data?.team ?? null

  const locked = {
    team: ctx.team,
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
        {/* Top bar: the team dropdown in the left corner, who the page is viewing as in the right. Together they decide the owner and grantee every Salable call is made for. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TeamSwitcher
            team={ctx.team}
            onChange={(team) => switchContext({ ...ctx, team })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <ViewerSwitcher
              granteeId={ctx.granteeId}
              onChange={(granteeId) => switchContext({ ...ctx, granteeId })}
            />
            <Button
              variant="secondary"
              onClick={refresh}
              pending={isValidating && !isPolling}
              pendingLabel="Refreshing…"
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Identity strip: the owner and grantee the context resolves to, the plan it buys and the entitlements the demo gates on. Each term reveals its definition. */}
        <header className="space-y-3">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/salable.svg" alt="Salable" width={36} height={36} />
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
          <dl className="flex flex-wrap gap-2 text-sm">
            {(
              [
                ['owner', owner],
                ['grantee', ctx.granteeId],
                ['plan', ctx.team === 'acme' ? 'Team' : 'Personal'],
                [
                  'entitlement',
                  [EXPORT_PDF_ENTITLEMENT, AI_ASSISTANT_ENTITLEMENT].join(', '),
                ],
              ] satisfies [ResourceKey, string][]
            ).map(([resource, value]) => (
              <div
                key={resource}
                className="flex items-center gap-1.5 rounded-md border border-black/10 bg-zinc-50 px-2.5 py-1 dark:border-white/15 dark:bg-zinc-900"
              >
                <dt>
                  <ResourceTooltip resource={resource} />
                </dt>
                <dd className="font-mono text-xs font-medium">{value}</dd>
              </div>
            ))}
          </dl>
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
            {ctx.team === 'acme' ? TEAM_NAME : 'Personal'} workspace from
            Salable…
          </p>
        ) : null}

        {loaded && subscription.data ? (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-6">
                {/* Step 3: two features gated on entitlements. The check is owner-scoped, so each team answers for its own owner. */}
                <SimulatedFeature
                  key={`export-${qs}`}
                  title="Export PDF"
                  description={
                    <>
                      Gated by the{' '}
                      <code className="font-mono text-xs">
                        {EXPORT_PDF_ENTITLEMENT}
                      </code>{' '}
                      entitlement, which both plans grant. The check is for the
                      grantee{' '}
                      <code className="font-mono text-xs">{ctx.granteeId}</code>{' '}
                      scoped to the owner{' '}
                      <code className="font-mono text-xs">{owner}</code>.
                    </>
                  }
                  entitlement={EXPORT_PDF_ENTITLEMENT}
                  enabled={canExportPdf}
                  requires={
                    ctx.team === 'acme' ? 'Requires Team' : 'Requires Personal'
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
                      user is locked out here in their Personal workspace and
                      let in on {TEAM_NAME}, from one entitlement check with a
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
                  // Step 2: checkout for the team's plan, or manage it once it
                  // exists.
                  <PlanPanel
                    team={ctx.team}
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
            {ctx.team === 'acme' && !memberOnly ? (
              <Panel
                title={`${TEAM_NAME} members`}
                description={
                  <>
                    The group Salable created for the owner{' '}
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

/** Why a feature is locked in this team for this user, and what unlocks it. */
function lockedHint({
  team,
  granteeId,
  subscribed,
  isMember,
  teamOnly,
}: {
  team: Team
  granteeId: GranteeId
  subscribed: boolean
  isMember: boolean
  /** The entitlement is only on the Team plan. */
  teamOnly: boolean
}): ReactNode {
  if (team === 'personal') {
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
 * Step 2: a Subscribe panel until the team's owner holds a live subscription
 * to the team's plan, then a Manage panel for that subscription.
 */
function PlanPanel({
  team,
  granteeId,
  owner,
  subscription,
  onChange,
  onCancelled,
}: {
  team: Team
  granteeId: GranteeId
  owner: string
  subscription: Subscription | null
  onChange: () => void
  onCancelled: () => void
}) {
  const name = team === 'acme' ? 'Team' : 'Personal'

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
        team === 'acme' ? (
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
            {usd.format(PERSONAL_PRICE_CENTS / 100)} per month, billed to the
            owner <code className="font-mono text-xs">{owner}</code>. Grants the{' '}
            <code className="font-mono text-xs">{EXPORT_PDF_ENTITLEMENT}</code>{' '}
            entitlement to the grantee{' '}
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
          team={team}
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
