import type { ReactNode } from 'react'

type Props = {
  title: string
  description?: ReactNode
  badge?: ReactNode
  className?: string
  children: ReactNode
}

export function Panel({
  title,
  description,
  badge,
  className = '',
  children,
}: Props) {
  return (
    <section
      className={`rounded-xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/15 dark:bg-zinc-950 ${className}`}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {description}
            </p>
          ) : null}
        </div>
        {badge}
      </header>
      {children}
    </section>
  )
}
