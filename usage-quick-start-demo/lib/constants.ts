// Hardcoded identifiers that match the Salable usage quick start guide:
// https://salable.app/docs/usage-quick-start?lang=sdk
export const OWNER = 'company_acme'
export const GRANTEE = 'user_alice'
/** The meter the Pro plan's metered line item records usage against. */
export const METER_SLUG = 'image_generations'
/** Granted by the Pro plan only: unlocks generating images (recording usage). */
export const GENERATE_ENTITLEMENT = 'image_generations'
/** Also granted by the Pro plan: unlocks the simulated Export HD feature. */
export const EXPORT_HD_ENTITLEMENT = 'high_resolution_exports'
/** Granted by the Pro plan. Display only; nothing in the demo is gated on it. */
export const PRIORITY_ENTITLEMENT = 'priority_processing'
/** The Pro plan's per-unit price for one image generation, in cents. */
export const UNIT_AMOUNT_CENTS = 10

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
