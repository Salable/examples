// Hardcoded identifiers. The owner and grantee match the Salable token and
// usage quick start guides so this demo can share a Salable organisation with
// them:
// https://salable.app/docs/token-quick-start?lang=sdk
// https://salable.app/docs/usage-quick-start?lang=sdk
export const OWNER = 'company_acme'
export const GRANTEE = 'user_alice'
/**
 * The Pro plan's token line item grants tokens under this slug and its metered
 * line item records usage against a meter with the same slug. Consuming tries
 * the tokens first and falls back to the meter once they are exhausted.
 *
 * An owner-scoped entitlement check returns both as separate entries with
 * this value: `{ type: 'token', ... }` and `{ type: 'meter', ... }`. Checking
 * type as well as value is what tells them apart, and together they unlock
 * generating images; no separate entitlement is needed.
 */
export const TOKEN_SLUG = 'image_generations'
export const METER_SLUG = 'image_generations'
/** Tokens the Pro plan grants each billing cycle. */
export const INCLUDED_TOKENS = 1000
/** The Pro plan's monthly price for the included tokens, in cents. */
export const PLAN_AMOUNT_CENTS = 2900
/** The Pro plan's metered price for one overage image generation, in cents. */
export const OVERAGE_UNIT_AMOUNT_CENTS = 10

/** Server-only: the Pro plan ID printed by `npm run import:salable-product`. */
export function getProPlanId(): string {
  const pro = process.env.SALABLE_PRO_PLAN_ID

  if (!pro) {
    throw new Error(
      'Missing SALABLE_PRO_PLAN_ID. Run `npm run import:salable-product` and copy the printed value into .env.local.'
    )
  }

  return pro
}
