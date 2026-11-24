import { getSalable } from './salable'
import type { Invoice, InvoiceStatus } from './types'

const INVOICE_STATUSES: ReadonlySet<string> = new Set<InvoiceStatus>([
  'draft',
  'open',
  'paid',
  'uncollectible',
  'void',
])

/**
 * The invoices Stripe has raised for a subscription, newest first, plus a
 * preview of the next one while the subscription is set to renew. Salable
 * rejects the call for perpetual and Salable-only subscriptions, which never
 * have invoices.
 */
export async function getInvoices(subscriptionId: string): Promise<Invoice[]> {
  const response = await getSalable()
    .api.subscriptions.byId(subscriptionId)
    .invoices.get()

  return (response?.data ?? []).map((invoice) => ({
    id: invoice.id ?? 'upcoming',
    number: invoice.number ?? null,
    status: isInvoiceStatus(invoice.status) ? invoice.status : null,
    created: invoice.created ?? null,
    periodStart: invoice.periodStart ?? null,
    periodEnd: invoice.periodEnd ?? null,
    total: invoice.total ?? null,
    currency: invoice.currency ?? null,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl ?? null,
    invoicePdf: invoice.invoicePdf ?? null,
    billingReason: invoice.billingReason ?? null,
    upcoming: invoice.billingReason === 'upcoming',
  }))
}

function isInvoiceStatus(
  value: string | null | undefined
): value is InvoiceStatus {
  return INVOICE_STATUSES.has(value ?? '')
}
