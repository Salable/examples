// Hardcoded identifiers that match the Salable token quick start guide:
// https://salable.app/docs/token-quick-start?lang=sdk
export const OWNER = 'company_acme'
export const GRANTEE = 'user_alice'
export const TOKEN_SLUG = 'image_tokens'
/** Granted by both plans: unlocks consuming tokens. */
export const GENERATE_ENTITLEMENT = 'generate_images'
/** Granted by the Starter plan only: unlocks the Export HD feature. */
export const EXPORT_HD_ENTITLEMENT = 'export_hd'

export type PlanKey = 'starter' | 'topup'

/** Server-only: plan IDs printed by `npm run import:salable-product`. */
export function getPlanIds(): Record<PlanKey, string> {
  const starter = process.env.SALABLE_STARTER_PLAN_ID
  const topup = process.env.SALABLE_TOP_UP_PLAN_ID

  if (!starter || !topup) {
    throw new Error(
      'Missing SALABLE_STARTER_PLAN_ID and/or SALABLE_TOP_UP_PLAN_ID. Run `npm run import:salable-product` and copy the printed values into .env.local.'
    )
  }

  return { starter, topup }
}
