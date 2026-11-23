import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-foreground text-background hover:opacity-90 focus-visible:outline-foreground',
  secondary:
    'border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10 focus-visible:outline-foreground',
  danger:
    'border border-red-500/40 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 focus-visible:outline-red-500',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  pending?: boolean
  pendingLabel?: ReactNode
}

export function Button({
  variant = 'primary',
  pending = false,
  pendingLabel,
  children,
  className = '',
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}
