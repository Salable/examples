// Hardcoded identifiers for the Salable per-seat quick start guide:
// https://salable.app/docs/per-seat-quick-start?lang=sdk
//
// The guide uses one owner and one grantee. This demo has two grantees who can
// each hold a Personal subscription and share a Team one, so the owner depends
// on which tab is open (see `lib/context.ts`).

/** The two users you can view the app as. Both are grantees in Salable. */
export const USERS = {
  user_alice: { id: 'user_alice', name: 'Alice Smith' },
  user_bob: { id: 'user_bob', name: 'Bob Johnson' },
} as const
export const GRANTEE_IDS = ['user_alice', 'user_bob'] as const
export type GranteeId = (typeof GRANTEE_IDS)[number]

/**
 * The two tabs. Personal is owned by the user themselves; Team is owned by
 * `team_acme` and shared by everyone in its group.
 */
export const TABS = ['personal', 'team'] as const
export type Tab = (typeof TABS)[number]
export const TEAM_OWNER = 'team_acme'
export const TEAM_NAME = 'Team ACME'

/** The Team plan's per-seat line item and how many seats checkout buys. */
export const TEAM_SEATS_SLUG = 'team_seats'
export const TEAM_SEATS = 2

/** Granted by both plans: unlocks the simulated Export PDF feature. */
export const EXPORT_PDF_ENTITLEMENT = 'export_pdf'
/** Granted by the Team plan only: unlocks the simulated AI assistant. */
export const AI_ASSISTANT_ENTITLEMENT = 'ai_assistant'

/** Monthly prices in cents: Personal is flat, Team is per seat. */
export const PERSONAL_PRICE_CENTS = 900
export const TEAM_SEAT_PRICE_CENTS = 1200

/** Server-only: plan IDs printed by `npm run import:salable-product`. */
export function getPlanIds(): Record<Tab, string> {
  const personal = process.env.SALABLE_PERSONAL_PLAN_ID
  const team = process.env.SALABLE_TEAM_PLAN_ID

  if (!personal || !team) {
    throw new Error(
      'Missing SALABLE_PERSONAL_PLAN_ID and/or SALABLE_TEAM_PLAN_ID. Run `npm run import:salable-product` and copy the printed values into .env.local.'
    )
  }

  return { personal, team }
}
