import { useEffect, useRef, useState } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap, deriveOptions } from 'markmap-view'
import type { Project } from '../../../preload/index'
import { IconFolder, IconPlus } from './icons'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal'

const transformer = new Transformer()

type ViewMode = 'split' | 'editor' | 'mindmap'

type InsightsState = {
  cadence: 'off' | 'daily' | '3d' | 'weekly'
  lastRunAt: number
  lastStatus: 'idle' | 'running' | 'ok' | 'error'
  lastSummary: string
  lastError: string
}

export function BrainView({
  activeProject,
  activeSessionId,
  onJumpToTerminal
}: {
  activeProject: Project | null
  activeSessionId: string | null
  onJumpToTerminal?: () => void
}) {
  void activeProject; void activeSessionId; void onJumpToTerminal
  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-bg">
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-5">
          <h1 className="text-[18px] font-semibold leading-tight text-text-primary">Brain</h1>
          <PersonaPicker />
        </div>
      </header>
      <BrainNotes />
    </main>
  )
}

type Persona = { id: string; label: string; description: string; builtIn: boolean }

function PersonaPicker() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [active, setActive] = useState<string>('me')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let mounted = true
    void window.terminal42.personas.list().then((p) => mounted && setPersonas(p))
    void window.terminal42.personas.active().then((a) => mounted && setActive(a))
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-persona-picker]')) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const switchTo = async (id: string) => {
    if (id === active || busy) { setOpen(false); return }
    setBusy(true)
    try {
      const r = await window.terminal42.personas.setActive(id)
      if (r?.ok) setActive(id)
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  const current = personas.find((p) => p.id === active)
  const label = current?.label ?? 'Me'

  return (
    <div className="relative" data-persona-picker>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md bg-surface px-2.5 py-1 text-[12px] text-text-secondary hover:bg-elevated"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        <span className="text-text-primary">{label}</span>
        <span className="text-text-muted">▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+4px)] z-20 w-[260px] overflow-hidden rounded-md bg-surface shadow-md"
        >
          {personas.map((p) => (
            <button
              key={p.id}
              type="button"
              role="option"
              aria-selected={p.id === active}
              onClick={() => void switchTo(p.id)}
              disabled={busy}
              className={[
                'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors',
                p.id === active ? 'bg-elevated' : 'hover:bg-elevated'
              ].join(' ')}
            >
              <span className="flex w-full items-center justify-between gap-2 text-[12.5px] text-text-primary">
                <span className="font-medium">{p.label}</span>
                {p.id === active && <span className="text-[10px] text-accent">active</span>}
              </span>
              <span className="text-[11px] leading-snug text-text-muted">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BrainNotes() {
  const [body, setBody] = useState<string>('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [view, setView] = useState<ViewMode>('split')
  const [path, setPath] = useState<string>('')
  const [editorDirty, setEditorDirty] = useState(false)
  const [, setInsights] = useState<InsightsState | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const mmRef = useRef<Markmap | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorDirtyRef = useRef(false)

  useEffect(() => { editorDirtyRef.current = editorDirty }, [editorDirty])

  useEffect(() => {
    let mounted = true
    void window.terminal42.memory.read().then((b) => {
      if (!mounted) return
      setBody(b)
      setBodyLoaded(true)
    })
    void window.terminal42.memory.path().then((p) => mounted && setPath(p))
    void window.terminal42.insights.state().then((s) => mounted && setInsights(s as InsightsState))

    const reload = () => {
      if (editorDirtyRef.current) return
      void window.terminal42.memory.read().then((b) => {
        if (mounted) setBody(b)
      })
    }
    const offIpc = window.terminal42.memory.onChanged(reload)
    const offState = window.terminal42.insights.onState((s) => mounted && setInsights(s as InsightsState))
    const onCustom = () => reload()
    window.addEventListener('t42:memory-changed', onCustom)
    return () => {
      mounted = false
      offIpc()
      offState()
      window.removeEventListener('t42:memory-changed', onCustom)
    }
  }, [])

  useEffect(() => {
    if (!svgRef.current) return
    if (view === 'editor') return
    try {
      const md = body && body.trim() ? body : '# My Brain\n\n- Empty for now'
      const { root, frontmatter } = transformer.transform(md)
      const opts = deriveOptions({ ...(frontmatter as Record<string, unknown>) })
      if (!mmRef.current) {
        mmRef.current = Markmap.create(svgRef.current, {
          ...opts,
          duration: 250,
          maxWidth: 320,
          spacingHorizontal: 90,
          spacingVertical: 18,
          paddingX: 14,
          autoFit: true,
          embedGlobalCSS: true,
          fitRatio: 0.92
        }, root)
      } else {
        mmRef.current.setData(root)
        void mmRef.current.fit()
      }
    } catch (err) {
      console.warn('mindmap render failed', err)
    }
  }, [body, view])

  useEffect(() => {
    if (view === 'editor' && mmRef.current) {
      try { mmRef.current.destroy() } catch {}
      mmRef.current = null
    }
  }, [view])

  const onChange = (next: string) => {
    setBody(next)
    setEditorDirty(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void window.terminal42.memory.write(next).then(() => {
        setSavedAt(Date.now())
        setEditorDirty(false)
      })
    }, 400)
  }

  const reveal = () => { void window.terminal42.memory.reveal() }
  const refit = () => { void mmRef.current?.fit() }

  const insertHeading = () => {
    const next = (body.trimEnd() + '\n\n## New section\n- ').replace(/\n{3,}/g, '\n\n')
    onChange(next)
  }


  const ago = savedAt ? `Saved ${formatRel(savedAt)}` : 'Auto-saves as you type'
  const stats = computeStats(body)
  void ago

  const [onboarding, setOnboarding] = useState(false)
  const [bodyLoaded, setBodyLoaded] = useState(false)
  const [skipped, setSkipped] = useState<boolean>(() =>
    typeof window !== 'undefined' && localStorage.getItem('t42:brain:onboarded') === 'skip'
  )
  const isEmpty = bodyLoaded && body.trim().replace(/^#+\s.*$/m, '').trim().length === 0

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-bg">
      {onboarding && (
        <BrainOnboarding
          onClose={() => setOnboarding(false)}
          onFinish={(md) => {
            onChange(md)
            localStorage.setItem('t42:brain:onboarded', 'done')
            setOnboarding(false)
          }}
        />
      )}
      {isEmpty && !onboarding && !skipped && (
        <div className="mx-6 mt-3 flex items-center justify-between gap-4 rounded-lg bg-elevated/40 px-4 py-3 text-[12.5px]">
          <div className="flex flex-col gap-0.5">
            <div className="font-medium text-text-primary">Your Brain is empty</div>
            <div className="text-text-muted">Answer a few quick questions and Terminal42 will draft your first mind map.</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { localStorage.setItem('t42:brain:onboarded', 'skip'); setSkipped(true) }}
              className="rounded-md px-2.5 py-1 text-text-secondary hover:bg-elevated hover:text-text-primary"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => setOnboarding(true)}
              className="rounded-md bg-action px-2.5 py-1 font-medium text-action-text hover:opacity-90"
            >
              Start interview
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-end gap-1 px-6 py-2">
        <ViewToggle view={view} onChange={setView} />
        <button
          type="button"
          onClick={insertHeading}
          className="ml-1 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          <IconPlus size={12} /> Section
        </button>
        <button
          type="button"
          onClick={reveal}
          aria-label="Open in Finder"
          title={path}
          className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          <IconFolder size={13} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {(view === 'split' || view === 'editor') && (
          <div className={view === 'editor' ? 'flex flex-1 flex-col' : 'flex w-1/2 min-w-0 flex-col'}>
            <textarea
              value={body}
              onChange={(e) => onChange(e.target.value)}
              spellCheck={false}
              aria-label="Brain markdown editor"
              className="flex-1 resize-none bg-bg p-5 font-mono text-[14px] leading-relaxed text-text-primary focus:outline-none"
              style={{ userSelect: 'text' }}
              placeholder="# Start writing your brain…"
            />
          </div>
        )}
        {(view === 'split' || view === 'mindmap') && (
          <div className={view === 'mindmap' ? 'flex flex-1 flex-col' : 'flex w-1/2 min-w-0 flex-col'}>
            <div className="t42-mindmap relative flex-1 overflow-hidden bg-surface">
              <svg
                ref={svgRef}
                role="img"
                aria-label="Mindmap of your Brain markdown file"
                className="h-full w-full"
                onDoubleClick={refit}
              />
              {stats.headings + stats.bullets === 0 && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-text-muted">
                  Add headings (## Title) and bullets (- item) to grow the map.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { id: ViewMode; label: string }[] = [
    { id: 'editor', label: 'Editor' },
    { id: 'split', label: 'Split' },
    { id: 'mindmap', label: 'Mindmap' }
  ]
  return (
    <div role="tablist" aria-label="Brain view" className="flex overflow-hidden rounded-md ">
      {opts.map((o) => (
        <button
          key={o.id}
          role="tab"
          type="button"
          aria-selected={view === o.id}
          onClick={() => onChange(o.id)}
          className={
            'px-3 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
            (view === o.id
              ? 'bg-elevated font-medium text-text-primary'
              : 'text-text-secondary hover:bg-elevated hover:text-text-primary')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function computeStats(md: string): { headings: number; bullets: number } {
  let headings = 0
  let bullets = 0
  for (const line of md.split('\n')) {
    if (/^#{1,6}\s/.test(line)) headings++
    else if (/^\s*[-*]\s+\S/.test(line)) bullets++
  }
  return { headings, bullets }
}

function formatRel(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 5000) return 'just now'
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`
  return new Date(ts).toLocaleTimeString()
}

// ─── Onboarding interview ────────────────────────────────────────────

type ChipQ = {
  kind: 'chips'
  id: string
  q: string
  hint?: string
  options: { id: string; label: string }[]
  multi: boolean
}
type TextQ = { kind: 'text'; id: string; q: string; hint?: string; placeholder?: string }
type Question = ChipQ | TextQ

const ONBOARD_QUESTIONS: Question[] = [
  {
    kind: 'chips',
    id: 'roles',
    q: 'What do you spend most of your time doing?',
    hint: 'Pick all that apply.',
    multi: true,
    options: [
      { id: 'ux-design', label: 'UX design' },
      { id: 'ux-research', label: 'UX research' },
      { id: 'frontend', label: 'Frontend code' },
      { id: 'backend', label: 'Backend code' },
      { id: 'product', label: 'Product / PM' },
      { id: 'writing', label: 'Writing & docs' },
      { id: 'data', label: 'Data & analysis' }
    ]
  },
  {
    kind: 'chips',
    id: 'code-values',
    q: 'When Copilot writes code for you, what matters most?',
    multi: true,
    options: [
      { id: 'small-functions', label: 'Small focused functions' },
      { id: 'tests-first', label: 'Tests before implementation' },
      { id: 'no-any', label: 'No `any` in TypeScript' },
      { id: 'comments', label: 'Comments only when needed' },
      { id: 'show-plan', label: 'Show me the plan first' },
      { id: 'one-change', label: 'One change at a time' }
    ]
  },
  {
    kind: 'chips',
    id: 'design-values',
    q: 'When you work on UI or design, what should it always do?',
    multi: true,
    options: [
      { id: 'no-gradients', label: 'No gradients' },
      { id: 'one-accent', label: 'One accent color' },
      { id: 'sentence-case', label: 'Sentence case headings' },
      { id: 'subtle-shadows', label: 'Subtle shadows only' },
      { id: 'no-emoji', label: 'No emoji in UI' },
      { id: 'wcag-aa', label: 'WCAG AA contrast' },
      { id: 'focus-rings', label: 'Visible focus rings' }
    ]
  },
  {
    kind: 'chips',
    id: 'reply-style',
    q: 'How do you want Copilot to talk to you?',
    multi: false,
    options: [
      { id: 'concise', label: 'Concise: short, direct' },
      { id: 'explained', label: 'Explained: show your reasoning' },
      { id: 'conversational', label: 'Conversational: discuss tradeoffs' }
    ]
  },
  {
    kind: 'text',
    id: 'stack',
    q: 'Anything specific about your stack or tools?',
    hint: 'Languages, frameworks, libraries, hosting: whatever you reach for. Skip if unsure.',
    placeholder: 'e.g. TypeScript, React, Tailwind, Postgres, Vercel'
  },
  {
    kind: 'text',
    id: 'avoid',
    q: 'Anything you want Copilot to avoid?',
    hint: 'Words, patterns, libraries, AI clichés.',
    placeholder: 'e.g. emoji, em-dashes, "leverage", lodash, jQuery'
  }
]

type Answer = string[] | string
type Answers = Record<string, Answer>

function buildBrainMarkdown(a: Answers): string {
  const lines: string[] = []
  lines.push('# My Brain')
  lines.push('')

  const roles = (a.roles as string[]) || []
  if (roles.length) {
    lines.push('## What I work on')
    for (const r of roles) {
      const label = ONBOARD_QUESTIONS[0].kind === 'chips'
        ? ONBOARD_QUESTIONS[0].options.find((o) => o.id === r)?.label || r
        : r
      lines.push(`- ${label}`)
    }
    lines.push('')
  }

  const code = (a['code-values'] as string[]) || []
  if (code.length) {
    lines.push('## Code')
    const codeOpts = (ONBOARD_QUESTIONS[1] as ChipQ).options
    for (const id of code) {
      const label = codeOpts.find((o) => o.id === id)?.label || id
      lines.push(`- ${label}`)
    }
    lines.push('')
  }

  const design = (a['design-values'] as string[]) || []
  if (design.length) {
    lines.push('## Design & UI')
    const designOpts = (ONBOARD_QUESTIONS[2] as ChipQ).options
    for (const id of design) {
      const label = designOpts.find((o) => o.id === id)?.label || id
      lines.push(`- ${label}`)
    }
    lines.push('')
  }

  const reply = a['reply-style'] as string
  if (reply) {
    const replyOpts = (ONBOARD_QUESTIONS[3] as ChipQ).options
    const label = replyOpts.find((o) => o.id === reply)?.label || reply
    lines.push('## How I want replies')
    lines.push(`- ${label}`)
    lines.push('')
  }

  const stack = (a.stack as string)?.trim()
  if (stack) {
    lines.push('## My stack')
    for (const item of stack.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  const avoid = (a.avoid as string)?.trim()
  if (avoid) {
    lines.push('## Avoid')
    for (const item of avoid.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean)) {
      lines.push(`- ${item}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim() + '\n'
}

function BrainOnboarding({
  onClose,
  onFinish
}: {
  onClose: () => void
  onFinish: (markdown: string) => void
}) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const total = ONBOARD_QUESTIONS.length
  const isReview = step === total
  const q = !isReview ? ONBOARD_QUESTIONS[step] : null
  const preview = buildBrainMarkdown(answers)

  const setAns = (id: string, v: Answer): void => setAnswers((prev) => ({ ...prev, [id]: v }))
  const next = (): void => setStep((s) => Math.min(total, s + 1))
  const prev = (): void => setStep((s) => Math.max(0, s - 1))

  return (
    <Modal title="Set up your Brain" onClose={onClose} size="medium" closeOnBackdrop={false}>
      <ModalHeader
        title="Set up your Brain"
        note={isReview ? 'Review' : `Step ${step + 1} of ${total}`}
        right={
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
          >
            ×
          </button>
        }
      />

      <div className="h-1 w-full bg-elevated">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${((isReview ? total : step) / total) * 100}%` }}
        />
      </div>

      <ModalBody>
        <div className="flex flex-col gap-4">
          {q?.kind === 'chips' && (
            <ChipQuestion
              q={q}
              selected={(answers[q.id] as string[]) || []}
              onChange={(ids) => setAns(q.id, ids)}
            />
          )}
          {q?.kind === 'text' && (
            <TextQuestion
              q={q}
              value={(answers[q.id] as string) || ''}
              onChange={(v) => setAns(q.id, v)}
            />
          )}
          {isReview && (
            <div className="flex flex-col gap-2">
              <div className="text-[14px] font-medium text-text-primary">Here's your starting Brain</div>
              <div className="text-[12px] text-text-muted">You can edit anything later: this is just the seed.</div>
              <pre className="max-h-[320px] overflow-auto rounded-md bg-bg p-3 font-mono text-[12px] leading-relaxed text-text-primary">{preview}</pre>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter
        left={
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="rounded-md px-2.5 py-1 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40"
          >
            Back
          </button>
        }
      >
          {!isReview && (
            <button
              type="button"
              onClick={next}
              className="rounded-md px-2.5 py-1 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary"
            >
              Skip
            </button>
          )}
          {!isReview ? (
            <button
              type="button"
              onClick={next}
              className="rounded-md bg-action px-3 py-1 text-[12px] font-medium text-action-text hover:opacity-90"
            >
              {step === total - 1 ? 'Review' : 'Next'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onFinish(preview)}
              className="rounded-md bg-action px-3 py-1 text-[12px] font-medium text-action-text hover:opacity-90"
            >
              Save to Brain
            </button>
          )}
      </ModalFooter>
    </Modal>
  )
}

function ChipQuestion({
  q, selected, onChange
}: {
  q: ChipQ
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string): void => {
    if (q.multi) {
      onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
    } else {
      onChange([id])
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[15px] font-medium text-text-primary">{q.q}</div>
        {q.hint && <div className="mt-0.5 text-[12px] text-text-muted">{q.hint}</div>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {q.options.map((o) => {
          const on = selected.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              aria-pressed={on}
              className={[
                'rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                on
                  ? 'border-accent bg-action text-action-text'
                  : 'bg-bg text-text-secondary hover: hover:text-text-primary'
              ].join(' ')}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TextQuestion({
  q, value, onChange
}: {
  q: TextQ
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[15px] font-medium text-text-primary">{q.q}</div>
        {q.hint && <div className="mt-0.5 text-[12px] text-text-muted">{q.hint}</div>}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={q.placeholder}
        rows={3}
        className="resize-none rounded-md bg-bg p-2.5 text-[13px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
      />
    </div>
  )
}
