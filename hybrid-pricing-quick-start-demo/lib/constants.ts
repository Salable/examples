// Hardcoded identifiers for the Salable hybrid pricing quick start guide:
// https://salable.app/docs/hybrid-pricing-quick-start?lang=sdk
//
// The guide uses one owner and one grantee. This demo has two grantees who can
// each hold a Personal subscription and share a Team one, so the owner depends
// on which team is open (see `lib/context.ts`).

/** The two users you can view the app as. Both are grantees in Salable. */
export const USERS = {
  user_alice: { id: 'user_alice', name: 'Alice Smith' },
  user_bob: { id: 'user_bob', name: 'Bob Johnson' },
} as const
export const GRANTEE_IDS = ['user_alice', 'user_bob'] as const
export type GranteeId = (typeof GRANTEE_IDS)[number]

/**
 * The two teams. Personal is owned by the user themselves; Team is owned by
 * `team_acme` and shared by everyone in its group.
 */
export const TEAMS = ['personal', 'acme'] as const
export type Team = (typeof TEAMS)[number]
export const TEAM_OWNER = 'team_acme'
export const TEAM_NAME = 'Team ACME'

/** The Team plan's per-seat line item and how many seats checkout buys. */
export const TEAM_SEATS_SLUG = 'hybrid_team_seats'
export const TEAM_SEATS = 2

/**
 * The meter both plans bill PDF exports against. Recording usage names the
 * meter and the owner; the owner's subscription decides which plan's rate
 * applies.
 */
export const METER_SLUG = 'pdf_exports'

/** The token the Team plan allocates every cycle, which the AI assistant consumes. */
export const TOKEN_SLUG = 'ai_credits'
export const TEAM_AI_CREDITS = 100

/** Monthly prices in cents: Personal is flat, Team is per seat plus the AI credits bundle. */
export const PERSONAL_PRICE_CENTS = 900
export const TEAM_SEAT_PRICE_CENTS = 1200
export const TEAM_AI_CREDITS_PRICE_CENTS = 500

/** What one PDF export costs on each plan, in cents. Same meter, different line item. */
export const EXPORT_UNIT_CENTS: Record<Team, number> = {
  personal: 25,
  acme: 10,
}

/** Server-only: plan IDs printed by `npm run import:salable-product`. */
export function getPlanIds(): Record<Team, string> {
  const personal = process.env.SALABLE_PERSONAL_PLAN_ID
  const team = process.env.SALABLE_TEAM_PLAN_ID

  if (!personal || !team) {
    throw new Error(
      'Missing SALABLE_PERSONAL_PLAN_ID and/or SALABLE_TEAM_PLAN_ID. Run `npm run import:salable-product` and copy the printed values into .env.local.'
    )
  }

  return { personal, acme: team }
}
