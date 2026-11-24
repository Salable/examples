import type {
  CheckEntitlementsSchema_data_entitlements,
  GetSubscriptionInvoicesSchema_data,
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
    | 'status'
    | 'startDate'
    | 'cancelAtPeriodEnd'
    | 'cancelledAt'
    | 'isPerpetual'
    | 'ownerId'
  >
> & { id: NonNullable<GetSubscriptionListSchema_data['id']> }

/** Stripe's invoice statuses, as returned by the subscription invoices endpoint. */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'

/**
 * One row of a subscription's invoice list. While the subscription is set to
 * renew the list also previews the upcoming invoice, which has no number and
 * no hosted or PDF link yet.
 */
export type Invoice = Required<
  Pick<
    GetSubscriptionInvoicesSchema_data,
    | 'number'
    | 'created'
    | 'periodStart'
    | 'periodEnd'
    | 'total'
    | 'currency'
    | 'hostedInvoiceUrl'
    | 'invoicePdf'
    | 'billingReason'
  >
> & { id: string; status: InvoiceStatus | null; upcoming: boolean }

export type SubscriptionSummary = {
  /** The owner's live Pro subscription, or null when not subscribed. */
  pro: Subscription | null
}

/** Error body returned by every API route on a non-2xx status. */
export type ApiErrorResponse = z.infer<typeof apiErrorSchema>
