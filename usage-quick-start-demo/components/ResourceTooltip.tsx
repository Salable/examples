import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
} from 'react'
import { RESOURCES, type ResourceKey } from '@/lib/resources'

// Keep the popover this far inside the viewport, and this far from the word.
const VIEWPORT_MARGIN = 16
const GAP = 8

type Placement = 'above' | 'below'
type Position = { left: number; top: number; placement: Placement }

type Props = {
  resource: ResourceKey
}

/**
 * A resource term with a definition popover, mirroring the resource tooltips
 * in the Salable docs: the word is the only trigger, it reveals on hover on
 * pointer devices and on tap on touch devices, and Escape dismisses it.
 *
 * The popover is `position: fixed` and clamped to the viewport, so it never
 * overflows even for a chip at the left edge of the page.
 */
export function ResourceTooltip({ resource }: Props) {
  const { label, plural, description, href } = RESOURCES[resource]
  const id = useId()
  const contentId = `${id}-content`
  const descriptionId = `${id}-description`

  const rootRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)

  // Opened by a tap or click (or Enter on the focused word).
  const [open, setOpen] = useState(false)
  // Set by Escape or a closing click: hides the hover reveal until the
  // pointer leaves or focus moves away, so the popover does not spring back.
  const [dismissed, setDismissed] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)

  const reposition = useCallback(() => {
    const trigger = triggerRef.current
    const content = contentRef.current
    if (!trigger || !content) return

    const t = trigger.getBoundingClientRect()
    const c = content.getBoundingClientRect()

    const minLeft = VIEWPORT_MARGIN + c.width / 2
    const maxLeft = window.innerWidth - VIEWPORT_MARGIN - c.width / 2
    const left = Math.min(maxLeft, Math.max(minLeft, t.left + t.width / 2))

    const aboveTop = t.top - c.height - GAP
    const maxTop = window.innerHeight - VIEWPORT_MARGIN - c.height
    const placement: Placement = aboveTop >= VIEWPORT_MARGIN ? 'above' : 'below'
    const top =
      placement === 'above'
        ? aboveTop
        : Math.min(t.bottom + GAP, Math.max(VIEWPORT_MARGIN, maxTop))

    setPosition({ left, top, placement })
  }, [])

  function close(dismiss: boolean) {
    setOpen(false)
    setDismissed(dismiss)
  }

  function toggle() {
    if (open) {
      close(true)
      return
    }
    reposition()
    setDismissed(false)
    setOpen(true)
  }

  function handleBlur(event: FocusEvent<HTMLSpanElement>) {
    const root = rootRef.current
    if (
      root &&
      event.relatedTarget instanceof Node &&
      root.contains(event.relatedTarget)
    ) {
      return
    }
    close(root?.matches(':hover') ?? false)
  }

  // Escape closes a popover that is open, hovered or focused. Scrolling or
  // resizing moves the word, so the fixed popover follows it while shown.
  useEffect(() => {
    const isShown = () => {
      const root = rootRef.current
      if (!root) return false
      return (
        open ||
        root.matches(':hover') ||
        (document.activeElement instanceof Node &&
          root.contains(document.activeElement))
      )
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isShown()) close(true)
    }
    const handleViewportChange = () => {
      if (isShown()) reposition()
    }

    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [open, reposition])

  // A tap or click anywhere outside closes an open popover.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) {
        return
      }
      close(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  return (
    <span
      ref={rootRef}
      className="group relative inline-block"
      data-open={open || undefined}
      data-dismissed={dismissed || undefined}
      onPointerEnter={reposition}
      onPointerLeave={() => {
        const root = rootRef.current
        const hasFocus =
          root &&
          document.activeElement instanceof Node &&
          root.contains(document.activeElement)
        if (!hasFocus) setDismissed(false)
      }}
      onBlur={handleBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-describedby={descriptionId}
        aria-controls={contentId}
        onClick={toggle}
        onFocus={reposition}
        className="cursor-help rounded-xs text-brand underline decoration-dotted decoration-1 underline-offset-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {label}
      </button>
      <span
        ref={contentRef}
        id={contentId}
        style={
          position ? { left: position.left, top: position.top } : undefined
        }
        className={`pointer-events-none invisible fixed z-50 w-max max-w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 translate-y-1 rounded-lg border border-black/12 bg-white p-3 text-left text-[0.8125rem] leading-normal font-normal text-zinc-500 opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.16)] transition-[opacity,transform,visibility] duration-[120ms] ease-out after:absolute after:inset-x-0 after:h-2 after:content-[''] group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-data-open:pointer-events-auto group-data-open:visible group-data-open:translate-y-0 group-data-open:opacity-100 group-data-dismissed:pointer-events-none! group-data-dismissed:invisible! group-data-dismissed:opacity-0! dark:border-white/14 dark:bg-zinc-950 dark:text-zinc-400 dark:shadow-[0_12px_32px_rgba(0,0,0,0.4)] ${
          position?.placement === 'below' ? 'after:-top-2' : 'after:-bottom-2'
        }`}
      >
        <span id={descriptionId} role="tooltip" className="block">
          {description}
        </span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs font-semibold text-brand hover:underline"
        >
          Learn more about {plural}
        </a>
      </span>
    </span>
  )
}
