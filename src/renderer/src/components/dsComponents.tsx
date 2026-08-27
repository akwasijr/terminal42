import { useState, type CSSProperties, type ReactNode } from 'react'
import { type DesignSystem, SHADOW_CSS, feelLook } from '../lib/designSystem'
import { DsIcon } from './dsIcons'
import { FONT_OPTIONS } from '../lib/brief'

// A library of live, interactive component previews. Each renders itself from
// the design system's tokens, so changing a token updates every component
// instantly. Components respond to hover / focus / click so the states can be
// explored directly in the documentation.

function stack(name: string): string {
  return FONT_OPTIONS.find((f) => f.id === name)?.stack ?? `'${name}', system-ui, sans-serif`
}

/** The user's chosen brand/company name, shown inside components (never a placeholder). */
function brandName(s: DesignSystem): string {
  return (s.brief?.brandName?.trim() || s.name?.trim() || 'Brand')
}

export interface DSComponent {
  name: string
  category: Category
  /** one-line description shown on the detail page and overview cards */
  desc: string
  render: (s: DesignSystem) => JSX.Element
  variants?: { id: string; label: string; render: (s: DesignSystem) => JSX.Element }[]
}

export const DS_CATEGORIES = ['Actions', 'Forms', 'Navigation', 'Containers', 'Notifications', 'Data', 'Visual'] as const
export type Category = (typeof DS_CATEGORIES)[number]

// ── Token-driven sizing + treatment ──────────────────────────────────────────
const DENSITY_MULT: Record<string, number> = { compact: 0.82, cozy: 1, comfortable: 1.12, spacious: 1.34 }
export function dims(s: DesignSystem): { padX: number; padY: number; fieldX: number; fieldY: number; cardPad: number; gap: number } {
  const m = DENSITY_MULT[s.density ?? 'comfortable'] ?? 1
  return { padX: Math.round(14 * m), padY: Math.round(7 * m), fieldX: Math.round(11 * m), fieldY: Math.round(8 * m), cardPad: Math.round(14 * m), gap: Math.round(8 * m) }
}
interface Look { fill: 'solid' | 'tint' | 'outline'; btnWeight: number; headingWeight: number }
export function look(s: DesignSystem): Look { return feelLook(s.vibe) }

// Darken/lighten a hex color for hover + active states.
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amt < 0 ? c + (255 - c) * -amt : c * (1 - amt)
    return Math.max(0, Math.min(255, Math.round(v)))
  })
  return '#' + ch.map((x) => x.toString(16).padStart(2, '0')).join('')
}

// ── Contrast utilities (WCAG) so text is always legible on its background ──────
function hexRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function relLum(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const la = relLum(a), lb = relLum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
/** Pick the more legible of white / near-black for text on a solid background. */
function onSolid(bg: string): string {
  return contrast('#ffffff', bg) >= contrast('#161616', bg) ? '#ffffff' : '#161616'
}
/** Nudge a foreground color until it meets the WCAG AA contrast target on bg. */
function legible(fg: string, bg: string, target = 4.5): string {
  if (!/^#?[0-9a-f]{6}$/i.test(fg)) return relLum(bg) > 0.4 ? '#161616' : '#ffffff'
  if (contrast(fg, bg) >= target) return fg
  const darken = relLum(bg) > 0.4
  for (let st = 0.08; st <= 0.92; st += 0.08) {
    const cand = shade(fg, darken ? st : -st)
    if (contrast(cand, bg) >= target) return cand
  }
  return darken ? '#161616' : '#ffffff'
}

const btn = (s: DesignSystem, bg: string, color: string, border?: string): CSSProperties => {
  const d = dims(s)
  return {
    background: bg, color, border: border ? `1px solid ${border}` : '1px solid transparent',
    borderRadius: s.radii.md, padding: `${d.padY}px ${d.padX}px`, fontSize: s.type.sm, fontWeight: look(s).btnWeight,
    fontFamily: stack(s.font.family), cursor: 'pointer', lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 6
  }
}
/** A filled/tinted/outlined button base honoring the vibe, with legible text. */
const fillBtn = (s: DesignSystem, color: string): CSSProperties => {
  const lk = look(s)
  // For tint/outline, darken/lighten the brand color until it reads on the page,
  // then tint with that same readable hue so pale brand colors stay legible.
  if (lk.fill === 'tint') { const fg = legible(color, s.colors.bg); return btn(s, `${fg}26`, fg) }
  if (lk.fill === 'outline') { const fg = legible(color, s.colors.bg); return { ...btn(s, 'transparent', fg), border: `1px solid ${fg}` } }
  return btn(s, color, onSolid(color))
}

// Whether the Chromium build supports continuous (squircle) corners.
const SQUIRCLE_OK = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('corner-shape', 'squircle')
/** True if this system uses continuous corners (and the engine supports them). */
export function usesSquircle(s: DesignSystem): boolean {
  return s.cornerStyle === 'squircle' && SQUIRCLE_OK
}
/** A box outline honoring the system's border style (outlined / subtle / none). */
export function dsBorder(s: DesignSystem, color?: string): string {
  const style = s.borderStyle ?? 'outlined'
  if (style === 'none') return '1px solid transparent'
  const c = color ?? s.colors.border
  if (style === 'subtle') return `1px solid ${c}80`
  return `1px solid ${c}`
}
/** An internal divider (row/section separator). Disappears when outlines are off. */
export function dsDivider(s: DesignSystem): string {
  return s.borderStyle === 'none' ? '1px solid transparent' : `1px solid ${s.colors.border}`
}
const transition = (s: DesignSystem): string => `all ${s.motion.fast || 120}ms ${s.motion.easing}`

// ── Interactive primitives ────────────────────────────────────────────────────
function IButton({ s, color, children, variant = 'fill', size = 'md', block = false, onClick }: { s: DesignSystem; color: string; children: ReactNode; variant?: 'fill' | 'ghost'; size?: 'sm' | 'md' | 'lg'; block?: boolean; onClick?: () => void }): JSX.Element {
  const [hover, setHover] = useState(false)
  const [press, setPress] = useState(false)
  const [focus, setFocus] = useState(false)
  const lk = look(s)
  const fg = legible(color, s.colors.bg)
  const d = dims(s)
  let style: CSSProperties = variant === 'ghost' ? btn(s, 'transparent', s.colors.text, s.colors.border) : fillBtn(s, color)
  // Real size steps: scale padding + font so Small / Medium / Large differ visibly.
  if (size === 'sm') style = { ...style, padding: `${Math.round(d.padY * 0.6)}px ${Math.round(d.padX * 0.7)}px`, fontSize: s.type.xs }
  else if (size === 'lg') style = { ...style, padding: `${Math.round(d.padY * 1.55)}px ${Math.round(d.padX * 1.5)}px`, fontSize: s.type.md }
  if (block) style = { ...style, width: '100%', justifyContent: 'center' }
  if (hover || press) {
    if (variant === 'ghost') style = { ...style, background: `${s.colors.text}0d` }
    else if (lk.fill === 'solid') style = { ...style, background: shade(color, press ? 0.22 : 0.1) }
    else style = { ...style, background: `${fg}${press ? '42' : '36'}` }
  }
  if (focus) style = { ...style, outline: `2px solid ${variant === 'ghost' ? s.colors.text : fg}`, outlineOffset: 2 }
  return (
    <button type="button" onClick={onClick} style={{ ...style, transition: transition(s) }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setPress(false) }}
      onMouseDown={() => setPress(true)} onMouseUp={() => setPress(false)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}>{children}</button>
  )
}

function ICheck({ s, label, defaultOn = false, radio = false }: { s: DesignSystem; label: string; defaultOn?: boolean; radio?: boolean }): JSX.Element {
  const [on, setOn] = useState(defaultOn)
  const r = radio ? s.radii.pill : Math.min(6, s.radii.sm)
  return (
    <button type="button" role={radio ? 'radio' : 'checkbox'} aria-checked={on} onClick={() => setOn((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 9, color: s.colors.text, fontSize: s.type.sm, fontFamily: stack(s.font.family), background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <span style={{ width: 18, height: 18, borderRadius: r, background: on && !radio ? s.colors.primary : s.colors.surface, border: `1px solid ${on ? s.colors.primary : s.colors.border}`, display: 'grid', placeItems: 'center', transition: transition(s), flexShrink: 0 }}>
        {on && (radio ? <span style={{ width: 9, height: 9, borderRadius: s.radii.pill, background: s.colors.primary }} /> : <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M3 8.5l3.2 3.2L13 5" /></svg>)}
      </span>{label}
    </button>
  )
}

function ISwitch({ s, defaultOn = false, label }: { s: DesignSystem; defaultOn?: boolean; label?: string }): JSX.Element {
  const [on, setOn] = useState(defaultOn)
  const sw = (
    <button type="button" role="switch" onClick={() => setOn((v) => !v)} aria-checked={on} aria-label={label ?? 'Toggle setting'} style={{ width: 40, height: 22, borderRadius: s.radii.pill, background: on ? s.colors.primary : s.colors.border, position: 'relative', border: 'none', cursor: 'pointer', padding: 0, transition: transition(s) }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: s.radii.pill, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)', transition: transition(s) }} />
    </button>
  )
  if (!label) return sw
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, color: s.colors.text, fontFamily: stack(s.font.family), fontSize: s.type.sm }}>{sw}{label}</span>
}

function IInput({ s, label, placeholder, type = 'text', hint, required = false, suffix }: { s: DesignSystem; label?: string; placeholder?: string; type?: string; hint?: string; required?: boolean; suffix?: ReactNode }): JSX.Element {
  const [focus, setFocus] = useState(false)
  const d = dims(s)
  return (
    <label style={{ display: 'block', fontFamily: stack(s.font.family), width: 248 }}>
      {label && <span style={{ display: 'block', color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.medium, marginBottom: 5 }}>{label}{required && <span style={{ color: s.colors.error }}> *</span>}</span>}
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, background: s.colors.surface, border: `1px solid ${focus ? s.colors.primary : s.borderStyle === 'none' ? 'transparent' : s.colors.border}`, borderRadius: s.radii.md, padding: `${d.fieldY}px ${d.fieldX}px`, boxShadow: focus ? `0 0 0 3px ${s.colors.primary}22` : 'none', transition: transition(s) }}>
        <input type={type} placeholder={placeholder} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: s.colors.text, fontSize: s.type.base, fontFamily: stack(s.font.family) }} />
        {suffix}
      </span>
      {hint && <span style={{ display: 'block', color: s.colors.textMuted, fontSize: s.type.xs, marginTop: 5 }}>{hint}</span>}
    </label>
  )
}

function ITabs({ s, items, pill = false }: { s: DesignSystem; items: string[]; pill?: boolean }): JSX.Element {
  const [i, setI] = useState(0)
  return (
    <div role="tablist" style={{ display: 'inline-flex', gap: 2, background: pill ? s.colors.surface : 'transparent', border: pill ? dsBorder(s) : 'none', borderRadius: s.radii.md, padding: pill ? 3 : 0, borderBottom: pill ? undefined : dsDivider(s), fontFamily: stack(s.font.family) }}>
      {items.map((t, n) => {
        const active = n === i
        const base: CSSProperties = { padding: pill ? '5px 12px' : '7px 12px', fontSize: s.type.sm, fontWeight: s.weights.medium, cursor: 'pointer', border: 'none', background: 'transparent', color: active ? (pill ? onSolid(s.colors.primary) : s.colors.text) : s.colors.textMuted, transition: transition(s) }
        const style: CSSProperties = pill
          ? { ...base, borderRadius: Math.max(0, s.radii.md - 3), background: active ? s.colors.primary : 'transparent' }
          : { ...base, borderBottom: `2px solid ${active ? s.colors.primary : 'transparent'}`, marginBottom: -1 }
        return <button key={t} type="button" role="tab" aria-selected={active} onClick={() => setI(n)} style={style}>{t}</button>
      })}
    </div>
  )
}

function IAccordion({ s, items }: { s: DesignSystem; items: { q: string; a: string }[] }): JSX.Element {
  const [open, setOpen] = useState(0)
  return (
    <div style={{ width: 300, border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden', fontFamily: stack(s.font.family), background: s.colors.surface }}>
      {items.map((it, i) => {
        const isOpen = open === i
        return (
          <div key={it.q} style={{ borderTop: i ? dsDivider(s) : 'none' }}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? -1 : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '11px 13px', color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.medium, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {it.q}<span style={{ color: s.colors.textMuted, transform: isOpen ? 'rotate(180deg)' : 'none', transition: transition(s) }}><DsIcon name="chevronDown" style={s.iconStyle ?? 'outlined'} size={15} /></span>
            </button>
            {isOpen && <div style={{ padding: '0 13px 12px', color: s.colors.textMuted, fontSize: s.type.sm, lineHeight: 1.5 }}>{it.a}</div>}
          </div>
        )
      })}
    </div>
  )
}

/** The floating list of actions shared by the menu-opening buttons. */
function IMenuList({ s, items, danger = false }: { s: DesignSystem; items: string[]; danger?: boolean }): JSX.Element {
  const [hover, setHover] = useState(-1)
  return (
    <div role="menu" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1, marginTop: 6, minWidth: 172, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow], overflow: 'hidden', padding: '4px 0' }}>
      {items.map((t, i) => {
        const last = danger && i === items.length - 1
        return (
          <button key={t} type="button" role="menuitem" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(-1)}
            style={{ width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: s.type.sm, fontFamily: stack(s.font.family), color: last ? s.colors.error : s.colors.text, background: hover === i ? `${s.colors.text}0f` : 'transparent', border: 'none', cursor: 'pointer', transition: transition(s) }}>{t}</button>
        )
      })}
    </div>
  )
}

function ITooltip({ s }: { s: DesignSystem }): JSX.Element {  const [show, setShow] = useState(false)
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: stack(s.font.family) }}>
      <span role="tooltip" style={{ height: 26, fontSize: s.type.xs, color: onSolid(s.colors.text), background: show ? s.colors.text : 'transparent', padding: show ? '5px 9px' : 0, borderRadius: s.radii.sm, transition: transition(s) }}>{show ? 'Copy link' : ''}</span>
      <button type="button" aria-label="Copy link" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)} onFocus={() => setShow(true)} onBlur={() => setShow(false)} style={{ width: 32, height: 32, borderRadius: s.radii.md, border: dsBorder(s), background: s.colors.surface, display: 'grid', placeItems: 'center', color: s.colors.textMuted, cursor: 'pointer' }}><DsIcon name="info" style={s.iconStyle ?? 'outlined'} size={16} /></button>
      <span style={{ fontSize: s.type.xs, color: s.colors.textMuted }}>Hover the button</span>
    </div>
  )
}

function ISelect({ s, options }: { s: DesignSystem; options: string[] }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const d = dims(s)
  return (
    <div style={{ position: 'relative', width: 220, fontFamily: stack(s.font.family) }}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: s.colors.surface, border: `1px solid ${open ? s.colors.primary : s.borderStyle === 'none' ? 'transparent' : s.colors.border}`, borderRadius: s.radii.md, padding: `${d.fieldY}px ${d.fieldX}px`, color: s.colors.text, fontSize: s.type.base, cursor: 'pointer', boxShadow: open ? `0 0 0 3px ${s.colors.primary}22` : 'none' }}>
        {options[sel]}<span style={{ color: s.colors.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: transition(s) }}><DsIcon name="chevronDown" style={s.iconStyle ?? 'outlined'} size={16} /></span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow], overflow: 'hidden', zIndex: 5 }}>
          {options.map((o, i) => (
            <button key={o} type="button" onClick={() => { setSel(i); setOpen(false) }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: s.type.sm, color: s.colors.text, background: i === sel ? `${s.colors.primary}14` : 'transparent', border: 'none', cursor: 'pointer' }}>{o}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function IStepper({ s, steps }: { s: DesignSystem; steps: string[] }): JSX.Element {
  const [cur, setCur] = useState(1)
  return (
    <div style={{ fontFamily: stack(s.font.family) }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {steps.map((t, i) => {
          const done = i < cur
          const active = i === cur
          return (
            <div key={t} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
              <button type="button" onClick={() => setCur(i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ width: 28, height: 28, borderRadius: s.radii.pill, display: 'grid', placeItems: 'center', fontSize: s.type.sm, fontWeight: s.weights.semibold, background: done || active ? s.colors.primary : s.colors.surface, color: done || active ? onSolid(s.colors.primary) : s.colors.textMuted, border: done || active ? 'none' : dsDivider(s) }}>{done ? <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={onSolid(s.colors.primary)} strokeWidth="2.4" strokeLinecap="round"><path d="M3 8.5l3.2 3.2L13 5" /></svg> : i + 1}</span>
                <span style={{ fontSize: s.type.xs, color: active ? s.colors.text : s.colors.textMuted, whiteSpace: 'nowrap' }}>{t}</span>
              </button>
              {i < steps.length - 1 && <span style={{ flex: 1, height: 2, margin: '0 6px', marginBottom: 18, background: i < cur ? s.colors.primary : s.colors.border }} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IPagination({ s }: { s: DesignSystem }): JSX.Element {
  const [page, setPage] = useState(2)
  const cell = (content: ReactNode, active: boolean, onClick?: () => void, key?: string): JSX.Element => (
    <button key={key} type="button" onClick={onClick} aria-current={active ? 'page' : undefined} style={{ minWidth: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: s.radii.sm, fontSize: s.type.sm, background: active ? s.colors.primary : 'transparent', color: active ? onSolid(s.colors.primary) : s.colors.text, border: active ? 'none' : dsBorder(s), cursor: 'pointer', fontFamily: stack(s.font.family) }}>{content}</button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {cell(<DsIcon name="chevronLeft" style={s.iconStyle ?? 'outlined'} size={14} />, false, () => setPage((p) => Math.max(1, p - 1)), 'prev')}
      {[1, 2, 3, 4].map((n) => cell(n, n === page, () => setPage(n), 'p' + n))}
      {cell(<DsIcon name="chevronRight" style={s.iconStyle ?? 'outlined'} size={14} />, false, () => setPage((p) => Math.min(4, p + 1)), 'next')}
    </div>
  )
}

function ICookieConsent({ s }: { s: DesignSystem }): JSX.Element {
  const [open, setOpen] = useState(true)
  if (!open) return <button type="button" onClick={() => setOpen(true)} style={{ ...btn(s, 'transparent', s.colors.textMuted, s.colors.border), fontSize: s.type.xs }}>Show banner again</button>
  return (
    <div style={{ width: '100%', maxWidth: 360, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, boxShadow: SHADOW_CSS[s.shadow], padding: 16, fontFamily: stack(s.font.family) }}>
      <div style={{ color: s.colors.text, fontSize: s.type.md, fontWeight: s.weights.semibold, fontFamily: stack(s.font.heading) }}>This site uses cookies</div>
      <div style={{ color: s.colors.textMuted, fontSize: s.type.sm, margin: '5px 0 12px', lineHeight: 1.5 }}>We use cookies to improve your experience and analyse traffic.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <IButton s={s} color={s.colors.primary}>Accept all</IButton>
        <button type="button" onClick={() => setOpen(false)} style={btn(s, 'transparent', s.colors.text, s.colors.border)}>Settings</button>
      </div>
    </div>
  )
}

// ── Component library ──────────────────────────────────────────────────────────
export const DS_COMPONENTS: DSComponent[] = [
  // Actions ---------------------------------------------------------------------
  { name: 'Button', category: 'Actions', desc: 'Buttons make actions visible and let people trigger them.', variants: [
    { id: 'all', label: 'All styles', render: (s) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><IButton s={s} color={s.colors.primary}>Primary</IButton><IButton s={s} color={s.colors.secondary}>Secondary</IButton><IButton s={s} color={s.colors.tertiary}>Tertiary</IButton><IButton s={s} color={s.colors.primary} variant="ghost">Ghost</IButton><IButton s={s} color={s.colors.error}>Danger</IButton></div> },
    { id: 'sizes', label: 'Sizes', render: (s) => <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><IButton s={s} color={s.colors.primary} size="sm">Small</IButton><IButton s={s} color={s.colors.primary} size="md">Medium</IButton><IButton s={s} color={s.colors.primary} size="lg">Large</IButton></div> },
    { id: 'disabled', label: 'Disabled', render: (s) => <button type="button" disabled style={{ ...btn(s, s.colors.border, s.colors.textMuted), cursor: 'not-allowed', opacity: 0.7 }}>Disabled</button> }
  ], render: (s) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <IButton s={s} color={s.colors.primary}>Primary</IButton>
      <IButton s={s} color={s.colors.secondary}>Secondary</IButton>
      <IButton s={s} color={s.colors.tertiary}>Tertiary</IButton>
      <IButton s={s} color={s.colors.primary} variant="ghost">Ghost</IButton>
    </div>
  ) },
  { name: 'ToggleButton', category: 'Actions', desc: 'A button that switches between an on and off state.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [on, setOn] = useState(true)
      const fg = legible(s.colors.primary, s.colors.bg)
      return <button type="button" aria-pressed={on} onClick={() => setOn((v) => !v)} style={{ ...btn(s, on ? `${fg}1f` : 'transparent', on ? fg : s.colors.text, on ? fg : s.colors.border), fontWeight: s.weights.medium }}><DsIcon name={on ? 'check' : 'plus'} style={s.iconStyle ?? 'outlined'} size={15} />{on ? 'Following' : 'Follow'}</button>
    }
    return <Demo />
  } },
  { name: 'Link', category: 'Actions', desc: 'Links take people to another page or location.', render: (s) => (
    <div style={{ display: 'flex', gap: 16, fontFamily: stack(s.font.family), fontSize: s.type.base }}>
      <a style={{ color: legible(s.colors.primary, s.colors.bg), textDecoration: 'none', fontWeight: s.weights.medium, cursor: 'pointer' }}>Read the docs →</a>
      <a style={{ color: s.colors.textMuted, textDecoration: 'underline', cursor: 'pointer' }}>Learn more</a>
    </div>
  ) },
  { name: 'Linkbox', category: 'Actions', desc: 'A whole card that acts as a single large link.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [h, setH] = useState(false)
      return (
        <a onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: 'block', width: 260, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.lg, padding: dims(s).cardPad, boxShadow: h ? SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow] : 'none', transform: h ? 'translateY(-1px)' : 'none', transition: transition(s), cursor: 'pointer', fontFamily: stack(s.font.family) }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: s.colors.text, fontSize: s.type.md, fontWeight: s.weights.semibold, fontFamily: stack(s.font.heading) }}>Annual report 2026</div>
            <span style={{ color: s.colors.primary, transform: h ? 'translateX(2px)' : 'none', transition: transition(s) }}><DsIcon name="chevronRight" style={s.iconStyle ?? 'outlined'} size={18} /></span>
          </div>
          <div style={{ color: s.colors.textMuted, fontSize: s.type.sm, marginTop: 5 }}>Read the full summary and figures.</div>
        </a>
      )
    }
    return <Demo />
  } },

  // Forms -----------------------------------------------------------------------
  { name: 'TextInput', category: 'Forms', desc: 'A single-line field for short text entry.', render: (s) => <IInput s={s} label="Full name" placeholder="Jane Doe" hint="As it appears on your ID." /> },
  { name: 'TextArea', category: 'Forms', desc: 'A multi-line field for longer text.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [focus, setFocus] = useState(false)
      return (
        <label style={{ display: 'block', fontFamily: stack(s.font.family), width: 260 }}>
          <span style={{ display: 'block', color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.medium, marginBottom: 5 }}>Message</span>
          <textarea placeholder="Write your message…" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} rows={3} style={{ width: '100%', resize: 'none', background: s.colors.surface, border: `1px solid ${focus ? s.colors.primary : s.borderStyle === 'none' ? 'transparent' : s.colors.border}`, borderRadius: s.radii.md, padding: `${dims(s).fieldY}px ${dims(s).fieldX}px`, color: s.colors.text, fontSize: s.type.base, fontFamily: stack(s.font.family), outline: 'none', boxShadow: focus ? `0 0 0 3px ${s.colors.primary}22` : 'none' }} />
        </label>
      )
    }
    return <Demo />
  } },
  { name: 'NumberInput', category: 'Forms', desc: 'A field for entering and stepping numeric values.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [n, setN] = useState(3)
      const step = (d: number): CSSProperties => ({ padding: '1px 8px', color: s.colors.textMuted, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: d > 0 ? dsDivider(s) : 'none' })
      return (
        <div style={{ display: 'inline-flex', alignItems: 'stretch', border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden', fontFamily: stack(s.font.family), background: s.colors.surface }}>
          <span style={{ padding: '8px 16px', color: s.colors.text, fontSize: s.type.base, minWidth: 30, textAlign: 'center' }}>{n}</span>
          <span style={{ display: 'flex', flexDirection: 'column', borderLeft: dsDivider(s) }}>
            <button type="button" aria-label="Increase" onClick={() => setN((v) => v + 1)} style={step(1)}><DsIcon name="chevronUp" style={s.iconStyle ?? 'outlined'} size={12} /></button>
            <button type="button" aria-label="Decrease" onClick={() => setN((v) => Math.max(0, v - 1))} style={step(-1)}><DsIcon name="chevronDown" style={s.iconStyle ?? 'outlined'} size={12} /></button>
          </span>
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'PhoneInput', category: 'Forms', desc: 'A field for entering a phone number with a country code.', render: (s) => (
    <label style={{ display: 'block', fontFamily: stack(s.font.family), width: 260 }}>
      <span style={{ display: 'block', color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.medium, marginBottom: 5 }}>Phone number</span>
      <span style={{ display: 'flex', alignItems: 'stretch', background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden' }}>
        <span style={{ padding: `${dims(s).fieldY}px ${dims(s).fieldX}px`, color: s.colors.text, fontSize: s.type.base, borderRight: dsDivider(s) }}>+358</span>
        <input placeholder="40 123 4567" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', padding: `${dims(s).fieldY}px ${dims(s).fieldX}px`, color: s.colors.text, fontSize: s.type.base, fontFamily: stack(s.font.family) }} />
      </span>
    </label>
  ) },
  { name: 'SearchInput', category: 'Forms', desc: 'A styled text field for search queries.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [v, setV] = useState('')
      const [focus, setFocus] = useState(false)
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 260, background: s.colors.surface, border: `1px solid ${focus ? s.colors.primary : s.borderStyle === 'none' ? 'transparent' : s.colors.border}`, borderRadius: s.radii.md, padding: `${dims(s).fieldY}px ${dims(s).fieldX}px`, fontFamily: stack(s.font.family), boxShadow: focus ? `0 0 0 3px ${s.colors.primary}22` : 'none' }}>
          <span style={{ color: s.colors.textMuted, display: 'grid', placeItems: 'center' }}><DsIcon name="search" style={s.iconStyle ?? 'outlined'} size={15} /></span>
          <input value={v} onChange={(e) => setV(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} placeholder="Search" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: s.colors.text, fontSize: s.type.base, fontFamily: stack(s.font.family) }} />
          {v && <button type="button" onClick={() => setV('')} aria-label="Clear" style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.colors.textMuted, display: 'grid', placeItems: 'center' }}><DsIcon name="close" style={s.iconStyle ?? 'outlined'} size={14} /></button>}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'Search', category: 'Forms', desc: 'A search field that shows live suggestions.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [v, setV] = useState('de')
      const all = ['Design tokens', 'Dependencies', 'Deployment', 'Developers']
      const hits = v ? all.filter((x) => x.toLowerCase().includes(v.toLowerCase())) : []
      return (
        <div style={{ width: 280, fontFamily: stack(s.font.family) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, padding: `${dims(s).fieldY}px ${dims(s).fieldX}px` }}>
            <span style={{ color: s.colors.textMuted, display: 'grid', placeItems: 'center' }}><DsIcon name="search" style={s.iconStyle ?? 'outlined'} size={15} /></span>
            <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Search" style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: s.colors.text, fontSize: s.type.base, fontFamily: stack(s.font.family) }} />
          </div>
          {hits.length > 0 && (
            <div style={{ marginTop: 4, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden' }}>
              {hits.map((h) => <button key={h} type="button" onClick={() => setV(h)} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: s.type.sm, color: s.colors.text, background: 'transparent', border: 'none', cursor: 'pointer' }}>{h}</button>)}
            </div>
          )}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'Select', category: 'Forms', desc: 'A control that opens a list of options to pick from.', render: (s) => <ISelect s={s} options={['Option one', 'Option two', 'Option three', 'Option four']} /> },
  { name: 'Checkbox', category: 'Forms', desc: 'Lets people select one or more options.', render: (s) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <ICheck s={s} label="Subscribe to updates" defaultOn />
      <ICheck s={s} label="Send me product offers" />
    </div>
  ) },
  { name: 'RadioButton', category: 'Forms', desc: 'Lets people pick one option from a set.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [sel, setSel] = useState(0)
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: stack(s.font.family) }}>
          {['Monthly', 'Yearly', 'Pay as you go'].map((t, i) => (
            <button key={t} type="button" onClick={() => setSel(i)} style={{ display: 'flex', alignItems: 'center', gap: 9, color: s.colors.text, fontSize: s.type.sm, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <span style={{ width: 18, height: 18, borderRadius: s.radii.pill, border: `1px solid ${sel === i ? s.colors.primary : s.colors.border}`, display: 'grid', placeItems: 'center' }}>{sel === i && <span style={{ width: 9, height: 9, borderRadius: s.radii.pill, background: s.colors.primary }} />}</span>{t}
            </button>
          ))}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'SelectionGroup', category: 'Forms', desc: 'A labelled group of related checkboxes or radios.', render: (s) => (
    <fieldset style={{ border: dsBorder(s), borderRadius: s.radii.md, padding: dims(s).cardPad, margin: 0, fontFamily: stack(s.font.family) }}>
      <legend style={{ padding: '0 6px', color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.semibold }}>Notify me about</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        <ICheck s={s} label="Comments" defaultOn />
        <ICheck s={s} label="Mentions" defaultOn />
        <ICheck s={s} label="Weekly digest" />
      </div>
    </fieldset>
  ) },
  { name: 'Switch', category: 'Forms', desc: 'Turns a single setting on or off.', render: (s) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ISwitch s={s} label="Email notifications" defaultOn />
      <ISwitch s={s} label="Public profile" />
    </div>
  ) },
  { name: 'Slider', category: 'Forms', desc: 'Selects a value from a continuous range.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [v, setV] = useState(55)
      return (
        <div style={{ width: 240, fontFamily: stack(s.font.family) }}>
          <input type="range" min={0} max={100} value={v} onChange={(e) => setV(parseInt(e.target.value))} style={{ width: '100%', accentColor: s.colors.primary }} />
          <div style={{ fontSize: s.type.xs, color: s.colors.textMuted, marginTop: 4 }}>{v}%</div>
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'Fieldset', category: 'Forms', desc: 'Groups related form fields under one label.', render: (s) => (
    <fieldset style={{ border: dsBorder(s), borderRadius: s.radii.md, padding: dims(s).cardPad, margin: 0, width: 280, fontFamily: stack(s.font.family) }}>
      <legend style={{ padding: '0 6px', color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.semibold }}>Shipping address</legend>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        <IInput s={s} label="Street" placeholder="123 Main Street" />
        <IInput s={s} label="City" placeholder="Your city" />
      </div>
    </fieldset>
  ) },
  { name: 'DateInput', category: 'Forms', desc: 'Lets people enter a date or pick one from a calendar.', render: (s) => <IInput s={s} label="Choose a date" required hint="Use format D.M.YYYY" placeholder="6.6.2026" suffix={<span style={{ color: s.colors.textMuted, display: 'grid', placeItems: 'center' }}><DsIcon name="calendar" style={s.iconStyle ?? 'outlined'} size={16} /></span>} /> },
  { name: 'TimeInput', category: 'Forms', desc: 'Lets people enter a time of day.', render: (s) => <IInput s={s} label="Pick a time" placeholder="09:30" hint="24-hour format" suffix={<span style={{ color: s.colors.textMuted, display: 'grid', placeItems: 'center' }}><DsIcon name="clock" style={s.iconStyle ?? 'outlined'} size={16} /></span>} /> },
  { name: 'FileInput', category: 'Forms', desc: 'Lets people browse and upload files.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [files, setFiles] = useState<string[]>([])
      return (
        <div style={{ fontFamily: stack(s.font.family), width: 260 }}>
          <button type="button" onClick={() => setFiles(['report.pdf'])} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px', borderRadius: s.radii.md, border: s.borderStyle === 'none' ? '1px dashed transparent' : `1px dashed ${s.colors.border}`, background: s.borderStyle === 'none' ? `${s.colors.primary}0d` : s.colors.surface, color: legible(s.colors.primary, s.colors.surface), fontSize: s.type.sm, fontWeight: s.weights.medium, cursor: 'pointer' }}><DsIcon name="plus" style={s.iconStyle ?? 'outlined'} size={16} />Add files</button>
          {files.map((f) => <div key={f} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, fontSize: s.type.sm, color: s.colors.text }}>{f}<button type="button" aria-label={`Remove ${f}`} onClick={() => setFiles([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.colors.textMuted }}><DsIcon name="trash" style={s.iconStyle ?? 'outlined'} size={14} /></button></div>)}
        </div>
      )
    }
    return <Demo />
  } },
  // Navigation ------------------------------------------------------------------
  { name: 'Header', category: 'Navigation', desc: 'The top bar that holds branding and primary navigation.', render: (s) => (
    <div style={{ width: '100%', maxWidth: 380, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden', fontFamily: stack(s.font.family) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: dsDivider(s) }}>
        <span style={{ fontFamily: stack(s.font.heading), fontWeight: s.weights.bold, color: s.colors.text, fontSize: s.type.md }}>{brandName(s)}</span>
        <span style={{ display: 'flex', gap: 16, fontSize: s.type.sm, color: s.colors.textMuted }}><span style={{ color: s.colors.text, fontWeight: s.weights.medium }}>Products</span><span>Pricing</span><span>About</span></span>
        <IButton s={s} color={s.colors.primary}>Sign in</IButton>
      </div>
    </div>
  ) },
  { name: 'Footer', category: 'Navigation', desc: 'The bottom area with secondary links and legal info.', render: (s) => (
    <div style={{ width: '100%', maxWidth: 380, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, padding: 18, fontFamily: stack(s.font.family) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
        {[['Product', ['Features', 'Pricing']], ['Company', ['About', 'Careers']], ['Legal', ['Privacy', 'Terms']]].map(([h, items]) => (
          <div key={h as string} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: s.colors.text, fontSize: s.type.xs, fontWeight: s.weights.semibold }}>{h as string}</span>
            {(items as string[]).map((i) => <span key={i} style={{ color: s.colors.textMuted, fontSize: s.type.xs }}>{i}</span>)}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: dsDivider(s), color: s.colors.textMuted, fontSize: s.type.xs }}>© 2026 {brandName(s)}</div>
    </div>
  ) },
  { name: 'SideNavigation', category: 'Navigation', desc: 'A vertical menu for moving between sections.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [sel, setSel] = useState(1)
      const items: [string, string][] = [['Overview', 'home'], ['Reports', 'image'], ['Members', 'user'], ['Settings', 'settings']]
      return (
        <div style={{ width: 200, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, padding: 8, display: 'flex', flexDirection: 'column', gap: 2, fontFamily: stack(s.font.family) }}>
          {items.map(([t, icon], i) => (
            <button key={t} type="button" onClick={() => setSel(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: s.radii.sm, fontSize: s.type.sm, fontWeight: i === sel ? s.weights.medium : s.weights.regular, color: i === sel ? s.colors.text : s.colors.textMuted, background: i === sel ? `${s.colors.primary}14` : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <DsIcon name={icon} style={s.iconStyle ?? 'outlined'} size={16} color={i === sel ? s.colors.primary : s.colors.textMuted} />{t}
            </button>
          ))}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'Breadcrumb', category: 'Navigation', desc: 'Shows where a page sits in the site hierarchy.', render: (s) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: s.colors.textMuted, fontSize: s.type.sm, fontFamily: stack(s.font.family) }}>
      <span style={{ color: legible(s.colors.primary, s.colors.bg), cursor: 'pointer' }}>Home</span><span>/</span><span style={{ color: legible(s.colors.primary, s.colors.bg), cursor: 'pointer' }}>Library</span><span>/</span><span style={{ color: s.colors.text }}>Data</span>
    </div>
  ) },
  { name: 'Tabs', category: 'Navigation', desc: 'Switches between views in the same context.', render: (s) => <ITabs s={s} items={['Overview', 'Activity', 'Settings']} /> },
  { name: 'ContentSwitcher', category: 'Navigation', desc: 'Toggles between a small number of related views.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [i, setI] = useState(0)
      const items = ['Day', 'Week', 'Month']
      const noOutline = s.borderStyle === 'none'
      // When outlines are off, use a filled track instead of a bordered segmented control.
      return (
        <div style={{ display: 'inline-flex', gap: noOutline ? 2 : 0, padding: noOutline ? 3 : 0, background: noOutline ? s.colors.surface : 'transparent', border: noOutline ? 'none' : `1px solid ${s.colors.primary}`, borderRadius: s.radii.md, overflow: 'hidden', fontFamily: stack(s.font.family) }}>
          {items.map((t, n) => <button key={t} type="button" onClick={() => setI(n)} style={{ padding: '6px 14px', fontSize: s.type.sm, fontWeight: s.weights.medium, background: n === i ? s.colors.primary : 'transparent', color: n === i ? onSolid(s.colors.primary) : legible(s.colors.primary, s.colors.surface), border: 'none', borderRadius: noOutline ? Math.max(0, s.radii.md - 3) : 0, borderLeft: !noOutline && n ? `1px solid ${s.colors.primary}` : 'none', cursor: 'pointer' }}>{t}</button>)}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'Pagination', category: 'Navigation', desc: 'Moves through pages of results.', render: (s) => <IPagination s={s} /> },
  { name: 'Stepper', category: 'Navigation', desc: 'Shows progress through a sequence of steps.', render: (s) => <div style={{ width: '100%', maxWidth: 360 }}><IStepper s={s} steps={['Account', 'Profile', 'Billing', 'Done']} /></div> },
  { name: 'StepByStep', category: 'Navigation', desc: 'A vertical list of ordered instructions.', render: (s) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, fontFamily: stack(s.font.family), width: 280 }}>
      {['Create your account', 'Verify your email', 'Invite your team'].map((t, i, arr) => (
        <div key={t} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ width: 26, height: 26, borderRadius: s.radii.pill, background: s.colors.primary, color: onSolid(s.colors.primary), display: 'grid', placeItems: 'center', fontSize: s.type.sm, fontWeight: s.weights.semibold, flexShrink: 0 }}>{i + 1}</span>
            {i < arr.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 18, background: s.colors.border }} />}
          </div>
          <div style={{ paddingBottom: 16 }}><div style={{ color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.medium }}>{t}</div><div style={{ color: s.colors.textMuted, fontSize: s.type.xs, marginTop: 2 }}>Step {i + 1} of {arr.length}</div></div>
        </div>
      ))}
    </div>
  ) },
  { name: 'Menu', category: 'Navigation', desc: 'A list of actions revealed from a trigger.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(true)
      return (
        <div style={{ fontFamily: stack(s.font.family) }}>
          <button type="button" onClick={() => setOpen((o) => !o)} style={btn(s, 'transparent', s.colors.text, s.colors.border)}>Account<DsIcon name="chevronDown" style={s.iconStyle ?? 'outlined'} size={14} /></button>
          {open && (
            <div style={{ width: 180, marginTop: 6, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow], overflow: 'hidden' }}>
              {['Profile', 'Settings', 'Sign out'].map((t) => <button key={t} type="button" style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: s.type.sm, color: s.colors.text, background: 'transparent', border: 'none', cursor: 'pointer' }}>{t}</button>)}
            </div>
          )}
        </div>
      )
    }
    return <Demo />
  } },

  // Containers ------------------------------------------------------------------
  { name: 'Card', category: 'Containers', desc: 'A surface that groups related content and actions.', render: (s) => (
    <div style={{ width: 240, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.lg, boxShadow: SHADOW_CSS[s.shadow], overflow: 'hidden', fontFamily: stack(s.font.family) }}>
      <div style={{ height: 72, background: s.colors.primary }} />
      <div style={{ padding: dims(s).cardPad }}>
        <div style={{ color: s.colors.text, fontSize: s.type.md, fontWeight: s.weights.semibold, fontFamily: stack(s.font.heading) }}>Card title</div>
        <div style={{ color: s.colors.textMuted, fontSize: s.type.sm, marginTop: 4 }}>A short supporting description for the card.</div>
        <div style={{ marginTop: 12 }}><IButton s={s} color={s.colors.primary}>Action</IButton></div>
      </div>
    </div>
  ) },
  { name: 'Accordion', category: 'Containers', desc: 'Expandable sections that hide and reveal content.', render: (s) => <IAccordion s={s} items={[{ q: 'How to publish data?', a: 'Open the dataset, choose Publish, and confirm the licence.' }, { q: 'How does billing work?', a: 'You are billed monthly for active seats only.' }, { q: 'Can I export?', a: 'Yes, export to CSV or JSON from any table.' }]} /> },
  { name: 'Dialog', category: 'Containers', desc: 'A focused overlay for a single task or decision.', render: (s) => (
    <div style={{ width: 300, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.lg, boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'medium' : s.shadow], overflow: 'hidden', fontFamily: stack(s.font.family) }}>
      <div style={{ padding: 18 }}>
        <div style={{ color: s.colors.text, fontSize: s.type.md, fontWeight: s.weights.semibold, fontFamily: stack(s.font.heading) }}>Delete project?</div>
        <div style={{ color: s.colors.textMuted, fontSize: s.type.sm, marginTop: 5, lineHeight: 1.5 }}>This action cannot be undone and will remove all associated files.</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 14px', borderTop: dsDivider(s) }}>
        <IButton s={s} color={s.colors.primary} variant="ghost">Cancel</IButton>
        <IButton s={s} color={s.colors.error}>Delete</IButton>
      </div>
    </div>
  ) },
  { name: 'Hero', category: 'Containers', desc: 'A large lead section that introduces a page.', render: (s) => (
    <div style={{ width: '100%', maxWidth: 400, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.lg, padding: 28, fontFamily: stack(s.font.family) }}>
      <div style={{ color: s.colors.text, fontSize: Math.min(30, s.type.xxl), fontWeight: look(s).headingWeight, fontFamily: stack(s.font.heading), lineHeight: 1.1, letterSpacing: '-0.01em' }}>Build it once, ship everywhere</div>
      <div style={{ color: s.colors.textMuted, fontSize: s.type.md, marginTop: 10, maxWidth: 320, lineHeight: 1.5 }}>A single set of tokens that keeps every screen consistent.</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}><IButton s={s} color={s.colors.primary}>Get started</IButton><IButton s={s} color={s.colors.primary} variant="ghost">Read docs</IButton></div>
    </div>
  ) },

  // Notifications ---------------------------------------------------------------
  { name: 'Notification', category: 'Notifications', desc: 'An inline message about the state of the system.', render: (s) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 300, fontFamily: stack(s.font.family) }}>
      {([['info', s.colors.info, 'Update available', 'A new version is ready to install.'], ['success', s.colors.success, 'Saved', 'Your changes have been stored.']] as const).map(([k, c, title, body]) => (
        <div key={k} style={{ display: 'flex', gap: 10, background: `${c}14`, border: s.borderStyle === 'none' ? '1px solid transparent' : `1px solid ${c}33`, borderRadius: s.radii.md, padding: 12 }}>
          <span style={{ color: c, marginTop: 1, flexShrink: 0 }}><DsIcon name={k === 'success' ? 'check' : 'info'} style={s.iconStyle ?? 'outlined'} size={16} /></span>
          <div><div style={{ color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.semibold }}>{title}</div><div style={{ color: s.colors.textMuted, fontSize: s.type.xs, marginTop: 2 }}>{body}</div></div>
        </div>
      ))}
    </div>
  ) },
  { name: 'Alert', category: 'Notifications', desc: 'A prominent message that needs attention.', render: (s) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 300, fontFamily: stack(s.font.family) }}>
      {([['success', s.colors.success, 'Saved successfully'], ['error', s.colors.error, 'Could not connect to the server']] as const).map(([k, c, t]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, background: `${c}14`, border: s.borderStyle === 'none' ? '1px solid transparent' : `1px solid ${c}33`, borderRadius: s.radii.md, padding: `${dims(s).fieldY}px ${dims(s).fieldX}px`, color: s.colors.text, fontSize: s.type.sm }}>
          <span style={{ color: c, display: 'grid', placeItems: 'center', flexShrink: 0 }}><DsIcon name={k === 'success' ? 'check' : 'close'} style={s.iconStyle ?? 'outlined'} size={15} /></span>{t}
        </div>
      ))}
    </div>
  ) },
  { name: 'CookieConsent', category: 'Notifications', desc: 'Informs people about cookie usage and choices.', render: (s) => <ICookieConsent s={s} /> },
  { name: 'Tooltip', category: 'Notifications', desc: 'A small hint shown on hover or focus.', render: (s) => <ITooltip s={s} /> },
  { name: 'Progress', category: 'Notifications', desc: 'Shows how far along a task is.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [v, setV] = useState(64)
      return (
        <div style={{ width: 240, fontFamily: stack(s.font.family) }}>
          <div style={{ width: '100%', height: 8, borderRadius: s.radii.pill, background: s.colors.border, overflow: 'hidden' }}><div style={{ height: '100%', width: `${v}%`, borderRadius: s.radii.pill, background: s.colors.primary, transition: transition(s) }} /></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button type="button" onClick={() => setV((x) => Math.max(0, x - 10))} style={btn(s, 'transparent', s.colors.text, s.colors.border)}>−10</button><button type="button" onClick={() => setV((x) => Math.min(100, x + 10))} style={btn(s, 'transparent', s.colors.text, s.colors.border)}>+10</button></div>
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'LoadingSpinner', category: 'Notifications', desc: 'Indicates that content is loading.', render: (s) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke={s.colors.border} strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke={s.colors.primary} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ) },
  { name: 'StatusLabel', category: 'Notifications', desc: 'A small label that shows a status with a colour.', render: (s) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: stack(s.font.family) }}>
      {([['Active', s.colors.success], ['Pending', s.colors.warning], ['Failed', s.colors.error], ['Info', s.colors.info]] as const).map(([t, c]) => { const fg = legible(c, s.colors.bg); return (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${fg}1f`, color: fg, borderRadius: s.radii.pill, padding: '3px 10px', fontSize: s.type.xs, fontWeight: s.weights.semibold }}><span style={{ width: 6, height: 6, borderRadius: s.radii.pill, background: fg }} />{t}</span>
      ) })}
    </div>
  ) },
  { name: 'Tag', category: 'Notifications', desc: 'A small label for categories or keywords.', render: (s) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: stack(s.font.family) }}>
      {['Design', 'Research', 'Code', 'Docs'].map((t) => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: s.colors.surface, color: s.colors.text, border: dsBorder(s), borderRadius: s.radii.pill, padding: '3px 5px 3px 11px', fontSize: s.type.sm }}>{t}<span style={{ width: 16, height: 16, display: 'grid', placeItems: 'center', color: s.colors.textMuted }}><DsIcon name="close" style={s.iconStyle ?? 'outlined'} size={12} /></span></span>
      ))}
    </div>
  ) },
  { name: 'Badge', category: 'Notifications', desc: 'A small count or status marker.', render: (s) => (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontFamily: stack(s.font.family) }}>
      <span style={{ position: 'relative', color: s.colors.text }}><DsIcon name="bell" style={s.iconStyle ?? 'outlined'} size={22} /><span style={{ position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, padding: '0 4px', borderRadius: s.radii.pill, background: s.colors.error, color: onSolid(s.colors.error), fontSize: 10, fontWeight: s.weights.bold, display: 'grid', placeItems: 'center' }}>3</span></span>
      <span style={{ position: 'relative', color: s.colors.text }}><DsIcon name="mail" style={s.iconStyle ?? 'outlined'} size={22} /><span style={{ position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: s.radii.pill, background: s.colors.primary, border: `2px solid ${s.colors.bg}` }} /></span>
    </div>
  ) },
  { name: 'Highlight', category: 'Notifications', desc: 'A callout that draws attention to key info.', render: (s) => (
    <div style={{ width: 320, background: `${s.colors.primary}12`, borderRadius: s.radii.md, padding: dims(s).cardPad, fontFamily: stack(s.font.family) }}>
      <div style={{ color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.semibold }}>Good to know</div>
      <div style={{ color: s.colors.text, fontSize: s.type.sm, marginTop: 4, lineHeight: 1.5, opacity: 0.85 }}>Tokens update every component at once, so you only change a value in one place.</div>
    </div>
  ) },

  // Data ------------------------------------------------------------------------
  { name: 'Table', category: 'Data', desc: 'Displays rows and columns of structured data.', render: (s) => (
    <div style={{ width: '100%', maxWidth: 340, border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden', fontFamily: stack(s.font.family), fontSize: s.type.sm }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', background: s.colors.surface, color: s.colors.text, fontWeight: s.weights.semibold, padding: '9px 12px', borderBottom: dsDivider(s) }}><span>Name</span><span>Role</span><span>Status</span></div>
      {[['Aino Laine', 'Admin', 'Active'], ['Eero Virta', 'Editor', 'Pending'], ['Liisa Koski', 'Viewer', 'Active']].map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', color: s.colors.textMuted, padding: '9px 12px', borderTop: i ? dsDivider(s) : 'none', alignItems: 'center' }}><span style={{ color: s.colors.text }}>{r[0]}</span><span>{r[1]}</span><span>{r[2]}</span></div>
      ))}
    </div>
  ) },
  { name: 'List', category: 'Data', desc: 'A simple vertical list of items.', render: (s) => (
    <div style={{ width: 240, border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden', fontFamily: stack(s.font.family), background: s.colors.surface }}>
      {['Item one', 'Item two', 'Item three'].map((t, i) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', fontSize: s.type.sm, color: s.colors.text, borderTop: i ? dsDivider(s) : 'none' }}>{t}<span style={{ color: s.colors.textMuted }}><DsIcon name="chevronRight" style={s.iconStyle ?? 'outlined'} size={14} /></span></div>
      ))}
    </div>
  ) },
  { name: 'Avatar', category: 'Data', desc: 'Represents a person or entity.', render: (s) => (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {([['AK', s.colors.primary], ['JD', s.colors.secondary], ['MR', s.colors.tertiary], ['+5', s.colors.border]] as const).map(([t, c], i) => (
        <span key={t} style={{ width: 36, height: 36, marginLeft: i ? -8 : 0, borderRadius: s.radii.pill, background: c, color: c === s.colors.border ? s.colors.text : onSolid(c), display: 'grid', placeItems: 'center', fontSize: s.type.xs, fontWeight: s.weights.semibold, fontFamily: stack(s.font.family), border: `2px solid ${s.colors.bg}` }}>{t}</span>
      ))}
    </div>
  ) },
  { name: 'Chip', category: 'Data', desc: 'A compact, often removable, piece of information.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [chips, setChips] = useState(['Design', 'Research', 'Code'])
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: stack(s.font.family) }}>
          {chips.map((t) => <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: s.colors.surface, color: s.colors.text, border: dsBorder(s), borderRadius: s.radii.pill, padding: '3px 5px 3px 11px', fontSize: s.type.sm }}>{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setChips((c) => c.filter((x) => x !== t))} style={{ width: 16, height: 16, display: 'grid', placeItems: 'center', color: s.colors.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}><DsIcon name="close" style={s.iconStyle ?? 'outlined'} size={12} /></button></span>)}
          {chips.length === 0 && <button type="button" onClick={() => setChips(['Design', 'Research', 'Code'])} style={{ ...btn(s, 'transparent', s.colors.textMuted, s.colors.border), fontSize: s.type.xs }}>Reset</button>}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'CodeSnippet', category: 'Data', desc: 'Shows a block of copyable code.', render: (s) => (
    <div style={{ width: 280, background: s.base === 'dark' ? '#0b0f17' : '#0f172a', borderRadius: s.radii.md, padding: '12px 14px', fontFamily: 'ui-monospace, monospace', fontSize: s.type.xs, color: '#e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span><span style={{ color: s.colors.tertiary }}>npm</span> install design-system</span>
      <span style={{ color: '#94a3b8', cursor: 'pointer' }}><DsIcon name="copy" style={s.iconStyle ?? 'outlined'} size={14} /></span>
    </div>
  ) },

  // Visual ----------------------------------------------------------------------
  { name: 'Title', category: 'Visual', desc: 'A page or section heading with a subtitle.', render: (s) => (
    <div style={{ fontFamily: stack(s.font.heading), color: s.colors.text }}>
      <div style={{ fontSize: Math.min(32, s.type.xxl), fontWeight: look(s).headingWeight, lineHeight: 1.1, letterSpacing: '-0.01em' }}>Heading</div>
      <div style={{ fontSize: s.type.md, color: s.colors.textMuted, fontFamily: stack(s.font.family), marginTop: 5 }}>Supporting subtitle text</div>
    </div>
  ) },
  { name: 'Divider', category: 'Visual', desc: 'A line that separates content.', render: (s) => (
    <div style={{ width: 260, fontFamily: stack(s.font.family) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: s.colors.textMuted, fontSize: s.type.xs }}><span style={{ flex: 1, height: 1, background: s.colors.border }} />or<span style={{ flex: 1, height: 1, background: s.colors.border }} /></div>
    </div>
  ) },
  { name: 'Icon', category: 'Visual', desc: 'The icon set drawn in the system style.', render: (s) => (
    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: s.colors.text }}>
      {['home', 'search', 'heart', 'star', 'bell', 'settings', 'mail', 'calendar'].map((n) => <DsIcon key={n} name={n} style={s.iconStyle ?? 'outlined'} size={24} />)}
    </div>
  ) },
  { name: 'Logo', category: 'Visual', desc: 'A simple wordmark drawn in the heading font.', render: (s) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: stack(s.font.heading) }}>
      <span style={{ width: 30, height: 30, borderRadius: s.radii.md, background: s.colors.primary, display: 'grid', placeItems: 'center', color: onSolid(s.colors.primary), fontWeight: s.weights.bold, fontSize: s.type.md }}>{brandName(s).charAt(0).toUpperCase()}</span>
      <span style={{ color: s.colors.text, fontWeight: s.weights.bold, fontSize: s.type.lg, letterSpacing: '-0.01em' }}>{brandName(s)}</span>
    </div>
  ) },
  { name: 'Koros', category: 'Visual', desc: 'A decorative wave shape used as a section edge.', render: (s) => (
    <div style={{ width: 320, fontFamily: stack(s.font.family) }}>
      <div style={{ background: s.colors.primary, borderTopLeftRadius: s.radii.md, borderTopRightRadius: s.radii.md, padding: '18px 16px 6px', color: onSolid(s.colors.primary), fontSize: s.type.sm }}>Section content</div>
      <svg width="320" height="20" viewBox="0 0 320 20" preserveAspectRatio="none" style={{ display: 'block' }}><path d="M0 0 Q 20 20 40 0 T 80 0 T 120 0 T 160 0 T 200 0 T 240 0 T 280 0 T 320 0 V0 H0 Z" fill={s.colors.primary} /></svg>
    </div>
  ) },

  // Actions, continued ----------------------------------------------------------
  { name: 'MenuButton', category: 'Actions', desc: 'One button whose whole face opens a menu of related actions.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(false)
      return (
        <div style={{ fontFamily: stack(s.font.family), position: 'relative' }}>
          <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ ...fillBtn(s, s.colors.primary), transition: transition(s) }}>
            Actions<DsIcon name="chevronDown" style={s.iconStyle ?? 'outlined'} size={14} />
          </button>
          {open && <IMenuList s={s} items={['Duplicate', 'Move to…', 'Archive']} />}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'ComboButton', category: 'Actions', desc: 'A primary action with a second, smaller trigger for its alternatives.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(false)
      const r = s.radii.md
      const base = fillBtn(s, s.colors.primary)
      return (
        <div style={{ fontFamily: stack(s.font.family), position: 'relative' }}>
          <div style={{ display: 'inline-flex' }}>
            <button type="button" style={{ ...base, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRadius: `${r}px 0 0 ${r}px`, transition: transition(s) }}>Publish</button>
            <span style={{ width: 1, background: `${onSolid(s.colors.primary)}33` }} />
            <button type="button" aria-label="More publish options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
              style={{ ...base, padding: `${dims(s).padY}px ${Math.round(dims(s).padX * 0.6)}px`, borderRadius: `0 ${r}px ${r}px 0`, transition: transition(s) }}>
              <DsIcon name="chevronDown" style={s.iconStyle ?? 'outlined'} size={14} />
            </button>
          </div>
          {open && <IMenuList s={s} items={['Publish and notify', 'Schedule…', 'Save as draft']} />}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'OverflowMenu', category: 'Actions', desc: 'An icon-only trigger that holds the actions a row has no room for.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(false)
      const [hover, setHover] = useState(false)
      return (
        <div style={{ fontFamily: stack(s.font.family), position: 'relative' }}>
          <button type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: s.radii.sm, border: 'none', cursor: 'pointer', color: s.colors.text, background: open || hover ? `${s.colors.text}0f` : 'transparent', transition: transition(s) }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="8" cy="13" r="1.5" /></svg>
          </button>
          {open && <IMenuList s={s} items={['Rename', 'Duplicate', 'Delete']} danger />}
        </div>
      )
    }
    return <Demo />
  } },

  // Forms, continued ------------------------------------------------------------
  { name: 'TreeView', category: 'Navigation', desc: 'A nested list whose branches expand to show what is inside them.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState<Record<string, boolean>>({ Design: true })
      const [sel, setSel] = useState('Tokens')
      const tree: { label: string; children?: string[] }[] = [
        { label: 'Design', children: ['Tokens', 'Components', 'Patterns'] },
        { label: 'Engineering', children: ['Packages', 'Releases'] },
        { label: 'Guidelines' }
      ]
      const row = (label: string, depth: number, node: boolean, expanded?: boolean, onClick?: () => void): JSX.Element => {
        const active = sel === label
        return (
          <button key={label} type="button" onClick={onClick} aria-expanded={node ? expanded : undefined} aria-current={active ? 'true' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: `6px 10px 6px ${10 + depth * 16}px`, border: 'none', cursor: 'pointer', fontSize: s.type.sm, fontFamily: stack(s.font.family), color: active ? s.colors.text : s.colors.textMuted, fontWeight: active ? s.weights.medium : s.weights.regular, background: active ? `${s.colors.primary}1a` : 'transparent', borderLeft: `2px solid ${active ? s.colors.primary : 'transparent'}`, transition: transition(s) }}>
            <span style={{ width: 12, display: 'grid', placeItems: 'center', opacity: node ? 1 : 0 }}>
              <span style={{ display: 'grid', transform: expanded ? 'rotate(90deg)' : 'none', transition: transition(s) }}><DsIcon name="chevronRight" style={s.iconStyle ?? 'outlined'} size={12} /></span>
            </span>
            {label}
          </button>
        )
      }
      return (
        <div role="tree" style={{ width: 232, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, padding: '6px 0', overflow: 'hidden' }}>
          {tree.map((n) => (
            <div key={n.label} role="treeitem" aria-expanded={n.children ? !!open[n.label] : undefined}>
              {row(n.label, 0, !!n.children, !!open[n.label], () => { if (n.children) setOpen((o) => ({ ...o, [n.label]: !o[n.label] })); else setSel(n.label) })}
              {n.children && open[n.label] && n.children.map((c) => row(c, 1, false, undefined, () => setSel(c)))}
            </div>
          ))}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'RightPanel', category: 'Navigation', desc: 'A panel that slides in from the edge to hold details without leaving the page.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(true)
      return (
        <div style={{ width: 340, height: 208, position: 'relative', overflow: 'hidden', border: dsBorder(s), borderRadius: s.radii.md, background: s.colors.bg, fontFamily: stack(s.font.family) }}>
          <div style={{ padding: 14 }}>
            <div style={{ color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.medium }}>Page content</div>
            <div style={{ marginTop: 10 }}><IButton s={s} color={s.colors.primary} size="sm" onClick={() => setOpen((o) => !o)}>{open ? 'Close panel' : 'Open panel'}</IButton></div>
          </div>
          <aside aria-hidden={!open} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 188, background: s.colors.surface, borderLeft: dsBorder(s), boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow], transform: open ? 'translateX(0)' : 'translateX(100%)', transition: `transform ${s.motion.normal || 200}ms ${s.motion.easing}`, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.semibold, fontFamily: stack(s.font.heading) }}>Details</span>
              <button type="button" aria-label="Close panel" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.colors.textMuted, display: 'grid' }}><DsIcon name="close" style={s.iconStyle ?? 'outlined'} size={14} /></button>
            </div>
            {['Owner', 'Updated', 'Status'].map((k, i) => (
              <div key={k} style={{ marginTop: 12 }}>
                <div style={{ color: s.colors.textMuted, fontSize: s.type.xs }}>{k}</div>
                <div style={{ color: s.colors.text, fontSize: s.type.sm, marginTop: 2 }}>{['Design team', 'Today', 'In review'][i]}</div>
              </div>
            ))}
          </aside>
        </div>
      )
    }
    return <Demo />
  } },

  // Containers, continued -------------------------------------------------------
  { name: 'Popover', category: 'Containers', desc: 'A small floating surface that holds content next to whatever opened it.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(true)
      return (
        <div style={{ position: 'relative', fontFamily: stack(s.font.family), paddingBottom: open ? 96 : 0 }}>
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={btn(s, 'transparent', s.colors.text, s.colors.border)}>Filters</button>
          {open && (
            <div role="dialog" aria-label="Filters" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, width: 216, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow], padding: 12 }}>
              <span style={{ position: 'absolute', top: -5, left: 18, width: 8, height: 8, background: s.colors.surface, borderLeft: dsBorder(s), borderTop: dsBorder(s), transform: 'rotate(45deg)' }} />
              <div style={{ color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.medium, marginBottom: 8 }}>Show</div>
              <div style={{ display: 'grid', gap: 7 }}>
                <ICheck s={s} label="Published" defaultOn />
                <ICheck s={s} label="Drafts" />
                <ICheck s={s} label="Archived" />
              </div>
            </div>
          )}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'AspectRatio', category: 'Containers', desc: 'Holds a fixed shape for media so nothing shifts while it loads.', render: (s) => {
    const Demo = (): JSX.Element => {
      const ratios: [string, number][] = [['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1]]
      const [pick, setPick] = useState(0)
      const [label, r] = ratios[pick]
      return (
        <div style={{ width: 260, fontFamily: stack(s.font.family) }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {ratios.map(([l], i) => (
              <button key={l} type="button" onClick={() => setPick(i)} style={{ padding: '4px 10px', fontSize: s.type.xs, borderRadius: s.radii.sm, cursor: 'pointer', border: dsBorder(s), background: i === pick ? `${s.colors.primary}1a` : 'transparent', color: i === pick ? s.colors.text : s.colors.textMuted, transition: transition(s) }}>{l}</button>
            ))}
          </div>
          <div style={{ width: '100%', aspectRatio: String(r), background: `${s.colors.primary}1f`, border: dsBorder(s), borderRadius: s.radii.md, display: 'grid', placeItems: 'center', color: s.colors.textMuted, fontSize: s.type.sm, transition: transition(s) }}>{label}</div>
        </div>
      )
    }
    return <Demo />
  } },

  // Notifications, continued ----------------------------------------------------
  { name: 'Toggletip', category: 'Notifications', desc: 'Like a tooltip, but it stays open so the content inside can be used.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(true)
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: stack(s.font.family), position: 'relative', paddingBottom: open ? 78 : 0 }}>
          <span style={{ color: s.colors.text, fontSize: s.type.sm }}>Monthly spend</span>
          <button type="button" aria-label="About monthly spend" aria-expanded={open} onClick={() => setOpen((o) => !o)}
            style={{ width: 18, height: 18, borderRadius: s.radii.pill, border: dsBorder(s), background: 'transparent', color: s.colors.textMuted, cursor: 'pointer', fontSize: 11, display: 'grid', placeItems: 'center', padding: 0, transition: transition(s) }}>i</button>
          {open && (
            <div role="dialog" style={{ position: 'absolute', top: 26, left: 0, width: 212, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow], padding: 10 }}>
              <div style={{ color: s.colors.text, fontSize: s.type.xs, lineHeight: 1.5 }}>Spend is totalled on the first of each month and excludes tax.</div>
              <button type="button" style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: s.colors.primary, fontSize: s.type.xs, fontWeight: s.weights.medium, fontFamily: stack(s.font.family) }}>Read the billing guide</button>
            </div>
          )}
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'InlineLoading', category: 'Notifications', desc: 'Reports the progress of one action in the place the action was taken.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [state, setState] = useState<'idle' | 'active' | 'done' | 'error'>('active')
      const tone = state === 'error' ? s.colors.error : state === 'done' ? s.colors.success : s.colors.primary
      const text = { idle: 'Not started', active: 'Saving…', done: 'Saved', error: 'Could not save' }[state]
      return (
        <div style={{ fontFamily: stack(s.font.family), display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 20 }}>
            {state === 'active' && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="9" stroke={s.colors.border} strokeWidth="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke={tone} strokeWidth="3" strokeLinecap="round" /></svg>}
            {state === 'done' && <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6.6" /><path d="M5 8.4l2.2 2.2L11.2 6" /></svg>}
            {state === 'error' && <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round"><circle cx="8" cy="8" r="6.6" /><path d="M8 4.8v4M8 11.1v.1" /></svg>}
            {state === 'idle' && <span style={{ width: 16 }} />}
            <span style={{ color: state === 'idle' ? s.colors.textMuted : s.colors.text, fontSize: s.type.sm }}>{text}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['idle', 'active', 'done', 'error'] as const).map((k) => (
              <button key={k} type="button" onClick={() => setState(k)} style={{ padding: '3px 9px', fontSize: s.type.xs, borderRadius: s.radii.sm, cursor: 'pointer', border: dsBorder(s), background: state === k ? `${s.colors.primary}1a` : 'transparent', color: state === k ? s.colors.text : s.colors.textMuted, transition: transition(s) }}>{k}</button>
            ))}
          </div>
        </div>
      )
    }
    return <Demo />
  } },
  { name: 'AILabel', category: 'Notifications', desc: 'Marks content a model produced, and explains itself when opened.', render: (s) => {
    const Demo = (): JSX.Element => {
      const [open, setOpen] = useState(false)
      return (
        <div style={{ fontFamily: stack(s.font.family), position: 'relative', paddingBottom: open ? 92 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: s.colors.text, fontSize: s.type.sm }}>Suggested summary</span>
            <button type="button" aria-label="Explain this AI result" aria-expanded={open} onClick={() => setOpen((o) => !o)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: s.radii.pill, cursor: 'pointer', border: `1px solid ${s.colors.primary}66`, background: `${s.colors.primary}14`, color: legible(s.colors.primary, s.colors.bg), fontSize: s.type.xs, fontWeight: s.weights.medium, fontFamily: stack(s.font.family), transition: transition(s) }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1.6 4.4L14 7l-4.4 1.6L8 13l-1.6-4.4L2 7l4.4-1.6z" /></svg>AI
            </button>
          </div>
          {open && (
            <div role="dialog" style={{ position: 'absolute', top: 28, left: 0, width: 244, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow], padding: 12 }}>
              <div style={{ color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.medium }}>How this was made</div>
              <div style={{ color: s.colors.textMuted, fontSize: s.type.xs, marginTop: 5, lineHeight: 1.5 }}>Written from the last 30 days of activity in this project. Check it before you send it on.</div>
            </div>
          )}
        </div>
      )
    }
    return <Demo />
  } },

  // Data, continued -------------------------------------------------------------
  { name: 'ContainedList', category: 'Data', desc: 'A named list held inside its own surface, for a set that belongs together.', render: (s) => (
    <div style={{ width: 264, background: s.colors.surface, border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden', fontFamily: stack(s.font.family) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderBottom: dsDivider(s), background: `${s.colors.text}08` }}>
        <span style={{ color: s.colors.text, fontSize: s.type.sm, fontWeight: s.weights.semibold, fontFamily: stack(s.font.heading) }}>Members</span>
        <span style={{ color: s.colors.textMuted, fontSize: s.type.xs }}>3</span>
      </div>
      {['Ada Lovelace', 'Grace Hopper', 'Alan Turing'].map((n, i) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', borderTop: i ? dsDivider(s) : 'none' }}>
          <span style={{ color: s.colors.text, fontSize: s.type.sm }}>{n}</span>
          <span style={{ color: s.colors.textMuted, fontSize: s.type.xs }}>{['Owner', 'Editor', 'Viewer'][i]}</span>
        </div>
      ))}
    </div>
  ) },
  { name: 'StructuredList', category: 'Data', desc: 'Rows of related values, one of which can be chosen.', render: (s) => {
    const Demo = (): JSX.Element => {
      const rows = [['Starter', '5 seats', 'Free'], ['Team', '25 seats', '£40/mo'], ['Business', 'Unlimited', '£120/mo']]
      const [sel, setSel] = useState(1)
      return (
        <div role="radiogroup" style={{ width: 320, border: dsBorder(s), borderRadius: s.radii.md, overflow: 'hidden', fontFamily: stack(s.font.family) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 24px', gap: 10, padding: '8px 12px', borderBottom: dsDivider(s), color: s.colors.textMuted, fontSize: s.type.xs, fontWeight: s.weights.medium }}>
            <span>Plan</span><span>Seats</span><span>Price</span><span />
          </div>
          {rows.map((r, i) => (
            <button key={r[0]} type="button" role="radio" aria-checked={sel === i} onClick={() => setSel(i)}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto 24px', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 12px', borderTop: i ? dsDivider(s) : 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', cursor: 'pointer', background: sel === i ? `${s.colors.primary}12` : 'transparent', color: s.colors.text, fontSize: s.type.sm, fontFamily: stack(s.font.family), transition: transition(s) }}>
              <span style={{ fontWeight: sel === i ? s.weights.medium : s.weights.regular }}>{r[0]}</span>
              <span style={{ color: s.colors.textMuted }}>{r[1]}</span>
              <span>{r[2]}</span>
              <span style={{ display: 'grid', placeItems: 'center', color: s.colors.primary }}>{sel === i && <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 8.5l3.2 3.2L13 5" /></svg>}</span>
            </button>
          ))}
        </div>
      )
    }
    return <Demo />
  } }
]
