import {
  GRANTEE_IDS,
  TEAMS,
  TEAM_NAME,
  USERS,
  type GranteeId,
  type Team,
} from '@/lib/constants'

const TEAM_LABELS: Record<Team, string> = {
  personal: 'Personal',
  acme: TEAM_NAME,
}

/**
 * Dropdown for which team is open: the user's own Personal workspace or the
 * shared Team ACME one, as a vendor's team switcher would offer. Together
 * with `ViewerSwitcher` it decides the grantee and owner every Salable call is
 * made for.
 */
export function TeamSwitcher({
  team,
  onChange,
}: {
  team: Team
  onChange: (team: Team) => void
}) {
  return (
    <span className="relative inline-flex">
      <select
        aria-label="Team"
        value={team}
        onChange={(event) => onChange(event.target.value as Team)}
        className="cursor-pointer appearance-none rounded-md border border-black/15 bg-transparent py-2 pr-9 pl-3 text-sm font-medium transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground dark:border-white/20 dark:hover:bg-white/10"
      >
        {TEAMS.map((t) => (
          <option key={t} value={t}>
            {TEAM_LABELS[t]}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500"
      >
        <path
          d="M4 6l4 4 4-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

/** Segmented control for which user the page is viewing as. */
export function ViewerSwitcher({
  granteeId,
  onChange,
}: {
  granteeId: GranteeId
  onChange: (granteeId: GranteeId) => void
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">Viewing as</span>
      <div
        role="group"
        aria-label="Viewing as"
        className="inline-flex rounded-md border border-black/15 p-0.5 dark:border-white/20"
      >
        {GRANTEE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === granteeId}
            onClick={() => onChange(id)}
            className={segment(id === granteeId)}
          >
            {USERS[id].name}
          </button>
        ))}
      </div>
    </div>
  )
}

function segment(selected: boolean) {
  return `cursor-pointer rounded px-3 py-1.5 text-sm font-medium transition-colors ${
    selected
      ? 'bg-foreground text-background'
      : 'text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10'
  }`
}
