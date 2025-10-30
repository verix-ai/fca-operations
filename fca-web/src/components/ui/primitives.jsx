import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function Card({ className = '', children }) {
  return (
    <div
      data-card
      className={cn(
        'relative overflow-hidden rounded-3xl border bg-[linear-gradient(160deg,rgba(40,41,48,0.96)_0%,rgba(28,29,36,0.96)_48%,rgba(50,52,60,0.97)_100%)] surface-main',
        className,
      )}
    >
      <div className="absolute inset-0 pointer-events-none opacity-15 bg-[radial-gradient(circle_at_top_right,rgba(99,255,130,0.18),transparent_55%)]" />
      <div className="relative">{children}</div>
    </div>
  )
}
export function CardHeader({ className = '', children }) {
  return <div className={cn('px-6 py-5 border-b border-white/5', className)}>{children}</div>
}
export function CardTitle({ className = '', children }) {
  return <h3 className={cn('text-xs uppercase tracking-[0.4em] text-heading-subdued', className)}>{children}</h3>
}
export function CardContent({ className = '', children }) {
  return <div className={cn('px-6 py-5', className)}>{children}</div>
}

const buttonVariants = {
  default: {
    background: 'rgba(var(--button-bg-rgb), 0.98)',
    color: 'rgb(var(--button-text-rgb))',
    borderColor: 'rgba(var(--button-border-rgb), 0.55)',
    shimmerColor: 'rgba(var(--brand-secondary), 0.65)',
    className:
      'shadow-[0_22px_45px_-28px_rgba(10,14,20,0.55)] motion-safe:hover:-translate-y-0.5 hover:shadow-[0_26px_58px_-30px_rgba(6,8,12,0.65)]',
  },
  outline: {
    background: 'rgba(var(--button-outline-bg-rgb), 0.9)',
    color: 'rgb(var(--text))',
    borderColor: 'rgba(var(--button-border-rgb), 0.45)',
    shimmerColor: 'rgba(var(--brand), 0.45)',
    className:
      'shadow-[0_14px_34px_-26px_rgba(10,14,20,0.35)] motion-safe:hover:-translate-y-0.5 hover:border-[rgba(var(--button-border-rgb),0.6)]',
  },
  ghost: {
    background: 'rgba(var(--button-outline-bg-rgb), 0.2)',
    color: 'rgba(var(--muted), 0.9)',
    borderColor: 'rgba(var(--button-border-rgb), 0.25)',
    shimmerColor: 'rgba(var(--brand-secondary), 0.35)',
    className:
      'shadow-none motion-safe:hover:-translate-y-0.5 hover:border-[rgba(var(--button-border-rgb),0.45)]',
  },
}

const buttonSizes = {
  sm: 'min-h-[2.5rem] px-4 text-sm',
  md: 'min-h-[2.75rem] px-5 py-2 text-sm md:text-base',
  lg: 'min-h-[3.25rem] px-7 py-2.5 text-base',
  icon: 'size-10 p-0',
}

export const Button = React.forwardRef(function Button(
  {
    className = '',
    variant = 'default',
    size = 'md',
    shimmerColor,
    shimmerSize = '0.08em',
    shimmerDuration = '3s',
    borderRadius = '999px',
    background,
    textColor,
    style,
    children,
    ...props
  },
  ref,
) {
  const variantConfig = buttonVariants[variant] || buttonVariants.default
  const resolvedBackground = background ?? variantConfig.background
  const resolvedShimmer = shimmerColor ?? variantConfig.shimmerColor
  const isDisabled = Boolean(props.disabled)

  const inlineStyle = {
    '--spread': '90deg',
    '--shimmer-color': resolvedShimmer,
    '--radius': borderRadius,
    '--speed': shimmerDuration,
    '--cut': shimmerSize,
    '--button-bg': resolvedBackground,
    background: resolvedBackground,
    color: variantConfig.color,
    borderColor: variantConfig.borderColor,
  }

  if (isDisabled) {
    inlineStyle.background = 'rgba(var(--button-disabled-bg-rgb), 0.94)'
    inlineStyle.color = `rgb(var(--button-disabled-text-rgb))`
    inlineStyle.borderColor = 'rgba(var(--button-border-rgb), 0.25)'
    inlineStyle['--shimmer-color'] = 'rgba(255,255,255,0.08)'
  }

  if (textColor) {
    inlineStyle.color = textColor
  }

  const baseClass =
    'group relative inline-flex cursor-pointer items-center justify-center overflow-hidden whitespace-nowrap font-semibold transition-transform duration-300 ease-in-out active:translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-secondary),0.45)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(var(--bg),0.85)] disabled:cursor-not-allowed disabled:shadow-none'

  return (
    <button
      ref={ref}
      style={{ ...inlineStyle, ...style }}
      className={cn(
        baseClass,
        '[border-radius:var(--radius)] border',
        buttonSizes[size] || buttonSizes.md,
        variantConfig.className,
        className,
      )}
      {...props}
    >
      <div
        className="-z-30 blur-[2px] pointer-events-none absolute inset-0 overflow-visible [container-type:size]"
        style={{ opacity: isDisabled ? 0 : 1 }}
      >
        <div className="absolute inset-0 h-[100cqh] animate-shimmer-slide [aspect-ratio:1] [border-radius:0] [mask:none]">
          <div className="animate-spin-around absolute -inset-full w-auto rotate-0 [background:conic-gradient(from_calc(270deg-(var(--spread)*0.5)),transparent_0,var(--shimmer-color)_var(--spread),transparent_var(--spread))] [translate:0_0]" />
        </div>
      </div>

      <span className="relative z-10 flex items-center gap-2">{children}</span>

      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          '[border-radius:var(--radius)]',
          'shadow-[inset_0_-8px_10px_#ffffff1f]',
          'transform-gpu transition-all duration-300 ease-in-out',
          'group-hover:shadow-[inset_0_-6px_10px_#ffffff3f]',
          'group-active:shadow-[inset_0_-10px_10px_#ffffff3f]',
        )}
      />

      <div className="pointer-events-none absolute -z-20 [background:var(--button-bg)] [border-radius:var(--radius)] [inset:var(--cut)]" />
    </button>
  )
})

Button.displayName = 'Button'

export function Badge({ className = '', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border border-[rgba(96,255,168,0.35)] bg-[rgba(96,255,168,0.12)] text-button-contrast rounded-xl px-3 py-1 text-xs uppercase tracking-wide',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-2xl border surface-input px-4 py-3 shadow-input focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand',
        className,
      )}
      {...props}
    />
  )
}

export function Label(props) { return <label {...props} /> }

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={cn(
        'w-full rounded-2xl border surface-input px-4 py-3 shadow-input focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand',
        className,
      )}
      {...props}
    />
  )
}

// --- Simple Select primitives (headless) ---
const SelectCtx = createContext(null)

export function Select({ value, onValueChange, children }) {
  const [internalValue, setInternalValue] = useState(value ?? null)
  const [label, setLabel] = useState(null)
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => { if (value !== undefined) setInternalValue(value) }, [value])

  // Close on outside click (use 'click' so item onClick fires first)
  useEffect(() => {
    function onDocClick(e) {
      if (!open) return
      const el = containerRef.current
      if (el && !el.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [open])

  const setValue = (nextValue, nextLabel) => {
    setInternalValue(nextValue)
    if (typeof onValueChange === 'function') onValueChange(nextValue)
    if (nextLabel != null) setLabel(nextLabel)
    setOpen(false)
  }

  const contextValue = useMemo(() => ({
    value: internalValue,
    label,
    open,
    setOpen,
    setValue,
    containerRef,
  }), [internalValue, label, open])

  return (
    <SelectCtx.Provider value={contextValue}>
      <div ref={containerRef} className="relative inline-block w-full">
        {children}
      </div>
    </SelectCtx.Provider>
  )
}

export function SelectTrigger({ className = '', children }) {
  const ctx = useContext(SelectCtx)
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        'w-full text-left rounded-2xl border surface-input px-4 py-3 shadow-input hover:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function SelectValue({ placeholder }) {
  const ctx = useContext(SelectCtx)
  return <span className="text-heading-primary">{ctx.label ?? placeholder}</span>
}

export function SelectContent({ className = '', children }) {
  const ctx = useContext(SelectCtx)
  const contentRef = useRef(null)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 256 })

  useEffect(() => {
    if (!ctx.open) return

    function updatePosition() {
      const triggerEl = ctx.containerRef?.current
      if (!triggerEl) return

      const rect = triggerEl.getBoundingClientRect()
      let left = rect.left
      let width = rect.width
      let top = rect.bottom + 12 // gap similar to mt-3

      const contentEl = contentRef.current
      if (contentEl) {
        const desiredHeight = contentEl.offsetHeight
        const spaceBelow = window.innerHeight - top - 8
        const spaceAbove = rect.top - 12 - 8
        // If not enough space below, try placing above
        if (desiredHeight > spaceBelow && desiredHeight <= spaceAbove) {
          top = Math.max(8, rect.top - 12 - desiredHeight)
        } else if (desiredHeight > spaceBelow) {
          // Clamp within viewport if both sides are tight
          top = Math.max(8, Math.min(top, window.innerHeight - 8 - Math.min(desiredHeight, 256)))
        }
      }

      const maxHeight = Math.min(256, Math.max(120, window.innerHeight - top - 8))
      setPosition({ left, top, width, maxHeight })
    }

    updatePosition()
    const opts = { passive: true }
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition, opts)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition, opts)
    }
  }, [ctx.open])

  if (!ctx.open) return null

  const node = (
    <div
      ref={contentRef}
      className={cn(
        'fixed rounded-2xl border border-[rgba(147,165,197,0.2)] bg-hero-card p-2 z-50 shadow-[0_25px_60px_-30px_rgba(0,0,0,0.85)] overflow-auto backdrop-blur-2xl',
        className,
      )}
      style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
    >
      {children}
    </div>
  )

  return createPortal(node, document.body)
}

export function SelectItem({ value, className = '', children }) {
  const ctx = useContext(SelectCtx)
  const label = typeof children === 'string' ? children : String(value)
  const isSelected = ctx.value === value
  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => ctx.setValue(value, label)}
      className={cn(
        'px-4 py-2 rounded-xl cursor-pointer text-heading-primary opacity-80 hover:opacity-100 hover:bg-[rgba(96,255,168,0.16)] transition-colors',
        className,
      )}
      data-value={value}
    >
      {children}
    </div>
  )
}

export function Table({ children }) { return <table className="w-full border-collapse">{children}</table> }
export function TableHeader({ children }) { return <thead>{children}</thead> }
export function TableBody({ children }) { return <tbody>{children}</tbody> }
export function TableRow({ className = '', children }) { return <tr className={cn('border-b border-[rgba(147,165,197,0.2)]', className)}>{children}</tr> }
export function TableHead({ className = '', children }) { return <th className={cn('text-left p-3 text-white/60', className)}>{children}</th> }
export function TableCell({ className = '', children, ...props }) { return <td className={cn('p-3 text-heading-primary', className)} {...props}>{children}</td> }

// --- Simple Tabs primitives ---
const TabsCtx = createContext(null)

export function Tabs({ value, onValueChange, defaultValue, className = '', children }) {
  const [active, setActive] = useState(value ?? defaultValue ?? null)
  useEffect(() => { if (value !== undefined) setActive(value) }, [value])
  const setValue = (v) => { setActive(v); if (typeof onValueChange === 'function') onValueChange(v) }
  const ctx = useMemo(() => ({ active, setValue }), [active])
  return <div className={className}><TabsCtx.Provider value={ctx}>{children}</TabsCtx.Provider></div>
}

export function TabsList({ className = '', children }) { return <div className={cn('flex gap-2', className)}>{children}</div> }

export function TabsTrigger({ value, className = '', children }) {
  const { active, setValue } = useContext(TabsCtx) || { active: null, setValue: () => {} }
  const isActive = active === value
  return (
    <button
      type="button"
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => setValue(value)}
      className={cn(
        'px-4 py-2 rounded-2xl border border-[rgba(147,165,197,0.25)] text-heading-subdued data-[state=active]:bg-[rgba(96,255,168,0.12)] data-[state=active]:border-brand/40 data-[state=active]:text-button-contrast transition-all',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function TabsContent({ value, children }) {
  const { active } = useContext(TabsCtx) || { active: null }
  if (active !== value) return null
  return <div>{children}</div>
}

export function Checkbox({ className = '', checked, defaultChecked, onChange, onCheckedChange, ...props }) {
  const [isChecked, setIsChecked] = useState(Boolean(checked ?? defaultChecked))
  useEffect(() => { if (checked !== undefined) setIsChecked(Boolean(checked)) }, [checked])

  const handleChange = (e) => {
    const next = e.target.checked
    if (checked === undefined) setIsChecked(next)
    if (typeof onChange === 'function') onChange(e)
    if (typeof onCheckedChange === 'function') onCheckedChange(next)
  }

  return (
    <input
      type="checkbox"
      data-state={isChecked ? 'checked' : 'unchecked'}
      aria-checked={isChecked}
      className={cn(
        'h-5 w-5 rounded-md border-[rgba(96,255,168,0.35)] text-brand focus:outline-none focus:ring-2 focus:ring-brand/40 accent-brand',
        className,
      )}
      checked={isChecked}
      onChange={handleChange}
      style={{ accentColor: '#60FFA8' }}
      {...props}
    />
  )
}

export function Sidebar({ className = '', children }) {
  return (
    <aside
      data-sidebar
      className={cn(
        'w-72 bg-[linear-gradient(160deg,rgba(6,7,9,0.98)_0%,rgba(5,6,8,0.92)_60%,rgba(6,7,9,0.98)_100%)] border-r border-[rgba(0,217,255,0.1)]',
        className,
      )}
    >
      {children}
    </aside>
  )
}
export function SidebarContent({ className = '', children }) { return <div className={className}>{children}</div> }
export function SidebarHeader({ className = '', children }) { return <div className={className}>{children}</div> }
export function SidebarFooter({ className = '', children }) { return <div className={className}>{children}</div> }
export function SidebarGroup({ children }) { return <div>{children}</div> }
export function SidebarGroupLabel({ className = '', children }) { return <div className={className}>{children}</div> }
export function SidebarGroupContent({ children }) { return <div>{children}</div> }
export function SidebarMenu({ children }) { return <div>{children}</div> }
export function SidebarMenuItem({ children }) { return <div>{children}</div> }
export function SidebarMenuButton({ className = '', asChild = false, children }) { return asChild ? React.cloneElement(children, { className: cn(children.props.className || '', className) }) : <button className={className}>{children}</button> }
export function SidebarProvider({ children }) { return <div className="flex">{children}</div> }
export function SidebarTrigger({ className = '' }) {
  return (
    <button
      className={cn(
        'px-3 py-2 rounded-2xl border surface-input shadow-input text-heading-primary',
        className,
      )}
    >
      ☰
    </button>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={cn('animate-pulse bg-[rgba(147,165,197,0.18)] rounded', className)} />
}

export default {}
