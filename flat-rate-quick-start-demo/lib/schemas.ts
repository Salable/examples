import { z } from 'zod'

export const playSchema = z.object({
  track: z
    .string({ error: 'Choose a track' })
    .min(1, { error: 'Choose a track' }),
})

export const checkoutSchema = z.object({
  plan: z.literal('pro'),
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
