import { z } from 'zod'
import { GRANTEE_IDS, TEAMS } from './constants'

/**
 * Which user and team a request is for. The owner is derived server-side from
 * these (see `resolveContext`), so a request can never name an owner directly.
 */
export const contextSchema = z.object({
  granteeId: z.enum(GRANTEE_IDS),
  team: z.enum(TEAMS),
})

/** Checkout buys the team's plan for the user, so it needs nothing more. */
export const checkoutSchema = contextSchema

/** Export PDF: how many exports to record against the team's meter. */
export const recordUsageSchema = contextSchema.extend({
  increment: z
    .number({ error: 'Enter how many notes to export' })
    .int({ error: 'Must be a whole number' })
    .positive({ error: 'Must be at least 1' }),
})

/** AI assistant: how many credits to consume from the team's token balance. */
export const consumeTokensSchema = contextSchema.extend({
  amount: z
    .number({ error: 'Enter how many credits to spend' })
    .int({ error: 'Must be a whole number' })
    .positive({ error: 'Must be at least 1' }),
})

/**
 * Add or remove one of the demo users in the team's group. `viewer` is the
 * user making the change, who must already be in the group; in a real app it
 * would come from the session rather than the request.
 */
export const memberActionSchema = z.object({
  viewer: z.enum(GRANTEE_IDS),
  granteeId: z.enum(GRANTEE_IDS),
  action: z.enum(['add', 'remove']),
})

export const subscriptionIdSchema = z.object({
  id: z.string().min(1),
})

export const autoRenewSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['enable', 'disable']),
})

export const resetSchema = z.object({
  confirm: z.literal('yes'),
})

/** Error body every API route returns on a non-2xx status. */
export const apiErrorSchema = z.object({
  error: z.string(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
})
