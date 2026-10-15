import type {
  CheckEntitlementsSchema_data_entitlements,
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

export type Entitlement = Required<
  Pick<
    CheckEntitlementsSchema_data_entitlements,
    'value' | 'type' | 'expiryDate'
  >
>

export type Subscription = Required<
  Pick<
    GetSubscriptionListSchema_data,
    'status' | 'startDate' | 'cancelAtPeriodEnd' | 'cancelledAt' | 'isPerpetual'
  >
> & { id: NonNullable<GetSubscriptionListSchema_data['id']> }

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

/**
 * A usage record's lifecycle: `current` while the billing period is open,
 * `final` once the period ends (or the subscription is cancelled immediately)
 * and the count has been invoiced.
 */
export type UsageRecordStatus = 'recorded' | 'current' | 'final'

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

export type SubscriptionSummary = {
  /** The owner's live Pro subscription, or null when not subscribed. */
  pro: Subscription | null
}

/**
 * How `/api/consume` billed a request: `tokens` when the included balance
 * covered it, `usage` when the balance was exhausted and the whole amount was
 * recorded against the meter as overage.
 */
export type BilledAs = 'tokens' | 'usage'

export type ConsumeResponse = {
  message: string
  billedAs: BilledAs
}

/** Error body returned by every API route on a non-2xx status. */
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
