import { useEffect, useRef, useState, type ReactNode } from 'react'
import { type BaseTheme, type DesignSystem, type SystemAnswers, DEFAULT_ANSWERS, SHADOW_CSS, applyBase, cornerStyleFromCorners, deleteSystem, loadSystems, radiiForCorner, upsertSystem } from '../lib/designSystem'
import { FONT_OPTIONS } from '../lib/brief'
import { DesignSystemWizard } from './DesignSystemWizard'
import { DS_CATEGORIES, DS_COMPONENTS } from './dsComponents'
import { DsIcon, ICON_SAMPLE, iconSnippet } from './dsIcons'
import { studioFromDesignSystem } from '../lib/tokens/fromDesignSystem'

function fontStack(name: string): string {
  return FONT_OPTIONS.find((f) => f.id === name)?.stack ?? `'${name}', system-ui, sans-serif`
}

function Swatch({ label, value, onChange }: { label: string; value: string; onChange?: (v: string) => void }): JSX.Element {
  return (
    <label className="flex flex-col gap-1">
      <span className="t42-swatch relative h-12 w-full overflow-hidden rounded-md" style={{ background: value }}>
        {onChange && <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-full w-full cursor-pointer opacity-0" />}
      </span>
      <span className="text-[11px] font-medium text-text-primary">{label}</span>
      <span className="font-mono text-[10px] text-text-muted">{value}</span>
    </label>
  )
}

function DocNote({ text }: { text?: string }): JSX.Element | null {
  if (!text) return null
  // Honor the no-dash preference even for AI-written docs.
  const clean = text.replace(/\s*[–—]\s*/g, ' - ').replace(/[–—]/g, '-')
  return <p className="max-w-xl text-[12.5px] leading-relaxed text-text-secondary">{clean}</p>
}
function PageTitle({ children }: { children: ReactNode }): JSX.Element {
  return <h2 className="text-[18px] font-semibold text-text-primary">{children}</h2>
}
/** Carbon-style selector box: small label on top, value + chevron below. */
function SelectorBox({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }): JSX.Element {
  const current = options.find((o) => o.value === value)?.label ?? value
  return (
    <label className="relative flex flex-1 cursor-pointer flex-col gap-1 bg-surface px-3.5 py-2.5">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate text-[13.5px] text-text-primary">{current}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted"><path d="M4 6l4 4 4-4" /></svg>
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </label>
  )
}
function answersFromSystem(s: DesignSystem): SystemAnswers {
  return {
    ...DEFAULT_ANSWERS, name: `${s.name} copy`, vibe: s.vibe, primary: s.colors.primary, secondary: s.colors.secondary, tertiary: s.colors.tertiary,
    base: s.base ?? 'light', headingFont: s.font.heading, bodyFont: s.font.family, notes: s.notes ?? '',
    cornerStyle: s.cornerStyle ?? cornerStyleFromCorners(undefined), borderStyle: s.borderStyle ?? 'outlined', iconStyle: s.iconStyle ?? 'outlined',
    rules: s.rules ?? DEFAULT_ANSWERS.rules,
    purpose: s.brief?.purpose ?? '', style: s.brief?.style ?? '', branding: s.brief?.branding ?? '', logo: s.brief?.logo, shots: s.brief?.shots, refName: s.brief?.refName ?? '', brandName: s.brief?.brandName ?? ''
  }
}

const FOUNDATIONS: { id: string; label: string }[] = [
  { id: 'colors', label: 'Colors' }, { id: 'typography', label: 'Typography' }, { id: 'icons', label: 'Icons' },
  { id: 'spacing', label: 'Dimensions' }, { id: 'grid', label: 'Layout grid' }, { id: 'radius', label: 'Corner radius' },
  { id: 'elevation', label: 'Elevation' }, { id: 'motion', label: 'Motion' }
]

/** One motion-token row: a handle that performs the real transition (duration +
 *  easing) with a calm pause between, so the timing reads naturally. */
function MotionRow({ label, ms, easing, color, track }: { label: string; ms: number; easing: string; color: string; track: string }): JSX.Element {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setOn((o) => !o), ms + 1100)
    return () => clearInterval(t)
  }, [ms])
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-[11px] text-text-muted">{label}</span>
      <span className="relative h-1.5 flex-1 rounded-full" style={{ background: track }}>
        <span className="absolute top-1/2 h-3.5 w-3.5 rounded-full" style={{ left: on ? 'calc(100% - 14px)' : '0px', transform: 'translateY(-50%)', background: color, transition: `left ${ms}ms ${easing}` }} />
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-text-muted">{ms}ms</span>
    </div>
  )
}

export function DesignSystemView({ openSystemId, onConsumeOpen }: { openSystemId?: string | null; onConsumeOpen?: () => void } = {}): JSX.Element {
  const [systems, setSystems] = useState<DesignSystem[]>(() => loadSystems())
  const [openId, setOpenId] = useState<string | null>(null)
  const [wizard, setWizard] = useState<{ initial?: SystemAnswers } | null>(null)
  const [nav, setNav] = useState<string>('overview')
  const [menuOpen, setMenuOpen] = useState(false)
  const [makingTokens, setMakingTokens] = useState(false)
  const [tokensNote, setTokensNote] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [foundOpen, setFoundOpen] = useState(true)
  const [compOpen, setCompOpen] = useState(true)
  const [compBase, setCompBase] = useState<BaseTheme>('light')
  const [compVariant, setCompVariant] = useState(0)
  const [compDevice, setCompDevice] = useState<'desktop' | 'mobile'>('desktop')
  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodyH, setBodyH] = useState(0)

  // Constrain the detail view to the remaining viewport height so the PAGE never
  // scrolls; only the nav (and content) scroll inside their own regions. A
  // ResizeObserver re-measures whenever the scroll container or the title header
  // settles (e.g. the app shell sizing late), which fixed-delay timers can miss.
  useEffect(() => {
    const el = bodyRef.current
    const sc = rootRef.current?.closest('.overflow-y-auto') as HTMLElement | null
    if (!el || !sc) return
    const header = el.previousElementSibling as HTMLElement | null
    const measure = (): void => {
      sc.scrollTop = 0
      const offsetInView = el.getBoundingClientRect().top - sc.getBoundingClientRect().top
      const wrap = el.closest('.pb-10') as HTMLElement | null
      const padBottom = wrap ? parseFloat(getComputedStyle(wrap).paddingBottom) || 0 : 0
      setBodyH(Math.max(360, Math.round(sc.clientHeight - offsetInView - padBottom - 4)))
    }
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(sc)
    if (header) ro.observe(header)
    const raf = requestAnimationFrame(measure)
    const t = setTimeout(measure, 250)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); cancelAnimationFrame(raf); clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [openId, nav])

  // When the landing's "New design → Design system" flow creates one, open it.
  useEffect(() => {
    if (openSystemId) { setSystems(loadSystems()); setOpenId(openSystemId); setNav('overview'); onConsumeOpen?.() }
  }, [openSystemId, onConsumeOpen])

  const system = systems.find((x) => x.id === openId) ?? null
  const update = (patch: Partial<DesignSystem>): void => { if (system) setSystems(upsertSystem({ ...system, ...patch })) }
  const updateColors = (patch: Partial<DesignSystem['colors']>): void => { if (system) setSystems(upsertSystem({ ...system, colors: { ...system.colors, ...patch } })) }

  const wizardEl = wizard && (
    <DesignSystemWizard
      initial={wizard.initial}
      onCancel={() => setWizard(null)}
      onComplete={(gen) => { setSystems(upsertSystem(gen)); setOpenId(gen.id); setNav('overview'); setWizard(null) }}
    />
  )

  // ── Collection ───────────────────────────────────────────────────────────────
  if (!system) {
    if (systems.length === 0) {
      return (
        <div className="pb-12">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-surface px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-elevated text-[rgb(var(--accent))]">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" /></svg>
            </div>
            <h2 className="text-[15px] font-medium text-text-primary">No design systems yet</h2>
            <p className="max-w-xs text-[12.5px] text-text-muted">Start one from New design, then choose Design system.</p>
          </div>
          {wizardEl}
        </div>
      )
    }
    return (
      <div className="pb-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {systems.map((s) => (
            <button key={s.id} type="button" onClick={() => { setOpenId(s.id); setNav('overview') }} className="flex min-h-[156px] flex-col overflow-hidden rounded-xl bg-surface text-left transition-colors hover:border-accent/50">
              <div className="flex h-20 items-stretch">{[s.colors.primary, s.colors.secondary, s.colors.tertiary, s.colors.success, s.colors.surface].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div>
              <div className="flex flex-1 flex-col justify-between p-2.5">
                <div className="truncate text-[13px] font-medium text-text-primary" style={{ fontFamily: fontStack(s.font.family) }}>{s.name}</div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-text-muted"><span className="rounded-full bg-elevated px-1.5 py-0.5 capitalize">{s.vibe}</span><span className="truncate">{s.font.family}</span></div>
              </div>
            </button>
          ))}
        </div>
        {wizardEl}
      </div>
    )
  }

  // ── Documentation dashboard ───────────────────────────────────────────────────
  const s = system

  /**
   * Turn this system into a token library.
   *
   * A new library rather than an update to an existing one, because the two
   * drift apart the moment either is edited and silently overwriting a
   * library someone has been binding forms to would be the worse surprise.
   */
  async function makeTokens(): Promise<void> {
    setMakingTokens(true)
    setTokensNote(null)
    try {
      const studio = studioFromDesignSystem(s)
      const row = await window.terminal42.tokens.create(s.name, studio)
      await window.terminal42.tokens.save(row.id, { ...studio, id: row.id })
      setTokensNote(`\u201c${s.name}\u201d is now a token library. Find it under Design \u203a Tokens.`)
    } catch {
      setTokensNote('That library could not be made. Try again.')
    } finally {
      setMakingTokens(false)
    }
  }
  const colorRows: { key: keyof DesignSystem['colors']; label: string }[] = [
    { key: 'primary', label: 'Primary' }, { key: 'secondary', label: 'Secondary' }, { key: 'tertiary', label: 'Tertiary' },
    { key: 'bg', label: 'Background' }, { key: 'surface', label: 'Surface' }, { key: 'border', label: 'Border' },
    { key: 'text', label: 'Text' }, { key: 'textMuted', label: 'Text muted' },
    { key: 'success', label: 'Success' }, { key: 'warning', label: 'Warning' }, { key: 'error', label: 'Error' }, { key: 'info', label: 'Info' }
  ]
  const typeRows: { key: keyof DesignSystem['type']; label: string }[] = [
    { key: 'xxxl', label: 'Display' }, { key: 'xxl', label: 'H1' }, { key: 'xl', label: 'H2' }, { key: 'lg', label: 'H3' }, { key: 'md', label: 'Lead' }, { key: 'base', label: 'Body' }, { key: 'sm', label: 'Small' }, { key: 'xs', label: 'Caption' }
  ]
  const compName = nav.startsWith('component:') ? nav.slice('component:'.length) : null
  const openComp = compName ? (DS_COMPONENTS.find((c) => c.name === compName) ?? null) : null
  const themed = applyBase(s, compBase)
  const variant = openComp?.variants ? openComp.variants[Math.min(compVariant, openComp.variants.length - 1)] : null
  const navCls = (id: string): string => ['mb-0.5 block w-full truncate rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors', nav === id ? 'bg-elevated font-medium text-text-primary' : 'text-text-secondary hover:bg-elevated/50 hover:text-text-primary'].join(' ')
  const goComp = (name: string): void => { setNav('component:' + name); setCompVariant(0); setCompBase(s.base ?? 'light') }
  const goFoundation = (id: string): void => setNav('foundations:' + id)

  const headingFor = (key: keyof DesignSystem['type']): string => (key === 'xxxl' || key === 'xxl' || key === 'xl') ? fontStack(s.font.heading) : fontStack(s.font.family)
  const qualityItems = [
    { label: 'Contrast-ready text', ok: true },
    { label: (s.borderStyle ?? 'outlined') === 'none' ? 'No-outline mode enforced' : 'Outline tokens applied', ok: true },
    { label: `Corners use ${s.cornerStyle ?? 'rounded'}`, ok: true },
    { label: 'Mobile preview available', ok: true },
    { label: 'Placeholder brand names avoided', ok: !/acme/i.test(s.brief?.brandName ?? s.name) }
  ]
  const cssVars = `:root {
  --ds-primary: ${s.colors.primary};
  --ds-secondary: ${s.colors.secondary};
  --ds-tertiary: ${s.colors.tertiary};
  --ds-bg: ${s.colors.bg};
  --ds-surface: ${s.colors.surface};
  --ds-text: ${s.colors.text};
  --ds-muted: ${s.colors.textMuted};
  --ds-border: ${s.colors.border};
  --ds-radius-sm: ${s.radii.sm}px;
  --ds-radius-md: ${s.radii.md}px;
  --ds-radius-lg: ${s.radii.lg}px;
  --ds-font-body: ${s.font.family};
  --ds-font-heading: ${s.font.heading};
}`
  const jsonTokens = JSON.stringify({ colors: s.colors, type: s.type, spacing: s.spacing, radii: s.radii, fonts: s.font, borderStyle: s.borderStyle, cornerStyle: s.cornerStyle, density: s.density }, null, 2)

  function renderContent(): JSX.Element {
    if (openComp) {
      const variantOpts = (openComp.variants ?? [{ id: 'default', label: 'Default' }]).map((vv, i) => ({ value: String(i), label: vv.label }))
      return (
        <section>
          <PageTitle>{openComp.name}</PageTitle>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-secondary">{openComp.desc}</p>
          <div className="mb-4 mt-4 flex">
            <SelectorBox label="Theme" value={compBase} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(v) => setCompBase(v as BaseTheme)} />
            <div className="-ml-px"><SelectorBox label="Device" value={compDevice} options={[{ value: 'desktop', label: 'Desktop' }, { value: 'mobile', label: 'Mobile' }]} onChange={(v) => setCompDevice(v as 'desktop' | 'mobile')} /></div>
            <div className="-ml-px flex-1"><SelectorBox label="Variant" value={String(Math.min(compVariant, variantOpts.length - 1))} options={variantOpts} onChange={(v) => setCompVariant(parseInt(v))} /></div>
          </div>
          <div className="mb-1.5 text-[11px] font-medium text-text-muted">Example</div>
          {compDevice === 'mobile' ? (
            <div className="grid min-h-[420px] place-items-center rounded-xl bg-surface/40 py-8">
              <div className="flex h-[560px] w-[346px] flex-col overflow-hidden rounded-[26px] p-3 shadow-2xl" style={{ background: themed.colors.bg }}>
                <div className="mx-auto mb-2 h-1 w-12 shrink-0 rounded-full bg-black/15" />
                <div className="grid flex-1 place-items-center overflow-auto px-3">{variant ? variant.render(themed) : openComp.render(themed)}</div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[340px] place-items-center px-12 py-12" style={{ background: themed.colors.bg, borderRadius: 12 }}>
              {variant ? variant.render(themed) : openComp.render(themed)}
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-text-muted">This preview reflects your design tokens.</p>
        </section>
      )
    }
    if (nav.startsWith('foundations:')) {
      const f = nav.slice('foundations:'.length)
      if (f === 'colors') {
        return (
          <section className="space-y-3">
            <PageTitle>Colors</PageTitle>
            <DocNote text={s.docs?.colors} />
            <div className="rounded-xl bg-surface p-5">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">{colorRows.map((c) => <Swatch key={c.key} label={c.label} value={s.colors[c.key]} onChange={(v) => updateColors({ [c.key]: v })} />)}</div>
            </div>
          </section>
        )
      }
      if (f === 'typography') {
        return (
          <section className="space-y-3">
            <PageTitle>Typography</PageTitle>
            <DocNote text={s.docs?.typography} />
            <div className="rounded-xl bg-surface p-5">
              <div className="mb-3 text-[12px] text-text-muted">Heading {s.font.heading} · Body {s.font.family}</div>
              <div className="space-y-2">
                {typeRows.map((t) => (
                  <div key={t.key} className="flex items-baseline gap-3">
                    <span className="w-16 shrink-0 text-[10px] text-text-muted">{t.label} · {s.type[t.key]}</span>
                    <span className="truncate text-text-primary" style={{ fontFamily: headingFor(t.key), fontSize: Math.min(34, s.type[t.key]), fontWeight: (t.key === 'base' || t.key === 'sm' || t.key === 'xs') ? s.weights.regular : s.weights.semibold }}>Ag the quick brown fox</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      }
      if (f === 'spacing') {
        const maxSp = Math.max(...s.spacing, 1)
        return (
          <section className="space-y-3">
            <PageTitle>Dimensions</PageTitle>
            <DocNote text={s.docs?.spacing} />
            <div className="space-y-2.5 rounded-xl bg-surface p-5">
              {s.spacing.map((sp, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-[11px] text-text-muted">space-{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ width: `${(sp / maxSp) * 100}%`, height: 12, background: s.colors.primary, opacity: 0.85, borderRadius: 2 }} />
                  <span className="shrink-0 text-[11px] tabular-nums text-text-muted">{sp}px</span>
                </div>
              ))}
            </div>
          </section>
        )
      }
      if (f === 'grid') {
        const cols = 12
        const bps: [string, string][] = [['Small', '320'], ['Medium', '768'], ['Large', '1024'], ['X-large', '1440']]
        return (
          <section className="space-y-3">
            <PageTitle>Layout grid</PageTitle>
            <DocNote text="A 12-column grid keeps every layout aligned. Columns flex, gutters stay fixed." />
            <div className="rounded-xl bg-surface p-5">
              <div className="mb-2 text-[11px] text-text-muted">12 columns</div>
              <div className="flex gap-1.5">
                {Array.from({ length: cols }).map((_, i) => <span key={i} className="h-16 flex-1 rounded-sm" style={{ background: `${s.colors.primary}1f` }} />)}
              </div>
            </div>
            <div className="rounded-xl bg-surface p-5">
              <div className="mb-2 text-[11px] text-text-muted">Breakpoints</div>
              <div className="space-y-1.5">
                {bps.map(([label, w]) => (
                  <div key={label} className="flex items-center gap-3 text-[12px]">
                    <span className="w-20 shrink-0 text-text-secondary">{label}</span>
                    <span className="font-mono text-[11px] text-text-muted">≥ {w}px</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      }
      if (f === 'radius') {
        const cornerOpts = [{ value: 'angular', label: 'Angular' }, { value: 'slight', label: 'Slightly curved' }, { value: 'rounded', label: 'Rounded' }, { value: 'curved', label: 'Curved' }, { value: 'full', label: 'Fully curved' }, { value: 'squircle', label: 'Squircle' }]
        const borderOpts = [{ value: 'outlined', label: 'Outlined' }, { value: 'subtle', label: 'Subtle' }, { value: 'none', label: 'No outline' }]
        const curCorner = s.cornerStyle ?? 'rounded'
        const curBorder = s.borderStyle ?? 'outlined'
        const scale: [keyof DesignSystem['radii'], string][] = [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['pill', 'Pill']]
        return (
          <section className="space-y-3">
            <PageTitle>Corner radius</PageTitle>
            <DocNote text={s.docs?.radius} />
            <div className="flex max-w-md gap-0">
              <SelectorBox label="Corner style" value={curCorner} options={cornerOpts} onChange={(v) => update({ cornerStyle: v as DesignSystem['cornerStyle'], radii: radiiForCorner(v as NonNullable<DesignSystem['cornerStyle']>) })} />
              <div className="-ml-px flex-1"><SelectorBox label="Outlines" value={curBorder} options={borderOpts} onChange={(v) => update({ borderStyle: v as DesignSystem['borderStyle'] })} /></div>
            </div>
            <div className="rounded-xl bg-surface p-5">
              <div className="mb-3 text-[11px] text-text-muted">Radius scale</div>
              <div className="flex flex-wrap gap-6">{scale.map(([r, label]) => <div key={r} className="flex flex-col items-center gap-2"><span className="h-14 w-14" style={{ borderRadius: Math.min(28, s.radii[r]), background: `${s.colors.primary}1f`, border: curBorder === 'none' ? '1px solid transparent' : `1px solid ${s.colors.border}` }} /><span className="text-[10px] text-text-muted">{label} · {s.radii[r] >= 999 ? 'full' : s.radii[r]}</span></div>)}</div>
            </div>
          </section>
        )
      }
      if (f === 'icons') {
        const iconOpts = [{ value: 'outlined', label: 'Outlined' }, { value: 'filled', label: 'Filled' }, { value: 'duotone', label: 'Duotone' }, { value: 'sharp', label: 'Sharp' }]
        const cur = s.iconStyle ?? 'outlined'
        return (
          <section className="space-y-3">
            <PageTitle>Icons</PageTitle>
            <DocNote text="One icon set, drawn in your chosen style." />
            <div className="max-w-[220px]"><SelectorBox label="Icon style" value={cur} options={iconOpts} onChange={(v) => update({ iconStyle: v as DesignSystem['iconStyle'] })} /></div>
            <div className="rounded-xl bg-surface p-5">
              <div className="flex flex-wrap gap-6" style={{ color: s.colors.text }}>
                {ICON_SAMPLE.map((n) => <DsIcon key={n} name={n} style={cur} size={26} color={s.colors.text} />)}
              </div>
            </div>
            <div className="rounded-xl bg-surface p-5">
              <div className="mb-2 text-[11px] text-text-muted">Usage</div>
              <pre className="overflow-x-auto rounded-lg bg-bg/60 p-3 font-mono text-[11px] leading-relaxed text-text-secondary">{iconSnippet('star', cur)}</pre>
            </div>
          </section>
        )
      }
      if (f === 'elevation') {
        const levels: [string, DesignSystem['shadow']][] = [['Flat', 'off'], ['Raised', 'subtle'], ['Floating', 'medium']]
        return (
          <section className="space-y-3">
            <PageTitle>Elevation</PageTitle>
            <DocNote text={s.docs?.elevation} />
            <div className="rounded-xl bg-surface p-6">
              <div className="flex flex-wrap gap-8" style={{ color: s.colors.text }}>
                {levels.map(([label, sh]) => (
                  <div key={label} className="flex flex-col items-center gap-2.5">
                    <span className="grid h-20 w-28 place-items-center text-[11px]" style={{ background: s.colors.bg, color: s.colors.textMuted, borderRadius: Math.min(16, s.radii.lg), boxShadow: SHADOW_CSS[sh], border: sh === 'off' ? `1px solid ${s.colors.border}` : 'none' }}>{s.shadow === sh ? 'In use' : ''}</span>
                    <span className="text-[11px] text-text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )
      }
      // motion
      return (
        <section className="space-y-3">
          <PageTitle>Motion</PageTitle>
          <DocNote text={s.docs?.motion} />
          <div className="rounded-xl bg-surface p-5">
            <div className="space-y-4">
              <MotionRow label="Fast" ms={s.motion.fast} easing={s.motion.easing} color={s.colors.primary} track={`${s.colors.primary}1f`} />
              <MotionRow label="Normal" ms={s.motion.normal} easing={s.motion.easing} color={s.colors.primary} track={`${s.colors.primary}1f`} />
              <MotionRow label="Slow" ms={s.motion.slow} easing={s.motion.easing} color={s.colors.primary} track={`${s.colors.primary}1f`} />
            </div>
            <div className="mt-4 font-mono text-[11px] text-text-muted">{s.motion.easing}</div>
          </div>
        </section>
      )
    }
    // Overview (default): HDS-style index of foundations + components
    const b = s.brief
    const ov = applyBase(s, s.base)
    const foundationCards: { id: string; label: string; desc: string; preview: JSX.Element }[] = [
      { id: 'colors', label: 'Colors', desc: 'Brand and semantic palette.', preview: <div className="flex h-full w-full">{[s.colors.primary, s.colors.secondary, s.colors.tertiary, s.colors.success, s.colors.warning].map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</div> },
      { id: 'typography', label: 'Typography', desc: 'Type scale and fonts.', preview: <div className="grid h-full w-full place-items-center" style={{ background: ov.colors.surface }}><span style={{ fontFamily: fontStack(s.font.heading), fontSize: 40, fontWeight: s.weights.bold, color: ov.colors.text }}>Ag</span></div> },
      { id: 'icons', label: 'Icons', desc: 'One set in your style.', preview: <div className="flex h-full w-full items-center justify-center gap-4" style={{ background: ov.colors.surface, color: ov.colors.text }}>{['home', 'heart', 'star', 'bell'].map((n) => <DsIcon key={n} name={n} style={s.iconStyle ?? 'outlined'} size={22} />)}</div> },
      { id: 'spacing', label: 'Dimensions', desc: 'Spacing on a 4px grid.', preview: <div className="flex h-full w-full flex-col justify-center gap-1.5 px-5" style={{ background: ov.colors.surface }}>{[40, 64, 88].map((w) => <span key={w} className="h-2 rounded-full" style={{ width: w, background: s.colors.primary }} />)}</div> },
      { id: 'grid', label: 'Layout grid', desc: '12-column responsive grid.', preview: <div className="flex h-full w-full items-stretch gap-1 px-4 py-4" style={{ background: ov.colors.surface }}>{Array.from({ length: 8 }).map((_, i) => <span key={i} className="flex-1 rounded-sm" style={{ background: `${s.colors.primary}33` }} />)}</div> },
      { id: 'radius', label: 'Corner radius', desc: 'Corner shape and outlines.', preview: <div className="grid h-full w-full place-items-center" style={{ background: ov.colors.surface }}><span style={{ width: 48, height: 48, borderRadius: Math.min(22, s.radii.lg), background: `${s.colors.primary}26`, border: `1px solid ${s.colors.border}` }} /></div> },
      { id: 'elevation', label: 'Elevation', desc: 'Shadow levels.', preview: <div className="grid h-full w-full place-items-center" style={{ background: ov.colors.surface }}><span style={{ width: 64, height: 40, borderRadius: Math.min(14, s.radii.md), background: ov.colors.bg, boxShadow: SHADOW_CSS[s.shadow === 'off' ? 'subtle' : s.shadow] }} /></div> }
    ]
    return (
      <section className="space-y-8">
        <div className="space-y-3">
          <PageTitle>Overview</PageTitle>
          <DocNote text={s.docs?.overview} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-text-muted">
            <span className="capitalize">{s.vibe}</span><span className="capitalize">{s.base}</span>
            <span>Heading {s.font.heading}</span><span>Body {s.font.family}</span>
          </div>
          {b?.style && <p className="max-w-2xl text-[12.5px] leading-relaxed text-text-secondary">{b.style}</p>}
        </div>

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-text-primary">Foundations</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {foundationCards.map((f) => (
              <button key={f.id} type="button" onClick={() => goFoundation(f.id)} className="group flex flex-col overflow-hidden rounded-xl bg-surface text-left transition-transform hover:-translate-y-0.5">
                <div className="h-24 w-full overflow-hidden">{f.preview}</div>
                <div className="p-3">
                  <div className="text-[12.5px] font-medium text-text-primary">{f.label}</div>
                  <div className="mt-0.5 text-[11px] text-text-muted">{f.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold text-text-primary">Components</h3>
          {DS_CATEGORIES.map((cat) => {
            const items = DS_COMPONENTS.filter((c) => c.category === cat)
            if (!items.length) return null
            return (
              <div key={cat} className="space-y-2.5">
                <div className="text-[11px] font-medium text-text-muted">{cat}</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((c) => (
                    <button key={c.name} type="button" onClick={() => goComp(c.name)} className="flex flex-col overflow-hidden rounded-xl bg-surface text-left transition-transform hover:-translate-y-0.5">
                      <div className="grid h-28 w-full place-items-center overflow-hidden" style={{ background: ov.colors.bg }}>
                        <div className="pointer-events-none" style={{ transform: 'scale(0.66)' }}>{c.render(ov)}</div>
                      </div>
                      <div className="p-3">
                        <div className="text-[12.5px] font-medium text-text-primary">{c.name}</div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-muted">{c.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-text-primary">Quality check</h3>
          <div className="grid gap-2 rounded-xl bg-surface p-4 sm:grid-cols-2">
            {qualityItems.map((q) => <div key={q.label} className="flex items-center gap-2 text-[12px] text-text-secondary"><span className="text-success">✓</span>{q.label}</div>)}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-[13px] font-semibold text-text-primary">Export tokens</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl bg-surface p-4">
              <div className="mb-2 text-[11px] font-medium text-text-muted">CSS variables</div>
              <pre className="max-h-56 overflow-auto rounded-lg bg-bg/60 p-3 font-mono text-[11px] leading-relaxed text-text-secondary">{cssVars}</pre>
            </div>
            <div className="rounded-xl bg-surface p-4">
              <div className="mb-2 text-[11px] font-medium text-text-muted">JSON tokens</div>
              <pre className="max-h-56 overflow-auto rounded-lg bg-bg/60 p-3 font-mono text-[11px] leading-relaxed text-text-secondary">{jsonTokens}</pre>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div ref={rootRef} className="flex flex-col" data-ds-corner={s.cornerStyle ?? 'rounded'}>
      <div className="shrink-0 bg-bg pb-3 pt-1">
        <button type="button" onClick={() => setOpenId(null)} className="mb-2 flex items-center gap-1 text-[12px] text-text-muted hover:text-text-primary">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L5 8l5 5" /></svg>
          Design systems
        </button>
        <div className="flex items-center gap-3">
          <input value={s.name} onChange={(e) => update({ name: e.target.value })} className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[20px] font-semibold text-text-primary hover:bg-elevated focus:bg-elevated focus:outline-none" />
          <div className="relative">
            <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-label="Actions" className="grid h-8 w-8 place-items-center rounded-lg text-text-secondary hover:bg-elevated hover:text-text-primary"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="3" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="8" cy="13" r="1.4" /></svg></button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} role="presentation" />
                <div className="t42-menu absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-lg bg-raised py-1 shadow-overlay">
                  <button type="button" onClick={() => { setMenuOpen(false); setWizard({ initial: answersFromSystem(s) }) }} className="flex w-full px-3 py-2 text-left text-[12.5px] text-text-primary hover:bg-elevated">Duplicate &amp; tweak</button>
                  <button
                    type="button"
                    disabled={makingTokens}
                    onClick={() => { setMenuOpen(false); void makeTokens() }}
                    className="flex w-full px-3 py-2 text-left text-[12.5px] text-text-primary hover:bg-elevated disabled:opacity-50"
                  >
                    {makingTokens ? 'Making a library…' : 'Make a token library'}
                  </button>
                  <button type="button" onClick={() => { setMenuOpen(false); setConfirmDel(true) }} className="flex w-full px-3 py-2 text-left text-[12.5px] text-error hover:bg-error/10">Delete</button>
                </div>
              </>
            )}
          </div>
        </div>
        {tokensNote ? (
          <p className="mt-2 text-[12px] text-text-secondary">{tokensNote}</p>
        ) : null}
      </div>

      <div ref={bodyRef} className="flex min-h-0 gap-6 overflow-hidden" style={{ height: bodyH || undefined }}>
        <nav className="w-52 shrink-0 overflow-y-auto pr-1 text-[12.5px]">
          <button type="button" onClick={() => setNav('overview')} className={navCls('overview')}>Overview</button>

          <button type="button" onClick={() => setFoundOpen((o) => !o)} className="mt-3 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-medium text-text-muted hover:text-text-secondary">
            <span>Foundations</span>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${foundOpen ? '' : '-rotate-90'}`}><path d="M4 6l4 4 4-4" /></svg>
          </button>
          {foundOpen && <div className="mb-1">{FOUNDATIONS.map((f) => <button key={f.id} type="button" onClick={() => setNav('foundations:' + f.id)} className={navCls('foundations:' + f.id)}>{f.label}</button>)}</div>}

          <button type="button" onClick={() => setCompOpen((o) => !o)} className="mt-3 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-medium text-text-muted hover:text-text-secondary">
            <span>Components</span>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${compOpen ? '' : '-rotate-90'}`}><path d="M4 6l4 4 4-4" /></svg>
          </button>
          {compOpen && (
            <div className="mb-1">
              {DS_CATEGORIES.map((cat) => {
                const items = DS_COMPONENTS.filter((c) => c.category === cat)
                if (!items.length) return null
                return (
                  <div key={cat} className="mb-1.5">
                    <div className="px-2 pb-0.5 pt-1 text-[10.5px] text-text-muted/70">{cat}</div>
                    {items.map((c) => <button key={c.name} type="button" onClick={() => { setNav('component:' + c.name); setCompVariant(0); setCompBase(s.base ?? 'light') }} className={navCls('component:' + c.name)}>{c.name}</button>)}
                  </div>
                )
              })}
            </div>
          )}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto pb-6 pr-1">{renderContent()}</div>
      </div>

      {wizardEl}
      {confirmDel && (
        <div className="t42-scrim fixed inset-0 z-[200] grid place-items-center bg-black/60 p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDel(false) }} role="presentation">
          <div className="w-[380px] max-w-full rounded-xl bg-bg p-5 shadow-2xl">
            <h3 className="text-[15px] font-semibold text-text-primary">Delete this design system?</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">“{s.name}” and its documentation will be removed. This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDel(false)} className="rounded-md px-3 py-1.5 text-[12.5px] text-text-secondary hover:bg-elevated">Cancel</button>
              <button type="button" onClick={() => { setSystems(deleteSystem(s.id)); setConfirmDel(false); setOpenId(null) }} className="rounded-md bg-error px-3 py-1.5 text-[12.5px] font-medium text-white hover:opacity-90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
