import type { ParsedUrlQuery } from 'node:querystring'
import {
  GRANTEE_IDS,
  TEAMS,
  TEAM_OWNER,
  type GranteeId,
  type Team,
} from './constants'

/** Which user the page is viewing as and which team is open. */
export type Context = { granteeId: GranteeId; team: Team }

/** A context plus the owner it resolves to. */
export type DemoContext = Context & { owner: string }

/**
 * The owner is derived here and never read from a request. In the Personal
 * workspace the user is their own owner, so each user can hold their own
 * Personal subscription; in Team ACME the owner is `team_acme`, which every
 * member of the team shares.
 */
export function resolveContext(granteeId: GranteeId, team: Team): DemoContext {
  return { granteeId, team, owner: team === 'acme' ? TEAM_OWNER : granteeId }
}

/**
 * Lenient parse of the page's `?grantee=&team=` query, defaulting to Alice's
 * Personal workspace. The API routes use the strict `contextSchema` instead.
 */
export function contextFromQuery(query: ParsedUrlQuery): Context {
  const grantee = first(query.grantee)
  const team = first(query.team)
  return {
    granteeId: isGranteeId(grantee) ? grantee : GRANTEE_IDS[0],
    team: isTeam(team) ? team : TEAMS[0],
  }
}

/** Query string for the context-scoped API routes, also used as the SWR key. */
export function contextSearchParams({ granteeId, team }: Context): string {
  return new URLSearchParams({ granteeId, team }).toString()
}

/** The other demo user, i.e. the one a member can add to the team. */
export function otherGrantee(granteeId: GranteeId): GranteeId {
  return granteeId === 'user_alice' ? 'user_bob' : 'user_alice'
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function isGranteeId(value: string | undefined): value is GranteeId {
  return (GRANTEE_IDS as readonly string[]).includes(value ?? '')
}

function isTeam(value: string | undefined): value is Team {
  return (TEAMS as readonly string[]).includes(value ?? '')
}
