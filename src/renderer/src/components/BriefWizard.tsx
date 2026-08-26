import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  PROJECT_TYPES, SUB_TYPES_BY_TYPE, SURFACE_OPTIONS, AUDIENCE_OPTIONS, LOOK_OPTIONS, BRAND_SWATCHES, FONT_OPTIONS,
  ICON_LIBRARY_OPTIONS, IMAGE_SOURCE_OPTIONS, MOTION_OPTIONS, DESIGN_SYSTEM_OPTIONS, DATA_BACKEND_OPTIONS,
  THEME_OPTIONS, RADIUS_STEPS, SHADOW_STEPS, OUTLINE_STEPS, STACK_BY_TYPE, LANGUAGE_OPTIONS,
  AUTH_OPTIONS, STORE_OPTIONS, DEPLOY_OPTIONS, emptyWizard, buildKickoffPrompt,
  type WizardState, type ProjectTypeId, type Branch
} from '../lib/brief'
import type { ProjectBrief } from '../../../preload/index'

type Props = {
  folderPath: string
  projectId: string
  initial?: ProjectBrief | null
  onCancel: () => void
  onComplete: (brief: ProjectBrief, startWithCopilot: boolean) => void | Promise<void>
}

// Inline icon factory.
const Ico = (path: ReactNode) =>
  function Icon({ className = 'h-5 w-5' }: { className?: string }) {
    return (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        {path}
      </svg>
    )
  }

const TYPE_ICONS: Record<ProjectTypeId, ReturnType<typeof Ico>> = {
  'web-app':        Ico(<><rect x="2" y="3" width="16" height="12" rx="1.5" /><path d="M2 7h16M5 5h.01M7 5h.01" /></>),
  'marketing-site': Ico(<><path d="M3 4h14l-2 12H5z" /><path d="M8 8h4M8 11h4" /></>),
  'content-site':   Ico(<><rect x="3" y="3" width="14" height="14" rx="1.5" /><path d="M6 7h8M6 10h8M6 13h5" /></>),
  'productivity':   Ico(<><rect x="2.5" y="3.5" width="6" height="6" rx="1" /><rect x="11.5" y="3.5" width="6" height="6" rx="1" /><rect x="2.5" y="11.5" width="6" height="5" rx="1" /><rect x="11.5" y="11.5" width="6" height="5" rx="1" /></>),
  'slide-deck':     Ico(<><rect x="2" y="3" width="16" height="11" rx="1" /><path d="M10 14v3M7 17h6" /></>),
  'social-post':    Ico(<><rect x="3" y="3" width="14" height="14" rx="2.5" /><circle cx="13.5" cy="6.5" r="1" /></>),
  'poster':         Ico(<><rect x="4" y="2" width="12" height="16" rx="0.5" /><path d="M7 6h6M7 9h6M7 12h4" /></>),
  'brochure':       Ico(<><rect x="2" y="4" width="6" height="12" rx="0.5" /><rect x="8" y="4" width="6" height="12" rx="0.5" /><rect x="14" y="4" width="4" height="12" rx="0.5" /></>),
  'one-pager':      Ico(<><rect x="4" y="2" width="12" height="16" rx="1" /><path d="M7 6h6M7 9h6M7 12h6M7 15h4" /></>),
  'resume':         Ico(<><rect x="4" y="2" width="12" height="16" rx="1" /><circle cx="10" cy="7" r="2" /><path d="M7 13h6M7 15h4" /></>),
  'api':            Ico(<><path d="M3 7h14M3 13h14" /><circle cx="6" cy="7" r="1.2" /><circle cx="14" cy="13" r="1.2" /></>),
  'library':        Ico(<><path d="M4 3v14M16 3v14" /><rect x="6" y="4" width="3" height="13" rx="0.5" /><rect x="11" y="4" width="3" height="13" rx="0.5" /></>),
  'data':           Ico(<><ellipse cx="10" cy="5" rx="6" ry="2" /><path d="M4 5v10c0 1.1 2.7 2 6 2s6-.9 6-2V5" /><path d="M4 10c0 1.1 2.7 2 6 2s6-.9 6-2" /></>),
  'cli':            Ico(<><rect x="2" y="3" width="16" height="14" rx="1.5" /><path d="M5 8l3 2-3 2M10 12h5" /></>),
  'other':          Ico(<><circle cx="10" cy="10" r="7" /><path d="M8 8a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.6M10 14h.01" /></>),
  'blank':          Ico(<><path d="M5 4h7l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /></>)
}

const SURFACE_ICONS: Record<string, ReturnType<typeof Ico>> = {
  mobile:  Ico(<><rect x="6" y="2" width="8" height="16" rx="1.5" /><path d="M9.5 15.5h1" /></>),
  tablet:  Ico(<><rect x="3.5" y="3" width="13" height="14" rx="1.5" /><path d="M9.5 15h1" /></>),
  desktop: Ico(<><rect x="2" y="3" width="16" height="11" rx="1.5" /><path d="M7 17h6M10 14v3" /></>),
  tv:      Ico(<><rect x="2" y="4" width="16" height="10" rx="1" /><path d="M7 17h6M10 14v3" /></>)
}

const LOOK_ICONS: Record<string, ReturnType<typeof Ico>> = {
  minimal:   Ico(<><circle cx="10" cy="10" r="6" /></>),
  playful:   Ico(<><path d="M5 8a3 3 0 1 1 5 2c-1 1-1 2-1 3M9 14h.01M13 5l1 1M15 9l1.5-.5M14 13l1 1" /></>),
  editorial: Ico(<><path d="M4 4h12M4 8h7M4 12h12M4 16h9" /></>),
  data:      Ico(<><path d="M3 16V8M7 16V4M11 16v-7M15 16V6" /></>),
  luxury:    Ico(<><path d="M4 7l3-3h6l3 3-6 9z" /><path d="M4 7h12M8 7l2 9M12 7l-2 9" /></>),
  brutalist: Ico(<><rect x="3" y="3" width="6" height="6" /><rect x="11" y="11" width="6" height="6" /><rect x="11" y="3" width="6" height="6" /></>),
  friendly:  Ico(<><circle cx="10" cy="10" r="6" /><path d="M7 9h.01M13 9h.01M7 12c1 1.3 5 1.3 6 0" /></>)
}

const THEME_ICONS: Record<'light' | 'dark' | 'auto' | 'both', ReturnType<typeof Ico>> = {
  light: Ico(<><circle cx="10" cy="10" r="3.5" /><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4" /></>),
  dark:  Ico(<><path d="M14.5 11a5 5 0 1 1-5.5-7 4 4 0 0 0 5.5 7z" /></>),
  auto:  Ico(<><circle cx="10" cy="10" r="6" /><path d="M10 4v12" /></>),
  both:  Ico(<><circle cx="7" cy="10" r="3" /><path d="M14.5 11a3.5 3.5 0 1 1-3.5-4.5" /></>)
}

const AUDIENCE_ICONS: Record<string, ReturnType<typeof Ico>> = {
  'Just me':                Ico(<><circle cx="10" cy="7" r="3" /><path d="M4 17c0-3 3-5 6-5s6 2 6 5" /></>),
  'Friends and family':     Ico(<><circle cx="7" cy="8" r="2.5" /><circle cx="13" cy="8" r="2.5" /><path d="M3 16c0-2.2 2-4 4-4s4 1.8 4 4M11 16c0-2.2 1.5-4 3-4s3 1.8 3 4" /></>),
  'Consumers':              Ico(<><circle cx="6" cy="7" r="2" /><circle cx="10" cy="6" r="2" /><circle cx="14" cy="7" r="2" /><path d="M3 15c0-2 1.5-4 3-4M17 15c0-2-1.5-4-3-4M7 16c0-2 1.5-4 3-4s3 2 3 4" /></>),
  'SMB':                    Ico(<><rect x="3" y="6" width="14" height="11" rx="1" /><path d="M7 6V3h6v3M7 11h2M11 11h2M7 14h2M11 14h2" /></>),
  'Enterprise':             Ico(<><rect x="3" y="4" width="14" height="13" /><path d="M6 7h2M10 7h2M14 7h.01M6 10h2M10 10h2M14 10h.01M6 13h2M10 13h2M14 13h.01" /></>),
  'Internal team':          Ico(<><circle cx="10" cy="6" r="2" /><circle cx="5" cy="11" r="2" /><circle cx="15" cy="11" r="2" /><path d="M10 8v3M5 13c-1 1-1 3-1 4M15 13c1 1 1 3 1 4M10 11v6" /></>),
  'Open source community':  Ico(<><circle cx="10" cy="10" r="7" /><path d="M3 10h14M10 3a10 10 0 0 1 0 14M10 3a10 10 0 0 0 0 14" /></>)
}

const ICO_CODE   = Ico(<><path d="M6 6l-3 4 3 4M14 6l3 4-3 4M11 4l-2 12" /></>)
const ICO_KEY    = Ico(<><circle cx="6" cy="10" r="3" /><path d="M9 10h8M14 10v3M17 10v3" /></>)
const ICO_DB     = Ico(<><ellipse cx="10" cy="5" rx="6" ry="2" /><path d="M4 5v10c0 1.1 2.7 2 6 2s6-.9 6-2V5" /></>)
const ICO_CLOUD  = Ico(<><path d="M5 14h10a3 3 0 0 0 .5-6 4 4 0 0 0-7.7-1A3.5 3.5 0 0 0 5 14z" /></>)
const ICO_STACK  = Ico(<><path d="M10 3l7 4-7 4-7-4 7-4z" /><path d="M3 11l7 4 7-4M3 14l7 4 7-4" /></>)
const ICO_TAG    = Ico(<><path d="M3 10V4h6l8 8-6 6z" /><circle cx="6.5" cy="6.5" r="1" /></>)
const ICO_UPLOAD = Ico(<><path d="M10 13V4M6 8l4-4 4 4M3 14v2a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2" /></>)
const ICO_PENCIL = Ico(<><path d="M14 3l3 3-9 9H5v-3z" /><path d="M12 5l3 3" /></>)

function branchOf(type: ProjectTypeId | null): Branch {
  if (!type) return 'none'
  return PROJECT_TYPES.find((t) => t.id === type)?.branch ?? 'none'
}

function pageList(branch: Branch, type: ProjectTypeId | null, designSystem?: string | null): string[] {
  const hasSub = !!(type && SUB_TYPES_BY_TYPE[type]?.length)
  const isApp = type === 'web-app' || type === 'productivity'
  const isSite = type === 'marketing-site' || type === 'content-site'
  const isPrint =
    type === 'slide-deck' || type === 'social-post' || type === 'poster' ||
    type === 'brochure'   || type === 'one-pager'   || type === 'resume'
  const usesSystem = !!designSystem && designSystem !== 'none'
  switch (branch) {
    case 'visual':
      if (isPrint) {
        // Static / print-style pieces: no surfaces, no motion, no UI radius/shadow,
        // no theme toggle. Brand and inspiration matter most.
        const wantsIcons  = type === 'slide-deck' || type === 'one-pager' || type === 'resume'
        const wantsImages = type !== 'resume'
        return [
          'type',
          ...(hasSub ? ['subType'] : []),
          'context',
          'audience', 'look', 'colors', 'fonts',
          ...(wantsIcons ? ['icons'] : []),
          ...(wantsImages ? ['images'] : []),
          'brand', 'inspiration', 'stack', 'final', 'preview'
        ]
      }
      return [
        'type',
        ...(hasSub ? ['subType'] : []),
        'surfaces',
        'context',
        ...(isApp || isSite ? ['designSystem'] : []),
        'audience', 'look', 'colors', 'fonts',
        ...(isApp || isSite ? ['icons'] : []),
        ...(isApp || isSite ? ['images'] : []),
        ...(isSite ? ['motion'] : []),
        ...(usesSystem ? [] : ['ui']),
        'theme',
        'brand',
        'inspiration', 'stack',
        ...(isApp ? ['data'] : []),
        'final', 'preview'
      ]
    case 'backend':
      return ['type', ...(hasSub ? ['subType'] : []), 'context', 'language', 'auth', 'store', 'deploy', 'final', 'preview']
    case 'lib':
      return ['type', 'context', 'language', 'final', 'preview']
    case 'none':
      return ['type']
  }
}

function tileClass(selected: boolean, extra = ''): string {
  return [
    'group rounded-lg p-4 text-left transition-all',
    selected ? 'bg-accent/15' : 'bg-surface/50 hover:bg-surface',
    extra
  ].join(' ')
}

function iconWrapClass(selected: boolean, mb = true): string {
  return [
    'inline-flex h-9 w-9 items-center justify-center transition-colors',
    mb ? 'mb-2' : '',
    selected ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'
  ].join(' ')
}

const PAGE_TITLES: Record<string, string> = {
  type: 'What are you building?',
  subType: 'What kind exactly?',
  surfaces: 'Where will it run?',
  audience: 'Who is this for?',
  look: 'Look and feel',
  colors: 'Brand colors',
  fonts: 'Typography',
  icons: 'Icon library',
  images: 'Images',
  motion: 'Motion and animation',
  designSystem: 'Design system',
  data: 'Data',
  brand: 'Brand identity',
  ui: 'UI style',
  theme: 'Theme',
  inspiration: 'Visual inspiration',
  stack: 'Tech stack hint',
  language: 'Programming language',
  auth: 'Auth model',
  store: 'Data store',
  deploy: 'Deploy target',
  oneLiner: 'Tell me about your project',
  context: 'Tell me about your project',
  final: 'Anything else?',
  preview: 'Project brief'
}

export function BriefWizard({ folderPath, projectId, initial, onCancel, onComplete }: Props) {
  const [state, setState] = useState<WizardState>(() => {
    if (initial) return { ...emptyWizard(), ...initial, type: initial.type as ProjectTypeId }
    return emptyWizard()
  })
  const [pageIdx, setPageIdx] = useState(0)
  const [saving, setSaving] = useState(false)

  const pages = useMemo(
    () => pageList(branchOf(state.type ?? null), state.type ?? null, state.designSystem ?? null),
    [state.type, state.designSystem]
  )
  const currentPage = pages[pageIdx]
  const total = pages.length
  const isLast = pageIdx === total - 1

  useEffect(() => {
    if (pageIdx >= pages.length) setPageIdx(pages.length - 1)
  }, [pages, pageIdx])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }))

  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

  const next = () => {
    if (state.type === 'blank') return finish(false)
    if (isLast) return
    setDirection('forward')
    setPageIdx((i) => Math.min(i + 1, pages.length - 1))
  }
  const back = () => {
    setDirection('back')
    setPageIdx((i) => Math.max(i - 1, 0))
  }

  async function finish(startWithCopilot: boolean) {
    if (!state.type) return
    setSaving(true)
    const typeLabel = PROJECT_TYPES.find((t) => t.id === state.type)?.label ?? state.type
    const brief: ProjectBrief = {
      v: 1,
      type: state.type,
      typeLabel,
      subType: state.subType,
      audience: state.audience,
      look: state.look,
      lookNote: state.lookNote,
      brandColor: state.brandColor,
      secondaryColor: state.secondaryColor,
      tertiaryColor: state.tertiaryColor,
      headingFont: state.headingFont,
      bodyFont: state.bodyFont,
      font: state.font,
      iconLibrary: state.iconLibrary,
      imageSource: state.imageSource,
      motionLibs: state.motionLibs,
      designSystem: state.designSystem,
      brandLogo: state.brandLogo,
      brandName: state.brandName,
      radius: state.radius,
      shadow: state.shadow,
      outline: state.outline,
      theme: state.theme,
      stack: state.stack,
      language: state.language,
      auth: state.auth,
      store: state.store,
      deploy: state.deploy,
      oneLiner: state.oneLiner,
      notes: state.notes,
      scaffold: state.scaffold,
      inspirationImages: state.inspirationImages,
      createdAt: initial?.createdAt ?? Date.now()
    }
    try { await onComplete(brief, startWithCopilot) }
    finally { setSaving(false) }
  }

  const canAdvance =
    currentPage === 'type' ? !!state.type :
    currentPage === 'data' ? state.dataMode === 'demo' || (state.dataMode === 'real' && !!state.dataBackend) :
    true

  return (
    <div
      className="fixed inset-0 z-[200] grid place-items-center bg-black/60 p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }}
      role="presentation"
    >
      <div className="flex h-[82vh] max-h-[800px] w-[860px] max-w-full flex-col overflow-hidden rounded-xl bg-bg shadow-2xl">
        <header className="flex items-center gap-6 bg-surface/40 px-6 py-4">
          <h2 className="flex-shrink-0 text-2xl font-semibold text-text-primary">
            {PAGE_TITLES[currentPage] ?? ''}
          </h2>
          <div className="flex flex-1 items-center justify-end gap-1.5" title={folderPath}>
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === pageIdx ? 'w-8 bg-accent' : i < pageIdx ? 'w-1.5 bg-text-secondary' : 'w-1.5 bg-border'}`} />
            ))}
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            title="Close (Esc)"
            className="flex-shrink-0 grid h-8 w-8 place-items-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div
            key={currentPage}
            className={direction === 'forward' ? 'wizard-page-fwd' : 'wizard-page-back'}
          >
          {currentPage === 'type' && <PageType state={state} set={set} />}
          {currentPage === 'subType' && <PageSubType state={state} set={set} />}
          {currentPage === 'surfaces' && <PageSurfaces state={state} set={set} />}
          {currentPage === 'audience' && <PageAudience state={state} set={set} />}
          {currentPage === 'look' && <PageLook state={state} set={set} />}
          {currentPage === 'colors' && <PageColors state={state} set={set} />}
          {currentPage === 'fonts' && <PageFonts state={state} set={set} />}
          {currentPage === 'icons' && <PageIcons state={state} set={set} />}
          {currentPage === 'images' && <PageImages state={state} set={set} />}
          {currentPage === 'motion' && <PageMotion state={state} set={set} />}
          {currentPage === 'designSystem' && <PageDesignSystem state={state} set={set} />}
          {currentPage === 'brand' && <PageBrand state={state} set={set} projectId={projectId} />}
          {currentPage === 'ui' && <PageUiStyle state={state} set={set} />}
          {currentPage === 'theme' && <PageTheme state={state} set={set} />}
          {currentPage === 'inspiration' && <PageInspiration state={state} set={set} projectId={projectId} />}
          {currentPage === 'stack' && (
            <PageChoice
              title="Tech stack hint"
              hint="Optional. Copilot can recommend something different."
              options={STACK_BY_TYPE[state.type ?? ''] ?? ['Let copilot pick']}
              value={state.stack}
              onPick={(v) => set('stack', v)}
              Icon={ICO_STACK}
            />
          )}
          {currentPage === 'language' && (
            <PageChoice
              title="Primary language"
              options={LANGUAGE_OPTIONS}
              value={state.language}
              onPick={(v) => set('language', v)}
              Icon={ICO_CODE}
            />
          )}
          {currentPage === 'auth' && <PageChoice title="Auth model" options={AUTH_OPTIONS} value={state.auth} onPick={(v) => set('auth', v)} Icon={ICO_KEY} />}
          {currentPage === 'store' && <PageChoice title="Data store" options={STORE_OPTIONS} value={state.store} onPick={(v) => set('store', v)} Icon={ICO_DB} />}
          {currentPage === 'deploy' && <PageChoice title="Deploy target" options={DEPLOY_OPTIONS} value={state.deploy} onPick={(v) => set('deploy', v)} Icon={ICO_CLOUD} />}
          {currentPage === 'oneLiner' && <PageContext state={state} set={set} />}
          {currentPage === 'context' && <PageContext state={state} set={set} />}
          {currentPage === 'data' && <PageData state={state} set={set} />}
          {currentPage === 'final' && <PageFinal state={state} set={set} projectId={projectId} />}
          {currentPage === 'preview' && <PagePreview state={state} projectId={projectId} />}
          </div>
        </main>

        <footer className="flex items-center justify-between bg-surface/40 px-6 py-4">
          <button
            onClick={back}
            disabled={pageIdx === 0 || saving}
            className="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-surface disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ← Back
          </button>
          <div className="text-xs text-text-secondary">{pageIdx + 1} of {total}</div>
          {isLast ? (
            <div className="flex gap-2">
              <button
                onClick={() => finish(false)}
                disabled={saving || !state.type}
                className="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-surface disabled:opacity-30"
              >
                Save without starting
              </button>
              <button
                onClick={() => finish(true)}
                disabled={saving || !state.type}
                className="rounded-md bg-action px-4 py-2 text-sm font-medium text-action-text hover:opacity-90 disabled:opacity-30"
              >
                {saving ? 'Saving' : 'Save and start with Copilot'}
              </button>
            </div>
          ) : (
            <button
              onClick={next}
              disabled={!canAdvance}
              className="rounded-md bg-action px-4 py-2 text-sm font-medium text-action-text hover:opacity-90 disabled:opacity-30"
            >
              {state.type === 'blank' ? 'Create blank project' : 'Next →'}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function PageHeading(_: { title: string; hint?: string }) {
  return null
}

function PageType({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const mainTypes = PROJECT_TYPES.filter((t) => !t.group)
  const engineeringTypes = PROJECT_TYPES.filter((t) => t.group === 'engineering')
  // Auto-expand if the user previously picked an engineering type.
  const initiallyExpanded = !!state.type && engineeringTypes.some((t) => t.id === state.type)
  const [showEngineering, setShowEngineering] = useState(initiallyExpanded)

  return (
    <div>
      <PageHeading title="What are you building?" hint="Pick the closest match" />
      <div className="grid grid-cols-3 gap-2.5">
        {mainTypes.map((t) => {
          const selected = state.type === t.id
          const Icon = TYPE_ICONS[t.id]
          return (
            <button key={t.id} onClick={() => set('type', t.id)} className={tileClass(selected)}>
              <span className={iconWrapClass(selected)}><Icon /></span>
              <div className="text-sm font-medium text-text-primary">{t.label}</div>            </button>
          )
        })}
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowEngineering((s) => !s)}
          className="flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          <span className={`inline-block h-2.5 w-2.5 transition-transform ${showEngineering ? 'rotate-90' : ''}`}>▸</span>
          More engineering types ({engineeringTypes.length})
        </button>
        {showEngineering && (
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {engineeringTypes.map((t) => {
              const selected = state.type === t.id
              const Icon = TYPE_ICONS[t.id]
              return (
                <button key={t.id} onClick={() => set('type', t.id)} className={tileClass(selected)}>
                  <span className={iconWrapClass(selected)}><Icon /></span>
                  <div className="text-sm font-medium text-text-primary">{t.label}</div>                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function PageSubType({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const opts = (state.type && SUB_TYPES_BY_TYPE[state.type]) || []
  const isCustom = !!state.subType && !opts.includes(state.subType)
  const [describing, setDescribing] = useState(isCustom)
  return (
    <div>
      <PageHeading title="What kind exactly?" hint="Helps tailor the next questions" />
      <div className="grid grid-cols-3 gap-2.5">
        {opts.map((opt) => {
          const selected = state.subType === opt && !describing
          return (
            <button
              key={opt}
              onClick={() => { setDescribing(false); set('subType', opt) }}
              className={tileClass(selected, 'flex items-center gap-3')}
            >
              <span className={iconWrapClass(selected, false)}><ICO_TAG /></span>
              <span className="text-sm font-medium text-text-primary">{opt}</span>
            </button>
          )
        })}
        <button
          onClick={() => { setDescribing(true); if (opts.includes(state.subType ?? '')) set('subType', '') }}
          className={tileClass(describing, 'flex items-center gap-3')}
        >
          <span className={iconWrapClass(describing, false)}><ICO_PENCIL /></span>
          <span className="text-sm font-medium text-text-primary">I'll describe</span>
        </button>
      </div>
      {describing && (
        <textarea
          autoFocus
          value={state.subType ?? ''}
          onChange={(e) => set('subType', e.target.value)}
          placeholder="e.g. Subscription box dashboard for indie roasters"
          rows={3}
          className="mt-4 w-full resize-none rounded-lg bg-surface px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
      )}
    </div>
  )
}

function PageSurfaces({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const picked = new Set(state.surfaces ?? [])
  const toggle = (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set('surfaces', Array.from(next))
  }
  return (
    <div>
      <PageHeading title="Where will it run?" hint="Pick one or more" />
      <div className="grid grid-cols-2 gap-2.5">
        {SURFACE_OPTIONS.map((o) => {
          const selected = picked.has(o.id)
          const Icon = SURFACE_ICONS[o.id]
          return (
            <button key={o.id} onClick={() => toggle(o.id)} className={tileClass(selected)}>
              <span className={iconWrapClass(selected)}>{Icon ? <Icon /> : null}</span>
              <div className="text-sm font-medium text-text-primary">{o.label}</div>            </button>
          )
        })}
      </div>
    </div>
  )
}

function PageAudience({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const isCustom = !!state.audience && !AUDIENCE_OPTIONS.includes(state.audience)
  const [describing, setDescribing] = useState(isCustom)
  return (
    <div>
      <PageHeading title="Who is this for?" />
      <div className="grid grid-cols-2 gap-2.5">
        {AUDIENCE_OPTIONS.map((opt) => {
          const selected = state.audience === opt && !describing
          const Icon = AUDIENCE_ICONS[opt]
          return (
            <button
              key={opt}
              onClick={() => { setDescribing(false); set('audience', opt) }}
              className={tileClass(selected, 'flex items-center gap-3')}
            >
              <span className={iconWrapClass(selected, false)}><Icon /></span>
              <span className="text-sm font-medium text-text-primary">{opt}</span>
            </button>
          )
        })}
        <button
          onClick={() => { setDescribing(true); if (AUDIENCE_OPTIONS.includes(state.audience ?? '')) set('audience', '') }}
          className={tileClass(describing, 'flex items-center gap-3')}
        >
          <span className={iconWrapClass(describing, false)}><ICO_PENCIL /></span>
          <span className="text-sm font-medium text-text-primary">I'll describe</span>
        </button>
      </div>
      {describing && (
        <textarea
          autoFocus
          value={state.audience ?? ''}
          onChange={(e) => set('audience', e.target.value)}
          placeholder="e.g. Bookkeepers at small accounting firms"
          rows={3}
          className="mt-4 w-full resize-none rounded-lg bg-surface px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
      )}
    </div>
  )
}

function PageChoice({
  title, hint, options, value, onPick, Icon
}: {
  title: string; hint?: string; options: string[]; value: string | undefined
  onPick: (v: string) => void; Icon: ReturnType<typeof Ico>
}) {
  return (
    <div>
      <PageHeading title={title} hint={hint} />
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((opt) => {
          const selected = value === opt
          return (
            <button key={opt} onClick={() => onPick(opt)} className={tileClass(selected, 'flex items-center gap-3')}>
              <span className={iconWrapClass(selected, false)}><Icon /></span>
              <span className="text-sm font-medium text-text-primary">{opt}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PageLook({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const picked = new Set(state.look ?? [])
  const [describing, setDescribing] = useState(!!state.lookNote)
  const toggle = (id: string) => {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else if (next.size < 2) next.add(id)
    else { const arr = Array.from(next); arr.shift(); arr.push(id); set('look', arr); return }
    set('look', Array.from(next))
  }
  return (
    <div>
      <PageHeading title="Look and feel" hint="Pick up to 2 or describe your own" />
      <div className="grid grid-cols-2 gap-2.5">
        {LOOK_OPTIONS.map((o) => {
          const selected = picked.has(o.label)
          const Icon = LOOK_ICONS[o.id]
          return (
            <button key={o.id} onClick={() => toggle(o.label)} className={tileClass(selected)}>
              <span className={iconWrapClass(selected)}><Icon /></span>
              <div className="text-sm font-medium text-text-primary">{o.label}</div>            </button>
          )
        })}
        <button
          onClick={() => setDescribing((d) => !d)}
          className={tileClass(describing)}
        >
          <span className={iconWrapClass(describing)}><ICO_PENCIL /></span>
          <div className="text-sm font-medium text-text-primary">I'll describe</div>
        </button>
      </div>
      {describing && (
        <textarea
          autoFocus
          value={state.lookNote ?? ''}
          onChange={(e) => set('lookNote', e.target.value)}
          placeholder="e.g. Notion meets a vinyl record sleeve. Lots of bold type, warm off-white background, one brutal accent color."
          rows={3}
          className="mt-4 w-full resize-none rounded-lg bg-surface px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
      )}
    </div>
  )
}

function ColorPickerRow({
  label, value, onChange
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
}) {
  const [text, setText] = useState(value ?? '')
  useEffect(() => { setText(value ?? '') }, [value])
  const safeValue = value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#5B47FB'
  return (
    <div className="rounded-lg bg-surface/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {value && (
          <button onClick={() => onChange(undefined)} className="text-xs text-text-secondary hover:text-text-primary">
            Clear
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <label
          className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-md"
          style={{ backgroundColor: value || '#2a2a2a' }}
          title="Open color picker"
        >
          <input
            type="color"
            value={safeValue}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          type="text"
          value={text}
          placeholder="#5B47FB"
          onChange={(e) => {
            setText(e.target.value)
            if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onChange(e.target.value.toUpperCase())
          }}
          className="w-32 rounded-md bg-surface px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-accent"
        />
        <div className="flex flex-1 flex-wrap gap-1.5">
          {BRAND_SWATCHES.map((hex) => {
            const selected = (value ?? '').toUpperCase() === hex.toUpperCase()
            return (
              <button
                key={hex}
                onClick={() => onChange(hex)}
                className={`h-7 w-7 rounded ring-1 ring-black/10 transition-all ${selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}
                style={{ backgroundColor: hex }}
                title={hex}
                aria-label={hex}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PageColors({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <div>
      <PageHeading title="Brand colors" hint="Primary required, secondary and tertiary optional" />
      <div className="space-y-3">
        <ColorPickerRow label="Primary" value={state.brandColor} onChange={(v) => set('brandColor', v)} />
        <ColorPickerRow label="Secondary" value={state.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
        <ColorPickerRow label="Tertiary / accent" value={state.tertiaryColor} onChange={(v) => set('tertiaryColor', v)} />
      </div>
      {(state.brandColor || state.secondaryColor || state.tertiaryColor) && (
        <div className="mt-5 rounded-lg bg-surface/50 p-4">
          <div className="mb-2 text-xs text-text-secondary">Preview</div>
          <div className="flex gap-2">
            {[state.brandColor, state.secondaryColor, state.tertiaryColor].filter(Boolean).map((c, i) => (
              <div key={i} className="flex-1 rounded-md p-3 text-xs font-mono" style={{ backgroundColor: c, color: contrastFor(c!) }}>
                {c}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function contrastFor(hex: string): string {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#fff'
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#111' : '#fff'
}

function FontPicker({
  label, value, onChange, sample
}: {
  label: string
  value: string | undefined
  onChange: (v: string | undefined) => void
  sample: string
}) {
  const groups = useMemo(() => {
    const out = new Map<string, typeof FONT_OPTIONS>()
    for (const f of FONT_OPTIONS) {
      if (!out.has(f.group)) out.set(f.group, [])
      out.get(f.group)!.push(f)
    }
    return Array.from(out.entries())
  }, [])
  const selected = FONT_OPTIONS.find((f) => f.id === value)
  return (
    <div className="rounded-lg bg-surface/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {value && (
          <button onClick={() => onChange(undefined)} className="text-xs text-text-secondary hover:text-text-primary">
            Clear
          </button>
        )}
      </div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="w-full rounded-md bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        <option value="">Pick a font</option>
        {groups.map(([g, opts]) => (
          <optgroup key={g} label={g}>
            {opts.map((o) => (
              <option key={o.id} value={o.id}>{o.id}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <div
        className="mt-3 truncate rounded-md bg-bg/50 px-3 py-3 text-xl text-text-primary"
        style={{ fontFamily: selected?.stack ?? 'inherit', letterSpacing: '-0.01em' }}
      >
        {selected ? sample : <span className="text-sm text-text-secondary">Preview will appear here</span>}
      </div>
    </div>
  )
}

function PageFonts({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <div>
      <PageHeading title="Typography" hint="Heading and body" />
      <div className="space-y-3">
        <FontPicker label="Heading font" value={state.headingFont} onChange={(v) => set('headingFont', v)} sample="Display heading" />
        <FontPicker label="Body font" value={state.bodyFont} onChange={(v) => set('bodyFont', v)} sample="The quick brown fox jumps over the lazy dog" />
      </div>
    </div>
  )
}

function PageIcons({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <div>
      <PageHeading title="Icon library" hint="One set, used consistently" />
      <div className="grid grid-cols-2 gap-2.5">
        {ICON_LIBRARY_OPTIONS.map((o) => {
          const selected = state.iconLibrary === o.id
          return (
            <button
              key={o.id}
              onClick={() => set('iconLibrary', selected ? undefined : o.id)}
              className={tileClass(selected)}
            >
              <div className="text-sm font-medium text-text-primary">{o.label}</div>            </button>
          )
        })}
      </div>
    </div>
  )
}

function PageImages({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <div>
      <PageHeading title="Images" hint="Source for photos and visuals" />
      <div className="grid grid-cols-2 gap-2.5">
        {IMAGE_SOURCE_OPTIONS.map((o) => {
          const selected = state.imageSource === o.id
          return (
            <button
              key={o.id}
              onClick={() => set('imageSource', selected ? undefined : o.id)}
              className={tileClass(selected)}
            >
              <div className="text-sm font-medium text-text-primary">{o.label}</div>            </button>
          )
        })}
      </div>
    </div>
  )
}

function PageMotion({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const picked = new Set(state.motionLibs ?? [])
  const toggle = (id: string) => {
    const next = new Set(picked)
    if (id === 'none') {
      // 'none' is exclusive
      set('motionLibs', next.has('none') ? [] : ['none'])
      return
    }
    next.delete('none')
    if (next.has(id)) next.delete(id)
    else next.add(id)
    set('motionLibs', Array.from(next))
  }
  return (
    <div>
      <PageHeading title="Motion and animation" hint="Pick libraries to use, or None for static" />
      <div className="grid grid-cols-2 gap-2.5">
        {MOTION_OPTIONS.map((o) => {
          const selected = picked.has(o.id)
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.id)}
              className={tileClass(selected)}
            >
              <div className="text-sm font-medium text-text-primary">{o.label}</div>            </button>
          )
        })}
      </div>
    </div>
  )
}

function PageDesignSystem({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const current = state.designSystem ?? 'none'
  const categoryOrder = ['Custom', 'Platform', 'Enterprise', 'Headless']
  const groups = categoryOrder.map((cat) => ({
    cat,
    items: DESIGN_SYSTEM_OPTIONS.filter((o) => o.category === cat)
  }))
  return (
    <div className="space-y-6">
      {groups.map(({ cat, items }) => (
        <section key={cat}>
          <div className="mb-2 text-xs text-text-secondary">{cat}</div>
          <div className="grid grid-cols-2 gap-2">
            {items.map((o) => {
              const selected = current === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => set('designSystem', o.id)}
                  className={[
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                    selected
                      ? 'bg-accent/10 ring-1 ring-accent'
                      : 'bg-surface/40 hover:bg-surface'
                  ].join(' ')}
                >
                  <span
                    className={[
                      'grid h-8 w-8 flex-shrink-0 place-items-center rounded-md font-mono text-[13px]',
                      selected ? 'bg-action text-action-text' : 'bg-surface text-text-secondary'
                    ].join(' ')}
                    aria-hidden
                  >
                    {o.mono}
                  </span>
                  <span className="text-sm font-medium text-text-primary">{o.label}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function PageData({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const mode = state.dataMode ?? null
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { set('dataMode', 'demo'); set('dataBackend', undefined) }}
          className={[
            'rounded-lg p-4 text-left transition-colors',
            mode === 'demo' ? 'bg-accent/10 ring-1 ring-accent' : 'bg-surface/40 hover:bg-surface'
          ].join(' ')}
        >
          <div className="text-sm font-medium text-text-primary">Demo data</div>
          <div className="mt-1 text-xs text-text-secondary">Placeholder fixtures, no backend</div>
        </button>
        <button
          onClick={() => set('dataMode', 'real')}
          className={[
            'rounded-lg p-4 text-left transition-colors',
            mode === 'real' ? 'bg-accent/10 ring-1 ring-accent' : 'bg-surface/40 hover:bg-surface'
          ].join(' ')}
        >
          <div className="text-sm font-medium text-text-primary">Wire a real backend</div>
          <div className="mt-1 text-xs text-text-secondary">Supabase, Firebase, Azure, and others</div>
        </button>
      </div>

      {mode === 'real' && (
        <section>
          <div className="mb-2 text-xs text-text-secondary">Pick a backend</div>
          <div className="grid grid-cols-2 gap-2">
            {DATA_BACKEND_OPTIONS.map((o) => {
              const selected = state.dataBackend === o.id
              return (
                <button
                  key={o.id}
                  onClick={() => set('dataBackend', o.id)}
                  className={[
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors',
                    selected ? 'bg-accent/10 ring-1 ring-accent' : 'bg-surface/40 hover:bg-surface'
                  ].join(' ')}
                >
                  <span
                    className={[
                      'grid h-8 w-8 flex-shrink-0 place-items-center rounded-md font-mono text-[13px]',
                      selected ? 'bg-action text-action-text' : 'bg-surface text-text-secondary'
                    ].join(' ')}
                    aria-hidden
                  >
                    {o.mono}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary">{o.label}</div>
                    <div className="truncate text-xs text-text-secondary">{o.hint}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function PageBrand({
  state, set, projectId
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  projectId: string
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [thumb, setThumb] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logo = state.brandLogo

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!logo) { setThumb(null); return }
      const url = await window.terminal42.brief.brandDataUrl(projectId, logo)
      if (!cancelled) setThumb(url)
    })()
    return () => { cancelled = true }
  }, [logo, projectId])

  async function uploadFile(files: FileList | null) {
    if (!files || !files.length) return
    setBusy(true)
    setError(null)
    const file = files[0]
    const buf = await file.arrayBuffer()
    // If a previous logo exists, remove it first so we don't accumulate files.
    if (logo) {
      try { await window.terminal42.brief.deleteBrandLogo(projectId, logo) } catch {}
    }
    const res = await window.terminal42.brief.uploadBrandLogo(projectId, { name: file.name, bytes: buf })
    if (res.ok && res.relativePath) set('brandLogo', res.relativePath)
    else if (res.error) setError(res.error)
    setBusy(false)
  }

  async function remove() {
    if (!logo) return
    try { await window.terminal42.brief.deleteBrandLogo(projectId, logo) } catch {}
    set('brandLogo', undefined)
  }

  return (
    <div>
      <PageHeading
        title="Brand"
        hint="Optional. Brand name and logo for headers and splash screens."
      />

      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Brand name</label>
          <input
            type="text"
            value={state.brandName ?? ''}
            onChange={(e) => set('brandName', e.target.value || undefined)}
            placeholder="e.g. Acme Health"
            className="w-full rounded-md bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Logo</label>
          {logo && thumb ? (
            <div className="flex items-center gap-3 rounded-md bg-elevated p-3">
              <img src={thumb} alt="Brand logo" className="h-16 w-16 rounded object-contain bg-bg" />
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm text-text-primary">{logo.split('/').pop()}</div>
                <div className="text-xs text-text-secondary">Saved with this project</div>
              </div>
              <button
                onClick={remove}
                className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-bg hover:text-text-primary"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-elevated px-4 py-6 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              {busy ? 'Uploading…' : '+ Upload logo (SVG, PNG, JPG)'}
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/svg+xml,image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            onChange={(e) => uploadFile(e.target.files)}
          />
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  )
}

function RadioRow<T extends string>({
  label, value, options, onChange
}: {
  label: string
  value: T | undefined
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-text-primary">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = value === o.id
          return (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-all ${selected ? 'bg-accent/20 text-accent' : 'bg-surface/50 text-text-secondary hover:bg-surface hover:text-text-primary'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full border ${selected ? 'border-accent' : 'border-text-secondary/40'}`}>
                {selected && <span className="block h-full w-full scale-50 rounded-full bg-accent" />}
              </span>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PageUiStyle({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const radius = RADIUS_STEPS.find((s) => s.id === state.radius) ?? RADIUS_STEPS[2]
  const shadow = SHADOW_STEPS.find((s) => s.id === state.shadow) ?? SHADOW_STEPS[1]
  const outline = OUTLINE_STEPS.find((s) => s.id === state.outline) ?? OUTLINE_STEPS[1]
  const radiusIdx = RADIUS_STEPS.findIndex((s) => s.id === radius.id)
  return (
    <div>
      <PageHeading title="UI style" hint="Buttons and surfaces" />

      <div className="mb-8 rounded-xl bg-surface/30 p-8">
        <div className="mb-4 text-xs text-text-secondary">Preview</div>
        <div className="flex items-center justify-center gap-4 pointer-events-none select-none">
          <div
            className="bg-action px-5 py-2.5 text-sm font-medium text-action-text"
            style={{
              borderRadius: radius.px,
              boxShadow: shadow.css,
              border: outline.px ? `${outline.px}px solid rgba(0,0,0,.25)` : 'none'
            }}
          >
            Primary button
          </div>
          <div
            className="bg-bg px-5 py-2.5 text-sm font-medium text-text-primary"
            style={{
              borderRadius: radius.px,
              boxShadow: shadow.css,
              border: outline.px ? `${outline.px}px solid var(--border, rgba(255,255,255,.18))` : 'none'
            }}
          >
            Secondary
          </div>
          <div
            className="bg-bg px-5 py-4 text-sm text-text-secondary"
            style={{
              borderRadius: radius.px,
              boxShadow: shadow.css,
              border: outline.px ? `${outline.px}px solid var(--border, rgba(255,255,255,.18))` : 'none',
              minWidth: 140
            }}
          >
            Card surface
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary">Corner radius</span>
            <span className="text-xs text-text-secondary">{radius.label}</span>
          </div>
          <input
            type="range"
            min={0} max={RADIUS_STEPS.length - 1} step={1}
            value={radiusIdx}
            onChange={(e) => set('radius', RADIUS_STEPS[Number(e.target.value)].id)}
            className="w-full accent-accent"
          />
          <div className="mt-1 flex justify-between text-[10px] text-text-secondary">
            {RADIUS_STEPS.map((s) => <span key={s.id}>{s.label}</span>)}
          </div>
        </div>

        <RadioRow
          label="Shadow"
          value={state.shadow}
          options={SHADOW_STEPS.map((s) => ({ id: s.id, label: s.label }))}
          onChange={(v) => set('shadow', v)}
        />

        <RadioRow
          label="Outlines"
          value={state.outline}
          options={OUTLINE_STEPS.map((s) => ({ id: s.id, label: s.label }))}
          onChange={(v) => set('outline', v)}
        />
      </div>
    </div>
  )
}

function PageTheme({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  return (
    <div>
      <PageHeading title="Theme" />
      <div className="grid grid-cols-2 gap-2.5">
        {THEME_OPTIONS.map((t) => {
          const selected = state.theme === t.id
          const Icon = THEME_ICONS[t.id]
          return (
            <button key={t.id} onClick={() => set('theme', t.id)} className={tileClass(selected, 'flex items-center gap-3')}>
              <span className={iconWrapClass(selected, false)}><Icon /></span>
              <span className="text-sm font-medium text-text-primary">{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PageInspiration({
  state, set, projectId
}: {
  state: WizardState
  set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void
  projectId: string
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const images = state.inspirationImages ?? []

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = {}
      for (const rel of images) {
        if (thumbs[rel]) { next[rel] = thumbs[rel]; continue }
        const url = await window.terminal42.brief.inspirationDataUrl(projectId, rel)
        if (cancelled) return
        if (url) next[rel] = url
      }
      if (!cancelled) setThumbs(next)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.join('|'), projectId])

  async function uploadFiles(files: FileList | null) {
    if (!files || !files.length) return
    setBusy(true)
    setError(null)
    const added: string[] = []
    for (const file of Array.from(files)) {
      const buf = await file.arrayBuffer()
      const res = await window.terminal42.brief.uploadInspiration(projectId, { name: file.name, bytes: buf })
      if (res.ok && res.relativePath) added.push(res.relativePath)
      else if (res.error) setError(res.error)
    }
    if (added.length) set('inspirationImages', [...(state.inspirationImages ?? []), ...added])
    setBusy(false)
  }

  async function remove(rel: string) {
    await window.terminal42.brief.deleteInspiration(projectId, rel)
    set('inspirationImages', (state.inspirationImages ?? []).filter((p) => p !== rel))
  }

  return (
    <div>
      <PageHeading title="Visual inspiration" hint="Screenshots, moodboards, references" />

      <label
        onDragOver={(e) => { e.preventDefault() }}
        onDrop={(e) => { e.preventDefault(); uploadFiles(e.dataTransfer.files) }}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl bg-surface/50 px-6 py-12 text-center hover:bg-surface"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-accent/20 text-accent">
          <ICO_UPLOAD className="h-6 w-6" />
        </span>
        <div>
          <div className="text-sm font-medium text-text-primary">Drop images here, or click to choose</div>
          <div className="mt-1 text-xs text-text-secondary">PNG, JPG, GIF, WEBP, SVG, AVIF</div>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </label>

      {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
      {busy && <div className="mt-3 text-xs text-text-secondary">Uploading...</div>}

      {images.length > 0 && (
        <div className="mt-6 grid grid-cols-4 gap-3">
          {images.map((rel) => (
            <div key={rel} className="group relative aspect-square overflow-hidden rounded-lg bg-surface">
              {thumbs[rel] ? (
                <img src={thumbs[rel]} alt="inspiration" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-text-secondary">Loading</div>
              )}
              <button
                onClick={() => remove(rel)}
                className="absolute right-1 top-1 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PageContext({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void }) {
  const [showGuided, setShowGuided] = useState(
    !!(state.problem || state.goal || state.keyFeatures || state.mustHaves || state.successMetric)
  )
  return (
    <div>
      <PageHeading title="Tell me about your project" hint="In your own words" />

      <textarea
        value={state.description ?? ''}
        onChange={(e) => set('description', e.target.value)}
        placeholder={`What are you building. Why it needs to exist. What success looks like.`}
        rows={8}
        className="w-full resize-y rounded-lg bg-surface px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
      />

      <button
        onClick={() => setShowGuided((s) => !s)}
        className="mt-5 flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary"
      >
        <span className={`inline-block transition-transform ${showGuided ? 'rotate-90' : ''}`}>▸</span>
        {showGuided ? 'Hide guided prompts' : 'Add guided prompts (optional)'}
      </button>

      {showGuided && (
        <div className="mt-3 space-y-3">
          <GuidedField
            label="The problem"
            hint="What pain or gap does this solve?"
            value={state.problem}
            onChange={(v) => set('problem', v)}
          />
          <GuidedField
            label="The goal"
            hint="What does winning look like?"
            value={state.goal}
            onChange={(v) => set('goal', v)}
          />
          <GuidedField
            label="Key features"
            hint="One per line. Don't overthink it."
            value={state.keyFeatures}
            onChange={(v) => set('keyFeatures', v)}
            rows={4}
          />
          <GuidedField
            label="Must-haves"
            hint="Constraints and deal-breakers"
            value={state.mustHaves}
            onChange={(v) => set('mustHaves', v)}
          />
          <GuidedField
            label="Success metric"
            hint="How will you know this thing is working?"
            value={state.successMetric}
            onChange={(v) => set('successMetric', v)}
          />
        </div>
      )}
    </div>
  )
}

function GuidedField({
  label, hint, value, onChange, rows = 2
}: {
  label: string
  hint: string
  value?: string
  onChange: (v: string) => void
  rows?: number
}) {
  return (
    <div className="rounded-lg bg-surface/30 p-3">
      <label className="block text-xs font-medium text-text-secondary">{label}</label>
      <div className="mb-2 text-xs text-text-secondary/80">{hint}</div>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-y rounded-md bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  )
}

function PageFinal({ state, set }: { state: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void; projectId: string }) {
  return (
    <div>
      <PageHeading title="Anything else?" hint="Constraints, deadlines, anything else" />
      <textarea
        value={state.notes ?? ''}
        onChange={(e) => set('notes', e.target.value)}
        placeholder="e.g. Must work offline. Mobile first. Avoid jQuery."
        rows={6}
        className="w-full resize-none rounded-lg bg-surface px-4 py-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
      />
      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg bg-surface/50 p-4 hover:bg-surface">
        <input
          type="checkbox"
          checked={!!state.scaffold}
          onChange={(e) => set('scaffold', e.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <div>
          <div className="text-sm font-medium text-text-primary">Generate starter files</div>
          <div className="mt-0.5 text-xs text-text-secondary">
            Ask Copilot to scaffold folder layout, tokens, README and an app shell based on this brief. It'll show you the plan first.
          </div>
        </div>
      </label>
    </div>
  )
}

function PagePreview({ state, projectId }: { state: WizardState; projectId: string }) {
  const [copied, setCopied] = useState(false)
  const [inspirationDir, setInspirationDir] = useState<string | undefined>(undefined)
  const [brandDir, setBrandDir] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancel = false
    void window.terminal42.brief.inspirationDir(projectId)
      .then((d) => { if (!cancel) setInspirationDir(typeof d === 'string' ? d : undefined) })
      .catch(() => {})
    void window.terminal42.brief.brandDir(projectId)
      .then((d) => { if (!cancel) setBrandDir(typeof d === 'string' ? d : undefined) })
      .catch(() => {})
    return () => { cancel = true }
  }, [projectId])
  const prompt = useMemo(() => {
    if (!state.type) return ''
    try {
      const { type, ...rest } = state
      return buildKickoffPrompt({
        v: 1,
        type,
        typeLabel: PROJECT_TYPES.find((t) => t.id === type)?.label ?? 'App',
        ...rest,
        createdAt: Date.now()
      } as ProjectBrief, { inspirationBaseDir: inspirationDir, brandBaseDir: brandDir })
    } catch { return '' }
  }, [state, inspirationDir, brandDir])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs text-text-secondary">
          Sent to Copilot on finish. {prompt ? `${prompt.split('\n').length} lines.` : ''}
        </div>
        {prompt && (
          <button onClick={copy} className="rounded-md bg-surface px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      <pre className="max-h-[58vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface/30 px-4 py-3 font-mono text-[11px] leading-relaxed text-text-secondary">
        {prompt || '(blank project, no prompt will be sent)'}
      </pre>
    </div>
  )
}
