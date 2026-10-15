import type {
  CheckEntitlementsSchema_data_entitlements,
  GetSubscriptionListSchema_data,
  GetTokenBalanceListSchema_data,
  GetTokenBalanceListSchema_data_records,
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

export type SubscriptionSummary = {
  /** The owner's live Starter subscription, or null when not subscribed. */
  starter: Subscription | null
}

/** Error body returned by every API route on a non-2xx status. */
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
