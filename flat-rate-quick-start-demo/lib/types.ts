import type {
  CheckEntitlementsSchema_data_entitlements,
  GetSubscriptionListSchema_data,
} from '@salable/sdk/dist/sdk/models'
import type { z } from 'zod'
import type { apiErrorSchema } from './schemas'

// The page's state is built from the SDK's response models, narrowed to the
// fields it displays. The readers in `lib/` replace `undefined` with `null` so
// the state survives `getServerSideProps` serialisation, hence
// `Required<Pick<>>`. Identifiers the page relies on are additionally
// non-null.

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
> & { id: NonNullable<GetSubscriptionListSchema_data['id']> }

export type SubscriptionSummary = {
  /** The owner's live Pro subscription, or null when not subscribed. */
  pro: Subscription | null
}

/** Error body returned by every API route on a non-2xx status. */
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
