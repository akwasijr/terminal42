import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AUDIENCE_OPTIONS, DENSITY_OPTIONS, DESIGN_KINDS, FIDELITY_OPTIONS, FONT_FAMILIES, FONT_FAMILY_GROUPS, fontFamilyById, GRID_OPTIONS, GROUP_LABELS, SPACING_OPTIONS,
  ICON_LIBRARIES, ICON_STYLES,
  LOOK_OPTIONS, MOTION_OPTIONS, PAGE_TITLES, PALETTES, SURFACE_OPTIONS, THEME_OPTIONS,
  STACK_OPTIONS, RADIUS_OPTIONS, SHADOW_OPTIONS, BORDER_OPTIONS, SURFACE_SHAPE_OPTIONS, SECONDARY_BUTTON_OPTIONS, DESIGN_SYSTEMS,
  emptyDesignState, pagesForState, stateToBrief,
  type DesignGroup, type DesignKind, type DesignWizardState,
  type IconLibraryId
} from '../lib/designBrief'
import type { DesignBrief, TemplateInfo } from '../../../preload/index'
import { IconClose } from './icons'
import {
  AI_RULES, AI_RULE_GROUPS, disabledCount, saveGlobalAiRules,
  type AiRuleId
} from '../lib/aiRules'

// ─── Inline icon factory ────────────────────────────────────────────────────

const Ico = (path: ReactNode) =>
  function Icon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {path}
      </svg>
    )
  }

// One icon per design kind. Kept simple line drawings.
const KIND_ICONS: Record<DesignKind, ReturnType<typeof Ico>> = {
  // Web
  website:       Ico(<><rect x="2" y="3" width="16" height="12" rx="1.5" /><path d="M2 7h16M5 11h6M5 13h4M14 11h2M14 13h2" /></>),
  landing:       Ico(<><rect x="2" y="3" width="16" height="12" rx="1.5" /><path d="M2 7h16M5 11h6M5 13h4" /></>),
  email:         Ico(<><rect x="2" y="5" width="16" height="11" rx="1.5" /><path d="M2 6l8 6 8-6" /></>),
  // App
  app:           Ico(<><rect x="2" y="3" width="16" height="14" rx="1.5" /><line x1="6" y1="3" x2="6" y2="17" /><path d="M9 7h7M9 10h5M9 13h6" /></>),
  dashboard:     Ico(<><rect x="2" y="3" width="6" height="6" rx="1" /><rect x="10" y="3" width="8" height="6" rx="1" /><rect x="2" y="11" width="16" height="6" rx="1" /></>),
  'component-library': Ico(<><rect x="2.5" y="2.5" width="6" height="6" rx="1" /><rect x="11.5" y="2.5" width="6" height="6" rx="1" /><rect x="2.5" y="11.5" width="6" height="6" rx="1" /><rect x="11.5" y="11.5" width="6" height="6" rx="1" /></>),
  // ── DEPRECATED: old briefs may still reference these ids; map to a
  //    generic icon so type stays exhaustive but they never render in the wizard.
  'app-screen':  Ico(<><rect x="6" y="2" width="8" height="16" rx="1.5" /><path d="M9 4h2M8.5 16h3" /></>),
  pricing:       Ico(<><rect x="2.5" y="4" width="4.5" height="12" rx="1" /><rect x="7.75" y="4" width="4.5" height="12" rx="1" /><rect x="13" y="4" width="4.5" height="12" rx="1" /></>),
  login:         Ico(<><rect x="4" y="3" width="12" height="14" rx="1.5" /><path d="M7 8h6M7 11h6" /><circle cx="10" cy="14.5" r="0.6" /></>),
  hero:          Ico(<><rect x="2" y="3" width="16" height="12" rx="1.5" /><path d="M5 7h6M5 9h4M14 7v4" /></>),
  component:     Ico(<><rect x="2" y="3" width="7" height="7" rx="1" /><rect x="11" y="3" width="7" height="7" rx="1" /><rect x="6" y="12" width="8" height="5" rx="1" /></>),
  // Presentation
  'pitch-deck':    Ico(<><rect x="2" y="3" width="16" height="11" rx="1" /><path d="M10 14v3M7 17h6" /></>),
  'talk-slides':   Ico(<><rect x="2" y="4" width="16" height="10" rx="1" /><path d="M5 7h10M5 10h6M10 14v3M7 17h6" /></>),
  'sales-deck':    Ico(<><rect x="2" y="3" width="16" height="11" rx="1" /><path d="M5 11l3-3 2 2 4-5M10 14v3M7 17h6" /></>),
  'workshop-deck': Ico(<><rect x="2" y="3" width="16" height="11" rx="1" /><circle cx="7" cy="9" r="1.5" /><circle cx="13" cy="9" r="1.5" /><path d="M10 14v3M7 17h6" /></>),
  // Content
  'blog-post':  Ico(<><rect x="3" y="3" width="14" height="14" rx="1" /><path d="M6 7h8M6 10h8M6 13h6" /></>),
  resume:       Ico(<><rect x="4" y="2" width="12" height="16" rx="1" /><circle cx="10" cy="7" r="2" /><path d="M7 12h6M7 14h4" /></>),
  'one-pager':  Ico(<><rect x="4" y="2" width="12" height="16" rx="1" /><path d="M7 6h6M7 9h6M7 12h6M7 15h4" /></>),
  brochure:     Ico(<><rect x="2" y="4" width="6" height="12" rx="0.5" /><rect x="8" y="4" width="6" height="12" rx="0.5" /><rect x="14" y="4" width="4" height="12" rx="0.5" /></>),
  'case-study': Ico(<><rect x="3" y="3" width="14" height="14" rx="1" /><path d="M6 6h8M6 9h5M6 12h8M6 15h6" /></>),
  // Print / event
  poster:         Ico(<><rect x="4" y="2" width="12" height="16" rx="0.5" /><rect x="6" y="5" width="8" height="5" /><path d="M6 12h8M6 14h6" /></>),
  flyer:          Ico(<><rect x="4" y="2" width="12" height="16" rx="0.5" /><path d="M7 6h6M7 9h6M7 12h6" /></>),
  invitation:     Ico(<><rect x="2" y="5" width="16" height="11" rx="1" /><path d="M2 6l8 6 8-6" /><circle cx="10" cy="11" r="1.6" /></>),
  'business-card':Ico(<><rect x="2" y="6" width="16" height="9" rx="1" /><path d="M5 9h4M5 11h6" /></>),
  certificate:    Ico(<><rect x="2" y="3" width="16" height="11" rx="1" /><circle cx="10" cy="8.5" r="2" /><path d="M8.5 11l-1 5 2.5-1.5L12.5 16l-1-5" /></>),
  // Data
  infographic: Ico(<><rect x="2.5" y="2.5" width="15" height="15" rx="1" /><path d="M5 14V8M9 14v-3M13 14v-7M5 5h2M9 5h3" /></>),
  report:      Ico(<><rect x="3" y="2" width="14" height="16" rx="1" /><path d="M6 6h8M6 9h8M6 12h6M6 15h5" /></>),
  chart:       Ico(<><path d="M3 16V4M3 16h14" /><rect x="6" y="11" width="2" height="5" /><rect x="10" y="8" width="2" height="8" /><rect x="14" y="6" width="2" height="10" /></>),
  // Social
  'social-post':  Ico(<><rect x="3" y="3" width="14" height="14" rx="2.5" /><circle cx="13.5" cy="6.5" r="1" /></>),
  'social-story': Ico(<><rect x="6" y="2" width="8" height="16" rx="2" /></>),
  'cover-image':  Ico(<><rect x="2" y="6" width="16" height="8" rx="1" /></>),
  'ad-banner':    Ico(<><rect x="2" y="7" width="16" height="6" rx="1" /></>),
  // Figma / design system
  'design-system':    Ico(<><circle cx="6" cy="6" r="2" /><circle cx="14" cy="6" r="2" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /></>),
  wireframe:          Ico(<><rect x="2.5" y="3" width="15" height="14" rx="1" strokeDasharray="2 1.5" /><line x1="2.5" y1="7" x2="17.5" y2="7" strokeDasharray="2 1.5" /><line x1="6" y1="10.5" x2="14" y2="10.5" strokeDasharray="2 1.5" /></>),
  'mood-board':       Ico(<><rect x="2.5" y="2.5" width="7" height="7" rx="0.5" /><rect x="10.5" y="2.5" width="7" height="4" rx="0.5" /><rect x="10.5" y="8" width="7" height="4" rx="0.5" /><rect x="2.5" y="11" width="7" height="6.5" rx="0.5" /><rect x="10.5" y="13.5" width="7" height="4" rx="0.5" /></>),
  'style-tile':       Ico(<><rect x="2.5" y="2.5" width="15" height="6" rx="1" /><rect x="2.5" y="10" width="6" height="3" rx="0.5" /><rect x="2.5" y="14.5" width="15" height="3" rx="0.5" /><rect x="10" y="10" width="7.5" height="3" rx="0.5" /></>),
  'user-flow':        Ico(<><rect x="2" y="3" width="5" height="4" rx="0.5" /><rect x="13" y="3" width="5" height="4" rx="0.5" /><rect x="2" y="13" width="5" height="4" rx="0.5" /><rect x="13" y="13" width="5" height="4" rx="0.5" /><path d="M7 5h6M5 7v6M15 7v6M7 15h6" /></>),
  sitemap:            Ico(<><rect x="8" y="2" width="4" height="3" rx="0.5" /><rect x="3" y="9" width="4" height="3" rx="0.5" /><rect x="8" y="9" width="4" height="3" rx="0.5" /><rect x="13" y="9" width="4" height="3" rx="0.5" /><rect x="3" y="15" width="4" height="2.5" rx="0.5" /><rect x="13" y="15" width="4" height="2.5" rx="0.5" /><path d="M10 5v2M10 7L5 9M10 7l5 2M5 12v2M15 12v2" /></>),
  // Other
  blank: Ico(<><path d="M5 4h7l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /></>)
}

// ─── Tile / wrapper helpers (mirrors BriefWizard) ───────────────────────────

function tileClass(selected: boolean, extra = ''): string {
  return [
    'group rounded-lg p-3 text-left transition-colors',
    selected ? 'bg-accent/15' : 'bg-elevated/40 hover:bg-elevated',
    extra
  ].join(' ')
}

// "Decide for me" pill: small chip-style toggle. When on, the field gets
// added to brief.decisions so the prompt instructs the model to pick.
type DecisionField = 'audience' | 'look' | 'density' | 'motion' | 'theme' | 'subtype' | 'stack' | 'shape'
function DecideForMe({ state, set, field, onPick }: {
  state: DesignWizardState
  set: <K extends keyof DesignWizardState>(k: K, v: DesignWizardState[K]) => void
  field: DecisionField
  onPick: () => void  // clears the actual value when toggled on
}): JSX.Element {
  const on = !!state.decisions[field]
  const toggle = (): void => {
    if (on) {
      const { [field]: _drop, ...rest } = state.decisions
      void _drop
      set('decisions', rest)
    } else {
      set('decisions', { ...state.decisions, [field]: true })
      onPick()
    }
  }
  return (
    <button
      type="button"
      onClick={toggle}
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
        on
          ? 'bg-accent/15 text-accent'
          : 'bg-elevated/60 text-text-secondary hover:bg-elevated hover:text-text-primary'
      ].join(' ')}
    >
      <span className={[
        'grid h-3.5 w-3.5 place-items-center rounded-sm border transition-colors',
        on ? 'border-accent bg-accent text-accent-text' : 'border-text-muted/40 bg-transparent'
      ].join(' ')}>
        {on && (
          <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
            <path d="M2.5 6.2 L5 8.5 L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      Decide for me
    </button>
  )
}

// ─── Filled mini-illustration helpers (matches Fidelity tiles' style) ────────

function MiniBox({ children, w = 100, h = 64 }: { children: ReactNode; w?: number; h?: number }): JSX.Element {
  return (
    <div className="grid h-[64px] w-full place-items-center overflow-hidden rounded-md bg-elevated/70 text-accent">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h}>{children}</svg>
    </div>
  )
}

const COL = {
  paper: '#e7e5e4',
  ink:   '#374151',
  muted: 'rgba(120,120,120,0.5)',
  light: 'rgba(180,180,180,0.35)'
}

// ─── Kind mockups (richer than icons; mirror the category-page style)
// Each mock is rendered into a 100x64 viewBox on a paper-coloured tile.
// `currentColor` resolves to the wizard's accent so each tile gets a hint
// of the brand colour where it makes sense.

function kindMock(id: DesignKind): ReactNode | null {
  switch (id) {
    case 'website':
      return (
        <>
          {/* Site with sticky nav + hero + 2 sections */}
          <line x1="6" y1="10" x2="94" y2="10" stroke={COL.muted} strokeWidth="0.6" />
          <rect x="10" y="6" width="10" height="3" rx="0.7" fill={COL.ink} />
          <rect x="78" y="6.5" width="14" height="2.5" rx="1.2" fill="currentColor" />
          <rect x="6" y="14" width="46" height="3" rx="1" fill={COL.ink} />
          <rect x="6" y="20" width="32" height="2" rx="1" fill={COL.muted} />
          <rect x="6" y="27" width="14" height="5" rx="1.2" fill="currentColor" />
          <rect x="56" y="14" width="38" height="22" rx="2" fill="currentColor" opacity="0.4" />
          <rect x="6" y="40" width="26" height="18" rx="2" fill={COL.muted} opacity="0.6" />
          <rect x="36" y="40" width="26" height="18" rx="2" fill={COL.muted} opacity="0.6" />
          <rect x="66" y="40" width="26" height="18" rx="2" fill={COL.muted} opacity="0.6" />
        </>
      )
    case 'landing':
      return (
        <>
          {/* Single-page hero with CTA + supporting block */}
          <rect x="6" y="6" width="88" height="34" rx="2" fill="currentColor" opacity="0.18" />
          <rect x="14" y="14" width="44" height="3" rx="1" fill={COL.ink} />
          <rect x="14" y="20" width="56" height="2" rx="1" fill={COL.muted} />
          <rect x="14" y="29" width="14" height="5" rx="1.2" fill="currentColor" />
          <rect x="6" y="46" width="26" height="14" rx="1.5" fill={COL.muted} />
          <rect x="36" y="46" width="26" height="14" rx="1.5" fill={COL.muted} />
          <rect x="66" y="46" width="26" height="14" rx="1.5" fill={COL.muted} />
        </>
      )
    case 'email':
      return (
        <>
          {/* Centered 600px email body */}
          <rect x="20" y="6" width="60" height="52" rx="1.5" fill={COL.paper} />
          <rect x="20" y="6" width="60" height="6" rx="1.5" fill="currentColor" opacity="0.55" />
          <rect x="26" y="18" width="36" height="3" rx="1" fill={COL.ink} />
          <rect x="26" y="25" width="48" height="2" rx="1" fill={COL.muted} />
          <rect x="26" y="30" width="44" height="2" rx="1" fill={COL.muted} />
          <rect x="26" y="38" width="14" height="5" rx="1.2" fill="currentColor" />
        </>
      )
    case 'app':
      return (
        <>
          {/* Sidebar nav + topbar + main + cards (whole product flow) */}
          <rect x="6" y="6" width="18" height="52" rx="1.5" fill={COL.ink} />
          <rect x="9" y="11" width="12" height="2" rx="0.5" fill={COL.paper} opacity="0.7" />
          <rect x="9" y="16" width="9" height="2" rx="0.5" fill={COL.paper} opacity="0.5" />
          <rect x="9" y="21" width="11" height="2" rx="0.5" fill={COL.paper} opacity="0.5" />
          <rect x="9" y="26" width="8" height="2" rx="0.5" fill={COL.paper} opacity="0.5" />
          {/* Topbar */}
          <rect x="26" y="6" width="68" height="6" rx="1" fill={COL.muted} opacity="0.5" />
          {/* Main */}
          <rect x="26" y="14" width="20" height="3" rx="1" fill={COL.ink} />
          <rect x="26" y="20" width="68" height="14" rx="1.5" fill="currentColor" opacity="0.55" />
          <rect x="26" y="36" width="32" height="22" rx="1.5" fill={COL.muted} />
          <rect x="62" y="36" width="32" height="22" rx="1.5" fill={COL.muted} />
        </>
      )
    case 'dashboard':
      return (
        <>
          {/* Sidebar + KPI row + chart + table */}
          <rect x="6" y="6" width="14" height="52" rx="1.5" fill={COL.ink} opacity="0.85" />
          <rect x="22" y="6" width="11" height="14" rx="1" fill={COL.muted} />
          <rect x="35" y="6" width="11" height="14" rx="1" fill={COL.muted} />
          <rect x="48" y="6" width="11" height="14" rx="1" fill={COL.muted} />
          <rect x="61" y="6" width="33" height="14" rx="1" fill="currentColor" opacity="0.55" />
          {/* Chart */}
          <rect x="22" y="22" width="50" height="20" rx="1" fill={COL.paper} />
          <polyline points="26,38 32,32 38,34 44,28 50,30 56,24 62,26 68,22" fill="none" stroke="currentColor" strokeWidth="1" />
          {/* Table */}
          <rect x="74" y="22" width="20" height="20" rx="1" fill={COL.muted} opacity="0.6" />
          <rect x="22" y="44" width="72" height="14" rx="1" fill={COL.paper} />
          <line x1="22" y1="49" x2="94" y2="49" stroke={COL.muted} strokeWidth="0.4" />
          <line x1="22" y1="53" x2="94" y2="53" stroke={COL.muted} strokeWidth="0.4" />
        </>
      )
    case 'component-library':
      return (
        <>
          {/* Grid of component states */}
          <rect x="6" y="6" width="22" height="10" rx="1.5" fill="currentColor" />
          <rect x="32" y="6" width="22" height="10" rx="1.5" fill="currentColor" opacity="0.45" />
          <rect x="58" y="6" width="22" height="10" rx="1.5" fill={COL.paper} stroke={COL.muted} strokeWidth="0.6" />
          <rect x="6" y="22" width="34" height="10" rx="1.5" fill={COL.paper} stroke={COL.muted} strokeWidth="0.6" />
          <rect x="44" y="22" width="34" height="10" rx="1.5" fill={COL.muted} opacity="0.6" />
          <rect x="6" y="38" width="20" height="20" rx="1.5" fill={COL.paper} />
          <rect x="30" y="38" width="20" height="20" rx="1.5" fill={COL.paper} />
          <circle cx="40" cy="48" r="3" fill="currentColor" />
          <rect x="54" y="38" width="40" height="20" rx="1.5" fill={COL.paper} stroke={COL.muted} strokeWidth="0.6" />
          <line x1="58" y1="46" x2="78" y2="46" stroke={COL.muted} strokeWidth="0.5" />
          <line x1="58" y1="50" x2="86" y2="50" stroke={COL.muted} strokeWidth="0.5" />
        </>
      )
    case 'pitch-deck':
    case 'sales-deck':
    case 'talk-slides':
    case 'workshop-deck':
      return (
        <>
          {/* 16:9 slide stack with current slide highlighted */}
          <rect x="14" y="10" width="72" height="40" rx="2" fill={COL.paper} />
          <rect x="20" y="18" width="36" height="4" rx="1" fill={COL.ink} />
          <rect x="20" y="26" width="48" height="2" rx="1" fill={COL.muted} />
          <rect x="20" y="36" width="14" height="6" rx="1" fill="currentColor" />
          {/* Pager dots */}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={36 + i * 6} y="56" width={i === 1 ? 8 : 4} height="2" rx="1"
              fill={i === 1 ? 'currentColor' : COL.muted} />
          ))}
        </>
      )
    case 'blog-post':
      return (
        <>
          <rect x="14" y="6" width="72" height="2.5" rx="1" fill={COL.muted} />
          <rect x="14" y="14" width="50" height="4" rx="1" fill={COL.ink} />
          <rect x="14" y="22" width="72" height="2" rx="1" fill={COL.muted} />
          <rect x="14" y="27" width="68" height="2" rx="1" fill={COL.muted} />
          <rect x="14" y="32" width="72" height="2" rx="1" fill={COL.muted} />
          <rect x="14" y="40" width="56" height="14" rx="2" fill="currentColor" opacity="0.35" />
        </>
      )
    case 'case-study':
      return (
        <>
          <rect x="10" y="6" width="80" height="2.5" rx="1" fill={COL.muted} />
          <rect x="10" y="12" width="56" height="4" rx="1" fill={COL.ink} />
          <rect x="10" y="22" width="80" height="14" rx="1.5" fill="currentColor" opacity="0.45" />
          <rect x="10" y="40" width="38" height="2" rx="1" fill={COL.muted} />
          <rect x="10" y="45" width="80" height="2" rx="1" fill={COL.muted} />
          <rect x="10" y="50" width="74" height="2" rx="1" fill={COL.muted} />
        </>
      )
    case 'resume':
      return (
        <>
          <rect x="22" y="4" width="56" height="58" rx="1" fill={COL.paper} />
          <rect x="28" y="9" width="20" height="3" rx="1" fill={COL.ink} />
          <rect x="28" y="14" width="14" height="2" rx="1" fill={COL.muted} />
          <rect x="28" y="22" width="44" height="2" rx="1" fill={COL.ink} />
          <rect x="28" y="27" width="44" height="1.5" rx="0.7" fill={COL.muted} />
          <rect x="28" y="31" width="36" height="1.5" rx="0.7" fill={COL.muted} />
          <rect x="28" y="38" width="44" height="2" rx="1" fill={COL.ink} />
          <rect x="28" y="43" width="36" height="1.5" rx="0.7" fill={COL.muted} />
          <rect x="28" y="47" width="40" height="1.5" rx="0.7" fill={COL.muted} />
        </>
      )
    case 'one-pager':
      return (
        <>
          <rect x="22" y="4" width="56" height="58" rx="1" fill={COL.paper} />
          <rect x="28" y="9" width="40" height="3" rx="1" fill={COL.ink} />
          <rect x="28" y="16" width="44" height="2" rx="1" fill={COL.muted} />
          <rect x="28" y="22" width="44" height="6" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="28" y="32" width="44" height="2" rx="1" fill={COL.muted} />
          <rect x="28" y="36" width="40" height="2" rx="1" fill={COL.muted} />
          <rect x="28" y="42" width="44" height="2" rx="1" fill={COL.muted} />
          <rect x="28" y="50" width="20" height="4" rx="1" fill="currentColor" />
        </>
      )
    case 'brochure':
      return (
        <>
          <rect x="6" y="10" width="28" height="44" rx="1" fill={COL.paper} />
          <rect x="36" y="10" width="28" height="44" rx="1" fill={COL.paper} />
          <rect x="66" y="10" width="28" height="44" rx="1" fill={COL.paper} />
          <rect x="10" y="14" width="20" height="2" rx="1" fill={COL.ink} />
          <rect x="10" y="20" width="14" height="14" rx="1" fill="currentColor" opacity="0.4" />
          <rect x="40" y="14" width="20" height="2" rx="1" fill={COL.ink} />
          <rect x="40" y="20" width="20" height="1.5" rx="0.7" fill={COL.muted} />
          <rect x="40" y="24" width="18" height="1.5" rx="0.7" fill={COL.muted} />
          <rect x="70" y="14" width="20" height="2" rx="1" fill={COL.ink} />
          <rect x="70" y="20" width="20" height="1.5" rx="0.7" fill={COL.muted} />
        </>
      )
    case 'poster':
      return (
        <>
          <rect x="20" y="2" width="60" height="60" rx="1" fill="currentColor" opacity="0.5" />
          <rect x="28" y="14" width="44" height="6" rx="1" fill={COL.paper} />
          <rect x="28" y="44" width="32" height="3" rx="1" fill={COL.paper} />
          <rect x="28" y="50" width="20" height="2" rx="1" fill={COL.paper} opacity="0.7" />
        </>
      )
    case 'flyer':
      return (
        <>
          <rect x="22" y="4" width="56" height="58" rx="1" fill={COL.paper} />
          <rect x="28" y="9" width="44" height="4" rx="1" fill={COL.ink} />
          <rect x="28" y="18" width="44" height="2" rx="1" fill={COL.muted} />
          <rect x="28" y="22" width="40" height="2" rx="1" fill={COL.muted} />
          <rect x="28" y="30" width="44" height="14" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="28" y="50" width="22" height="4" rx="1" fill="currentColor" />
        </>
      )
    case 'invitation':
      return (
        <>
          <rect x="14" y="10" width="72" height="44" rx="2" fill={COL.paper} />
          <circle cx="50" cy="20" r="3" fill="currentColor" />
          <rect x="32" y="28" width="36" height="3" rx="1" fill={COL.ink} />
          <rect x="36" y="36" width="28" height="2" rx="1" fill={COL.muted} />
          <rect x="40" y="42" width="20" height="2" rx="1" fill={COL.muted} />
        </>
      )
    case 'business-card':
      return (
        <>
          <rect x="14" y="20" width="72" height="24" rx="1.5" fill={COL.paper} />
          <rect x="20" y="26" width="20" height="3" rx="1" fill={COL.ink} />
          <rect x="20" y="32" width="14" height="2" rx="1" fill={COL.muted} />
          <rect x="20" y="38" width="22" height="1.5" rx="0.7" fill={COL.muted} />
          <circle cx="74" cy="32" r="4" fill="currentColor" />
        </>
      )
    case 'certificate':
      return (
        <>
          <rect x="6" y="10" width="88" height="44" rx="2" fill={COL.paper} stroke={COL.muted} strokeWidth="0.6" />
          <rect x="20" y="16" width="60" height="3" rx="1" fill={COL.ink} />
          <rect x="28" y="26" width="44" height="2" rx="1" fill={COL.muted} />
          <rect x="20" y="34" width="60" height="3" rx="1" fill="currentColor" opacity="0.6" />
          <circle cx="78" cy="46" r="3" fill="currentColor" opacity="0.55" />
        </>
      )
    case 'infographic':
      return (
        <>
          <rect x="34" y="4" width="32" height="56" rx="1.5" fill={COL.paper} />
          <rect x="38" y="8" width="22" height="3" rx="1" fill="currentColor" />
          <circle cx="50" cy="20" r="4" fill="currentColor" opacity="0.55" />
          <rect x="38" y="28" width="24" height="6" rx="1" fill={COL.muted} />
          <rect x="38" y="36" width="24" height="6" rx="1" fill={COL.muted} />
          <rect x="38" y="44" width="24" height="6" rx="1" fill={COL.muted} />
        </>
      )
    case 'report':
      return (
        <>
          <rect x="14" y="6" width="72" height="52" rx="1.5" fill={COL.paper} />
          <rect x="20" y="12" width="34" height="3" rx="1" fill={COL.ink} />
          <rect x="20" y="20" width="32" height="14" rx="1.5" fill="currentColor" opacity="0.5" />
          <rect x="56" y="20" width="24" height="14" rx="1.5" fill={COL.muted} />
          <rect x="20" y="38" width="60" height="2" rx="1" fill={COL.muted} />
          <rect x="20" y="42" width="56" height="2" rx="1" fill={COL.muted} />
          <rect x="20" y="46" width="58" height="2" rx="1" fill={COL.muted} />
        </>
      )
    case 'chart':
      return (
        <>
          <rect x="10" y="10" width="80" height="44" rx="1.5" fill={COL.paper} />
          <line x1="14" y1="48" x2="86" y2="48" stroke={COL.muted} strokeWidth="0.6" />
          <line x1="14" y1="14" x2="14" y2="48" stroke={COL.muted} strokeWidth="0.6" />
          <rect x="22" y="32" width="6" height="16" fill="currentColor" />
          <rect x="34" y="22" width="6" height="26" fill="currentColor" opacity="0.7" />
          <rect x="46" y="28" width="6" height="20" fill="currentColor" opacity="0.55" />
          <rect x="58" y="18" width="6" height="30" fill="currentColor" />
          <rect x="70" y="26" width="6" height="22" fill="currentColor" opacity="0.7" />
        </>
      )
    case 'social-post':
      return (
        <>
          <rect x="20" y="8" width="60" height="48" rx="2" fill="currentColor" opacity="0.5" />
          <circle cx="50" cy="26" r="6" fill={COL.paper} />
          <rect x="32" y="42" width="36" height="2.5" rx="1" fill={COL.paper} />
        </>
      )
    case 'social-story':
      return (
        <>
          <rect x="32" y="4" width="36" height="56" rx="2" fill="currentColor" opacity="0.5" />
          <rect x="38" y="12" width="24" height="2.5" rx="1" fill={COL.paper} />
          <rect x="38" y="50" width="20" height="2.5" rx="1" fill={COL.paper} />
        </>
      )
    case 'cover-image':
      return (
        <>
          <rect x="6" y="22" width="88" height="20" rx="1.5" fill="currentColor" opacity="0.5" />
          <rect x="14" y="30" width="34" height="3" rx="1" fill={COL.paper} />
        </>
      )
    case 'ad-banner':
      return (
        <>
          <rect x="6" y="26" width="88" height="12" rx="1.5" fill="currentColor" opacity="0.55" />
          <rect x="12" y="30" width="14" height="4" rx="1" fill={COL.paper} />
          <rect x="30" y="30" width="40" height="2" rx="1" fill={COL.paper} opacity="0.85" />
          <rect x="78" y="30" width="12" height="4" rx="1" fill={COL.paper} opacity="0.9" />
        </>
      )
    case 'design-system':
      return (
        <>
          <rect x="6" y="6" width="36" height="6" rx="1" fill={COL.ink} />
          <rect x="6" y="16" width="14" height="14" rx="1" fill="currentColor" />
          <rect x="22" y="16" width="14" height="14" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="38" y="16" width="14" height="14" rx="1" fill={COL.muted} />
          <rect x="54" y="16" width="14" height="14" rx="1" fill={COL.muted} opacity="0.6" />
          <rect x="70" y="16" width="14" height="14" rx="1" fill={COL.paper} />
          <rect x="6" y="36" width="80" height="3" rx="1" fill={COL.muted} />
          <rect x="6" y="44" width="40" height="14" rx="1.5" fill={COL.paper} />
          <rect x="50" y="44" width="40" height="14" rx="1.5" fill={COL.paper} />
        </>
      )
    case 'wireframe':
      return (
        <>
          <rect x="10" y="6" width="80" height="52" rx="1" fill="none" stroke={COL.muted} strokeDasharray="2 2" strokeWidth="0.6" />
          <rect x="14" y="10" width="20" height="3" rx="0.5" fill="none" stroke={COL.muted} strokeDasharray="2 1.5" />
          <rect x="14" y="18" width="72" height="14" rx="0.5" fill="none" stroke={COL.muted} strokeDasharray="2 2" />
          <rect x="14" y="36" width="32" height="18" rx="0.5" fill="none" stroke={COL.muted} strokeDasharray="2 2" />
          <rect x="50" y="36" width="36" height="18" rx="0.5" fill="none" stroke={COL.muted} strokeDasharray="2 2" />
          <line x1="50" y1="36" x2="86" y2="54" stroke={COL.muted} strokeDasharray="1.5 1.5" />
          <line x1="50" y1="54" x2="86" y2="36" stroke={COL.muted} strokeDasharray="1.5 1.5" />
        </>
      )
    case 'mood-board':
      return (
        <>
          <rect x="6" y="6" width="22" height="22" rx="1" fill="currentColor" opacity="0.5" />
          <rect x="32" y="6" width="30" height="14" rx="1" fill={COL.muted} />
          <rect x="66" y="6" width="22" height="22" rx="1" fill={COL.muted} opacity="0.6" />
          <rect x="32" y="24" width="30" height="14" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="6" y="32" width="22" height="26" rx="1" fill={COL.muted} />
          <rect x="32" y="42" width="30" height="16" rx="1" fill={COL.muted} opacity="0.6" />
          <rect x="66" y="32" width="22" height="26" rx="1" fill="currentColor" opacity="0.4" />
        </>
      )
    case 'style-tile':
      return (
        <>
          <rect x="6" y="6" width="88" height="14" rx="1" fill={COL.ink} />
          <rect x="14" y="11" width="32" height="4" rx="1" fill={COL.paper} />
          <rect x="6" y="24" width="20" height="6" rx="1" fill="currentColor" />
          <rect x="28" y="24" width="20" height="6" rx="1" fill="currentColor" opacity="0.55" />
          <rect x="50" y="24" width="20" height="6" rx="1" fill={COL.muted} />
          <rect x="72" y="24" width="20" height="6" rx="1" fill={COL.muted} opacity="0.55" />
          <rect x="6" y="34" width="40" height="3" rx="1" fill={COL.ink} />
          <rect x="6" y="40" width="60" height="2" rx="1" fill={COL.muted} />
          <rect x="6" y="48" width="88" height="10" rx="1" fill={COL.paper} />
        </>
      )
    case 'user-flow':
      return (
        <>
          <rect x="6" y="14" width="20" height="12" rx="1.5" fill={COL.paper} stroke={COL.muted} strokeWidth="0.6" />
          <rect x="40" y="14" width="20" height="12" rx="1.5" fill={COL.paper} stroke={COL.muted} strokeWidth="0.6" />
          <rect x="74" y="14" width="20" height="12" rx="1.5" fill={COL.paper} stroke={COL.muted} strokeWidth="0.6" />
          <rect x="40" y="38" width="20" height="12" rx="1.5" fill="currentColor" opacity="0.4" />
          <line x1="26" y1="20" x2="40" y2="20" stroke={COL.muted} />
          <line x1="60" y1="20" x2="74" y2="20" stroke={COL.muted} />
          <line x1="50" y1="26" x2="50" y2="38" stroke={COL.muted} />
        </>
      )
    case 'sitemap':
      return (
        <>
          <rect x="42" y="6" width="16" height="8" rx="1" fill="currentColor" />
          <line x1="50" y1="14" x2="20" y2="22" stroke={COL.muted} />
          <line x1="50" y1="14" x2="50" y2="22" stroke={COL.muted} />
          <line x1="50" y1="14" x2="80" y2="22" stroke={COL.muted} />
          <rect x="12" y="22" width="16" height="8" rx="1" fill={COL.muted} />
          <rect x="42" y="22" width="16" height="8" rx="1" fill={COL.muted} />
          <rect x="72" y="22" width="16" height="8" rx="1" fill={COL.muted} />
          <line x1="20" y1="30" x2="14" y2="38" stroke={COL.muted} />
          <line x1="20" y1="30" x2="26" y2="38" stroke={COL.muted} />
          <rect x="8" y="38" width="14" height="6" rx="1" fill={COL.paper} />
          <rect x="22" y="38" width="14" height="6" rx="1" fill={COL.paper} />
          <rect x="42" y="38" width="14" height="6" rx="1" fill={COL.paper} />
          <rect x="72" y="38" width="14" height="6" rx="1" fill={COL.paper} />
        </>
      )
    case 'blank':
      return (
        <>
          <rect x="22" y="6" width="56" height="52" rx="1.5" fill={COL.paper} stroke={COL.muted} strokeDasharray="2 2" strokeWidth="0.6" />
        </>
      )
    default:
      return null
  }
}

// ─── Main wizard ────────────────────────────────────────────────────────────

export function DesignWizard({ onCancel, onComplete, initialIdea, target = 'html', starterTemplate, creating = false }: {
  onCancel: () => void
  onComplete: (brief: DesignBrief, kickoff: string) => void
  initialIdea?: string
  // 'html' (default) generates a v00N.html file. 'figma' sends the brief
  // through figmaFromScratch on completion: no HTML, straight to Figma.
  target?: 'html' | 'figma'
  // When provided, the wizard runs in "starter template" mode: only the
  // idea + palette pages are shown. The caller is expected to materialise
  // the template files into the new design's cwd before kicking off.
  starterTemplate?: TemplateInfo
  // True while the parent is materialising the template + creating the
  // design row. The wizard shows a loading overlay so the user knows the
  // app didn't freeze after they clicked the final button.
  creating?: boolean
}): JSX.Element {
  const [state, setState] = useState<DesignWizardState>(() => {
    const base = emptyDesignState()
    if (starterTemplate) {
      // Default kind/category give stateToBrief enough to produce a brief.
      // Dashboards map to the 'app' group; everything else is treated as
      // a website. The starter's actual files dominate at generation time
      // so the chosen kind is just a label.
      const isDash = starterTemplate.category === 'dashboard'
      base.category = isDash ? 'app' : 'web'
      base.kind = isDash ? 'dashboard' : 'website'
      base.starterTemplateId = starterTemplate.id
      base.starterTemplateName = starterTemplate.displayName
    }
    return { ...base, idea: initialIdea ?? '', target }
  })
  const [pageIdx, setPageIdx] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  // Reset the wizard body scroll to top whenever the page changes. Without
  // this, a long page (Look has 14 options, Palette has many) leaves you
  // mid-scroll, then the next page also opens mid-scroll — which reads as
  // "one continuous scroll between pages" instead of discrete tabs.
  const scrollMainRef = useRef<HTMLElement | null>(null)

  const pages = useMemo(() => pagesForState(state), [state.category, state.kind, state.target, state.templateFile, state.useTemplateLook, state.starterTemplateId])
  const currentPage = pages[pageIdx]
  const isLast = pageIdx === pages.length - 1

  // Don't trap pageIdx out of range when pages list shrinks.
  useEffect(() => {
    if (pageIdx >= pages.length) setPageIdx(pages.length - 1)
  }, [pages, pageIdx])

  // Snap each new page to the top so each tab opens fresh.
  useEffect(() => {
    if (scrollMainRef.current) scrollMainRef.current.scrollTop = 0
  }, [currentPage])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !creating) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, creating])

  const set = <K extends keyof DesignWizardState>(k: K, v: DesignWizardState[K]): void =>
    setState((s) => ({ ...s, [k]: v }))

  const next = (): void => {
    if (state.kind === 'blank') return finish()
    if (isLast) return finish()
    setDirection('forward')
    setPageIdx((i) => Math.min(i + 1, pages.length - 1))
  }
  const back = (): void => {
    setDirection('back')
    setPageIdx((i) => Math.max(i - 1, 0))
  }

  const canAdvance =
    currentPage === 'category' ? !!state.category :
    currentPage === 'kind'     ? !!state.kind :
    true

  const finish = (): void => {
    const brief = stateToBrief(state)
    if (!brief) return
    const ideaPart = brief.idea ? `\n\n${brief.idea}` : ''
    let kickoff: string
    if (state.starterTemplateId) {
      // Files for the chosen starter have already been (or are about to
      // be) materialised into the design's cwd by the caller. Tell the
      // model to treat them as the source of truth and only adapt them
      // to the user's project context.
      kickoff = `Use the ${state.starterTemplateName ?? 'starter'} template that's already in this folder as the foundation. Adapt the existing files to the brief below — don't rebuild from scratch.${ideaPart}`
    } else if (state.target === 'figma') {
      kickoff = `Build this in Figma based on the brief.${ideaPart}`
    } else {
      kickoff = `Create v001 based on this brief.${ideaPart}`
    }
    onComplete(brief, kickoff)
  }

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !creating) onCancel() }}
      role="presentation"
    >
      <div className="relative flex h-[82vh] max-h-[760px] w-[820px] max-w-full flex-col overflow-hidden rounded-xl bg-bg shadow-2xl">
        {/* Header */}
        <header className="flex items-center gap-5 bg-surface/40 px-6 py-4">
          <div className="flex flex-shrink-0 flex-col gap-0.5">
            <h2 className="text-[18px] font-semibold text-text-primary">
              {currentPage === 'subtype'
                ? (DESIGN_KINDS.find((k) => k.id === state.kind)?.subtypeLabel ?? PAGE_TITLES[currentPage])
                : PAGE_TITLES[currentPage]}
            </h2>
            {state.starterTemplateId && state.starterTemplateName && (
              <span className="text-[11px] text-text-secondary">
                Starting from {state.starterTemplateName} template
              </span>
            )}
          </div>
          <span className="flex-shrink-0 rounded-full bg-elevated/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-text-muted">
            {pageIdx + 1} / {pages.length}
          </span>
          <div className="flex flex-1" />
          <button
            onClick={onCancel}
            disabled={creating}
            aria-label="Close"
            title="Close (Esc)"
            className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-30"
          >
            <IconClose size={11} />
          </button>
        </header>

        {/* Loading overlay shown while the template is being cloned/copied
            and the design row + initial Copilot run are being kicked off. */}
        {creating && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-bg/85 backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <svg className="h-7 w-7 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
              <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="text-[13.5px] font-medium text-text-primary">
              {starterTemplate
                ? `Setting up ${starterTemplate.displayName} template…`
                : 'Creating design…'}
            </div>
            <div className="max-w-[420px] text-center text-[11.5px] text-text-muted">
              {starterTemplate
                ? 'Cloning the template files into your design folder. This takes a few seconds the first time.'
                : 'Preparing the workspace.'}
            </div>
          </div>
        )}

        {/* Body */}
        <main ref={scrollMainRef} className="flex-1 overflow-y-auto px-7 py-6">
          <div
            key={currentPage}
            className={direction === 'forward' ? 'wizard-page-fwd' : 'wizard-page-back'}
          >
            {currentPage === 'category'    && <PageCategory state={state} set={set} />}
            {currentPage === 'kind'        && <PageKind state={state} set={set} />}
            {currentPage === 'subtype'     && <PageSubtype state={state} set={set} />}
            {currentPage === 'surface'     && <PageSurface state={state} set={set} />}
            {currentPage === 'fidelity'    && <PageFidelity state={state} set={set} />}
            {currentPage === 'stack'       && <PageStack state={state} set={set} />}
            {currentPage === 'look'        && <PageLook state={state} set={set} />}
            {currentPage === 'shape'       && <PageShape state={state} set={set} />}
            {currentPage === 'audience'    && <PageAudience state={state} set={set} />}
            {currentPage === 'palette'     && <PagePalette state={state} set={set} />}
            {currentPage === 'fonts'       && <PageFonts state={state} set={set} />}
            {currentPage === 'icons'       && <PageIcons state={state} set={set} />}
            {currentPage === 'theme'       && <PageTheme state={state} set={set} />}
            {currentPage === 'density'     && <PageDensity state={state} set={set} />}
            {currentPage === 'spacing'     && <PageSpacing state={state} set={set} />}
            {currentPage === 'grid'        && <PageGrid state={state} set={set} />}
            {currentPage === 'motion'      && <PageMotion state={state} set={set} />}
            {currentPage === 'inspiration' && <PageInspiration state={state} set={set} />}
            {currentPage === 'idea'        && <PageIdea state={state} set={set} />}
            {currentPage === 'defaults'    && <PageDefaults state={state} set={set} />}
            {currentPage === 'figma'       && <PageFigma state={state} set={set} />}
            {currentPage === 'summary'     && <PageSummary state={state} set={set} />}
          </div>
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between bg-surface/40 px-6 py-3.5">
          <button
            onClick={back}
            disabled={pageIdx === 0 || creating}
            className="rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ← Back
          </button>
          <div className="flex flex-1" />
          <div className="flex items-center gap-2">
            {!isLast && pageIdx > 0 && currentPage !== 'kind' && currentPage !== 'category' && (
              <button
                onClick={next}
                disabled={creating}
                className="rounded-md px-3 py-1.5 text-[13px] text-text-secondary hover:bg-surface disabled:opacity-30"
              >
                Skip
              </button>
            )}
            <button
              onClick={next}
              disabled={!canAdvance || creating}
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-1.5 text-[13px] font-medium text-accent-text hover:opacity-90 disabled:opacity-50"
            >
              {creating && (
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M14 8a6 6 0 0 1-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
              {creating
                ? (starterTemplate ? 'Setting up template…' : 'Creating…')
                : (isLast || state.kind === 'blank'
                    ? (state.target === 'figma' ? 'Build in Figma' : 'Create design')
                    : 'Next →')}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ─── Pages ──────────────────────────────────────────────────────────────────

type PageProps = {
  state: DesignWizardState
  set: <K extends keyof DesignWizardState>(k: K, v: DesignWizardState[K]) => void
}

function PageCategory({ state, set }: PageProps): JSX.Element {
  const groups: DesignGroup[] = ['web', 'app', 'presentation', 'content', 'print', 'data', 'social', 'figma', 'other']
  const renderMock = (g: DesignGroup): ReactNode => {
    if (g === 'web') return <>
      <rect x="8" y="6" width="84" height="52" rx="3" fill={COL.paper} />
      <line x1="8" y1="14" x2="92" y2="14" stroke={COL.muted} strokeWidth="0.5" />
      <circle cx="14" cy="10" r="1" fill={COL.muted} /><circle cx="18" cy="10" r="1" fill={COL.muted} /><circle cx="22" cy="10" r="1" fill={COL.muted} />
      <rect x="14" y="22" width="22" height="3" rx="1" fill={COL.ink} />
      <rect x="14" y="30" width="34" height="2" rx="1" fill={COL.muted} />
      <rect x="14" y="42" width="14" height="6" rx="2" fill="currentColor" />
      <rect x="56" y="22" width="32" height="26" rx="2" fill="currentColor" opacity="0.45" />
    </>
    if (g === 'app') return <>
      <rect x="8" y="6" width="84" height="52" rx="3" fill={COL.paper} />
      {/* Left nav */}
      <rect x="8" y="6" width="18" height="52" fill={COL.ink} opacity="0.85" />
      <rect x="11" y="12" width="12" height="2" rx="0.5" fill={COL.paper} opacity="0.6" />
      <rect x="11" y="18" width="10" height="2" rx="0.5" fill={COL.paper} opacity="0.45" />
      <rect x="11" y="24" width="11" height="2" rx="0.5" fill={COL.paper} opacity="0.45" />
      <rect x="11" y="30" width="9" height="2" rx="0.5" fill={COL.paper} opacity="0.45" />
      {/* Main */}
      <rect x="30" y="12" width="22" height="3" rx="1" fill={COL.ink} />
      <rect x="30" y="20" width="58" height="14" rx="1.5" fill="currentColor" opacity="0.55" />
      <rect x="30" y="38" width="27" height="14" rx="1.5" fill={COL.muted} />
      <rect x="61" y="38" width="27" height="14" rx="1.5" fill={COL.muted} />
    </>
    if (g === 'presentation') return <>
      <rect x="6" y="8" width="88" height="48" rx="3" fill={COL.paper} />
      <rect x="14" y="18" width="34" height="4" rx="1" fill={COL.ink} />
      <rect x="14" y="26" width="44" height="2" rx="1" fill={COL.muted} />
      <rect x="14" y="32" width="40" height="2" rx="1" fill={COL.muted} />
      <rect x="62" y="32" width="22" height="14" rx="2" fill="currentColor" />
    </>
    if (g === 'content') return <>
      <rect x="14" y="6" width="48" height="52" rx="2" fill={COL.paper} />
      <rect x="20" y="12" width="20" height="3" rx="1" fill={COL.ink} />
      <rect x="20" y="20" width="36" height="1.5" rx="0.5" fill={COL.muted} />
      <rect x="20" y="24" width="36" height="1.5" rx="0.5" fill={COL.muted} />
      <rect x="20" y="28" width="32" height="1.5" rx="0.5" fill={COL.muted} />
      <rect x="20" y="34" width="36" height="1.5" rx="0.5" fill={COL.muted} />
      <rect x="20" y="38" width="36" height="1.5" rx="0.5" fill={COL.muted} />
      <rect x="20" y="42" width="22" height="1.5" rx="0.5" fill={COL.muted} />
      <rect x="68" y="14" width="22" height="36" rx="2" fill="currentColor" opacity="0.4" />
    </>
    if (g === 'print') return <>
      <rect x="14" y="8" width="32" height="48" rx="1" fill={COL.paper} />
      <rect x="20" y="18" width="20" height="14" fill="currentColor" />
      <rect x="20" y="36" width="20" height="2" rx="1" fill={COL.muted} />
      <rect x="20" y="40" width="14" height="2" rx="1" fill={COL.muted} />
      <rect x="58" y="14" width="32" height="42" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="62" y="22" width="24" height="2" rx="1" fill={COL.paper} opacity="0.7" />
      <rect x="62" y="28" width="20" height="2" rx="1" fill={COL.paper} opacity="0.5" />
    </>
    if (g === 'data') return <>
      <rect x="6" y="8" width="88" height="48" rx="3" fill={COL.paper} />
      <line x1="14" y1="48" x2="86" y2="48" stroke={COL.muted} strokeWidth="0.5" />
      <line x1="14" y1="14" x2="14" y2="48" stroke={COL.muted} strokeWidth="0.5" />
      <rect x="20" y="36" width="8" height="12" fill="currentColor" opacity="0.5" />
      <rect x="32" y="28" width="8" height="20" fill="currentColor" opacity="0.6" />
      <rect x="44" y="22" width="8" height="26" fill="currentColor" opacity="0.7" />
      <rect x="56" y="18" width="8" height="30" fill="currentColor" opacity="0.85" />
      <rect x="68" y="14" width="8" height="34" fill="currentColor" />
    </>
    if (g === 'social') return <>
      <rect x="20" y="8" width="60" height="48" rx="6" fill={COL.paper} />
      <circle cx="34" cy="22" r="6" fill="currentColor" />
      <rect x="46" y="18" width="22" height="3" rx="1" fill={COL.ink} />
      <rect x="46" y="24" width="14" height="2" rx="1" fill={COL.muted} />
      <rect x="28" y="34" width="44" height="16" rx="2" fill="currentColor" opacity="0.4" />
    </>
    if (g === 'figma') return <>
      <rect x="6" y="6" width="88" height="52" rx="4" fill={COL.paper} />
      {/* Color row */}
      <rect x="14" y="14" width="6" height="6" rx="1" fill="currentColor" />
      <rect x="22" y="14" width="6" height="6" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="30" y="14" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="38" y="14" width="6" height="6" rx="1" fill={COL.ink} />
      {/* Type sample */}
      <rect x="50" y="13" width="36" height="3" rx="1" fill={COL.ink} />
      <rect x="50" y="19" width="28" height="2" rx="1" fill={COL.muted} />
      {/* Component samples */}
      <rect x="14" y="28" width="22" height="10" rx="2" fill="currentColor" />
      <rect x="40" y="28" width="22" height="10" rx="2" fill={COL.ink} opacity="0.15" />
      <rect x="66" y="28" width="20" height="10" rx="5" fill={COL.muted} opacity="0.4" />
      <rect x="14" y="42" width="72" height="10" rx="2" fill={COL.muted} opacity="0.25" />
    </>
    // other
    return <>
      <rect x="22" y="10" width="56" height="44" rx="3" fill={COL.paper} />
      <path d="M30 26 q8 -10 16 0 q8 10 16 0" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="50" cy="40" r="3.5" fill="currentColor" opacity="0.6" />
    </>
  }
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {groups.map((g) => {
        const selected = state.category === g
        return (
          <button
            key={g}
            onClick={() => {
              // If switching category, also reset kind so picking again is clean.
              if (state.category !== g) set('kind', null)
              set('category', g)
            }}
            className={tileClass(selected, 'flex flex-col gap-2')}
          >
            <div
              className={[
                'grid h-[78px] w-full place-items-center overflow-hidden rounded-md bg-elevated/70 transition-colors',
                selected ? 'text-accent' : 'text-text-secondary group-hover:text-accent'
              ].join(' ')}
            >
              <svg viewBox="0 0 100 64" width="100%" height="64">{renderMock(g)}</svg>
            </div>
            <div>
              <div className="text-[13px] font-medium text-text-primary">{GROUP_LABELS[g]}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function PageKind({ state, set }: PageProps): JSX.Element {
  const [otherText, setOtherText] = useState('')
  const [otherOpen, setOtherOpen] = useState(false)
  if (!state.category) return <div className="text-text-muted">Pick a category first.</div>
  const items = DESIGN_KINDS.filter((k) => k.group === state.category)
  const isOtherActive = state.kind === 'blank' && otherOpen

  const pickOther = (): void => {
    setOtherOpen(true)
    set('kind', 'blank')
    set('subtype', null)
  }
  const onOtherChange = (v: string): void => {
    setOtherText(v)
    set('idea', v)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {items.map((k) => {
          const selected = state.kind === k.id && !isOtherActive
          const Icon = KIND_ICONS[k.id]
          const mock = kindMock(k.id)
          return (
            <button
              key={k.id}
              onClick={() => {
                setOtherOpen(false)
                if (state.kind !== k.id) set('subtype', null)
                set('kind', k.id)
              }}
              className={tileClass(selected, 'flex flex-col gap-2')}
            >
              <div className="grid h-[64px] w-full place-items-center overflow-hidden rounded-md bg-elevated/70 text-accent">
                {mock
                  ? <svg viewBox="0 0 100 64" width="100%" height="64">{mock}</svg>
                  : <Icon className="h-7 w-7 text-text-secondary" />}
              </div>
              <div className="truncate text-[12.5px] font-medium text-text-primary">{k.label}</div>
            </button>
          )
        })}
        <button
          onClick={pickOther}
          className={tileClass(isOtherActive, 'flex flex-col gap-2')}
        >
          <div className="grid h-[64px] w-full place-items-center overflow-hidden rounded-md bg-elevated/70 text-accent">
            <svg viewBox="0 0 20 20" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="10" cy="10" r="7" strokeDasharray="2 1.6" />
              <path d="M10 7 V13 M7 10 H13" />
            </svg>
          </div>
          <div className="truncate text-[12.5px] font-medium text-text-primary">I'll describe…</div>
        </button>
      </div>
      {isOtherActive && (
        <input
          type="text"
          value={otherText}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder="Describe what you want to design…"
          className="w-full rounded-md bg-elevated/60 px-3 py-2 text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40"
          autoFocus
        />
      )}
    </div>
  )
}

function PageSubtype({ state, set }: PageProps): JSX.Element {
  const def = DESIGN_KINDS.find((k) => k.id === state.kind)!
  const decided = !!state.decisions.subtype
  const multi = !!def.multiSubtype
  // For multi-select, subtype stores a comma-joined string. Treat empty
  // string as "none picked yet" so the validation loop doesn't trap.
  const picked = new Set(
    multi && state.subtype ? state.subtype.split(',').map((x) => x.trim()).filter(Boolean) : []
  )
  const togglePick = (s: string): void => {
    if (multi) {
      const next = new Set(picked)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      const joined = Array.from(next).join(', ')
      set('subtype', joined || null)
    } else {
      set('subtype', s)
    }
  }
  return (
    <div className="space-y-3">
      <div className={['grid grid-cols-3 gap-2 transition-opacity', decided ? 'opacity-40 pointer-events-none' : ''].join(' ')}>
        {def.subtypes!.map((s) => {
          const selected = !decided && (multi ? picked.has(s) : state.subtype === s)
          return (
            <button
              key={s}
              onClick={() => togglePick(s)}
              className={tileClass(selected, 'min-h-[56px] flex items-center gap-2')}
            >
              {multi && (
                <span className={[
                  'grid h-3.5 w-3.5 flex-shrink-0 place-items-center rounded-sm border transition-colors',
                  selected ? 'border-accent bg-accent text-accent-text' : 'border-text-muted/40 bg-transparent'
                ].join(' ')}>
                  {selected && (
                    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                      <path d="M2.5 6.2 L5 8.5 L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              )}
              <span className="text-[13px] font-medium text-text-primary">{s}</span>
            </button>
          )
        })}
      </div>
      <div>
        <DecideForMe state={state} set={set} field="subtype" onPick={() => set('subtype', null)} />
      </div>
    </div>
  )
}

function PageSurface({ state, set }: PageProps): JSX.Element {
  const renderMock = (id: string): ReactNode => {
    if (id === 'mobile') return <>
      <rect x="40" y="6" width="20" height="52" rx="3" fill={COL.paper} />
      <rect x="44" y="14" width="12" height="2.5" rx="1" fill={COL.ink} />
      <rect x="44" y="20" width="9" height="2"   rx="1" fill={COL.muted} />
      <rect x="44" y="26" width="12" height="6"  rx="1" fill="currentColor" />
      <rect x="44" y="36" width="12" height="3"  rx="1" fill={COL.muted} />
      <rect x="44" y="42" width="12" height="3"  rx="1" fill={COL.muted} />
    </>
    if (id === 'tablet') return <>
      <rect x="22" y="6" width="56" height="52" rx="3" fill={COL.paper} />
      <rect x="28" y="14" width="20" height="3" rx="1" fill={COL.ink} />
      <rect x="28" y="22" width="44" height="14" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="28" y="40" width="20" height="12" rx="2" fill={COL.muted} />
      <rect x="52" y="40" width="20" height="12" rx="2" fill={COL.muted} />
    </>
    if (id === 'desktop') return <>
      <rect x="8" y="6" width="84" height="46" rx="3" fill={COL.paper} />
      <rect x="14" y="14" width="20" height="2.5" rx="1" fill={COL.ink} />
      <rect x="14" y="20" width="32" height="2"   rx="1" fill={COL.muted} />
      <rect x="14" y="28" width="14" height="8"   rx="2" fill="currentColor" />
      <rect x="56" y="14" width="32" height="32"  rx="2" fill="currentColor" opacity="0.5" />
      <rect x="42" y="58" width="16" height="2"   rx="1" fill={COL.muted} />
    </>
    // responsive
    return <>
      <rect x="8" y="14" width="50" height="38" rx="3" fill={COL.paper} />
      <rect x="14" y="20" width="14" height="2.5" rx="1" fill={COL.ink} />
      <rect x="14" y="26" width="22" height="2"   rx="1" fill={COL.muted} />
      <rect x="14" y="34" width="38" height="14"  rx="2" fill="currentColor" opacity="0.55" />
      <rect x="62" y="6" width="30" height="52" rx="3" fill={COL.paper} />
      <rect x="66" y="14" width="14" height="2.5" rx="1" fill={COL.ink} />
      <rect x="66" y="20" width="20" height="2"   rx="1" fill={COL.muted} />
      <rect x="66" y="28" width="22" height="10"  rx="2" fill="currentColor" />
    </>
  }
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {SURFACE_OPTIONS.map((s) => {
        const selected = state.surface === s.id
        return (
          <button key={s.id} onClick={() => set('surface', s.id)} className={tileClass(selected, 'flex flex-col gap-2')}>
            <MiniBox>{renderMock(s.id)}</MiniBox>
            <div className="text-[12.5px] font-medium text-text-primary">{s.label}</div>
          </button>
        )
      })}
    </div>
  )
}

function PageFidelity({ state, set }: PageProps): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3">
      {FIDELITY_OPTIONS.map((f) => {
        const selected = state.fidelity === f.id
        return (
          <button
            key={f.id}
            onClick={() => set('fidelity', f.id)}
            className={tileClass(selected, 'flex flex-col gap-3')}
          >
            <div className="grid h-[120px] place-items-center overflow-hidden rounded-md bg-elevated text-accent">
              <FidelityMockup fidelity={f.id} />
            </div>
            <div>
              <div className="text-[13px] font-medium text-text-primary">{f.label}</div>
              <div className="text-[12px] text-text-muted">{f.hint}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function FidelityMockup({ fidelity }: { fidelity: 'wireframe' | 'highfidelity' }): JSX.Element {
  const wf = fidelity === 'wireframe'
  const stroke = wf ? 'rgba(120,120,120,0.6)' : 'transparent'
  const dash = wf ? '3 2' : undefined
  const muted = 'rgba(120,120,120,0.45)'
  const accent = wf ? muted : 'currentColor'
  const dark   = wf ? muted : '#374151'
  const light  = wf ? 'rgba(180,180,180,0.35)' : '#e7e5e4'
  return (
    <svg viewBox="0 0 160 100" width="160">
      <rect x="6" y="6" width="148" height="88" rx="6" fill={light} stroke={stroke} strokeDasharray={dash} />
      <circle cx="14" cy="14" r="1.6" fill={muted} />
      <circle cx="20" cy="14" r="1.6" fill={muted} />
      <circle cx="26" cy="14" r="1.6" fill={muted} />
      <line x1="6" y1="22" x2="154" y2="22" stroke={muted} strokeWidth="0.6" />
      <rect x="16" y="32" width="60" height="6" rx="2" fill={dark} />
      <rect x="16" y="44" width="80" height="4" rx="2" fill={muted} />
      <rect x="16" y="52" width="48" height="4" rx="2" fill={muted} />
      <rect x="16" y="64" width="32" height="10" rx="3" fill={accent} />
      <rect x="100" y="32" width="46" height="44" rx="3" fill={accent} opacity={0.55} />
    </svg>
  )
}

function PageLook({ state, set }: PageProps): JSX.Element {
  const lookMock = (id: string): { bg: string; node: ReactNode } => {
    switch (id) {
      case 'minimal': return { bg: '#fafaf9', node: <>
        {/* Lots of whitespace, one tiny element */}
        <line x1="6" y1="32" x2="34" y2="32" stroke="#1a1a1a" strokeWidth="0.6" />
        <rect x="6" y="38" width="20" height="2" rx="0.5" fill="#a3a3a3" />
      </>}
      case 'bold': return { bg: '#0a0a0a', node: <>
        {/* HUGE word + accent slab */}
        <rect x="6" y="14" width="50" height="14" rx="0" fill="#facc15" />
        <rect x="6" y="32" width="60" height="3" rx="0" fill="#fafaf9" />
        <rect x="6" y="44" width="22" height="10" rx="0" fill="#facc15" />
      </>}
      case 'modern': return { bg: '#f4f4f5', node: <>
        {/* Crisp two-column with a clean image */}
        <rect x="6" y="12" width="44" height="3" rx="0.5" fill="#0f172a" />
        <rect x="6" y="18" width="36" height="2" rx="0.5" fill="#64748b" />
        <rect x="6" y="22" width="42" height="2" rx="0.5" fill="#64748b" />
        <rect x="6" y="34" width="14" height="6" rx="1" fill="#0f172a" />
        <rect x="56" y="6" width="38" height="52" rx="2" fill="#0ea5e9" />
        <rect x="62" y="14" width="20" height="14" rx="1" fill="#f4f4f5" opacity="0.9" />
      </>}
      case 'editorial': return { bg: '#faf5ef', node: <>
        {/* Magazine: drop-cap + columns */}
        <rect x="6" y="6" width="14" height="18" rx="0" fill="#1f2937" />
        <rect x="22" y="8" width="40" height="2" rx="0" fill="#1f2937" />
        <rect x="22" y="14" width="36" height="2" rx="0" fill="#6b7280" />
        <rect x="22" y="20" width="38" height="2" rx="0" fill="#6b7280" />
        <line x1="6" y1="30" x2="94" y2="30" stroke="#1f2937" strokeWidth="0.4" />
        <rect x="6" y="36" width="40" height="2" rx="0" fill="#6b7280" />
        <rect x="6" y="40" width="42" height="2" rx="0" fill="#6b7280" />
        <rect x="6" y="44" width="36" height="2" rx="0" fill="#6b7280" />
        <rect x="52" y="36" width="40" height="2" rx="0" fill="#6b7280" />
        <rect x="52" y="40" width="38" height="2" rx="0" fill="#6b7280" />
        <rect x="52" y="44" width="40" height="2" rx="0" fill="#6b7280" />
      </>}
      case 'playful': return { bg: '#fff1f2', node: <>
        {/* Bouncing shapes */}
        <circle cx="20" cy="22" r="11" fill="#f43f5e" />
        <rect x="38" y="14" width="22" height="22" rx="6" fill="#fbbf24" />
        <circle cx="76" cy="22" r="9" fill="#10b981" />
        <rect x="20" y="42" width="50" height="6" rx="3" fill="#8b5cf6" />
        <circle cx="80" cy="48" r="4" fill="#0ea5e9" />
      </>}
      case 'friendly': return { bg: '#fef3c7', node: <>
        {/* Friendly avatar + warm copy */}
        <circle cx="22" cy="32" r="13" fill="#fbbf24" />
        <circle cx="18" cy="29" r="1.4" fill="#1a1a1a" />
        <circle cx="26" cy="29" r="1.4" fill="#1a1a1a" />
        <path d="M17 36 Q22 40 27 36" stroke="#1a1a1a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <rect x="44" y="22" width="42" height="3" rx="1.5" fill="#92400e" />
        <rect x="44" y="30" width="32" height="2" rx="1" fill="#a16207" opacity="0.7" />
        <rect x="44" y="40" width="16" height="6" rx="3" fill="#16a34a" />
      </>}
      case 'luxe': return { bg: '#1a1a1a', node: <>
        {/* Spacious gold serif */}
        <line x1="34" y1="18" x2="66" y2="18" stroke="#d4af37" strokeWidth="0.4" />
        <text x="50" y="34" fontSize="11" fill="#d4af37" textAnchor="middle"
          style={{ fontFamily: 'Georgia, serif', letterSpacing: '0.3em' }}>LUXE</text>
        <line x1="34" y1="44" x2="66" y2="44" stroke="#d4af37" strokeWidth="0.4" />
        <rect x="40" y="50" width="20" height="4" rx="0" fill="#d4af37" opacity="0.6" />
      </>}
      case 'brutalist': return { bg: '#facc15', node: <>
        {/* Stark black blocks at hard angles */}
        <rect x="6" y="6" width="38" height="20" fill="#000" />
        <rect x="50" y="6" width="44" height="12" fill="#000" />
        <rect x="50" y="22" width="20" height="4" fill="#000" />
        <rect x="6" y="32" width="22" height="26" fill="#000" />
        <rect x="34" y="32" width="60" height="14" fill="#000" />
        <rect x="34" y="50" width="40" height="8" fill="#000" />
      </>}
      case 'organic': return { bg: '#fef3c7', node: <>
        {/* Soft natural shapes */}
        <path d="M10,40 Q12,18 32,16 Q56,14 52,32 Q48,48 28,48 Q10,48 10,40 Z" fill="#65a30d" opacity="0.85" />
        <circle cx="68" cy="22" r="10" fill="#fb923c" opacity="0.9" />
        <path d="M58,52 Q70,40 82,52" stroke="#92400e" strokeWidth="1.5" fill="none" />
        <rect x="14" y="52" width="60" height="2" rx="1" fill="#92400e" opacity="0.4" />
      </>}
      case 'technical': return { bg: '#f8fafc', node: <>
        {/* Engineering grid */}
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={'v'+i} x1={10 + i*10} y1="6" x2={10 + i*10} y2="58" stroke="#cbd5e1" strokeWidth="0.3" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={'h'+i} x1="10" y1={10 + i*12} x2="90" y2={10 + i*12} stroke="#cbd5e1" strokeWidth="0.3" />
        ))}
        <rect x="14" y="14" width="22" height="6" fill="#0f172a" />
        <rect x="14" y="22" width="14" height="2" fill="#0f172a" />
        <rect x="14" y="28" width="40" height="14" fill="none" stroke="#0f172a" strokeWidth="0.6" strokeDasharray="2 1" />
        <text x="58" y="36" fontSize="6" fill="#0f172a" style={{ fontFamily: 'monospace' }}>v0.1</text>
        <line x1="14" y1="48" x2="90" y2="48" stroke="#0f172a" strokeWidth="0.5" />
      </>}
      case 'monochrome': return { bg: '#fafafa', node: <>
        {/* B/W with one bright accent dot */}
        <rect x="14" y="14" width="42" height="3" rx="0.5" fill="#0a0a0a" />
        <rect x="14" y="22" width="60" height="2" rx="0.5" fill="#525252" />
        <rect x="14" y="26" width="48" height="2" rx="0.5" fill="#525252" />
        <rect x="14" y="40" width="14" height="6" rx="1" fill="#0a0a0a" />
        <circle cx="78" cy="46" r="5" fill="#dc2626" />
      </>}
      case 'retro': return { bg: '#fde68a', node: <>
        {/* 70s curves + earth tones */}
        <rect x="10" y="10" width="80" height="44" rx="8" fill="#7c2d12" />
        <rect x="14" y="14" width="72" height="14" rx="6" fill="#fde68a" />
        <circle cx="22" cy="40" r="5" fill="#fbbf24" />
        <circle cx="36" cy="40" r="5" fill="#f97316" />
        <circle cx="50" cy="40" r="5" fill="#dc2626" />
        <rect x="60" y="36" width="22" height="10" rx="3" fill="#fde68a" />
      </>}
      case 'futuristic': return { bg: '#020617', node: <>
        <defs>
          <linearGradient id="fut" x1="0" x2="1">
            <stop offset="0" stopColor="#06b6d4" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        {/* Neon triangle + scan line */}
        <polygon points="50,6 86,52 14,52" fill="none" stroke="url(#fut)" strokeWidth="1.5" />
        <polygon points="50,16 76,48 24,48" fill="url(#fut)" opacity="0.55" />
        <line x1="14" y1="58" x2="86" y2="58" stroke="#06b6d4" strokeWidth="1.2" opacity="0.7" />
        <circle cx="50" cy="34" r="3" fill="#a855f7" />
      </>}
      case 'hand-drawn': return { bg: '#fef9e7', node: <>
        {/* Sketchy lines + dashed circle */}
        <path d="M10,16 Q40,12 50,18 T90,16" stroke="#0f172a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M10,28 Q34,26 48,28 T86,28" stroke="#525252" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <path d="M10,34 Q30,32 42,34 T76,34" stroke="#525252" strokeWidth="0.9" fill="none" strokeLinecap="round" />
        <rect x="14" y="42" width="16" height="8" rx="2.5" fill="none" stroke="#0f172a" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="74" cy="46" r="7" fill="none" stroke="#0f172a" strokeWidth="1.2" strokeDasharray="3 1.5" />
      </>}
    }
    return { bg: '#fafaf9', node: null }
  }
  const initialMode: 'system' | 'vibe' | 'describe' =
    state.designSystem ? 'system' : (state.customLook ? 'describe' : 'vibe')
  const [mode, setMode] = useState<'system' | 'vibe' | 'describe'>(initialMode)
  // Mode tabs.
  const tabBtn = (id: typeof mode, label: string): JSX.Element => (
    <button
      onClick={() => setMode(id)}
      className={[
        'flex-1 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
        mode === id
          ? 'bg-elevated text-text-primary shadow-sm'
          : 'text-text-secondary hover:text-text-primary'
      ].join(' ')}
    >{label}</button>
  )
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-elevated/40 p-1">
        {tabBtn('system',   'Design system')}
        {tabBtn('vibe',     'Pick a vibe')}
        {tabBtn('describe', 'Describe')}
      </div>

      {mode === 'system' && (
        <div className="space-y-2">
          <select
            value={state.designSystem ?? ''}
            onChange={(e) => {
              const v = e.target.value || null
              set('designSystem', v)
              if (v) { set('look', null); set('customLook', null) }
            }}
            className="w-full rounded-md bg-elevated/60 px-3 py-2.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
          >
            <option value="">Select a design system…</option>
            {DESIGN_SYSTEMS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {mode === 'vibe' && (
        <div className="grid grid-cols-3 gap-2.5">
          {LOOK_OPTIONS.map((l) => {
            const selected = state.look === l.id
            const m = lookMock(l.id)
            return (
              <button
                key={l.id}
                onClick={() => { set('look', l.id); set('customLook', null); set('designSystem', null) }}
                className={tileClass(selected, 'flex flex-col gap-2')}
              >
                <div className="grid h-[64px] w-full place-items-center overflow-hidden rounded-md" style={{ backgroundColor: m.bg }}>
                  <svg viewBox="0 0 100 64" width="100%" height="64">{m.node}</svg>
                </div>
                <div className="text-[13px] font-medium text-text-primary">{l.label}</div>
              </button>
            )
          })}
        </div>
      )}

      {mode === 'describe' && (
        <textarea
          value={state.customLook ?? ''}
          onChange={(e) => { set('customLook', e.target.value); set('look', null); set('designSystem', null) }}
          placeholder="Describe the look you want, in your words. e.g. 'late-90s skate magazine: high-contrast film grain, distressed serif headlines, hand-drawn arrows.'"
          rows={4}
          className="w-full rounded-md bg-elevated/60 px-3 py-2.5 text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40"
          autoFocus
        />
      )}
    </div>
  )
}

function PageAudience({ state, set }: PageProps): JSX.Element {
  const [otherOpen, setOtherOpen] = useState(state.audience !== null && !AUDIENCE_OPTIONS.includes(state.audience))
  const decided = !!state.decisions.audience
  return (
    <div className="space-y-3">
      <div className={['grid grid-cols-3 gap-2 transition-opacity', decided ? 'opacity-40 pointer-events-none' : ''].join(' ')}>
        {AUDIENCE_OPTIONS.map((a) => {
          const selected = state.audience === a && !decided
          return (
            <button
              key={a}
              onClick={() => { setOtherOpen(false); set('audience', a) }}
              className={tileClass(selected, 'flex flex-col gap-2')}
            >
              <div className="grid h-[64px] w-full place-items-center overflow-hidden rounded-md bg-elevated/70 text-accent">
                <AudienceGlyph label={a} large />
              </div>
              <div className="truncate text-[12.5px] font-medium text-text-primary">{a}</div>
            </button>
          )
        })}
        <button
          onClick={() => { setOtherOpen(true); if (AUDIENCE_OPTIONS.includes(state.audience ?? '')) set('audience', '') }}
          className={tileClass(otherOpen && !decided, 'flex flex-col gap-2')}
        >
          <div className="grid h-[64px] w-full place-items-center overflow-hidden rounded-md bg-elevated/70 text-accent">
            <svg viewBox="0 0 20 20" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 14 Q5 13 7 14 Q9 15 11 14 Q13 13 17 14" /><path d="M3 10 H10" /><path d="M3 6 H7" />
            </svg>
          </div>
          <div className="truncate text-[12.5px] font-medium text-text-primary">I'll describe…</div>
        </button>
      </div>
      {otherOpen && !decided && (
        <input
          type="text"
          value={state.audience && !AUDIENCE_OPTIONS.includes(state.audience) ? state.audience : ''}
          onChange={(e) => set('audience', e.target.value || null)}
          placeholder="Describe the audience…"
          className="w-full rounded-md bg-elevated/60 px-3 py-2 text-[13px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40"
          autoFocus
        />
      )}
    </div>
  )
}

function PagePalette({ state, set }: PageProps): JSX.Element {
  const applyPalette = (id: string): void => {
    const p = PALETTES.find((x) => x.id === id)
    set('paletteId', id)
    if (p && p.colors.length >= 4) {
      set('primaryColor',   p.colors[1] ?? null)
      set('secondaryColor', p.colors[2] ?? null)
      set('accentColor',    p.colors[0] ?? null)
    }
  }
  const customised = !!(state.primaryColor || state.secondaryColor || state.accentColor)
  return (
    <div className="space-y-3">
      {/* Compact 4-col grid. Each tile is a flat dark chip with three
          equally-sized colour dots (no white paper card behind them). */}
      <div className="grid grid-cols-4 gap-2">
        {PALETTES.map((p) => {
          const selected = state.paletteId === p.id
          // colors order: ink, brand, accent, paper.
          const [ink, brand, accent] = p.colors
          return (
            <button
              key={p.id}
              onClick={() => applyPalette(p.id)}
              title={p.label}
              className={tileClass(selected, 'flex flex-col gap-1.5 p-2')}
            >
              <div className="flex h-9 items-center gap-1.5 px-1">
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: brand }} />
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: accent }} />
                <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: ink }} />
              </div>
              <div className="truncate text-[11px] font-medium text-text-primary">{p.label}</div>
            </button>
          )
        })}
      </div>

      <details className="group rounded-lg bg-elevated/40" open={customised}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2 text-[12.5px] font-medium text-text-primary">
          <span className="flex items-center gap-2">
            Pick your own
            {customised && (
              <span className="flex items-center gap-1">
                {[state.primaryColor, state.secondaryColor, state.accentColor].filter(Boolean).map((c, i) => (
                  <span key={i} className="h-3 w-3 rounded-sm" style={{ backgroundColor: c! }} />
                ))}
              </span>
            )}
          </span>
          <span className="text-[10px] text-text-muted transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-2 px-3.5 pb-3">
          <ColorRow label="Primary"   value={state.primaryColor}   onChange={(v) => set('primaryColor', v)} />
          <ColorRow label="Secondary" value={state.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
          <ColorRow label="Accent"    value={state.accentColor}    onChange={(v) => set('accentColor', v)} />
        </div>
      </details>
    </div>
  )
}

function ColorRow({ label, value, onChange }: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}): JSX.Element {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[68px] flex-shrink-0 text-[12px] font-medium text-text-primary">{label}</div>
      <input
        type="color"
        value={value ?? '#5b47fb'}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"
      />
      <input
        type="text"
        value={value ?? ''}
        placeholder="#5b47fb"
        onChange={(e) => onChange(e.target.value || null)}
        className="w-24 rounded bg-surface px-2 py-1 text-[11.5px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[11px] text-text-muted hover:text-text-primary"
        >
          Clear
        </button>
      )}
    </div>
  )
}

function PageFonts({ state, set }: PageProps): JSX.Element {
  const customActive = state.customFonts != null
  const primary = fontFamilyById(state.fontPrimary)
  const secondary = fontFamilyById(state.fontSecondary)
  const tertiary = fontFamilyById(state.fontTertiary)
  return (
    <div className="space-y-3">
      {/* Live preview: always visible so the user sees the type before clicking */}
      <div className="rounded-lg bg-elevated/30 p-3.5">
        <div className="mb-2 text-[10.5px] text-text-muted">Preview</div>
        <div className="space-y-1.5">
          <div style={{ fontFamily: primary?.stack ?? 'system-ui' }} className="text-[24px] font-semibold leading-tight text-text-primary">
            {primary?.label ?? 'Primary heading'}
          </div>
          <div style={{ fontFamily: secondary?.stack ?? 'system-ui' }} className="text-[13px] leading-relaxed text-text-secondary">
            {secondary
              ? 'Body copy in ' + secondary.label + ': the quick brown fox jumps over the lazy dog. Punctuation, parentheses (like this), and numbers 0123456789.'
              : 'Pick a secondary font for body copy.'}
          </div>
          {tertiary && (
            <div style={{ fontFamily: tertiary.stack }} className="text-[11.5px] text-text-muted">
              {tertiary.label} · accent / labels / mono
            </div>
          )}
        </div>
      </div>

      <div className={['space-y-2 transition-opacity', customActive ? 'opacity-40 pointer-events-none' : ''].join(' ')}>
        <FontDropdown
          role="Primary"
          hint="Headings, hero, h1:h4"
          value={state.fontPrimary}
          onChange={(v) => { set('fontPrimary', v); set('fontPairId', null) }}
        />
        <FontDropdown
          role="Secondary"
          hint="Body copy, paragraphs, UI"
          value={state.fontSecondary}
          onChange={(v) => { set('fontSecondary', v); set('fontPairId', null) }}
        />
        <FontDropdown
          role="Tertiary"
          hint="Optional: pull-quotes, code, accent labels"
          value={state.fontTertiary}
          onChange={(v) => { set('fontTertiary', v); set('fontPairId', null) }}
          allowClear
        />
      </div>

      <button
        type="button"
        onClick={() => { if (state.customFonts == null) { set('customFonts', ''); set('fontPrimary', null); set('fontSecondary', null); set('fontTertiary', null); set('fontPairId', null) } else { set('customFonts', null) } }}
        className={[
          'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
          customActive ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-elevated/40 hover:bg-elevated/70'
        ].join(' ')}
      >
        <span className={[
          'mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-sm border transition-colors',
          customActive ? 'border-accent bg-accent text-accent-text' : 'border-text-muted/40 bg-transparent'
        ].join(' ')}>
          {customActive && (
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
              <path d="M2.5 6.2 L5 8.5 L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium text-text-primary">
            I'll describe the type usage instead
          </span>
        </span>
      </button>
      {customActive && (
        <textarea
          value={state.customFonts ?? ''}
          onChange={(e) => set('customFonts', e.target.value)}
          rows={3}
          placeholder='e.g. "Cormorant for hero, Geist for body, JetBrains Mono for code blocks"'
          className="w-full resize-none rounded-md bg-elevated/60 px-3 py-2 text-[13px] leading-relaxed text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40"
          autoFocus
        />
      )}
    </div>
  )
}

function FontDropdown({ role, hint, value, onChange, allowClear }: {
  role: string
  hint: string
  value: string | null
  onChange: (v: string | null) => void
  allowClear?: boolean
}): JSX.Element {
  const current = fontFamilyById(value)
  const [tipOpen, setTipOpen] = useState(false)
  return (
    <div className="flex items-center gap-3 rounded-lg bg-elevated/40 px-3 py-2">
      <div className="flex w-[88px] flex-shrink-0 items-center gap-1.5">
        <div className="text-[12.5px] font-medium text-text-primary">{role}</div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setTipOpen((v) => !v)}
            onMouseEnter={() => setTipOpen(true)}
            onMouseLeave={() => setTipOpen(false)}
            onBlur={() => setTipOpen(false)}
            aria-label={`${role} role info`}
            className="grid h-3.5 w-3.5 place-items-center rounded-full text-text-muted hover:text-text-primary"
          >
            <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.2">
              <circle cx="6" cy="6" r="5" />
              <path d="M6 5.4v3" strokeLinecap="round" />
              <circle cx="6" cy="3.6" r="0.5" fill="currentColor" stroke="none" />
            </svg>
          </button>
          {tipOpen && (
            <div className="absolute left-1/2 top-full z-10 mt-1 w-44 -translate-x-1/2 rounded-md bg-text-primary px-2 py-1.5 text-[11px] leading-snug text-bg shadow-md">
              {hint}
            </div>
          )}
        </div>
      </div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        style={{ fontFamily: current?.stack ?? 'inherit' }}
        className="flex-1 rounded-md bg-surface px-2.5 py-1.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
      >
        <option value="">{allowClear ? 'None' : 'Pick a font…'}</option>
        {FONT_FAMILY_GROUPS.map((g) => (
          <optgroup key={g.id} label={g.label}>
            {FONT_FAMILIES.filter((f) => f.group === g.id).map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}

function PageIcons({ state, set }: PageProps): JSX.Element {
  const lib = state.iconLibraryId ? ICON_LIBRARIES.find((l) => l.id === state.iconLibraryId) : null
  const allowedStyles = lib?.styles ?? []
  const setLibrary = (id: IconLibraryId): void => {
    set('iconLibraryId', id)
    const next = ICON_LIBRARIES.find((l) => l.id === id)
    if (next && state.iconStyleId && !next.styles.includes(state.iconStyleId)) {
      set('iconStyleId', next.styles[0] ?? null)
    } else if (next && !state.iconStyleId && next.styles.length) {
      set('iconStyleId', next.styles[0])
    } else if (id === 'none') {
      set('iconStyleId', null)
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[12.5px] font-medium text-text-primary">Icon library</div>
        <div className="grid grid-cols-3 gap-2">
          {ICON_LIBRARIES.map((l) => {
            const selected = state.iconLibraryId === l.id
            return (
              <button
                key={l.id}
                onClick={() => setLibrary(l.id)}
                title={l.hint}
                className={tileClass(selected, 'flex flex-col items-center gap-2 p-3')}
              >
                <span className="text-text-primary">
                  <IconLibraryGlyph id={l.id} />
                </span>
                <span className="text-[12.5px] font-medium text-text-primary">{l.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {allowedStyles.length > 1 && (
        <div>
          <div className="mb-2 text-[12.5px] font-medium text-text-primary">Style</div>
          <div className="grid grid-cols-4 gap-2">
            {ICON_STYLES.filter((s) => allowedStyles.includes(s.id)).map((s) => {
              const selected = state.iconStyleId === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => set('iconStyleId', s.id)}
                  title={s.hint}
                  className={tileClass(selected, 'flex flex-col items-center gap-2 p-3')}
                >
                  <span className="text-text-primary">
                    <IconStyleGlyph id={s.id} />
                  </span>
                  <span className="text-[12.5px] font-medium text-text-primary">{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Each library gets a 24px representative glyph. Hand-rolled so we don't
// pull a real icon library in just for this one screen.
function IconLibraryGlyph({ id }: { id: string }): JSX.Element {
  const stroke = 'currentColor'
  const sw = 1.4
  switch (id) {
    case 'lucide':
      // Lucide leaf-feather-ish line icon
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 4 L4 20" /><path d="M14 4 H20 V10" /><path d="M4 20 L4 14" /><path d="M11 13 L20 4" />
        </svg>
      )
    case 'phosphor':
      // Phosphor: three weights stacked
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4.5" fill={stroke} fillOpacity="0.35" stroke="none" />
          <circle cx="12" cy="12" r="1.6" fill={stroke} stroke="none" />
        </svg>
      )
    case 'heroicons':
      // Heroicons: the 'shield' silhouette
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 L20 6 V12 c0 5-4 8-8 9-4-1-8-4-8-9 V6 Z" />
        </svg>
      )
    case 'tabler':
      // Tabler: a tabbed grid hint
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M3 9 H21" /><path d="M9 21 V9" />
        </svg>
      )
    case 'remix':
      // Remix: chunky R / split square
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="M8 7 H13 a3 3 0 0 1 0 6 H8 V7 Z M8 13 L14 19" />
        </svg>
      )
    case 'feather':
      // Feather: actual feather shape
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.2 4 a6 6 0 0 1-8.4 8.4 L4 20 V20 h4 l11.2-11.2 a6 6 0 0 0 1-4.8 Z" />
          <path d="M11 12 L4 19" /><path d="M16 8 L9 15" />
        </svg>
      )
    case 'material-symbols':
      // Material: the four-quadrant material design dot
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12 a9 9 0 0 1 18 0 Z" fill={stroke} fillOpacity="0.25" stroke="none" />
        </svg>
      )
    case 'iconoir':
      // Iconoir: friendly rounded square
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="6" />
          <circle cx="9" cy="11" r="1" fill={stroke} stroke="none" />
          <circle cx="15" cy="11" r="1" fill={stroke} stroke="none" />
          <path d="M9 16 q3 2 6 0" />
        </svg>
      )
    case 'none':
      // No icons: slashed circle
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M5 5 L19 19" />
        </svg>
      )
    default:
      return <svg width="22" height="22" />
  }
}

// Each style gets a single 'check' glyph rendered in its style.
function IconStyleGlyph({ id }: { id: string }): JSX.Element {
  const stroke = 'currentColor'
  const sw = 1.6
  switch (id) {
    case 'outline':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12 L11 15 L16 9" />
        </svg>
      )
    case 'filled':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={stroke} stroke="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12 L11 15 L16 9" stroke="rgb(var(--bg))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      )
    case 'duotone':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="9" fill={stroke} fillOpacity="0.25" stroke="none" />
          <path d="M8 12 L11 15 L16 9" />
        </svg>
      )
    case 'mixed':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12 a9 9 0 1 1 18 0 a9 9 0 0 1-18 0 Z" />
          <path d="M3 12 a9 9 0 0 0 18 0 Z" fill={stroke} stroke="none" />
          <path d="M8 12 L11 15 L16 9" />
        </svg>
      )
    default:
      return <svg width="22" height="22" />
  }
}

function PageTheme({ state, set }: PageProps): JSX.Element {
  const themeMock = (id: string): { bg: string; node: ReactNode } => {
    if (id === 'light') return { bg: '#fafaf9', node: <>
      <rect x="10" y="10" width="80" height="6" rx="1.5" fill="#1a1a1a" />
      <rect x="10" y="20" width="60" height="2.5" rx="1" fill="#a3a3a3" />
      <rect x="10" y="34" width="38" height="20" rx="2" fill="#e7e5e4" />
      <rect x="52" y="34" width="38" height="20" rx="2" fill="#e7e5e4" />
    </>}
    if (id === 'dark') return { bg: '#0a0a0a', node: <>
      <rect x="10" y="10" width="80" height="6" rx="1.5" fill="#fafaf9" />
      <rect x="10" y="20" width="60" height="2.5" rx="1" fill="#525252" />
      <rect x="10" y="34" width="38" height="20" rx="2" fill="#1f1f1f" />
      <rect x="52" y="34" width="38" height="20" rx="2" fill="#1f1f1f" />
    </>}
    if (id === 'auto') return { bg: '#fafaf9', node: <>
      <rect x="50" y="0" width="50" height="64" fill="#0a0a0a" />
      <rect x="6" y="10" width="40" height="6" rx="1.5" fill="#1a1a1a" />
      <rect x="54" y="10" width="40" height="6" rx="1.5" fill="#fafaf9" />
      <rect x="6" y="34" width="40" height="20" rx="2" fill="#e7e5e4" />
      <rect x="54" y="34" width="40" height="20" rx="2" fill="#1f1f1f" />
    </>}
    // both
    return { bg: '#fafaf9', node: <>
      <rect x="0" y="0" width="50" height="64" fill="#fafaf9" />
      <rect x="50" y="0" width="50" height="64" fill="#0a0a0a" />
      <rect x="6" y="20" width="36" height="24" rx="2" fill="#e7e5e4" />
      <rect x="58" y="20" width="36" height="24" rx="2" fill="#1f1f1f" />
      <circle cx="50" cy="32" r="6" fill="#facc15" />
    </>}
  }
  const decided = !!state.decisions.theme
  return (
    <div className="space-y-3">
      <div className={['grid grid-cols-4 gap-2.5 transition-opacity', decided ? 'opacity-40 pointer-events-none' : ''].join(' ')}>
        {THEME_OPTIONS.map((t) => {
          const selected = state.theme === t.id && !decided
          const m = themeMock(t.id)
          return (
            <button key={t.id} onClick={() => set('theme', t.id)} className={tileClass(selected, 'flex flex-col gap-2')}>
              <div className="grid h-[64px] w-full place-items-center overflow-hidden rounded-md" style={{ backgroundColor: m.bg }}>
                <svg viewBox="0 0 100 64" width="100%" height="64">{m.node}</svg>
              </div>
              <div className="text-[12.5px] font-medium text-text-primary">{t.label}</div>
            </button>
          )
        })}
      </div>
      <div>
        <DecideForMe state={state} set={set} field="theme" onPick={() => set('theme', null)} />
      </div>
    </div>
  )
}

function PageDensity({ state, set }: PageProps): JSX.Element {
  const decided = !!state.decisions.density
  return (
    <div className="space-y-3">
      <div className={['grid grid-cols-3 gap-2.5 transition-opacity', decided ? 'opacity-40 pointer-events-none' : ''].join(' ')}>
        {DENSITY_OPTIONS.map((d) => {
          const selected = state.density === d.id && !decided
          return (
            <button key={d.id} onClick={() => set('density', d.id)} className={tileClass(selected, 'flex flex-col gap-2')}>
              <MiniBox><DensityRows variant={d.id} /></MiniBox>
              <div>
                <div className="text-[13px] font-medium text-text-primary">{d.label}</div>
                <div className="text-[11.5px] text-text-muted">{d.hint}</div>
              </div>
            </button>
          )
        })}
      </div>
      <div>
        <DecideForMe state={state} set={set} field="density" onPick={() => set('density', null)} />
      </div>
    </div>
  )
}

function DensityRows({ variant }: { variant: 'compact' | 'comfortable' | 'spacious' }): JSX.Element {
  const gap = variant === 'compact' ? 5 : variant === 'comfortable' ? 9 : 14
  const rows = variant === 'compact' ? 5 : variant === 'comfortable' ? 4 : 3
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <rect key={i} x={10} y={6 + i * (4 + gap)} width={80} height={3.5} rx={1.5} fill={COL.muted} />
      ))}
    </>
  )
}

function PageSpacing({ state, set }: PageProps): JSX.Element {
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-text-muted">
        The base unit every padding, margin and gap snaps to. The model will
        only use values from this scale, never odd numbers like 5, 13, or 17.
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {SPACING_OPTIONS.map((sp) => {
          const selected = state.spacing === sp.id
          return (
            <button
              key={sp.id}
              onClick={() => set('spacing', sp.id)}
              className={tileClass(selected, 'flex flex-col gap-2')}
            >
              <MiniBox>
                <SpacingPreview base={sp.base} />
              </MiniBox>
              <div>
                <div className="text-[13px] font-medium text-text-primary">{sp.label}</div>
                <div className="text-[11.5px] text-text-muted">{sp.hint}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Three stacked rows whose internal padding scales with the chosen base
// unit. Just enough to read as "tighter / looser" at a glance.
function SpacingPreview({ base }: { base: 4 | 8 }): JSX.Element {
  const pad = base === 4 ? 3 : 6
  return (
    <>
      <rect x={10}        y={8}          width={80} height={10} rx={1.5} fill={COL.muted} opacity={0.5} />
      <rect x={10 + pad}  y={8 + pad + 8}  width={80 - pad * 2} height={4} rx={1} fill={COL.muted} />
      <rect x={10 + pad}  y={8 + pad + 16} width={60 - pad * 2} height={4} rx={1} fill={COL.muted} />
    </>
  )
}

function PageGrid({ state, set }: PageProps): JSX.Element {
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-text-muted">
        How the canvas is divided. Sections, cards, and major rows align to
        these columns so layouts feel intentional.
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {GRID_OPTIONS.map((g) => {
          const selected = state.grid === g.id
          return (
            <button
              key={g.id}
              onClick={() => set('grid', g.id)}
              className={tileClass(selected, 'flex flex-col gap-2')}
            >
              <MiniBox>
                <GridPreview columns={g.columns} />
              </MiniBox>
              <div>
                <div className="text-[13px] font-medium text-text-primary">{g.label}</div>
                <div className="text-[11.5px] text-text-muted">{g.hint}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Faint vertical column lines for the chosen grid size, or a wavy "no
// grid" hint when free-form.
function GridPreview({ columns }: { columns: number }): JSX.Element {
  if (columns === 0) {
    return <>
      <rect x={14} y={14} width={72} height={6} rx={1.5} fill={COL.muted} opacity={0.6} />
      <rect x={14} y={26} width={50} height={6} rx={1.5} fill={COL.muted} opacity={0.4} />
      <rect x={14} y={38} width={62} height={6} rx={1.5} fill={COL.muted} opacity={0.5} />
    </>
  }
  const left = 8
  const right = 92
  const step = (right - left) / columns
  return (
    <>
      {Array.from({ length: columns + 1 }).map((_, i) => (
        <line key={i} x1={left + i * step} y1={6} x2={left + i * step} y2={56}
              stroke={COL.muted} strokeWidth={0.6} opacity={0.5} />
      ))}
      <rect x={left + step}     y={16} width={step * 3 - 2} height={8} rx={1} fill={COL.muted} opacity={0.7} />
      <rect x={left + step * 5} y={16} width={step * 3 - 2} height={8} rx={1} fill={COL.muted} opacity={0.5} />
    </>
  )
}

function PageMotion({ state, set }: PageProps): JSX.Element {
  const [describeOpen, setDescribeOpen] = useState(!!state.customMotion)
  const isDescribeActive = describeOpen
  return (
    <div className="space-y-3">
      {/* 4-tile grid: 3 motion levels + I'll describe. Each tile animates
          on hover so the user can see the difference. */}
      <div className="grid grid-cols-2 gap-2.5 motion-page">
        {MOTION_OPTIONS.map((m) => {
          const selected = state.motion === m.id && !isDescribeActive
          return (
            <button
              key={m.id}
              onClick={() => {
                set('motion', m.id)
                setDescribeOpen(false)
                set('customMotion', null)
              }}
              className={tileClass(selected, `motion-tile motion-${m.id} flex flex-col gap-2`)}
            >
              <div className="grid h-[78px] w-full place-items-center overflow-hidden rounded-md bg-elevated/70">
                <svg viewBox="0 0 100 64" width="100%" height="64" className="text-accent">
                  <MotionPreview id={m.id} />
                </svg>
              </div>
              <div>
                <div className="text-[13px] font-medium text-text-primary">{m.label}</div>
                <div className="text-[11.5px] text-text-muted">{m.hint}</div>
              </div>
            </button>
          )
        })}
        {/* I'll describe tile */}
        <button
          onClick={() => {
            setDescribeOpen(true)
            set('motion', null)
          }}
          className={tileClass(isDescribeActive, 'flex flex-col gap-2')}
        >
          <div className="grid h-[78px] w-full place-items-center overflow-hidden rounded-md bg-elevated/70 text-text-secondary">
            <svg viewBox="0 0 100 64" width="100%" height="64">
              <path d="M22 32 H78" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" fill="none" />
              <path d="M30 24 H70 M30 40 H62" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-medium text-text-primary">I'll describe</div>
            <div className="text-[11.5px] text-text-muted">Describe the motion you want</div>
          </div>
        </button>
      </div>

      {/* Free-text panel: only when describe tile is active */}
      {isDescribeActive && (
        <div className="space-y-1.5 rounded-lg bg-elevated/40 p-3">
          <label className="text-[11.5px] font-medium text-text-muted">
            Motion notes
          </label>
          <textarea
            value={state.customMotion ?? ''}
            onChange={(e) => set('customMotion', e.target.value)}
            placeholder="e.g. Cards lift 4px on hover with a 200ms ease-out. Hero headline fades up on load. Buttons get a subtle scale (0.98) on press."
            rows={3}
            className="w-full rounded-md bg-elevated/80 px-2.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-muted/60 outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}

      {/* Hover-driven CSS animations: only run when the user's cursor is on
          the tile, so the page is calm at rest. */}
      <style>{`
        .motion-page .motion-tile svg [data-motion] { transform-box: fill-box; transform-origin: center; }
        .motion-page .motion-none .anim { /* no animation */ }
        .motion-page .motion-subtle:hover .anim {
          animation: t42-motion-subtle 1.6s ease-in-out infinite;
        }
        .motion-page .motion-expressive:hover .anim {
          animation: t42-motion-expressive 1.4s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes t42-motion-subtle {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50%      { transform: translateY(-3px); opacity: .85; }
        }
        @keyframes t42-motion-expressive {
          0%   { transform: translate(0,0) rotate(0)   scale(1);    opacity: .8; }
          40%  { transform: translate(2px,-6px) rotate(-6deg) scale(1.06); opacity: 1; }
          70%  { transform: translate(-2px,2px) rotate(4deg)  scale(.96); opacity: .9; }
          100% { transform: translate(0,0) rotate(0)   scale(1);    opacity: .8; }
        }
        @media (prefers-reduced-motion: reduce) {
          .motion-page .motion-tile:hover .anim { animation: none; }
        }
      `}</style>
    </div>
  )
}

// Inline preview shapes for the three motion levels. Each shape that should
// animate on tile hover is tagged with `class="anim"`.
function MotionPreview({ id }: { id: string }): JSX.Element {
  if (id === 'none') {
    return <>
      <rect x="14" y="22" width="20" height="20" rx="3" fill="currentColor" />
      <rect x="40" y="22" width="20" height="20" rx="3" fill="currentColor" />
      <rect x="66" y="22" width="20" height="20" rx="3" fill="currentColor" />
    </>
  }
  if (id === 'subtle') {
    return <>
      <rect x="14" y="22" width="20" height="20" rx="3" fill="currentColor" opacity="0.4" className="anim" data-motion style={{ animationDelay: '0ms' }} />
      <rect x="40" y="22" width="20" height="20" rx="3" fill="currentColor" opacity="0.7" className="anim" data-motion style={{ animationDelay: '150ms' }} />
      <rect x="66" y="22" width="20" height="20" rx="3" fill="currentColor"                className="anim" data-motion style={{ animationDelay: '300ms' }} />
    </>
  }
  // expressive
  return <>
    <rect x="10" y="32" width="14" height="14" rx="2" fill="currentColor" opacity="0.3" className="anim" data-motion style={{ animationDelay: '0ms' }} />
    <rect x="28" y="24" width="18" height="22" rx="3" fill="currentColor" opacity="0.6" className="anim" data-motion style={{ animationDelay: '120ms' }} />
    <rect x="52" y="14" width="22" height="30" rx="4" fill="currentColor"                className="anim" data-motion style={{ animationDelay: '240ms' }} />
    <circle cx="84" cy="20" r="5" fill="currentColor" opacity="0.5" className="anim" data-motion style={{ animationDelay: '360ms' }} />
  </>
}

// ─── Stack page ─────────────────────────────────────────────────────────────
// What the design plugs into. Drives import stubs, file structure, and the
// engineering vibe. Tile for each option + a free-text "I'll describe" tile.

function PageStack({ state, set }: PageProps): JSX.Element {
  const decided = !!state.decisions.stack
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2.5">
        {STACK_OPTIONS.map((opt) => {
          const selected = state.stack === opt.id && !decided
          return (
            <button
              key={opt.id}
              onClick={() => {
                set('stack', opt.id)
                set('customStack', null)
                if (decided) {
                  const { stack: _drop, ...rest } = state.decisions
                  void _drop
                  set('decisions', rest)
                }
              }}
              className={tileClass(selected, 'flex flex-col items-center gap-2 py-4')}
              title={opt.hint}
            >
              <StackLogo id={opt.id} />
              <div className="text-[12.5px] font-medium text-text-primary">{opt.label}</div>
            </button>
          )
        })}
        <button
          onClick={() => {
            set('stack', null)
            set('decisions', { ...state.decisions, stack: true })
          }}
          className={tileClass(decided, 'flex flex-col items-center gap-2 py-4')}
        >
          <div className="grid h-10 w-10 place-items-center rounded-md bg-elevated/70 text-text-secondary">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3v3M10 14v3M3 10h3M14 10h3M5 5l2 2M13 13l2 2M5 15l2-2M13 7l2-2" />
            </svg>
          </div>
          <div className="text-[12.5px] font-medium text-text-primary">Decide for me</div>
        </button>
      </div>
      {decided && (
        <div className="space-y-1.5 rounded-lg bg-elevated/40 p-3">
          <label className="text-[11.5px] font-medium text-text-muted">Notes (optional)</label>
          <textarea
            value={state.customStack ?? ''}
            onChange={(e) => set('customStack', e.target.value)}
            placeholder="Anything to steer the choice. e.g. 'must run on edge', 'team knows React'."
            rows={2}
            className="w-full rounded-md bg-elevated/80 px-2.5 py-2 text-[12.5px] text-text-primary placeholder:text-text-muted/60 outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      )}
    </div>
  )
}

// Brand-recognisable inline logos for each stack option. Kept small and
// drawn from primitives so we don't ship vendor SVG bundles.
function StackLogo({ id }: { id: string }): JSX.Element {
  const wrap = (children: ReactNode): JSX.Element => (
    <div className="grid h-10 w-10 place-items-center">
      <svg viewBox="0 0 40 40" width="36" height="36">{children}</svg>
    </div>
  )
  switch (id) {
    case 'plain':
      // HTML5 shield
      return wrap(
        <>
          <path d="M8 5h24l-2.2 26L20 34l-9.8-3L8 5z" fill="#E34F26" />
          <path d="M20 7v25l8-2.4L29.7 9H20z" fill="#EF652A" />
          <path d="M20 14h-6.6l.3 3H20v3h-5.9l.6 6.5L20 28v-3.1l-3-.8-.2-2.1H20V14z" fill="#fff" />
          <path d="M20 14v3h6.4l-.3 3H20v3h5.7l-.5 4.1-3.2 1V31l5.8-1.6L28.5 14H20z" fill="#EBEBEB" />
        </>
      )
    case 'react-tailwind':
    case 'react-css':
      // React atom
      return wrap(
        <g stroke="#61DAFB" strokeWidth="1.6" fill="none">
          <circle cx="20" cy="20" r="2.4" fill="#61DAFB" />
          <ellipse cx="20" cy="20" rx="11" ry="4.2" />
          <ellipse cx="20" cy="20" rx="11" ry="4.2" transform="rotate(60 20 20)" />
          <ellipse cx="20" cy="20" rx="11" ry="4.2" transform="rotate(120 20 20)" />
        </g>
      )
    case 'next-tailwind':
      // Next.js black circle with N
      return wrap(
        <>
          <circle cx="20" cy="20" r="15" fill="#000" />
          <path d="M14 12v16M14 12l13 16" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
          <rect x="24.5" y="12" width="2" height="11" fill="#fff" />
        </>
      )
    case 'vue-tailwind':
      // Vue chevron
      return wrap(
        <>
          <path d="M5 9h6l9 15 9-15h6L20 34 5 9z" fill="#41B883" />
          <path d="M11 9h5l4 7 4-7h5L20 25 11 9z" fill="#34495E" />
        </>
      )
    case 'svelte':
      // Svelte S flame
      return wrap(
        <>
          <path d="M30 10c-3-3-9-3-13 0L9 16c-3 2-4 6-2 10s6 5 10 4l-1 2c-2 3-1 7 2 9 4 3 10 3 13 0l8-6c3-2 4-6 2-10s-6-5-10-4l1-2c2-3 1-7-2-9z" fill="#FF3E00" />
          <path d="M22 28c-2 1-5 1-7-1-1-1-2-3-1-5l1-1c0 1 1 2 2 2 2 1 5 1 7-1l8-6c2-1 3-3 2-5l-1-1c0 1-1 2-2 2-2 1-5 1-7-1l8-6 8 6c2 1 3 3 2 5l-1 1c0-1-1-2-2-2-2-1-5-1-7 1l-8 6c-2 1-3 3-2 5l1 1c0-1 1-2 2-2 2-1 5-1 7 1z" fill="#fff" />
        </>
      )
    case 'astro':
      // Astro rocket
      return wrap(
        <>
          <path d="M20 4l9 28-9-5-9 5 9-28z" fill="url(#astroGrad)" />
          <defs>
            <linearGradient id="astroGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FF5D01" />
              <stop offset="1" stopColor="#883AEA" />
            </linearGradient>
          </defs>
          <ellipse cx="20" cy="30" rx="6" ry="3" fill="#fff" opacity="0.95" />
          <ellipse cx="20" cy="30" rx="3" ry="1.4" fill="#FF5D01" />
        </>
      )
    case 'flutter':
      // Flutter chevrons
      return wrap(
        <>
          <path d="M24 4L8 20l5 5L29 9 24 4z" fill="#54C5F8" />
          <path d="M24 18l-7 7 7 7h7l-7-7 7-7h-7z" fill="#01579B" />
          <path d="M17 25l7 7h7l-7-7-7-7-3 3 3 4z" fill="#0277BD" opacity="0.7" />
        </>
      )
    case 'swiftui':
      // Swift bird
      return wrap(
        <>
          <rect x="4" y="4" width="32" height="32" rx="7" fill="#F05138" />
          <path d="M27 11c2 5 1 11-2 14 4-1 6-3 7-5-1 4-4 7-9 7-5 0-9-3-12-7 1 1 4 2 6 2-3-2-5-5-7-9 2 2 4 3 6 4-2-2-4-5-5-9 4 5 9 9 16 11 0-1-1-3-2-4 2 2 3 5 5 8-1-3-2-7-3-12z" fill="#fff" />
        </>
      )
    default:
      return wrap(<rect x="8" y="8" width="24" height="24" rx="4" fill={COL.muted} />)
  }
}

// ─── Shape page ─────────────────────────────────────────────────────────────
// Three small tile rows in one page: corner radius, shadow weight, border
// strength. Each row is independent. Decide-for-me clears all three.

function PageShape({ state, set }: PageProps): JSX.Element {
  const decided = !!state.decisions.shape
  const row = (
    label: string,
    value: string | null,
    options: Array<{ id: string; label: string; hint: string }>,
    onPick: (v: string | null) => void
  ): JSX.Element => (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-text-muted">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onPick(e.target.value || null)}
        className="w-full rounded-md bg-elevated/60 px-3 py-2.5 text-[13px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/40"
      >
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className={['space-y-3 transition-opacity', decided ? 'opacity-40 pointer-events-none' : ''].join(' ')}>
        {row('Corner radius',    state.shapeRadius,  RADIUS_OPTIONS,         (v) => set('shapeRadius',  v as typeof state.shapeRadius))}
        {row('Shadow',           state.shapeShadow,  SHADOW_OPTIONS,         (v) => set('shapeShadow',  v as typeof state.shapeShadow))}
        {row('Borders',          state.shapeBorders, BORDER_OPTIONS,         (v) => set('shapeBorders', v as typeof state.shapeBorders))}
        {row('Surface treatment', state.shapeSurface, SURFACE_SHAPE_OPTIONS, (v) => set('shapeSurface', v as typeof state.shapeSurface))}
        {row('Secondary buttons', state.secondaryButton, SECONDARY_BUTTON_OPTIONS, (v) => set('secondaryButton', v as typeof state.secondaryButton))}
      </div>
      <div>
        <DecideForMe
          state={state}
          set={set}
          field="shape"
          onPick={() => {
            set('shapeRadius', null)
            set('shapeShadow', null)
            set('shapeBorders', null)
            set('shapeSurface', null)
            set('secondaryButton', null)
          }}
        />
      </div>
    </div>
  )
}

function PageInspiration({ state, set }: PageProps): JSX.Element {
  const figmaValid = !state.figmaUrl.trim() || /^https?:\/\/(www\.)?figma\.com\//i.test(state.figmaUrl.trim())
  const fileRef = useRef<HTMLInputElement>(null)
  const refsInput = useRef<HTMLInputElement>(null)
  const onPickTemplate = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    set('templateFile', file.name) // store the original name; gets renamed to template.<ext> on upload
    // Stash the actual File on the state via a side channel: we read it
    // back in DesignsListView when finishing the wizard.
    ;(window as unknown as { __t42PendingTemplate?: File }).__t42PendingTemplate = file
  }

  // Reference images: same File-stash pattern as templateFile. The renderer
  // tracks them as data URLs in memory for thumbnails; on wizard complete
  // they get uploaded to `_refs/` in the design cwd. We track names in
  // state.inspirationImages so the page survives back/next.
  const [refThumbs, setRefThumbs] = useState<Record<string, string>>({})
  const addRefFiles = async (files: FileList | null): Promise<void> => {
    if (!files || !files.length) return
    const win = window as unknown as { __t42PendingRefs?: File[] }
    win.__t42PendingRefs = win.__t42PendingRefs ?? []
    const newNames: string[] = []
    const newThumbs: Record<string, string> = {}
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue
      win.__t42PendingRefs.push(f)
      newNames.push(f.name)
      newThumbs[f.name] = await new Promise<string>((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result ?? ''))
        r.readAsDataURL(f)
      })
    }
    if (newNames.length) {
      set('inspirationImages', [...(state.inspirationImages ?? []), ...newNames])
      setRefThumbs((prev) => ({ ...prev, ...newThumbs }))
    }
  }
  const removeRef = (name: string): void => {
    const win = window as unknown as { __t42PendingRefs?: File[] }
    if (win.__t42PendingRefs) {
      win.__t42PendingRefs = win.__t42PendingRefs.filter((f) => f.name !== name)
    }
    set('inspirationImages', (state.inspirationImages ?? []).filter((n) => n !== name))
    setRefThumbs((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Reference images (look & feel) ──────────────────────────────── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-text-primary">
            Reference images <span className="text-text-muted">: optional</span>
          </span>
          {(state.inspirationImages ?? []).length > 0 && (
            <span className="text-[10.5px] text-text-muted">{(state.inspirationImages ?? []).length} added</span>
          )}
        </div>
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void addRefFiles(e.dataTransfer.files) }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg bg-elevated/40 px-4 py-5 text-center transition-colors hover:bg-elevated/70"
        >
          <PaperclipGlyph />
          <div className="text-[12px] text-text-secondary">
            Drop screenshots / moodboard / refs here, or click to choose
          </div>
          <div className="text-[10.5px] text-text-muted">PNG · JPG · WebP · GIF · SVG</div>
          <input
            ref={refsInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { void addRefFiles(e.target.files); if (refsInput.current) refsInput.current.value = '' }}
          />
        </label>
        {(state.inspirationImages ?? []).length > 0 && (
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {(state.inspirationImages ?? []).map((name) => (
              <div key={name} className="group relative aspect-square overflow-hidden rounded-md bg-elevated/60">
                {refThumbs[name]
                  ? <img src={refThumbs[name]} alt={name} className="h-full w-full object-cover" />
                  : <div className="grid h-full w-full place-items-center text-[10px] text-text-muted">{name.slice(0, 8)}…</div>
                }
                <button
                  type="button"
                  onClick={() => removeRef(name)}
                  className="absolute right-0.5 top-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Figma file ──────────────────────────────────────────────────── */}
      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-medium text-text-primary">
          <FigmaGlyph />
          <span>Figma file</span>
          <span className="text-text-muted">: optional</span>
        </div>
        <input
          type="url"
          value={state.figmaUrl}
          onChange={(e) => set('figmaUrl', e.target.value)}
          placeholder="https://www.figma.com/design/…"
          className={[
            'w-full rounded-lg bg-elevated/40 px-3 py-2 text-[13px] text-text-primary placeholder:text-text-disabled placeholder:opacity-50 focus:outline-none focus:ring-2',
            figmaValid ? 'focus:ring-accent/40' : 'ring-1 ring-error/60 focus:ring-error/60'
          ].join(' ')}
        />
        {state.figmaUrl && (
          <p className="mt-1.5 text-[11.5px] text-text-muted">
            Copilot will read this file via the Figma MCP server before generating, and try to match its layout, type and tokens.
          </p>
        )}
      </div>

      {/* ── Template file ───────────────────────────────────────────────── */}
      <div>
        <div className="mb-1.5 text-[12.5px] font-medium text-text-primary">
          Template file <span className="text-text-muted">: optional</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pptx,.docx,.xlsx,.pdf,.html,.htm,.md,.txt,.png,.jpg,.jpeg,.gif,.webp,.svg"
          onChange={onPickTemplate}
          className="hidden"
        />
        {state.templateFile ? (
          <div className="flex items-center justify-between rounded-lg bg-elevated/40 px-3 py-2">
            <span className="inline-flex items-center gap-1.5 truncate text-[12.5px] text-text-primary">
              <PaperclipGlyph />
              <span className="truncate">{state.templateFile}</span>
            </span>
            <button
              type="button"
              onClick={() => { set('templateFile', null); set('useTemplateLook', false); if (fileRef.current) fileRef.current.value = '' }}
              className="rounded-md px-2 py-0.5 text-[11px] text-text-muted hover:bg-elevated hover:text-text-primary"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-elevated/40 px-3 py-3 text-[12.5px] text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary"
          >
            <PaperclipGlyph />
            <span>Drop a .pptx / .pdf / .docx / image to use as template</span>
          </button>
        )}
        {state.templateFile && (
          <button
            type="button"
            onClick={() => set('useTemplateLook', !state.useTemplateLook)}
            className={[
              'mt-2 flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
              state.useTemplateLook
                ? 'bg-accent/15 ring-1 ring-accent/40'
                : 'bg-elevated/40 hover:bg-elevated/70'
            ].join(' ')}
          >
            <span className={[
              'mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-sm border transition-colors',
              state.useTemplateLook
                ? 'border-accent bg-accent text-accent-text'
                : 'border-text-muted/40 bg-transparent'
            ].join(' ')}>
              {state.useTemplateLook && (
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <path d="M2.5 6.2 L5 8.5 L9.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium text-text-primary">
                Use everything from this template
              </span>
              <span className="mt-0.5 block text-[11.5px] text-text-muted">
                Skip design questions. Copy template 1:1, only swap content.
              </span>
            </span>
          </button>
        )}
        {state.templateFile && !state.useTemplateLook && (
          <p className="mt-1.5 text-[11.5px] text-text-muted">
            Template used as a starting point.
          </p>
        )}
      </div>

      {/* ── Other links ─────────────────────────────────────────────────── */}
      <div>
        <div className="mb-1.5 text-[12.5px] font-medium text-text-primary">Other references <span className="text-text-muted">: links</span></div>
        <textarea
          value={state.inspiration}
          onChange={(e) => set('inspiration', e.target.value)}
          rows={3}
          placeholder={'Paste links to designs, sites or boards…'}
          className="w-full resize-none rounded-lg bg-elevated/40 px-3 py-2.5 text-[13px] leading-relaxed text-text-primary placeholder:text-text-disabled placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>
    </div>
  )
}

function FigmaGlyph(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="3" r="2.5" /><path d="M3.5 5.5h2.5v3H6a2.5 2.5 0 0 1 0-5h0" fill="none" />
      <path d="M3.5 5.5h2.5V3a2.5 2.5 0 1 0 0 5h0Z M6 8h2.5a2.5 2.5 0 1 1 0 5H6V8Z M6 8H3.5a2.5 2.5 0 1 0 2.5 2.5V8Z M6 3h2.5a2.5 2.5 0 1 1 0 5H6V3Z" />
      <circle cx="10.5" cy="8" r="2.5" />
    </svg>
  )
}

// Per-audience glyph used on the Audience page tiles. Falls back to a
// generic person silhouette for any audience we don't have art for yet.
function AudienceGlyph({ label, large = false }: { label: string; large?: boolean }): JSX.Element {
  const stroke = 'currentColor'
  const sw = large ? 1.2 : 1.4
  const path = (() => {
    const lower = label.toLowerCase()
    if (lower.includes('me')) return <><circle cx="10" cy="7" r="3" /><path d="M4 17 a6 6 0 0 1 12 0" /></>
    if (lower.includes('consumer')) return <><path d="M4 7 H16 L15 16 H5 Z" /><circle cx="8.5" cy="13" r="0.6" fill={stroke} stroke="none" /><circle cx="11.5" cy="13" r="0.6" fill={stroke} stroke="none" /></>
    if (lower.includes('developer')) return <><path d="M7 6 L4 10 L7 14" /><path d="M13 6 L16 10 L13 14" /><path d="M11 5 L9 15" /></>
    if (lower.includes('designer')) return <><circle cx="10" cy="10" r="6" /><circle cx="6" cy="9" r="1" fill={stroke} stroke="none" /><circle cx="14" cy="9" r="1" fill={stroke} stroke="none" /><circle cx="11" cy="14" r="1" fill={stroke} stroke="none" /></>
    if (lower.includes('business')) return <><path d="M3 9 H17 V16 H3 Z" /><path d="M7 9 V6 a1 1 0 0 1 1-1 H12 a1 1 0 0 1 1 1 V9" /></>
    if (lower.includes('investor')) return <><path d="M4 14 L8 10 L11 12 L16 6" /><path d="M12 6 H16 V10" /></>
    if (lower.includes('internal') || lower.includes('team')) return <><circle cx="6" cy="8" r="2" /><circle cx="14" cy="8" r="2" /><circle cx="10" cy="11" r="2" /><path d="M2 17 a5 4 0 0 1 8 0" /><path d="M10 17 a5 4 0 0 1 8 0" /></>
    if (lower.includes('open source') || lower.includes('community')) return <><circle cx="10" cy="10" r="6" /><path d="M10 4 V10 L14 12" /></>
    return <><circle cx="10" cy="7" r="3" /><path d="M4 17 a6 6 0 0 1 12 0" /></>
  })()
  const size = large ? 28 : 14
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {path}
    </svg>
  )
}

function PaperclipGlyph(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5.5 L6.2 11.3 a2.4 2.4 0 0 1-3.4-3.4 L9 1.7 a3.5 3.5 0 0 1 5 5 L7.7 13 a4.5 4.5 0 0 1-6.4-6.4" />
    </svg>
  )
}

function PageIdea({ state, set }: PageProps): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  const def = state.kind ? DESIGN_KINDS.find((k) => k.id === state.kind) : null
  const placeholder = def
    ? `e.g. A ${def.label.toLowerCase()}${state.subtype ? ` for ${state.subtype.toLowerCase()}` : ''} that…`
    : 'Describe your idea…'
  // Open the context block automatically if any of the fields already
  // have content (e.g. revisiting a saved wizard).
  const [showContext, setShowContext] = useState(
    !!(state.contextDescription || state.contextProblem || state.contextGoal || state.contextKeyFeatures || state.contextSuccess)
  )
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-text-muted">
        What is this design about? Anything specific you want included.
      </p>
      <textarea
        ref={ref}
        value={state.idea}
        onChange={(e) => set('idea', e.target.value)}
        rows={5}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg bg-surface/60 px-3 py-2.5 text-[13px] leading-relaxed text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-accent/40"
      />

      {/* Collapsible richer context: mirrors the BriefWizard's guided
          prompts. All optional. The model uses these to ground copy. */}
      <button
        type="button"
        onClick={() => setShowContext((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary"
      >
        <span className={`inline-block transition-transform ${showContext ? 'rotate-90' : ''}`}>▸</span>
        {showContext ? 'Hide background context' : 'Add background context (optional)'}
      </button>

      {showContext && (
        <div className="space-y-2">
          <ContextField
            label="About the project"
            hint="The story, the audience, what already exists"
            value={state.contextDescription}
            onChange={(v) => set('contextDescription', v)}
            rows={3}
          />
          <ContextField
            label="The problem"
            hint="What pain or gap is this solving?"
            value={state.contextProblem}
            onChange={(v) => set('contextProblem', v)}
          />
          <ContextField
            label="The goal"
            hint="What does winning look like?"
            value={state.contextGoal}
            onChange={(v) => set('contextGoal', v)}
          />
          <ContextField
            label="Key things to include"
            hint="One per line. Sections, features, callouts."
            value={state.contextKeyFeatures}
            onChange={(v) => set('contextKeyFeatures', v)}
            rows={3}
          />
          <ContextField
            label="What success looks like"
            hint="How will you know this design is doing its job?"
            value={state.contextSuccess}
            onChange={(v) => set('contextSuccess', v)}
          />
        </div>
      )}
    </div>
  )
}

function ContextField({ label, hint, value, onChange, rows = 2 }: {
  label: string
  hint: string
  value: string
  onChange: (v: string) => void
  rows?: number
}): JSX.Element {
  return (
    <div className="rounded-lg bg-elevated/40 p-3">
      <label className="block text-[11.5px] font-medium text-text-primary">{label}</label>
      <div className="mb-1.5 text-[10.5px] text-text-muted">{hint}</div>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-y rounded-md bg-elevated/80 px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  )
}

function PageDefaults({ state, set }: PageProps): JSX.Element {
  const off = disabledCount(state.aiRules)
  const toggle = (id: AiRuleId): void => {
    set('aiRules', { ...state.aiRules, [id]: !state.aiRules[id] })
  }
  const saveAsGlobal = (): void => saveGlobalAiRules(state.aiRules)
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[12.5px] leading-relaxed text-text-muted">
          These rules push the AI away from its marketing-template defaults
          (gradients, fake testimonials, "Supercharge your workflow"). Toggle
          off any you want to allow for this design.
        </p>
        <button
          type="button"
          onClick={saveAsGlobal}
          title="Save the current toggle state as your default for new designs"
          className="flex-shrink-0 rounded-md bg-elevated px-2.5 py-1 text-[11.5px] text-text-secondary hover:bg-elevated/70 hover:text-text-primary"
        >
          Save as default
        </button>
      </div>

      {AI_RULE_GROUPS.map((g) => {
        const rules = AI_RULES.filter((r) => r.group === g.id)
        if (!rules.length) return null
        return (
          <section key={g.id} className="space-y-1.5">
            <div className="text-[10.5px] font-medium text-text-muted">
              {g.label}
            </div>
            <div className="overflow-hidden rounded-lg bg-elevated/40">
              {rules.map((r, i) => {
                const on = state.aiRules[r.id]
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(r.id)}
                    className={[
                      'flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors',
                      i > 0 ? 'border-t border-bg/40' : '',
                      on ? 'hover:bg-elevated/70' : 'opacity-60 hover:opacity-90'
                    ].join(' ')}
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium text-text-primary">{r.label}</div>
                      <div className="mt-0.5 text-[11.5px] text-text-muted">{r.hint}</div>
                    </div>
                    <span
                      role="switch"
                      aria-checked={on}
                      className={[
                        'relative mt-0.5 inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors',
                        on ? 'bg-accent' : 'bg-bg/60'
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'absolute h-3 w-3 rounded-full bg-text-primary transition-transform',
                          on ? 'translate-x-3.5' : 'translate-x-0.5'
                        ].join(' ')}
                      />
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      <div className="rounded-md bg-elevated/30 px-3 py-2 text-[11.5px] text-text-muted">
        {off === 0
          ? 'All rules enforced: strict anti-AI defaults.'
          : `${off} rule${off === 1 ? '' : 's'} relaxed for this design.`}
      </div>

      <div className="space-y-1.5">
        <label className="text-[12.5px] font-medium text-text-primary">Other things to avoid</label>
        <p className="text-[11px] text-text-muted">
          One per line. These get added verbatim to the style contract sent to the model.
        </p>
        <textarea
          value={state.customAvoid}
          onChange={(e) => set('customAvoid', e.target.value)}
          rows={4}
          placeholder={'e.g. brand purple\nillustrated mascots\ntestimonial sliders\n"Get started" CTAs'}
          className="w-full resize-y rounded-md bg-elevated/40 px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-muted/60 outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>
    </div>
  )
}

function PageFigma({ state, set }: PageProps): JSX.Element {
  const url = state.figmaTargetUrl.trim()
  const valid = !url || /figma\.com\/(design|file|board|proto)\/[A-Za-z0-9]{8,40}/i.test(url)
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] leading-relaxed text-text-muted">
        Where should this design land? The figma MCP write tools handle the rest.
      </p>

      <div className="space-y-1.5">
        <FigmaModeRow
          label="New Figma file"
          hint="Creates a new design file in your drafts"
          selected={state.figmaMode === 'newFile'}
          onSelect={() => set('figmaMode', 'newFile')}
        />
        <FigmaModeRow
          label="Push into existing file"
          hint="Adds a new page to a file you already opened"
          selected={state.figmaMode === 'existingFile'}
          onSelect={() => set('figmaMode', 'existingFile')}
        />
      </div>

      {state.figmaMode === 'existingFile' && (
        <div className="space-y-1">
          <label className="block text-[11.5px] font-medium text-text-secondary">
            Figma file URL
          </label>
          <input
            type="text"
            value={state.figmaTargetUrl}
            onChange={(e) => set('figmaTargetUrl', e.target.value)}
            placeholder="https://www.figma.com/design/ABC123…/MyFile"
            className="w-full rounded-md bg-elevated/60 px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          {url && !valid && (
            <div className="text-[11px] text-error">Doesn't look like a Figma file URL.</div>
          )}
        </div>
      )}
    </div>
  )
}

function FigmaModeRow({ label, hint, selected, onSelect }: {
  label: string
  hint: string
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        selected ? 'bg-accent/15 ring-1 ring-accent/40' : 'bg-elevated/40 hover:bg-elevated/70'
      ].join(' ')}
    >
      <span className={['mt-1 grid h-3.5 w-3.5 flex-shrink-0 place-items-center rounded-full border', selected ? 'border-accent' : 'border-text-muted/50'].join(' ')}>
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-text-primary">{label}</span>
        <span className="mt-0.5 block text-[11.5px] text-text-muted">{hint}</span>
      </span>
    </button>
  )
}

// Synthesize a short, plain-English description of what the AI is about to
// build. Computed locally from the brief so the user can read + adjust
// before any model time is spent. Returns 2-4 short sentences.
function synthPlan(state: DesignWizardState): string {
  const def = state.kind ? DESIGN_KINDS.find((k) => k.id === state.kind) : null
  if (!def) return 'Pick a design type to see the plan.'

  const kind = def.label.toLowerCase()
  const sub = state.subtype ? ` (${state.subtype.toLowerCase()})` : ''
  const fid = state.fidelity === 'wireframe' ? 'wireframe ' : ''
  const lookDef = state.look ? LOOK_OPTIONS.find((l) => l.id === state.look) : null
  const look = (state.customLook?.trim() || lookDef?.label || '').toLowerCase()
  const palette = state.paletteId ? PALETTES.find((p) => p.id === state.paletteId)?.label : null
  const fontPrim = state.fontPrimary ? fontFamilyById(state.fontPrimary)?.label : null
  const theme = state.theme

  const sentences: string[] = []

  // 1. The headline of what's being built.
  let lead = `I'll build a ${fid}${kind}${sub}`
  const grounding: string[] = []
  if (state.idea && state.idea.trim()) grounding.push(`for "${state.idea.trim().slice(0, 80)}${state.idea.trim().length > 80 ? '\u2026' : ''}"`)
  if (look) grounding.push(`with a ${look} feel`)
  if (palette) grounding.push(`in the ${palette} palette`)
  if (grounding.length) lead += ' ' + grounding.join(', ')
  sentences.push(lead + '.')

  // 2. Structural decisions (per-kind hints).
  if (def.group === 'app' || state.kind === 'dashboard') {
    sentences.push('Single canvas with a working sidebar where every nav item scrolls to a real, populated section.')
  } else if (def.group === 'presentation') {
    sentences.push('A stack of 8 to 10 slides at 16:9 with one focused message per slide.')
  } else if (def.group === 'web') {
    sentences.push('Responsive layout with semantic sections, mobile-first, scaling up to desktop.')
  } else if (def.group === 'figma') {
    sentences.push('Static frames sized for review, no responsive states.')
  } else if (def.group === 'print') {
    sentences.push('Single artboard at the chosen print size, composition-first.')
  }

  // 3. Type / theme / motion summary.
  const typebits: string[] = []
  if (fontPrim) typebits.push(`${fontPrim} for headings`)
  if (theme === 'dark') typebits.push('dark theme')
  else if (theme === 'light') typebits.push('light theme')
  else if (theme === 'both') typebits.push('a light/dark toggle')
  if (state.motion === 'expressive') typebits.push('expressive motion')
  else if (state.motion === 'subtle') typebits.push('subtle motion')
  else if (state.motion === 'none') typebits.push('no motion')
  if (typebits.length) sentences.push(typebits.join(', ') + '.')

  // 4. Reference signals.
  const refBits: string[] = []
  if ((state.inspirationImages ?? []).length) {
    refBits.push(`${state.inspirationImages!.length} reference image${state.inspirationImages!.length === 1 ? '' : 's'}`)
  }
  if (state.figmaUrl) refBits.push('the Figma file you linked')
  if (state.templateFile) refBits.push(state.useTemplateLook ? `the ${state.templateFile} template (used as-is)` : `the ${state.templateFile} template (as a starting point)`)
  if (refBits.length) sentences.push('Grounded in ' + refBits.join(', ') + '.')

  return sentences.join(' ')
}

function PageSummary({ state, set }: { state: DesignWizardState; set: <K extends keyof DesignWizardState>(k: K, v: DesignWizardState[K]) => void }): JSX.Element {
  const brief = stateToBrief(state)
  const [showPrompt, setShowPrompt] = useState(false)
  if (!brief) return <div className="text-text-muted">Pick a design type first.</div>
  const plan = synthPlan(state)
  const off = disabledCount(state.aiRules)
  const customAvoidCount = state.customAvoid
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean).length
  return (
    <div className="space-y-4">
      <p className="text-[13.5px] leading-relaxed text-text-primary">{plan}</p>

      <BriefPreview brief={brief} aiRulesOff={off} customAvoidCount={customAvoidCount} />

      <div className="space-y-1.5">
        <label className="text-[12.5px] font-medium text-text-primary">Anything to add or change</label>
        <textarea
          value={state.planNotes}
          onChange={(e) => set('planNotes', e.target.value)}
          rows={3}
          placeholder={'e.g. Drop the chart, lead with the team section, smaller cards\u2026'}
          className="w-full resize-y rounded-md bg-elevated/40 px-3 py-2 text-[12.5px] text-text-primary placeholder:text-text-muted/60 outline-none focus:ring-1 focus:ring-accent/40"
        />
      </div>

      <div className="rounded-md border border-border/30 bg-elevated/30 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-text-primary">Preview the full prompt</div>
            <div className="text-[11.5px] text-text-muted">See the exact instructions the model will receive — including the design foundation, brand rules, and AI defaults you turned off.</div>
          </div>
          <button
            type="button"
            onClick={() => setShowPrompt(true)}
            className="shrink-0 rounded-md border border-border/50 bg-bg px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-elevated"
          >
            View prompt
          </button>
        </div>
      </div>

      {showPrompt && <PromptPreviewModal brief={brief} onClose={() => setShowPrompt(false)} />}
    </div>
  )
}

function PromptPreviewModal({ brief, onClose }: { brief: NonNullable<ReturnType<typeof stateToBrief>>; onClose: () => void }): JSX.Element {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await window.terminal42.designs.previewPrompt(brief)
        if (!cancelled) setText(r.prompt)
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    })()
    return () => { cancelled = true }
  }, [brief])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const charCount = text?.length ?? 0
  const tokenEstimate = Math.round(charCount / 4)
  const copy = async (): Promise<void> => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-[760px] max-w-full flex-col overflow-hidden rounded-xl bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 bg-surface/40 px-5 py-3">
          <h3 className="text-[14px] font-semibold text-text-primary">Prompt preview</h3>
          <span className="rounded-full bg-elevated/60 px-2 py-0.5 text-[10.5px] tabular-nums text-text-muted">
            {charCount.toLocaleString()} chars · ~{tokenEstimate.toLocaleString()} tokens
          </span>
          <div className="flex flex-1" />
          <button
            type="button"
            onClick={copy}
            disabled={!text}
            className="rounded-md bg-elevated/60 px-2.5 py-1 text-[11.5px] text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <IconClose size={10} />
          </button>
        </header>
        <main className="flex-1 overflow-auto bg-elevated/20 px-5 py-4">
          {error && <div className="text-[12px] text-text-muted">Failed to build preview: {error}</div>}
          {!text && !error && <div className="text-[12px] text-text-muted">Building preview…</div>}
          {text && (
            <pre className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-text-primary">
              {text}
            </pre>
          )}
        </main>
      </div>
    </div>
  )
}

function BriefPreview({ brief, aiRulesOff, customAvoidCount }: {
  brief: NonNullable<ReturnType<typeof stateToBrief>>
  aiRulesOff: number
  customAvoidCount: number
}): JSX.Element {
  type Group = { label: string; items: Array<[string, ReactNode]> }
  const groups: Group[] = []

  const what: Array<[string, ReactNode]> = []
  what.push(['Type', brief.subtype ? `${brief.kindLabel} \u00b7 ${brief.subtype}` : brief.kindLabel])
  if (brief.surface) what.push(['Surface', cap(brief.surface)])
  what.push(['Fidelity', brief.fidelity === 'wireframe' ? 'Wireframe' : 'High fidelity'])
  if (brief.audience) what.push(['Audience', brief.audience])
  if (brief.stackLabel) what.push(['Stack', brief.stackLabel])
  groups.push({ label: 'What', items: what })

  const look: Array<[string, ReactNode]> = []
  if (brief.designSystemLabel) look.push(['System', brief.designSystemLabel])
  if (brief.lookLabel) look.push(['Look', brief.lookLabel])
  if (brief.theme) look.push(['Theme', cap(brief.theme)])
  if (brief.paletteLabel) {
    look.push(['Palette',
      <span key="pal" className="inline-flex items-center gap-2">
        <span className="flex h-3 w-10 overflow-hidden rounded-sm">
          {brief.paletteColors!.map((c) => <span key={c} className="flex-1" style={{ backgroundColor: c }} />)}
        </span>
        <span>{brief.paletteLabel}</span>
      </span>])
  }
  if (brief.fontHeading) {
    look.push(['Type',
      brief.fontBody && brief.fontBody !== brief.fontHeading
        ? `${brief.fontHeading} \u00b7 ${brief.fontBody}`
        : brief.fontHeading])
  }
  if (brief.iconLibraryLabel) look.push(['Icons', brief.iconStyleLabel ? `${brief.iconLibraryLabel} \u00b7 ${brief.iconStyleLabel}` : brief.iconLibraryLabel])
  if (look.length) groups.push({ label: 'Look', items: look })

  const shape: Array<[string, ReactNode]> = []
  if (brief.shapeRadiusLabel)  shape.push(['Radius', brief.shapeRadiusLabel])
  if (brief.shapeShadowLabel)  shape.push(['Shadow', brief.shapeShadowLabel])
  if (brief.shapeBordersLabel) shape.push(['Borders', brief.shapeBordersLabel])
  if (brief.shapeSurfaceLabel) shape.push(['Surface', brief.shapeSurfaceLabel])
  if (brief.secondaryButtonLabel) shape.push(['Secondary button', brief.secondaryButtonLabel])
  if (brief.density) shape.push(['Density', cap(brief.density)])
  if (brief.spacing) shape.push(['Spacing', cap(brief.spacing)])
  if (brief.grid)    shape.push(['Grid',    brief.grid])
  if (brief.motion)  shape.push(['Motion',  cap(brief.motion)])
  if (shape.length) groups.push({ label: 'Shape & layout', items: shape })

  const refs: Array<[string, ReactNode]> = []
  if (brief.figmaUrl)     refs.push(['Figma',    <a key="fg" href={brief.figmaUrl} target="_blank" rel="noreferrer" className="break-all text-accent underline">{brief.figmaUrl}</a>])
  if (brief.templateFile) refs.push(['Template', brief.templateFile + (brief.useTemplateLook ? ' (use as-is)' : '')])
  if (brief.inspirationImages && brief.inspirationImages.length) refs.push(['Refs', `${brief.inspirationImages.length} image${brief.inspirationImages.length === 1 ? '' : 's'}`])
  if (brief.inspiration)  refs.push(['Inspiration', brief.inspiration])
  if (refs.length) groups.push({ label: 'References', items: refs })

  const rules: Array<[string, ReactNode]> = []
  rules.push(['AI defaults', aiRulesOff === 0 ? 'All enforced' : `${aiRulesOff} relaxed`])
  if (customAvoidCount > 0) rules.push(['Avoid list', `${customAvoidCount} custom item${customAvoidCount === 1 ? '' : 's'}`])
  groups.push({ label: 'Rules', items: rules })

  return (
    <div className="rounded-lg bg-surface/40 p-3">
      <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
        {groups.map((g) => (
          <section key={g.label} className="min-w-0">
            <div className="mb-1.5 text-[10.5px] font-medium uppercase-off text-text-muted" style={{ textTransform: 'none' }}>
              {g.label}
            </div>
            <dl className="grid grid-cols-[78px_1fr] gap-x-2 gap-y-0.5 text-[12px]">
              {g.items.map(([label, value]) => (
                <Fragment key={String(label)}>
                  <dt className="truncate text-text-muted">{label}</dt>
                  <dd className="min-w-0 break-words text-text-primary">{value}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
