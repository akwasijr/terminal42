import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  type BaseTheme, type BorderStyle, type CornerStyle, type Density, type DesignSystem, type Elevation, type IconStyle, type RefProfile, type ScaleChoice, type SystemAnswers, type Vibe,
  DEFAULT_ANSWERS, DS_RULES, FEEL_PRESETS, applyFeel, generateSystem, buildSystemPrompt, buildVisionPrompt, applyVisionAnalysis, parseSystemReply, applyAiSystem,
  type SystemBasis
} from '../lib/designSystem'
import { AI_RULE_GROUPS, type AiRuleId } from '../lib/aiRules'
import { FONT_OPTIONS } from '../lib/brief'
import { DsIcon } from './dsIcons'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalSteps, ModalButton } from './Modal'
import { LAYOUT_CATALOGUE, PATTERN_CATALOGUE } from '../lib/dsCatalogues'
import { refreshFromLibrary } from '../lib/tokens/systemLibrary'
import { formatTokensForPrompt } from '../../../shared/tokens/export'
import type { TokenStudio } from '../../../shared/tokens/types'

function fontStack(name: string): string {
  return FONT_OPTIONS.find((f) => f.id === name)?.stack ?? `'${name}', system-ui, sans-serif`
}
function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }
function labelOf<T extends string>(opts: { id: T; label: string }[], id: T): string { return opts.find((o) => o.id === id)?.label ?? id }

const FEELS: Vibe[] = ['minimal', 'professional', 'bold', 'playful', 'soft', 'elegant', 'brutalist', 'technical', 'luxe']

const CORNER_PX: Record<CornerStyle, number> = {
  angular: 0, slight: 3, rounded: 6, squircle: 8, curved: 10, full: 999
}

// The feel used to be a dropdown, so choosing between nine visual identities
// meant reading nine words. Each tile now renders the preset it stands for --
// its own corners, borders, brand colours, button treatment and heading face --
// so you are looking at the thing you are picking.
function FeelSwatch({ vibe }: { vibe: Vibe }): JSX.Element {
  const f = FEEL_PRESETS[vibe]
  const r = CORNER_PX[f.cornerStyle]
  const border = f.borderStyle === 'none'
    ? 'none'
    : `${f.borderStyle === 'outlined' ? 1.5 : 1}px solid ${f.borderStyle === 'outlined' ? '#1c1917' : '#d6d3d1'}`
  const btn = f.fill === 'outline'
    ? { background: 'transparent', border: `1.5px solid ${f.primary}`, color: f.primary }
    : f.fill === 'tint'
      ? { background: `${f.primary}26`, border: 'none', color: f.primary }
      : { background: f.primary, border: 'none', color: '#fff' }
  return (
    <div
      className="flex h-[92px] w-full flex-col justify-between overflow-hidden p-3"
      style={{ background: '#fafaf9', borderRadius: Math.min(r, 12), border }}
    >
      <div
        style={{
          fontFamily: fontStack(f.headingFont),
          fontWeight: f.headingWeight,
          fontSize: f.scale === 'expressive' ? 20 : f.scale === 'compact' ? 14 : 17,
          color: '#1c1917',
          lineHeight: 1
        }}
      >
        Aa
      </div>
      <div className="flex items-end justify-between gap-2">
        <div
          style={{
            ...btn,
            borderRadius: Math.min(r, 999),
            fontFamily: fontStack(f.bodyFont),
            fontWeight: f.btnWeight,
            fontSize: 9,
            padding: f.density === 'compact' ? '3px 8px' : f.density === 'spacious' ? '6px 14px' : '4px 11px'
          }}
        >
          Button
        </div>
        <div className="flex gap-1">
          {[f.primary, f.secondary, f.tertiary].map((c) => (
            <span key={c} className="h-3 w-3" style={{ background: c, borderRadius: Math.min(r, 999) }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function FeelTile(
  { label, blurb, selected, onClick, children }:
  { label: string; blurb: string; selected: boolean; onClick: () => void; children: ReactNode }
): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-xl p-2 text-left transition-colors ${selected ? 'bg-accent/15' : 'hover:bg-elevated/40'}`}
    >
      {children}
      <div className="mt-2 px-1">
        <div className={`text-[12.5px] ${selected ? 'text-text-primary' : 'text-text-secondary'}`}>{label}</div>
        <div className="text-[11px] leading-snug text-text-muted">{blurb}</div>
      </div>
    </button>
  )
}

// The two escape hatches keep their own drawings rather than borrowing a
// preset's, because neither of them has a look yet.
function WriteItSwatch(): JSX.Element {
  return (
    <div className="flex h-[92px] w-full items-center justify-center rounded-xl bg-elevated/30">
      <svg viewBox="0 0 40 24" width="52" height="32" fill="none" stroke="currentColor"
        strokeWidth="1.4" strokeLinecap="round" className="text-text-muted" aria-hidden="true">
        <path d="M4 7h22M4 13h16M4 19h10" />
        <path d="M28 16l8-8 3 3-8 8-4 1z" />
      </svg>
    </div>
  )
}
function ScreenshotSwatch(): JSX.Element {
  return (
    <div className="flex h-[92px] w-full items-center justify-center rounded-xl bg-elevated/30">
      <svg viewBox="0 0 40 28" width="52" height="36" fill="none" stroke="currentColor"
        strokeWidth="1.4" strokeLinejoin="round" className="text-text-muted" aria-hidden="true">
        <rect x="3" y="4" width="34" height="20" rx="2" />
        <path d="M3 18l8-6 6 4 5-4 15 8" />
        <circle cx="13" cy="10" r="2" />
      </svg>
    </div>
  )
}
const BASES: { id: BaseTheme; label: string }[] = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]
const CORNERS: { id: CornerStyle; label: string }[] = [
  { id: 'angular', label: 'Angular' }, { id: 'slight', label: 'Slightly curved' }, { id: 'rounded', label: 'Rounded' },
  { id: 'curved', label: 'Curved' }, { id: 'full', label: 'Fully curved' }, { id: 'squircle', label: 'Squircle' }
]
const BORDERS: { id: BorderStyle; label: string }[] = [{ id: 'outlined', label: 'Outlined' }, { id: 'subtle', label: 'Subtle' }, { id: 'none', label: 'No outline' }]
const ICON_STYLES: { id: IconStyle; label: string }[] = [{ id: 'outlined', label: 'Outlined' }, { id: 'filled', label: 'Filled' }, { id: 'duotone', label: 'Duotone' }, { id: 'sharp', label: 'Sharp' }]
const DENSITIES: { id: Density; label: string }[] = [{ id: 'compact', label: 'Compact' }, { id: 'cozy', label: 'Cozy' }, { id: 'comfortable', label: 'Comfortable' }, { id: 'spacious', label: 'Spacious' }]
const SCALES: { id: ScaleChoice; label: string }[] = [{ id: 'compact', label: 'Compact' }, { id: 'balanced', label: 'Balanced' }, { id: 'expressive', label: 'Expressive' }]
const ELEVATIONS: { id: Elevation; label: string }[] = [{ id: 'flat', label: 'Flat' }, { id: 'subtle', label: 'Subtle' }, { id: 'elevated', label: 'Elevated' }]

// Small pictograms so each option reads at a glance (only the first step is a dropdown).
const CORNER_RADIUS: Record<CornerStyle, number> = { angular: 0, slight: 2, rounded: 5, curved: 8, full: 11, squircle: 6 }
const DENSITY_GAP: Record<Density, number> = { compact: 2, cozy: 4, comfortable: 6, spacious: 9 }
const SCALE_SIZE: Record<ScaleChoice, number> = { compact: 15, balanced: 19, expressive: 24 }
const ELEV_SHADOW: Record<Elevation, string> = { flat: 'none', subtle: '0 1px 3px rgba(0,0,0,0.22)', elevated: '0 4px 10px rgba(0,0,0,0.26)' }
const BASE_PICTO: Record<BaseTheme, ReactNode> = {
  light: <span style={{ width: 24, height: 16, borderRadius: 3, background: '#ffffff', border: '1px solid #d4d4d8' }} />,
  dark: <span style={{ width: 24, height: 16, borderRadius: 3, background: '#18181b', border: '1px solid #3f3f46' }} />
}
const BORDER_PICTO: Record<BorderStyle, ReactNode> = {
  outlined: <span style={{ width: 26, height: 16, borderRadius: 3, border: '1.5px solid currentColor' }} />,
  subtle: <span style={{ width: 26, height: 16, borderRadius: 3, border: '1px solid currentColor', opacity: 0.45 }} />,
  none: <span style={{ width: 26, height: 16, borderRadius: 3, background: 'currentColor', opacity: 0.14 }} />
}
function cornerPicto(id: CornerStyle): ReactNode { return <span style={{ width: 22, height: 22, borderRadius: CORNER_RADIUS[id], border: '1.5px solid currentColor' }} /> }
function densityPicto(id: Density): ReactNode { return <span style={{ display: 'flex', flexDirection: 'column', gap: DENSITY_GAP[id] }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 24, height: 2.5, borderRadius: 2, background: 'currentColor' }} />)}</span> }
function scalePicto(id: ScaleChoice): ReactNode { return <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}><span style={{ fontSize: SCALE_SIZE[id], fontWeight: 700, lineHeight: 1 }}>A</span><span style={{ fontSize: 11, lineHeight: 1 }}>a</span></span> }
function elevPicto(id: Elevation): ReactNode { return <span style={{ width: 26, height: 16, borderRadius: 3, background: '#cbd0d6', boxShadow: ELEV_SHADOW[id], border: id === 'flat' ? '1px solid currentColor' : 'none' }} /> }
function iconPicto(id: IconStyle): ReactNode { return <DsIcon name="star" style={id} size={20} color="currentColor" /> }

const PAGES = ['style', 'basis', 'brand', 'color', 'type', 'shape', 'feel', 'parts', 'rules', 'context'] as const
type Page = typeof PAGES[number]
const TITLES: Record<Page, string> = { style: 'Style', basis: 'Basis', brand: 'Brand', color: 'Color', type: 'Type', shape: 'Shape', feel: 'Feel', parts: 'Parts', rules: 'Rules', context: 'Context' }

// The four pages that ask for values a token library already holds. When the
// system is standing on an existing library, asking again would only invite
// two answers to the same question, so they are dropped.
const VALUE_PAGES: Page[] = ['color', 'type', 'shape', 'feel']

/**
 * Enough of a library to recognise it by.
 *
 * A list of eleven rows all reading "an existing token library" tells nobody
 * which one is theirs. Its colours do.
 */
function summariseLibrary(row: { id: string; name: string; studio?: unknown }): { id: string; name: string; swatches: string[]; themes: number } {
  const studio = row.studio as { sets?: { tokens?: { path: string; type: string; value: unknown }[] }[]; themes?: unknown[] } | undefined
  const colors: Record<string, string> = {}
  for (const set of studio?.sets ?? [])
    for (const t of set.tokens ?? [])
      if (t.type === 'color' && typeof t.value === 'string') colors[t.path] = t.value
  const wanted = ['palette.brand.600', 'palette.accent.600', 'palette.neutral.600']
  const picked = wanted.map((k) => colors[k]).filter((v): v is string => !!v)
  const swatches = picked.length ? picked : [...new Set(Object.values(colors))].slice(0, 3)
  return { id: row.id, name: row.name, swatches, themes: Math.max(1, studio?.themes?.length ?? 1) }
}

// ── Image helpers (client-side; canvas.assist is text-only) ──────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(file)
  })
}
function downscale(dataUrl: string, max: number, mime = 'image/jpeg', q = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale))
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      const ctx = cv.getContext('2d'); if (!ctx) return resolve(dataUrl)
      ctx.drawImage(img, 0, 0, w, h)
      try { resolve(cv.toDataURL(mime, q)) } catch { resolve(dataUrl) }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}
function extractPalette(dataUrl: string): Promise<string[]> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = 48, h = Math.max(1, Math.round(48 * (img.height / Math.max(1, img.width))))
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      const ctx = cv.getContext('2d'); if (!ctx) return resolve([])
      ctx.drawImage(img, 0, 0, w, h)
      let data: Uint8ClampedArray
      try { data = ctx.getImageData(0, 0, w, h).data } catch { return resolve([]) }
      const buckets = new Map<string, { n: number; r: number; g: number; b: number }>()
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue
        const r = data[i], g = data[i + 1], b = data[i + 2]
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
        if (mx > 244 && mn > 244) continue // near white
        if (mx < 16) continue // near black
        const key = `${r >> 5}-${g >> 5}-${b >> 5}`
        const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
        e.n++; e.r += r; e.g += g; e.b += b; buckets.set(key, e)
      }
      const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, '0')
      const top = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 6)
      resolve(top.map((e) => `#${toHex(e.r / e.n)}${toHex(e.g / e.n)}${toHex(e.b / e.n)}`))
    }
    img.onerror = () => resolve([])
    img.src = dataUrl
  })
}

// Deduce a style profile (palette + light/dark + tone) from reference screenshots.
// The AI is text-only, so this client-side read is how we "see" the references.
function analyzeShots(urls: string[]): Promise<RefProfile> {
  return new Promise((resolve) => {
    let totL = 0, totS = 0, totN = 0
    const buckets = new Map<string, { n: number; r: number; g: number; b: number }>()
    let done = 0
    if (!urls.length) { resolve({ base: 'light', tone: 'neutral', palette: [] }); return }
    const finish = (): void => {
      const avgL = totN ? totL / totN : 0.5
      const avgS = totN ? totS / totN : 0
      const toHex = (n: number): string => Math.round(n).toString(16).padStart(2, '0')
      const palette = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((e) => `#${toHex(e.r / e.n)}${toHex(e.g / e.n)}${toHex(e.b / e.n)}`)
      const tone: RefProfile['tone'] = avgS > 0.42 ? 'vibrant' : avgS < 0.18 ? 'muted' : 'neutral'
      resolve({ base: avgL < 0.5 ? 'dark' : 'light', tone, palette })
    }
    for (const url of urls) {
      const img = new Image()
      img.onload = () => {
        const w = 64, h = Math.max(1, Math.round(64 * (img.height / Math.max(1, img.width))))
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h
        const ctx = cv.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h)
          try {
            const data = ctx.getImageData(0, 0, w, h).data
            for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] < 128) continue
              const r = data[i], g = data[i + 1], b = data[i + 2]
              const mx = Math.max(r, g, b), mn = Math.min(r, g, b)
              totL += (0.299 * r + 0.587 * g + 0.114 * b) / 255
              totS += mx === 0 ? 0 : (mx - mn) / mx
              totN++
              if (mx > 244 && mn > 244) continue
              if (mx < 16) continue
              const key = `${r >> 5}-${g >> 5}-${b >> 5}`
              const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
              e.n++; e.r += r; e.g += g; e.b += b; buckets.set(key, e)
            }
          } catch { /* tainted canvas; skip */ }
        }
        if (++done === urls.length) finish()
      }
      img.onerror = () => { if (++done === urls.length) finish() }
      img.src = url
    }
  })
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-elevated/40 p-2.5">
      <label className="t42-swatch relative h-10 w-10 overflow-hidden rounded-md" style={{ background: value }}><input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-full w-full cursor-pointer opacity-0" /></label>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium text-text-primary">{label}</div>
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent font-mono text-[11px] text-text-muted focus:outline-none" />
      </div>
    </div>
  )
}

function FontField({ label, value, onChange, sample }: { label: string; value: string; onChange: (v: string) => void; sample: string }): JSX.Element {
  const groups = useMemo(() => {
    const out = new Map<string, typeof FONT_OPTIONS>()
    for (const f of FONT_OPTIONS) { if (!out.has(f.group)) out.set(f.group, []); out.get(f.group)!.push(f) }
    return [...out.entries()]
  }, [])
  return (
    <div className="rounded-lg bg-elevated/40 p-3">
      <div className="mb-2 text-[12.5px] font-medium text-text-primary">{label}</div>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none rounded-md bg-surface px-3 py-2 pr-8 text-[13px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40">
          {groups.map(([g, opts]) => <optgroup key={g} label={g}>{opts.map((o) => <option key={o.id} value={o.id}>{o.id}</option>)}</optgroup>)}
        </select>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"><path d="M4 6l4 4 4-4" /></svg>
      </div>
      <div className="mt-2 flex items-baseline gap-2 px-0.5">
        <span className="shrink-0 text-[10px] text-text-muted">Preview</span>
        <span className="truncate text-[14px] text-text-secondary" style={{ fontFamily: fontStack(value) }}>{sample}</span>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }): JSX.Element {
  return <label className="mb-1.5 block text-[12.5px] font-medium text-text-primary">{children}</label>
}
/** A row of small selectable pictogram tiles (active state uses a neutral ring, never the accent). */
function PictoGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string; picto: ReactNode }[]; onChange: (v: T) => void }): JSX.Element {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.id === value
          return (
            <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={active} className={['flex w-[82px] flex-col items-center gap-2 rounded-lg px-2 py-2.5 text-[11px] transition-colors', active ? 'bg-elevated text-text-primary' : 'bg-elevated/30 text-text-muted hover:bg-elevated/60 hover:text-text-secondary'].join(' ')}>
              <span className="grid h-7 place-items-center">{o.picto}</span>
              <span className="w-full truncate text-center">{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const GEN_PHASES = ['Reading your brief', 'Composing the tokens', 'Refining the palette', 'Pairing the type', 'Writing the documentation', 'Assembling components']

// An animated pictogram of a small design being assembled, shown while generating.
function GeneratingArt(): JSX.Element {
  const piece = (delay: number): React.CSSProperties => ({ animation: 'dsRise 1.5s ease-in-out infinite', animationDelay: `${delay}ms` })
  return (
    <svg width="148" height="100" viewBox="0 0 148 100" fill="none" aria-hidden="true">
      <rect x="10" y="8" width="128" height="84" rx="8" stroke="currentColor" strokeOpacity="0.18" />
      {/* heading + body lines */}
      <rect x="24" y="22" width="58" height="9" rx="2.5" fill="currentColor" style={piece(0)} />
      <rect x="24" y="38" width="92" height="5" rx="2.5" fill="currentColor" fillOpacity="0.4" style={piece(150)} />
      <rect x="24" y="48" width="74" height="5" rx="2.5" fill="currentColor" fillOpacity="0.4" style={piece(300)} />
      {/* swatch row */}
      <rect x="24" y="64" width="16" height="16" rx="4" fill="currentColor" style={piece(450)} />
      <rect x="44" y="64" width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.6" style={piece(600)} />
      <rect x="64" y="64" width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.35" style={piece(750)} />
      {/* button */}
      <rect x="96" y="66" width="32" height="13" rx="4" fill="currentColor" style={piece(900)} />
    </svg>
  )
}

export function DesignSystemWizard({ initial, onCancel, onComplete }: {
  initial?: SystemAnswers
  onCancel: () => void
  onComplete: (s: DesignSystem) => void
}): JSX.Element {
  const [a, setA] = useState<SystemAnswers>(initial ?? DEFAULT_ANSWERS)
  const set = <K extends keyof SystemAnswers>(k: K, v: SystemAnswers[K]): void => setA((p) => ({ ...p, [k]: v }))
  const [idx, setIdx] = useState(0)
  const [customFeel, setCustomFeel] = useState(!!initial?.style)
  const [refMode, setRefMode] = useState(!!initial?.shots?.length)
  const [, setRefProfile] = useState<RefProfile | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisNote, setAnalysisNote] = useState<string | null>(null)
  const [detected, setDetected] = useState<Record<string, unknown> | null>(null)
  const detectedStr = (k: string): string => (detected && typeof detected[k] === 'string' ? (detected[k] as string).trim() : '')
  const [visionApplied, setVisionApplied] = useState(false)
  const [analysisSkipped, setAnalysisSkipped] = useState(false)
  const [palette, setPalette] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [phaseIdx, setPhaseIdx] = useState(0)
  const shotsInput = useRef<HTMLInputElement>(null)

  // Which token library this system stands on. '' means "build one from these
  // answers", which is what happens when a team has not made one yet.
  const [basis, setBasis] = useState('')
  const [libs, setLibs] = useState<{ id: string; name: string; swatches: string[]; themes: number }[]>([])
  const [pickedPatterns, setPickedPatterns] = useState<string[]>([])
  const [pickedLayouts, setPickedLayouts] = useState<string[]>([])
  useEffect(() => {
    let live = true
    void window.terminal42?.tokens?.list?.().then((rows) => {
      if (live) setLibs(rows.map(summariseLibrary))
    }).catch(() => undefined)
    return () => { live = false }
  }, [])

  const pages = PAGES.filter((p) => (basis ? !VALUE_PAGES.includes(p) : true))
  const page = pages[Math.min(idx, pages.length - 1)]
  const isLast = idx >= pages.length - 1

  const toggleRule = (id: AiRuleId): void => setA((p) => ({ ...p, rules: { ...p.rules, [id]: !p.rules[id] } }))

  function mergePalette(next: string[]): void {
    setPalette((prev) => [...new Set([...next, ...prev])].slice(0, 6))
  }
  async function onShots(files: FileList | null): Promise<void> {
    if (!files || !files.length) return
    const out: string[] = []
    let pal: string[] = []
    for (const f of [...files].slice(0, 5)) {
      const raw = await fileToDataUrl(f)
      out.push(await downscale(raw, 640, 'image/jpeg', 0.8))
      if (pal.length < 6) pal = [...pal, ...(await extractPalette(raw))]
    }
    const combined = [...(a.shots ?? []), ...out].slice(0, 6)
    setA((p) => ({ ...p, shots: combined }))
    setAnalysisSkipped(false)
    mergePalette(pal)
    setRefProfile(await analyzeShots(combined))
    // Read the screenshots with the vision model automatically, so the result
    // always reflects the UI even if the user never clicks "Analyze with AI".
    void analyzeWithAI(combined)
  }
  async function analyzeWithAI(shots?: string[]): Promise<void> {
    const imgs = shots ?? a.shots
    if (!imgs?.length) return
    setAnalyzing(true); setAnalysisNote(null)
    try {
      const vision = window.terminal42?.canvas?.assistVision
      if (vision) {
        const res = await vision(buildVisionPrompt(), imgs, null)
        if (res.ok) {
          const parsed = parseSystemReply(res.text) as Record<string, unknown> | null
          if (parsed) {
            setA((p) => applyVisionAnalysis(p, parsed))
            setVisionApplied(true)
            setDetected(parsed)
            const note = typeof parsed.notes === 'string' ? parsed.notes.trim() : ''
            setAnalysisNote(note || null)
          } else setAnalysisNote('Could not read the screenshots. Try the quick palette instead.')
        } else setAnalysisNote('Analysis failed. Try the quick palette instead.')
      } else setAnalysisNote('Vision is unavailable here.')
    } catch { setAnalysisNote('Analysis failed. Try the quick palette instead.') }
    setAnalyzing(false)
  }
  function applyImagePalette(): void {
    if (!palette.length) return
    setA((p) => ({ ...p, primary: palette[0] ?? p.primary, secondary: palette[1] ?? p.secondary, tertiary: palette[2] ?? p.tertiary }))
  }

  // Cycle the progress line while generating so the screen feels alive.
  useEffect(() => {
    if (!busy) { setPhaseIdx(0); return }
    const t = setInterval(() => setPhaseIdx((i) => Math.min(i + 1, GEN_PHASES.length - 1)), 1500)
    return () => clearInterval(t)
  }, [busy])

  async function handleGenerate(): Promise<void> {
    setBusy(true)
    let ans = a
    let usedVision = visionApplied
    // Always honour reference screenshots: if some were added but never analyzed,
    // run the vision pass now so the result actually matches the screenshots.
    if ((a.shots?.length ?? 0) > 0 && !visionApplied) {
      try {
        const vision = window.terminal42?.canvas?.assistVision
        if (vision) {
          const res = await vision(buildVisionPrompt(), a.shots!, null)
          if (res.ok) { const parsed = parseSystemReply(res.text); if (parsed) { ans = applyVisionAnalysis(ans, parsed); usedVision = true } }
        }
      } catch { /* fall through to deterministic */ }
    }
    let sys = generateSystem(ans)
    // What the system stands on, before the model is asked anything. A system
    // on a library has already answered colour, type and shape; without this
    // the model documents the wizard's untouched defaults instead.
    let basisBlock: SystemBasis | null = null
    if (basis) {
      try {
        const row = await window.terminal42.tokens.get(basis)
        if (row) {
          const studio = row.studio as TokenStudio
          const block = formatTokensForPrompt(studio, studio.activeTheme)
          if (block) {
            basisBlock = {
              name: row.name || studio.name,
              tokens: block,
              components: sys.components?.map((c) => c.id),
              patterns: pickedPatterns.map((id) => PATTERN_CATALOGUE.find((x) => x.id === id)?.name ?? id),
              layouts: pickedLayouts.map((id) => LAYOUT_CATALOGUE.find((x) => x.id === id)?.name ?? id)
            }
          }
        }
      } catch { /* a library that will not read is a reason to ask without it */ }
    }
    try {
      const assist = window.terminal42?.canvas?.assist
      if (assist) {
        const res = await assist(buildSystemPrompt(ans, palette, basisBlock), null)
        if (!res.ok) console.warn('[t42] system brief failed:', res.error)
        if (res.ok) {
          const parsed = parseSystemReply(res.text)
          // When the screenshots already gave accurate colours, keep them; only take the docs.
          // A library decides them outright, so there is nothing to take at all.
          if (parsed) sys = applyAiSystem(sys, parsed, { colors: !usedVision && !basis, name: !ans.name.trim() })
        }
      }
    } catch (err) { console.warn('[t42] system brief threw:', err) }
    // What the system covers, and what it stands on. Linking the library
    // before the values are read means the library wins any disagreement,
    // which is the whole point of picking one.
    sys = {
      ...sys,
      patterns: pickedPatterns.map((id) => {
        const c = PATTERN_CATALOGUE.find((x) => x.id === id)
        return { id, name: c?.name ?? id, uses: c?.uses ?? [] }
      }),
      layouts: pickedLayouts.map((id) => ({ id, name: LAYOUT_CATALOGUE.find((x) => x.id === id)?.name ?? id }))
    }
    if (basis) sys = await refreshFromLibrary({ ...sys, tokensId: basis })
    setBusy(false)
    onComplete(sys)
  }

  const relaxed = DS_RULES.filter((r) => a.rules[r.id] === false).length
  const needsScreenshotDecision = (a.shots?.length ?? 0) > 0 && !visionApplied && !analysisSkipped

  return (
    <Modal title={TITLES[page]} onClose={() => { if (!busy) onCancel() }} size="large">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="px-5 pt-5">
          <ModalSteps count={pages.length} at={idx} />
          <p className="mt-3 text-[11px] text-text-muted">Step {idx + 1} of {pages.length}</p>
        </div>
        <ModalHeader
          title={TITLES[page]}
          right={
            <button onClick={onCancel} disabled={busy} aria-label="Close" title="Close" className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-30"><svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg></button>
          }
        />

        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-bg/90 backdrop-blur-sm" role="status" aria-live="polite">
            <div className="text-accent"><GeneratingArt /></div>
            <div className="text-[14px] font-medium text-text-primary">Generating design system</div>
            <div className="flex items-center gap-2 text-[12px] text-text-muted">
              <svg className="h-3.5 w-3.5 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" /><path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
              <span>{GEN_PHASES[phaseIdx]}…</span>
            </div>
          </div>
        )}

        <ModalBody>
          {page === 'style' && (
            <div className="space-y-5">
              <div>
                <FieldLabel>Name</FieldLabel>
                <input autoFocus value={a.name} onChange={(e) => set('name', e.target.value)} placeholder="My design system" className="w-full max-w-sm rounded-lg bg-elevated/40 px-3.5 py-2.5 text-[14px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <FieldLabel>Feel</FieldLabel>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {FEELS.map((id) => (
                    <FeelTile
                      key={id}
                      label={FEEL_PRESETS[id].label}
                      blurb={FEEL_PRESETS[id].blurb}
                      selected={!refMode && !customFeel && a.vibe === id}
                      onClick={() => { setA((p) => applyFeel(p, id)); setCustomFeel(false); setRefMode(false) }}
                    >
                      <FeelSwatch vibe={id} />
                    </FeelTile>
                  ))}
                  <FeelTile
                    label="Describe your own"
                    blurb="Write the tone in your words"
                    selected={customFeel}
                    onClick={() => { setCustomFeel(true); setRefMode(false) }}
                  >
                    <WriteItSwatch />
                  </FeelTile>
                  <FeelTile
                    label="Match a screenshot"
                    blurb="Pull the look from an image"
                    selected={refMode}
                    onClick={() => { setRefMode(true); setCustomFeel(false) }}
                  >
                    <ScreenshotSwatch />
                  </FeelTile>
                </div>
              </div>
              {customFeel && (
                <div>
                  <FieldLabel>Describe your style</FieldLabel>
                  <textarea autoFocus value={a.style} onChange={(e) => set('style', e.target.value)} rows={3} placeholder="Tone, references, fonts or feel to lean into." className="w-full resize-none rounded-lg bg-elevated/40 px-3.5 py-3 text-[13.5px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
                </div>
              )}
              {refMode && (
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Reference screenshots</FieldLabel>
                    <input ref={shotsInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void onShots(e.target.files); e.target.value = '' }} />
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-elevated/40 p-2.5">
                      {(a.shots ?? []).map((src, i) => (
                        <span key={i} className="relative">
                          <img src={src} alt={`Reference ${i + 1}`} className="h-14 w-20 rounded-md object-cover" />
                          <button type="button" onClick={() => { const next = (a.shots ?? []).filter((_, j) => j !== i); setA((p) => ({ ...p, shots: next })); void analyzeShots(next).then(setRefProfile); setVisionApplied(false); setDetected(null); setAnalysisNote(null); setAnalysisSkipped(false); if (next.length) void analyzeWithAI(next) }} aria-label="Remove" className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-bg text-text-muted shadow hover:text-text-primary"><svg width="8" height="8" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg></button>
                        </span>
                      ))}
                      {(a.shots?.length ?? 0) < 6 && (
                        <button type="button" onClick={() => shotsInput.current?.click()} className="grid h-14 w-20 place-items-center rounded-md bg-bg/50 text-text-secondary hover:text-text-primary"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg></button>
                      )}
                    </div>
                  </div>
                  {(a.shots?.length ?? 0) > 0 && (
                    <div className="space-y-3 rounded-lg bg-elevated/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-[12px] font-medium text-text-primary">
                          {analyzing && <svg className="h-3.5 w-3.5 animate-spin text-text-muted" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" /><path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>}
                          {analyzing ? 'Reading your screenshots…' : visionApplied ? 'Detected from your screenshots' : 'Read your screenshots'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => void analyzeWithAI()} disabled={analyzing} className="rounded-md bg-elevated px-2.5 py-1 text-[11.5px] text-text-secondary hover:text-text-primary disabled:opacity-60">{visionApplied ? 'Re-analyze' : 'Analyze'}</button>
                          {!visionApplied && !analyzing && <button type="button" onClick={() => { setAnalysisSkipped(true); setAnalysisNote('Skipped. Your screenshots will still be stored as references.'); }} className="rounded-md px-2.5 py-1 text-[11.5px] text-text-muted hover:bg-elevated hover:text-text-primary">Skip</button>}
                        </div>
                      </div>
                      {analyzing && <p className="text-[11.5px] leading-relaxed text-text-muted">Reading the colours, corners, type, density and feel from the actual UI.</p>}
                      {!analyzing && visionApplied && (
                        <>
                          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-3">
                            {([['Feel', cap(a.vibe)], ['Base', cap(a.base)], ['Corners', labelOf(CORNERS, a.cornerStyle)], ['Outlines', labelOf(BORDERS, a.borderStyle)], ['Density', cap(a.density)], ['Icons', cap(a.iconStyle)], ['Heading', a.headingFont], ['Body', a.bodyFont], ...(detectedStr('product') ? [['Looks like', detectedStr('product')]] : [])] as [string, string][]).map(([k, v]) => (
                              <div key={k} className="flex items-baseline justify-between gap-2 text-[11.5px]"><span className="text-text-muted">{k}</span><span className="truncate text-right text-text-secondary">{v}</span></div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-text-muted">Colors</span>
                            <div className="flex gap-1">{[a.primary, a.secondary, a.tertiary].map((c, i) => <span key={i} className="t42-swatch h-4 w-4 rounded" style={{ background: c }} title={c} />)}</div>
                          </div>
                          {analysisNote && <p className="text-[11.5px] leading-relaxed text-text-muted">{analysisNote}</p>}
                          <p className="text-[11px] leading-relaxed text-text-muted">These become your starting tokens. You can change any of them in the next steps.</p>
                        </>
                      )}
                      {!analyzing && analysisSkipped && <p className="text-[11.5px] leading-relaxed text-text-muted">Analysis skipped. Generate is allowed, but the result may not match the screenshots as closely.</p>}
                      {!analyzing && !visionApplied && analysisNote && <p className="text-[11.5px] leading-relaxed text-text-secondary">{analysisNote}</p>}
                    </div>
                  )}
                  <div>
                    <FieldLabel>What UI is this? (optional)</FieldLabel>
                    <input value={a.refName} onChange={(e) => set('refName', e.target.value)} placeholder="e.g. Stripe dashboard, Notion, Linear" className="w-full max-w-sm rounded-lg bg-elevated/40 px-3.5 py-2.5 text-[13.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
                  </div>
                </div>
              )}
            </div>
          )}

          {page === 'basis' && (
            <div className="space-y-4">
              <p className="max-w-xl text-[12.5px] leading-relaxed text-text-muted">
                A design system is built on a set of values. Point at the library that already holds yours and the colour, type and shape questions go away — there is one answer to them, and it lives there.
              </p>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setBasis('')}
                  aria-pressed={basis === ''}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left transition-colors ${basis === '' ? 'bg-surface' : 'bg-elevated/40 hover:bg-elevated/70'}`}
                >
                  <span>
                    <span className="block text-[13px] text-text-primary">Build one from my answers</span>
                    <span className="mt-0.5 block text-[11.5px] text-text-muted">The next four steps ask for the values, and a library is made from them.</span>
                  </span>
                  {basis === '' && <DsIcon name="check" style="outlined" size={15} />}
                </button>
                {libs.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => { setBasis(l.id); setIdx((i) => i) }}
                    aria-pressed={basis === l.id}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left transition-colors ${basis === l.id ? 'bg-surface' : 'bg-elevated/40 hover:bg-elevated/70'}`}
                  >
                    <span>
                      <span className="block text-[13px] text-text-primary">{l.name}</span>
                      <span className="mt-1 flex items-center gap-2">
                        {l.swatches.map((c, i) => <span key={i} className="t42-swatch h-4 w-4 rounded" style={{ background: c }} />)}
                        <span className="text-[11.5px] text-text-muted">{l.themes === 1 ? 'One theme' : `${l.themes} themes`}</span>
                      </span>
                    </span>
                    {basis === l.id && <DsIcon name="check" style="outlined" size={15} />}
                  </button>
                ))}
              </div>
              {libs.length === 0 && <p className="text-[11.5px] text-text-muted">You have no token libraries yet, so one will be made for this system.</p>}
            </div>
          )}

          {page === 'parts' && (
            <div className="space-y-6">
              <p className="max-w-xl text-[12.5px] leading-relaxed text-text-muted">
                What this system covers beyond the components. Leave a row off if nobody has designed it yet — an empty one is more honest than a claimed one.
              </p>
              <div className="space-y-2">
                <FieldLabel>Patterns</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {PATTERN_CATALOGUE.map((c) => {
                    const on = pickedPatterns.includes(c.id)
                    return (
                      <button key={c.id} type="button" aria-pressed={on} title={c.hint}
                        onClick={() => setPickedPatterns((prev) => on ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                        className={`rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${on ? 'bg-accent text-black' : 'bg-elevated/50 text-text-muted hover:text-text-primary'}`}>{c.name}</button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>Layouts</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {LAYOUT_CATALOGUE.map((c) => {
                    const on = pickedLayouts.includes(c.id)
                    return (
                      <button key={c.id} type="button" aria-pressed={on} title={c.hint}
                        onClick={() => setPickedLayouts((prev) => on ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                        className={`rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${on ? 'bg-accent text-black' : 'bg-elevated/50 text-text-muted hover:text-text-primary'}`}>{c.name}</button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {page === 'brand' && (
            <div className="space-y-5">
              <div>
                <FieldLabel>Brand name</FieldLabel>
                <input value={a.brandName} onChange={(e) => set('brandName', e.target.value)} placeholder="Your company or product name" className="w-full max-w-sm rounded-lg bg-elevated/40 px-3.5 py-2.5 text-[13.5px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <FieldLabel>Branding notes</FieldLabel>
                <textarea value={a.branding} onChange={(e) => set('branding', e.target.value)} rows={3} placeholder="Brand rules to respect (optional)." className="w-full resize-none rounded-lg bg-elevated/40 px-3.5 py-3 text-[13.5px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
            </div>
          )}

          {page === 'color' && (
            <div className="space-y-5">
              <div>
                <FieldLabel>Brand colors</FieldLabel>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <ColorField label="Primary" value={a.primary} onChange={(v) => set('primary', v)} />
                  <ColorField label="Secondary" value={a.secondary} onChange={(v) => set('secondary', v)} />
                  <ColorField label="Tertiary" value={a.tertiary} onChange={(v) => set('tertiary', v)} />
                </div>
                {palette.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-[11px] text-text-muted">From your images</span>
                    <div className="flex gap-1">{palette.map((c) => <span key={c} className="t42-swatch h-5 w-5 rounded-md" style={{ background: c }} title={c} />)}</div>
                    <button type="button" onClick={applyImagePalette} className="rounded-md bg-elevated px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary">Use these</button>
                  </div>
                )}
              </div>
              <PictoGroup label="Base" value={a.base} options={BASES.map((o) => ({ ...o, picto: BASE_PICTO[o.id] }))} onChange={(v) => set('base', v)} />
            </div>
          )}

          {page === 'type' && (
            <div className="space-y-7">
              <div className="grid gap-3 sm:grid-cols-2">
                <FontField label="Heading" value={a.headingFont} onChange={(v) => set('headingFont', v)} sample="Display heading" />
                <FontField label="Body" value={a.bodyFont} onChange={(v) => set('bodyFont', v)} sample="The quick brown fox jumps over" />
              </div>
              <PictoGroup label="Type scale" value={a.scale} options={SCALES.map((o) => ({ ...o, picto: scalePicto(o.id) }))} onChange={(v) => set('scale', v)} />
              <PictoGroup label="Density" value={a.density} options={DENSITIES.map((o) => ({ ...o, picto: densityPicto(o.id) }))} onChange={(v) => set('density', v)} />
            </div>
          )}

          {page === 'shape' && (
            <div className="space-y-7">
              <PictoGroup label="Corners" value={a.cornerStyle} options={CORNERS.map((o) => ({ ...o, picto: cornerPicto(o.id) }))} onChange={(v) => set('cornerStyle', v)} />
              <PictoGroup label="Outlines" value={a.borderStyle} options={BORDERS.map((o) => ({ ...o, picto: BORDER_PICTO[o.id] }))} onChange={(v) => set('borderStyle', v)} />
            </div>
          )}

          {page === 'feel' && (
            <div className="space-y-7">
              <PictoGroup label="Icons" value={a.iconStyle} options={ICON_STYLES.map((o) => ({ ...o, picto: iconPicto(o.id) }))} onChange={(v) => set('iconStyle', v)} />
              <PictoGroup label="Elevation" value={a.elevation} options={ELEVATIONS.map((o) => ({ ...o, picto: elevPicto(o.id) }))} onChange={(v) => set('elevation', v)} />
            </div>
          )}

          {page === 'rules' && (
            <div className="space-y-4">
              <p className="text-[12.5px] leading-relaxed text-text-muted">Rules that keep the system away from AI defaults. Turn one off only if you want to allow it.</p>
              {AI_RULE_GROUPS.map((g) => {
                const rules = DS_RULES.filter((r) => r.group === g.id)
                if (!rules.length) return null
                return (
                  <section key={g.id} className="space-y-1.5">
                    <div className="text-[10.5px] font-medium text-text-muted">{g.label}</div>
                    <div className="overflow-hidden rounded-lg bg-elevated/40">
                      {rules.map((r, i) => {
                        const on = a.rules[r.id] !== false
                        return (
                          <button key={r.id} type="button" onClick={() => toggleRule(r.id)} className={['flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors', i > 0 ? '' : '', on ? 'hover:bg-elevated/70' : 'opacity-60 hover:opacity-90'].join(' ')}>
                            <div className="min-w-0">
                              <div className="text-[12.5px] font-medium text-text-primary">{r.label}</div>
                              <div className="mt-0.5 text-[11.5px] text-text-muted">{r.hint}</div>
                            </div>
                            <span role="switch" aria-checked={on} className={['relative mt-0.5 inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors', on ? 'bg-text-primary' : 'bg-raised'].join(' ')}>
                              <span className={['absolute left-0 h-3 w-3 rounded-full bg-bg transition-transform', on ? 'translate-x-3.5' : 'translate-x-0.5'].join(' ')} />
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
              <div className="rounded-md bg-elevated/30 px-3 py-2 text-[11.5px] text-text-muted">{relaxed === 0 ? 'All rules enforced.' : `${relaxed} rule${relaxed === 1 ? '' : 's'} relaxed.`}</div>
            </div>
          )}

          {page === 'context' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-elevated/40 p-4">
                <div className="flex items-start gap-3">
                  {a.logo && <img src={a.logo} alt="Logo" className="h-11 w-11 rounded-md bg-bg/50 object-contain" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-text-primary">{a.name.trim() || 'My design system'}</div>
                    <div className="mt-0.5 text-[12px] capitalize text-text-muted">{a.vibe} · {a.base} · {a.density} · {a.cornerStyle}</div>
                  </div>
                  <div className="flex gap-1">{[a.primary, a.secondary, a.tertiary].map((c) => <span key={c} className="t42-swatch h-7 w-7 rounded-md" style={{ background: c }} />)}</div>
                </div>
              </div>
              <div>
                <FieldLabel>What is this design system for?</FieldLabel>
                <textarea autoFocus value={a.purpose} onChange={(e) => set('purpose', e.target.value)} rows={5} placeholder="The product, who uses it, and what it should do." className="w-full resize-none rounded-lg bg-elevated/40 px-3.5 py-3 text-[13.5px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
              <div>
                <FieldLabel>Anything else to add?</FieldLabel>
                <textarea value={a.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Anything else (optional)." className="w-full resize-none rounded-lg bg-elevated/40 px-3.5 py-3 text-[13.5px] leading-relaxed text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40" />
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter
          left={
            <ModalButton tone="plain" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0 || busy}>← Back</ModalButton>
          }
        >
          {isLast && needsScreenshotDecision && <span className="mr-3 text-[11.5px] text-text-muted">Finish screenshot analysis or skip it first.</span>}
          <ModalButton tone="primary" onClick={() => { if (isLast) void handleGenerate(); else setIdx((i) => i + 1) }} disabled={busy || (isLast && needsScreenshotDecision)}>{isLast ? 'Generate' : 'Next →'}</ModalButton>
        </ModalFooter>
      </div>
    </Modal>
  )
}
