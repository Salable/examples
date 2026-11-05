import { GRANTEE_IDS, TABS, TEAM_NAME, USERS, type Tab } from '@/lib/constants'
import type { Context } from '@/lib/context'

type Props = Context & {
  onChange: (next: Context) => void
}

const TAB_LABELS: Record<Tab, string> = {
  personal: 'Personal',
  team: TEAM_NAME,
}

/**
 * Picks who the page is viewing as and which tab is open. Together they decide
 * the grantee and owner every Salable call is made for.
 */
export function ContextSwitcher({ granteeId, tab, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
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
              onClick={() => onChange({ granteeId: id, tab })}
              className={segment(id === granteeId)}
            >
              {USERS[id].name}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Workspace"
        className="inline-flex rounded-md border border-black/15 p-0.5 dark:border-white/20"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === tab}
            onClick={() => onChange({ granteeId, tab: t })}
            className={segment(t === tab)}
          >
            {TAB_LABELS[t]}
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
