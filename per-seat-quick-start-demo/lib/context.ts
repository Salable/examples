import type { ParsedUrlQuery } from 'node:querystring'
import {
  GRANTEE_IDS,
  TABS,
  TEAM_OWNER,
  type GranteeId,
  type Tab,
} from './constants'

/** Which user the page is viewing as and which tab is open. */
export type Context = { granteeId: GranteeId; tab: Tab }

/** A context plus the owner it resolves to. */
export type DemoContext = Context & { owner: string }

/**
 * The owner is derived here and never read from a request. On the Personal
 * tab the user is their own owner, so each user can hold their own Personal
 * subscription; on the Team tab the owner is `team_acme`, which every member
 * of the team shares.
 */
export function resolveContext(granteeId: GranteeId, tab: Tab): DemoContext {
  return { granteeId, tab, owner: tab === 'team' ? TEAM_OWNER : granteeId }
}

/**
 * Lenient parse of the page's `?grantee=&tab=` query, defaulting to Alice's
 * Personal tab. The API routes use the strict `contextSchema` instead.
 */
export function contextFromQuery(query: ParsedUrlQuery): Context {
  const grantee = first(query.grantee)
  const tab = first(query.tab)
  return {
    granteeId: isGranteeId(grantee) ? grantee : GRANTEE_IDS[0],
    tab: isTab(tab) ? tab : TABS[0],
  }
}

/** Query string for the context-scoped API routes, also used as the SWR key. */
export function contextSearchParams({ granteeId, tab }: Context): string {
  return new URLSearchParams({ granteeId, tab }).toString()
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

function isTab(value: string | undefined): value is Tab {
  return (TABS as readonly string[]).includes(value ?? '')
}
