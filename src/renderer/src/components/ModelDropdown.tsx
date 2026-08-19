import { useEffect, useState } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { IconChevronRight, IconRefresh } from './icons'
import { FALLBACK_MODELS, compareGroups, shortlistModels, type DisplayModel } from '../../../shared/models'

// Baseline shown before the live catalog (fetched from the Copilot CLI via
// main/models.ts) loads, and used as a safety-net fallback if that fetch is
// ever unavailable. `MODELS` itself is mutated in place once live data
// arrives — see initModelCatalog() below — so every consumer that imports
// MODELS directly (ModelDropdown, DesignChatRail, CanvasAssistant,
// StatusBar, FindAnything, SettingsView) picks up new models automatically,
// with no manual list maintenance required.

export const MODELS: DisplayModel[] = [...FALLBACK_MODELS]

const modelsListeners = new Set<() => void>()

export function onModelsChanged(cb: () => void): () => void {
  modelsListeners.add(cb)
  return () => { modelsListeners.delete(cb) }
}

function applyModelList(list: DisplayModel[]): void {
  if (!Array.isArray(list) || list.length < 3) return
  MODELS.splice(0, MODELS.length, ...list)
  for (const cb of modelsListeners) {
    try { cb() } catch {}
  }
}

let initialized = false

// Fetches the live, entitlement-filtered model list once at app start and
// subscribes to background refreshes pushed from the main process (see
// main/models.ts). Safe to call multiple times — only wires up once.
export function initModelCatalog(): void {
  if (initialized) return
  initialized = true
  const bridge = (window as unknown as { terminal42?: { models?: {
    list: () => Promise<DisplayModel[]>
    onUpdated: (cb: (models: DisplayModel[]) => void) => () => void
  } } }).terminal42
  if (!bridge?.models) return
  bridge.models.list().then(applyModelList).catch(() => {})
  bridge.models.onUpdated(applyModelList)
}

function shortLabel(label: string | undefined): string | undefined {
  if (!label) return label
  return label.replace(/^Claude\s+/i, '')
}

// Tiny provider logos for the group headers.
function AnthropicLogo(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.827 3.52h3.603L24 20.48h-3.603l-6.57-16.96zm-7.258 0H10.172L16.74 20.48H13.14L11.735 16.56H5.856L4.451 20.48H.848L6.569 3.52zm2.63 4.485L6.92 14.08h4.56L8.2 8.005z" />
    </svg>
  )
}

function OpenAILogo(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

function GoogleLogo(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c.45 6.36 5.64 11.55 12 12-6.36.45-11.55 5.64-12 12-.45-6.36-5.64-11.55-12-12C6.36 11.55 11.55 6.36 12 0z" />
    </svg>
  )
}

function MicrosoftLogo(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4zM11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24z" />
    </svg>
  )
}

function XaiLogo(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2.4 21.6L14.16 8.4l1.92 2.16-9.84 11.04H2.4zm5.28-8.64L2.4 6.96h3.84l3.36 3.84-1.92 2.16zM15.6 21.6L9.36 14.4l1.92-2.16 7.2 8.16H15.6zm.72-9.36L21.6 2.4h-3.84l-5.28 9.84 1.92 2.16-.08-2.16z" />
    </svg>
  )
}

const PROVIDER_LOGO: Record<string, () => JSX.Element> = {
  'Anthropic': AnthropicLogo,
  'OpenAI': OpenAILogo,
  'Google': GoogleLogo,
  'xAI': XaiLogo,
  'Microsoft': MicrosoftLogo,
}

export function ProviderLogo({ provider }: { provider: string }): JSX.Element | null {
  const Logo = PROVIDER_LOGO[provider]
  return Logo ? <Logo /> : null
}

export function ModelDropdown({
  value,
  pending,
  onPick,
  onRestart,
  pendingRestart
}: {
  value: string | null
  pending: boolean
  onPick: (id: string) => void
  onRestart?: () => void
  pendingRestart?: boolean
}) {
  const current = MODELS.find((m) => m.id === value)
  const [open, setOpen] = useState(false)
  // The full entitlement list runs past twenty entries, most of them older
  // revisions of a model already shown. Default to the current few per
  // provider and let the rest be revealed on request.
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? MODELS : shortlistModels(MODELS, 3, value)
  const hiddenCount = MODELS.length - visible.length
  const groups = Array.from(new Set(visible.map((m) => m.group))).sort(compareGroups)

  return (
    <Dropdown.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Reopening should start from the short list again rather than
        // remembering a one-off look at everything.
        if (!next) setShowAll(false)
      }}
    >
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="flex h-7 max-w-[140px] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px] text-text-secondary hover:bg-surface hover:text-text-primary outline-none focus:outline-none data-[state=open]:bg-elevated data-[state=open]:text-text-primary"
          title={current?.label ?? 'Model'}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden="true" />
          <span className="truncate">
            {pendingRestart ? 'Restarting…' : pending ? 'Saving…' : shortLabel(current?.label) ?? 'Model'}
          </span>
          <IconChevronRight size={9} className="shrink-0 rotate-90 text-text-muted" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[220px] rounded-lg bg-raised p-1 text-[12px] text-text-primary shadow-overlay"
        >
          {groups.map((g) => (
            <div key={g}>
              <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-[11px] text-text-muted">
                <ProviderLogo provider={g} />
                <span>{g}</span>
              </div>
              {visible.filter((m) => m.group === g).map((m) => (
                <Dropdown.Item
                  key={m.id}
                  onSelect={() => onPick(m.id)}
                  className={[
                    'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none',
                    m.id === value ? 'bg-surface font-medium' : 'hover:bg-surface'
                  ].join(' ')}
                >
                  <span className="w-3 shrink-0 text-text-secondary">{m.id === value ? '✓' : ''}</span>
                  <span>{m.label}</span>
                </Dropdown.Item>
              ))}
            </div>
          ))}
          {hiddenCount > 0 && (
            <Dropdown.Item
              // Radix menus use roving focus across items, so this has to be
              // an Item to be arrow-key reachable. preventDefault stops the
              // menu closing on what is really an in-place expand.
              onSelect={(e) => {
                e.preventDefault()
                setShowAll(true)
              }}
              className="mt-1 flex cursor-pointer items-center rounded-md px-2 py-1.5 text-[11px] text-text-muted outline-none transition-colors hover:bg-surface hover:text-text-secondary data-[highlighted]:bg-surface data-[highlighted]:text-text-secondary"
            >
              Show {hiddenCount} older {hiddenCount === 1 ? 'model' : 'models'}
            </Dropdown.Item>
          )}
          {onRestart && (
            <>
              <div className="my-1.5" />
              <Dropdown.Item
                onSelect={() => onRestart()}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none hover:bg-surface"
              >
                <IconRefresh size={12} className="text-text-secondary" />
                <span>Restart session</span>
              </Dropdown.Item>
            </>
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

export function useSessionModel(sessionId: string | null, defaultModel: string) {
  const [model, setModel] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [pendingRestart, setPendingRestart] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setModel(null)
      return
    }
    void window.terminal42.sessions.get(sessionId).then((s) => {
      setModel(s?.model ?? defaultModel)
    })
  }, [sessionId, defaultModel])

  const pick = async (id: string) => {
    if (!sessionId) return
    setPending(true)
    setModel(id)
    await window.terminal42.sessions.setModel(sessionId, id)
    setTimeout(() => setPending(false), 600)
  }

  const restart = async () => {
    if (!sessionId) return
    setPendingRestart(true)
    window.dispatchEvent(new CustomEvent('t42:restart-session', { detail: { id: sessionId } }))
    setTimeout(() => setPendingRestart(false), 1500)
  }

  return { model, pending, pick, restart, pendingRestart }
}
