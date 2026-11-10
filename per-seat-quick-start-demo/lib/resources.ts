/**
 * Short definitions for the Salable resources named in the identity strip at
 * the top of the page. Each links to its entry in the core concepts guide.
 */
export type ResourceKey =
  'owner' | 'grantee' | 'plan' | 'entitlement' | 'meter' | 'token'

export type Resource = {
  label: string
  /** Used in the "Learn more about …" link. */
  plural: string
  description: string
  href: string
}

const CORE_CONCEPTS = 'https://salable.app/docs/core-concepts'

export const RESOURCES: Record<ResourceKey, Resource> = {
  owner: {
    label: 'Owner',
    plural: 'Owners',
    description:
      'The tenant that holds the subscription and is billed for it. Checkouts, subscriptions, and entitlement checks are all scoped to an owner.',
    href: `${CORE_CONCEPTS}#owner`,
  },
  grantee: {
    label: 'Grantee',
    plural: 'Grantees',
    description:
      'The user or entity whose access is being checked. An entitlement check asks what a grantee can do within an owner.',
    href: `${CORE_CONCEPTS}#grantee`,
  },
  plan: {
    label: 'Plan',
    plural: 'Plans',
    description:
      'The purchasable bundle an owner subscribes to. A plan belongs to one product and holds the line items that set its price, such as a flat fee or a per-seat charge.',
    href: `${CORE_CONCEPTS}#plan`,
  },
  entitlement: {
    label: 'Entitlement',
    plural: 'Entitlements',
    description:
      'A string value that a plan grants. The entitlement check returns it so the app can unlock the feature it represents.',
    href: `${CORE_CONCEPTS}#entitlement`,
  },
  meter: {
    label: 'Meter',
    plural: 'Meters',
    description:
      'What recorded usage is counted against. A metered line item bills the owner at the end of each period for the usage recorded on that meter.',
    href: `${CORE_CONCEPTS}#meter-slug`,
  },
  token: {
    label: 'Token',
    plural: 'Tokens',
    description:
      'A unit of prepaid consumption. A token line item allocates a balance that the app deducts from each time the owner consumes.',
    href: `${CORE_CONCEPTS}#token`,
  },
}
