// Hardcoded identifiers that match the Salable flat-rate quick start guide:
// https://salable.app/docs/flat-rate-quick-start?lang=sdk
export const OWNER = 'company_acme'
export const GRANTEE = 'user_alice'
/**
 * The only entitlement the Pro plan grants: unlocks the simulated ad-free
 * player. It is the entitlement the guide's check looks for. An owner-scoped
 * entitlement check returns it as
 * `{ type: 'entitlement', value: 'ad_free_listening' }`.
 */
export const AD_FREE_ENTITLEMENT = 'ad_free_listening'
/** The Pro plan's flat monthly price, in cents. Display only. */
export const PLAN_AMOUNT_CENTS = 2000

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
