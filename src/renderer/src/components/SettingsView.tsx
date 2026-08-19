import { useEffect, useState, type ReactNode } from 'react'
import type { Settings } from '../../../preload/index'
import { MODELS, onModelsChanged } from './ModelDropdown'
import { IconExternal } from './icons'

type SectionId =
  | 'general'
  | 'appearance'
  | 'terminal'
  | 'configuration'
  | 'notifications'
  | 'mcp'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'mcp', label: 'MCP servers' }
]

export function SettingsView({ theme, onToggleTheme }: { theme: 'dark' | 'light'; onToggleTheme: () => void }) {
  const [s, setS] = useState<Settings | null>(null)
  const [section, setSection] = useState<SectionId>(() => {
    const saved = localStorage.getItem('terminal42:settings:section') as SectionId | null
    return saved && SECTIONS.some((x) => x.id === saved) ? saved : 'general'
  })

  useEffect(() => {
    void window.terminal42.settings.get().then(setS)
  }, [])
  useEffect(() => {
    localStorage.setItem('terminal42:settings:section', section)
  }, [section])

  const update = async <K extends keyof Settings>(k: K, v: Settings[K]): Promise<void> => {
    if (!s) return
    setS({ ...s, [k]: v })
    const next = await window.terminal42.settings.set(k, v)
    setS(next)
    window.dispatchEvent(new CustomEvent('t42:settings-changed', { detail: next }))
  }

  return (
    <main className="flex flex-1 overflow-hidden bg-bg">
      <aside className="flex w-[220px] shrink-0 flex-col gap-0.5 px-3 py-4">
        <div className="px-2.5 pb-2 pt-1 text-[18px] font-semibold leading-tight text-text-primary">Settings</div>
        {SECTIONS.map((x) => {
          const active = section === x.id
          return (
            <button
              key={x.id}
              type="button"
              onClick={() => setSection(x.id)}
              className={[
                'w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors',
                active ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:bg-elevated/40 hover:text-text-primary'
              ].join(' ')}
            >
              {x.label}
            </button>
          )
        })}
      </aside>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6">
          {!s ? (
            <div className="text-[12px] text-text-muted">Loading…</div>
          ) : (
            <>
              {section === 'general' && <GeneralPane s={s} update={update} />}
              {section === 'appearance' && (
                <AppearancePane s={s} update={update} theme={theme} onToggleTheme={onToggleTheme} />
              )}
              {section === 'terminal' && <TerminalSettingsPane s={s} update={update} />}
              {section === 'configuration' && <ConfigurationPane s={s} update={update} />}
              {section === 'notifications' && <NotificationsPane s={s} update={update} />}
              {section === 'mcp' && <McpPane />}
            </>
          )}
        </div>
      </div>
    </main>
  )
}

function GeneralPane({ s, update }: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  // Force a re-render when the live model catalog refreshes in the
  // background so this list reflects new models without needing a reopen.
  const [, bump] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => onModelsChanged(() => bump((n) => n + 1)), [])
  return (
    <>
      <Heading title="General" />
      <Group>
        <Row label="Default model">
          <div className="flex items-center gap-2">
            <select
              value={s.defaultModel}
              onChange={(e) => update('defaultModel', e.target.value)}
              className="rounded-md bg-elevated px-2.5 py-1 text-[12px]"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true)
                window.terminal42.models
                  .refresh()
                  .catch(() => {})
                  .finally(() => setRefreshing(false))
              }}
              className="rounded-md px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-50"
              title="Fetch the latest model list from Copilot"
            >
              {refreshing ? 'Refreshing…' : 'Refresh models'}
            </button>
          </div>
        </Row>
        <Row label="Send Brain at session start">
          <Toggle checked={s.brainAutoApply} onChange={(v) => update('brainAutoApply', v)} />
        </Row>
        <Row label="Default Figma file">
          <input
            type="text"
            value={s.defaultFigmaFile}
            onChange={(e) => update('defaultFigmaFile', e.target.value)}
            placeholder="https://www.figma.com/design/ABC…/MyLibrary"
            spellCheck={false}
            className="w-[320px] rounded-md bg-elevated px-2.5 py-1 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
        </Row>
      </Group>
    </>
  )
}

function AppearancePane({
  s, update, theme, onToggleTheme
}: {
  s: Settings
  update: <K extends keyof Settings>(k: K, v: Settings[K]) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}) {
  return (
    <>
      <Heading title="Appearance" />
      <Group>
        <Row label="Theme">
          <div className="flex items-center gap-1 rounded-md bg-elevated p-0.5 text-[12px]">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { if (theme !== t) onToggleTheme() }}
                className={[
                  'rounded px-2.5 py-1 capitalize',
                  theme === t ? 'bg-bg text-text-primary' : 'text-text-secondary hover:text-text-primary'
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Accent color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={s.accentColor}
              onChange={(e) => update('accentColor', e.target.value)}
              aria-label="Accent color"
              className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <span className="font-mono text-[11.5px] text-text-muted">{s.accentColor}</span>
          </div>
        </Row>
        <Row label="Translucent sidebar">
          <Toggle checked={s.translucentSidebar} onChange={(v) => update('translucentSidebar', v)} />
        </Row>
      </Group>
    </>
  )
}

const FONT_OPTIONS = [
  'JetBrains Mono',
  'SF Mono',
  'Menlo',
  'Fira Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Cascadia Code',
  'Consolas',
]

function TerminalSettingsPane({
  s, update
}: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  return (
    <>
      <Heading title="Terminal" />
      <Group>
        <Row label="Font family">
          <select
            value={s.terminalFontFamily}
            onChange={(e) => update('terminalFontFamily', e.target.value)}
            className="rounded-md bg-elevated px-2.5 py-1.5 text-[12.5px] text-text-primary outline-none"
          >
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Row>
        <Row label="Font size">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={24}
              step={1}
              value={s.terminalFontSize}
              onChange={(e) => update('terminalFontSize', Number(e.target.value))}
              className="t42-range w-24"
            />
            <span className="w-8 text-center font-mono text-[12px] text-text-primary">{s.terminalFontSize}</span>
          </div>
        </Row>
        <Row label="Line height">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1.0}
              max={2.0}
              step={0.05}
              value={s.terminalLineHeight}
              onChange={(e) => update('terminalLineHeight', Number(e.target.value))}
              className="t42-range w-24"
            />
            <span className="w-8 text-center font-mono text-[12px] text-text-primary">{s.terminalLineHeight.toFixed(2)}</span>
          </div>
        </Row>
        <Row label="Cursor style">
          <div className="flex items-center gap-1 rounded-md bg-elevated p-0.5 text-[12px]">
            {(['bar', 'block', 'underline'] as const).map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => update('terminalCursorStyle', style)}
                className={[
                  'rounded px-2.5 py-1 capitalize',
                  s.terminalCursorStyle === style ? 'bg-bg text-text-primary' : 'text-text-secondary hover:text-text-primary'
                ].join(' ')}
              >
                {style}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Cursor blink">
          <Toggle checked={s.terminalCursorBlink} onChange={(v) => update('terminalCursorBlink', v)} />
        </Row>
        <Row label="Copy on select">
          <Toggle checked={s.terminalCopyOnSelect} onChange={(v) => update('terminalCopyOnSelect', v)} />
        </Row>
      </Group>
    </>
  )
}

function ConfigurationPane({
  s, update
}: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const openToml = async (): Promise<void> => { await window.terminal42.settings.openConfigToml() }
  return (
    <>
      <Heading title="Configuration" />
      <Group>
        <Row label="Approval policy">
          <select
            value={s.approvalPolicy}
            onChange={(e) => update('approvalPolicy', e.target.value as Settings['approvalPolicy'])}
            className="rounded-md bg-elevated px-2.5 py-1 text-[12px]"
          >
            <option value="on-request">On request</option>
            <option value="suggest">Suggest</option>
            <option value="auto-edit">Auto-edit</option>
            <option value="full-auto">Full auto</option>
          </select>
        </Row>
        <Row label="Sandbox mode">
          <select
            value={s.sandboxMode}
            onChange={(e) => update('sandboxMode', e.target.value as Settings['sandboxMode'])}
            className="rounded-md bg-elevated px-2.5 py-1 text-[12px]"
          >
            <option value="read-only">Read only</option>
            <option value="workspace-write">Workspace write</option>
            <option value="danger">Danger</option>
          </select>
        </Row>
        <Row label="Copilot config file">
          <button
            type="button"
            onClick={() => void openToml()}
            className="flex items-center gap-1.5 rounded-md bg-elevated px-2.5 py-1 text-[12px] text-text-secondary hover:bg-elevated/80 hover:text-text-primary"
          >
            <IconExternal size={11} /> Open config.toml
          </button>
        </Row>
      </Group>
    </>
  )
}

function NotificationsPane({
  s, update
}: { s: Settings; update: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  return (
    <>
      <Heading title="Notifications" />
      <Group>
        <Row label="Notifications on">
          <Toggle checked={s.notificationsEnabled} onChange={(v) => update('notificationsEnabled', v)} />
        </Row>
        <Row label="Turn completion notifications">
          <select
            value={s.completionNotifyMode}
            onChange={(e) => update('completionNotifyMode', e.target.value as Settings['completionNotifyMode'])}
            className="rounded-md bg-elevated px-2.5 py-1 text-[12px]"
          >
            <option value="always">Always</option>
            <option value="unfocused">Only when unfocused</option>
            <option value="off">Off</option>
          </select>
        </Row>
        <Row label="Permission notifications">
          <Toggle checked={s.permissionNotifications} onChange={(v) => update('permissionNotifications', v)} />
        </Row>
        <Row label="Question notifications">
          <Toggle checked={s.questionNotifications} onChange={(v) => update('questionNotifications', v)} />
        </Row>
      </Group>
      <Group>
        <Row label="Notify after">
          <NumberInput
            value={s.notifyAfterSeconds}
            min={5}
            max={600}
            suffix="s"
            onChange={(v) => update('notifyAfterSeconds', v)}
          />
        </Row>
        <Row label="Quiet between notifications">
          <NumberInput
            value={s.notifyCooldownSeconds}
            min={30}
            max={3600}
            suffix="s"
            onChange={(v) => update('notifyCooldownSeconds', v)}
          />
        </Row>
      </Group>
    </>
  )
}

function McpPane() {
  const openToml = async (): Promise<void> => { await window.terminal42.settings.openConfigToml() }
  return (
    <>
      <Heading title="MCP servers" />
      <Group>
        <Row label="Configure servers">
          <button
            type="button"
            onClick={() => void openToml()}
            className="flex items-center gap-1.5 rounded-md bg-elevated px-2.5 py-1 text-[12px] text-text-secondary hover:bg-elevated/80 hover:text-text-primary"
          >
            <IconExternal size={11} /> Open config.toml
          </button>
        </Row>
      </Group>
    </>
  )
}

function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-[16px] font-semibold leading-tight text-text-primary">{title}</h2>
      {hint && <p className="text-[12px] text-text-muted">{hint}</p>}
    </div>
  )
}

function Group({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col rounded-xl bg-elevated/40">
      {children}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3 [&:not(:last-child)]: [&:not(:last-child)]:">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-text-primary">{label}</div>
        {hint && <div className="text-[11.5px] text-text-muted">{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-elevated'
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        ].join(' ')}
      />
    </button>
  )
}

function NumberInput({
  value, min, max, suffix, onChange
}: { value: number; min?: number; max?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-elevated px-2 py-1">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-16 border-0 bg-transparent text-right text-[12px] focus:outline-none"
      />
      {suffix && <span className="text-[11px] text-text-muted">{suffix}</span>}
    </div>
  )
}
