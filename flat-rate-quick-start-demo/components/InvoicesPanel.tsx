import type { Invoice, InvoiceStatus } from '@/lib/types'
import { Badge, type BadgeTone } from './Badge'
import { Panel } from './Panel'

type Props = {
  /** Undefined until the first fetch resolves. */
  invoices: Invoice[] | undefined
  error: unknown
  isLoading: boolean
}

const STATUS_TONES: Record<InvoiceStatus, BadgeTone> = {
  draft: 'amber',
  open: 'amber',
  paid: 'green',
  uncollectible: 'red',
  void: 'zinc',
}

/**
 * The invoices Stripe has raised for the live subscription, with links to the
 * hosted invoice and its PDF, plus a preview of the next one. The preview has
 * no number or links yet and disappears once auto-renew is turned off.
 */
export function InvoicesPanel({ invoices, error, isLoading }: Props) {
  const issued = invoices?.filter((invoice) => !invoice.upcoming).length ?? 0

  return (
    <Panel
      title="Invoices"
      description="Historic invoices for your subscription, plus a preview of the upcoming one and its cost while auto-renew is on. Stripe hosts each invoice to view online or download as a PDF."
      badge={
        <Badge tone={issued ? 'green' : 'zinc'}>
          {issued} {issued === 1 ? 'invoice' : 'invoices'}
        </Badge>
      }
    >
      {error ? (
        <p className="rounded-md border border-dashed border-red-300 p-4 text-sm text-red-700 dark:border-red-500/40 dark:text-red-300">
          {error instanceof Error ? error.message : 'Could not load invoices'}
        </p>
      ) : !invoices ? (
        <p className="text-sm text-zinc-500">
          {isLoading ? 'Loading invoices…' : 'Invoices not loaded.'}
        </p>
      ) : invoices.length === 0 ? (
        <p className="rounded-md border border-dashed border-black/15 p-4 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-400">
          No invoices yet. Stripe raises the first one when checkout completes.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-black/10 dark:border-white/15">
                <th className="py-2 pr-4 font-medium">Invoice</th>
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Period</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Total</th>
                <th className="py-2 font-medium">Links</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-black/5 last:border-0 dark:border-white/10"
                >
                  <td className="py-2 pr-4 font-mono text-xs">
                    {invoice.upcoming
                      ? 'Upcoming'
                      : (invoice.number ?? invoice.id)}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {formatDate(invoice.created)}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {formatDate(invoice.periodStart)} –{' '}
                    {formatDate(invoice.periodEnd)}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge
                      tone={
                        invoice.upcoming || !invoice.status
                          ? 'zinc'
                          : STATUS_TONES[invoice.status]
                      }
                    >
                      {invoice.upcoming
                        ? 'upcoming'
                        : (invoice.status ?? 'unknown')}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 tabular-nums">
                    {formatAmount(invoice.total, invoice.currency)}
                  </td>
                  <td className="py-2">
                    {invoice.hostedInvoiceUrl || invoice.invoicePdf ? (
                      <span className="flex gap-3">
                        {invoice.hostedInvoiceUrl ? (
                          <a
                            className="underline decoration-zinc-400 underline-offset-2 hover:decoration-current"
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </a>
                        ) : null}
                        {invoice.invoicePdf ? (
                          <a
                            className="underline decoration-zinc-400 underline-offset-2 hover:decoration-current"
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            PDF
                          </a>
                        ) : null}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/** Stripe sends dates as unix seconds. */
function formatDate(seconds: number | null): string {
  return seconds ? new Date(seconds * 1000).toLocaleDateString() : '—'
}

/** Stripe sends amounts in the currency's minor unit; the demo plans bill in USD. */
function formatAmount(total: number | null, currency: string | null): string {
  if (total === null || !currency) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(total / 100)
}
