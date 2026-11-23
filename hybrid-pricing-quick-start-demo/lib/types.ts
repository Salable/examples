import type {
  CheckEntitlementsSchema_data_entitlements,
  GetGroupDetailSchema_data_memberships_data,
  GetSubscriptionListSchema_data,
  GetTokenBalanceListSchema_data,
  GetTokenBalanceListSchema_data_records,
  GetUsageListSchema_data,
} from '@salable/sdk/dist/sdk/models'
import type { z } from 'zod'
import type { apiErrorSchema } from './schemas'

// The page's state is built from the SDK's response models, narrowed to the
// fields it displays. The readers in `lib/` replace `undefined` with `null` so
// the state survives `getServerSideProps` serialisation, hence
// `Required<Pick<>>`. Identifiers and totals the page relies on are
// additionally non-null.

/** What an entry in the entitlement check represents. Token and meter entries are only returned for owner-scoped checks. */
export type EntitlementType = 'entitlement' | 'meter' | 'token'

export type Entitlement = Omit<
  Required<
    Pick<
      CheckEntitlementsSchema_data_entitlements,
      'value' | 'type' | 'expiryDate'
    >
  >,
  'type'
> & { type: EntitlementType | null }

export type Subscription = Required<
  Pick<
    GetSubscriptionListSchema_data,
    'status' | 'startDate' | 'cancelAtPeriodEnd' | 'cancelledAt' | 'isPerpetual'
  >
> & {
  id: NonNullable<GetSubscriptionListSchema_data['id']>
  /** The group the subscription's plan grants access to. Salable creates it at checkout. */
  groupId: string | null
}

export type SubscriptionSummary = {
  /** The owner's live subscription to the team's plan; null when not subscribed. */
  subscription: Subscription | null
  /**
   * True in the Team ACME workspace when the team has a live subscription but
   * the user is not in its group, so the subscription is withheld from them.
   */
  memberOnly: boolean
}

/** A grantee in the team's group. */
export type TeamMember = {
  granteeId: string
  name: string | null
  /** When the membership was created. */
  joinedAt: NonNullable<
    GetGroupDetailSchema_data_memberships_data['createdAt']
  > | null
}

/** The group behind the live Team subscription, with its members and seats. */
export type TeamSummary = {
  groupId: string
  name: string | null
  /** Seats bought on the Team plan's per-seat line item, i.e. the most members the group can hold. */
  seats: number | null
  /** Every member, oldest first. */
  members: TeamMember[]
}

export type GroupSummary = {
  /** The group behind the live Team subscription, or null without one. */
  team: TeamSummary | null
  /** True when the user is not in the group, so the members are withheld from them. */
  memberOnly: boolean
}

/** The Team ACME workspace as one user is allowed to see it. */
export type TeamView = {
  subscription: SubscriptionSummary
  group: GroupSummary
}

/**
 * A usage record's lifecycle: `current` while the billing period is open,
 * `final` once the period ends (or the subscription is cancelled immediately)
 * and the count has been invoiced.
 */
export type UsageRecordStatus = 'recorded' | 'current' | 'final' | 'overage'

export type UsageRecord = Required<
  Pick<GetUsageListSchema_data, 'recordedAt' | 'createdAt' | 'updatedAt'>
> & {
  id: NonNullable<GetUsageListSchema_data['id']>
  count: NonNullable<GetUsageListSchema_data['count']>
  // The SDK types `status` as an untyped node; `lib/usage.ts` narrows it.
  status: UsageRecordStatus | null
}

export type UsageSummary = {
  /** The open record for the current billing period, or null without a metered subscription. */
  current: UsageRecord | null
  /** Every record returned for the owner and meter, newest first. */
  records: UsageRecord[]
}

export type TokenRecord = Required<
  Pick<
    GetTokenBalanceListSchema_data_records,
    'recordId' | 'remaining' | 'expiresAt' | 'source'
  >
>

export type TokenBalance = {
  balance: NonNullable<GetTokenBalanceListSchema_data['balance']>
  records: TokenRecord[]
}

/** Error body returned by every API route on a non-2xx status. */
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
