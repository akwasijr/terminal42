import React, { useMemo, useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter, ModalSteps } from '../Modal'
import { GroupPictogram } from './GroupPictogram'
import { buildReport, reportSummary, applyPrompt, type ReportSection } from '../../../../shared/guidelineReport'
import { formatTokensForPrompt } from '../../../../shared/tokens/export'
import { useTokenLibraries, type TokenLibrary } from '../../lib/tokens/useTokenLibraries'
import { TokenGlyph } from '../tokens/TokenLibraryModal'
import { DesignSystemWizard } from '../DesignSystemWizard'
import { loadSystems, type DesignSystem } from '../../lib/designSystem'
import { studioFromDesignSystem } from '../../lib/tokens/fromDesignSystem'
import type { GuidelineFinding } from '../../../../preload/index'
import { IconCheck, IconClose, IconFolder } from '../icons'

// Checking a project against the design guidelines, and holding it to yours.
//
// The point of this is generated work that came out off-brand: it looks
// plausible, it uses colours nobody chose and sizes off no scale, and there
// is no way to say "put it back onto ours". So it runs in three moves.
//
//   1. The project. A folder, or a public repository.
//   2. What to hold it to. A token library, a design system, both, or values
//      set here and now. Optional, and the guidelines apply either way.
//   3. The report, which is the list of what to change.
//
// The standard used to sit on the first screen, beside the folder picker,
// which asked you to choose the ruler before you had shown it the thing
// being measured -- and made a two-thing screen out of a one-thing question.
// It comes second now, and only once there is something to hold.

type Step = 'project' | 'standard' | 'report'
const STEP_ORDER: Step[] = ['project', 'standard', 'report']

type Stage =
  | { at: 'intake' }
  | { at: 'running'; what: string }
  | { at: 'read'; id: string; name: string; fileCount: number; entry: string | null; findings: GuidelineFinding[] }
  | { at: 'failed'; error: string }

/**
 * What the project is being held to.
 *
 * Every part optional and none exclusive: a library can carry the colours
 * while a system carries the shapes, and asking for both themes at once is
 * the only way to catch a page that is right in Light and unreadable in Dark.
 */
type Standard = {
  libraryId: string | null
  /** One or both. Empty means the library's own active theme. */
  themeIds: string[]
  systemId: string | null
}

const NO_STANDARD: Standard = { libraryId: null, themeIds: [], systemId: null }

/**
 * What a system says it covers, for the prompt.
 *
 * A design system is not only values. It says which components it documents,
 * which patterns it has agreed, and what its own guidelines ask for, and none
 * of that reached the run: a project was held to the colours of a system and
 * to none of its decisions. Empty rows are left out, because a system that
 * claims a pattern nobody designed is worse than one that claims nothing.
 */
function coversOf(system: DesignSystem | null): string | undefined {
  if (!system) return undefined
  const lines: string[] = []
  const components = (system.components ?? []).map((c) => c.id)
  const patterns = (system.patterns ?? []).map((p) => p.name)
  const layouts = (system.layouts ?? []).map((l) => l.name)
  if (components.length) lines.push(`Components it documents: ${components.join(', ')}.`)
  if (patterns.length) lines.push(`Patterns it has agreed: ${patterns.join(', ')}.`)
  if (layouts.length) lines.push(`Layouts it has agreed: ${layouts.join(', ')}.`)
  const g = system.guidelines
  if (g) {
    for (const [label, value] of [
      ['Component usage', g.componentUsage],
      ['Accessibility', g.accessibility],
      ['Content', g.content],
      ['Interaction', g.interaction],
      ['Responsive', g.responsive]
    ] as const) {
      if (value && value.trim()) lines.push(`${label}: ${value.trim()}`)
    }
    for (const d of g.dos ?? []) lines.push(`Do: ${d}`)
    for (const d of g.donts ?? []) lines.push(`Do not: ${d}`)
  }
  return lines.length ? lines.join('\n') : undefined
}

export function GuidelineCheckModal({
  onClose,
  onApply
}: {
  onClose: () => void
  /** Hand the accepted fixes, and the page they apply to, to the canvas. */
  onApply: (a: {
    checkId: string
    name: string
    /** Built once the source is in place, since what to ask for depends on it. */
    prompt: (source: { shell?: boolean; files?: string[] }) => string
  }) => void
}): React.JSX.Element {
  const [step, setStep] = useState<Step>('project')
  const [stage, setStage] = useState<Stage>({ at: 'intake' })
  const [link, setLink] = useState('')
  // Everything is accepted until it is turned off: the report is a list of
  // things the guidelines already say, so agreeing with all of it is the
  // ordinary case and unticking is the decision worth making.
  const [declined, setDeclined] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  // A standard chosen here overrides the project's own values, so the second
  // run does not merely tidy what is there but moves it onto the scale the
  // rest of the work already uses.
  const [standard, setStandard] = useState<Standard>(NO_STANDARD)
  const [wizardOpen, setWizardOpen] = useState(false)
  const { libraries } = useTokenLibraries()
  // Read once. The list cannot change while this dialog is open, and re-reading
  // it on every keystroke would rebuild every row underneath the pointer.
  const [systems, setSystems] = useState<DesignSystem[]>(() => loadSystems())

  const library = standard.libraryId
    ? libraries.find((l) => l.id === standard.libraryId) ?? null
    : null
  const system = standard.systemId ? systems.find((s) => s.id === standard.systemId) ?? null : null

  /**
   * The standard, written out for the model.
   *
   * A design system is turned into a library rather than described in prose,
   * because the run needs names it can write into a stylesheet and "the
   * primary is a deep indigo" is not one.
   */
  const tokenBlock = useMemo(() => {
    const parts: string[] = []
    const names: string[] = []
    if (library) {
      const themes = standard.themeIds.length
        ? standard.themeIds
        : [library.studio.activeTheme]
      // Two themes carry the same variable names with different values, so
      // each block says which theme it is or the second silently wins.
      for (const themeId of themes) {
        const block = formatTokensForPrompt(library.studio, themeId)
        if (!block) continue
        const theme = library.themes.find((t) => t.id === themeId)
        parts.push(theme ? `${theme.name}:\n${block}` : block)
      }
      if (parts.length) {
        const picked = themes
          .map((id) => library.themes.find((t) => t.id === id)?.name)
          .filter(Boolean)
        names.push(picked.length > 1 ? `${library.name} (${picked.join(' and ')})` : library.name)
      }
    }
    if (system) {
      // A system that stands on a library is a reader of it, not a second
      // copy. Rebuilding a library out of the system's own values would hold
      // the project to the copy and lose everything the library holds that
      // the system never carried: the whole palette, the component parts, the
      // themes. Only a system with no library falls back to its own values.
      const linked = system.tokensId
        ? libraries.find((l) => l.id === system.tokensId) ?? null
        : null
      const studio = linked ? linked.studio : studioFromDesignSystem(system)
      const themeId = linked ? system.tokensThemeId ?? studio.activeTheme : studio.activeTheme
      const block = formatTokensForPrompt(studio, themeId)
      if (block) { parts.push(block); names.push(system.name) }
    }
    if (parts.length === 0) return null
    return { name: names.join(' and '), block: parts.join('\n\n'), covers: coversOf(system) }
  }, [library, system, libraries, standard.themeIds])

  const sections: ReportSection[] = useMemo(
    () => (stage.at === 'read' ? buildReport(stage.findings) : []),
    [stage]
  )
  const accepted = useMemo(() => {
    const all = new Set<string>()
    for (const s of sections) for (const r of s.rows) if (!declined.has(r.guideline.id)) all.add(r.guideline.id)
    return all
  }, [sections, declined])

  const checkFolder = async (): Promise<void> => {
    setStage({ at: 'running', what: 'that folder' })
    const res = await window.terminal42.guidelines.checkFolder()
    if (!res.ok) {
      setStage(res.error === 'cancelled' ? { at: 'intake' } : { at: 'failed', error: res.error })
      return
    }
    setDeclined(new Set())
    setStage({ at: 'read', ...res })
    setStep('standard')
  }

  const checkLink = async (): Promise<void> => {
    const url = link.trim()
    if (!url) return
    setStage({ at: 'running', what: url.replace(/^https?:\/\/(www\.)?github\.com\//, '') })
    const res = await window.terminal42.guidelines.checkGithub(url)
    if (!res.ok) { setStage({ at: 'failed', error: res.error }); return }
    setDeclined(new Set())
    setStage({ at: 'read', ...res })
    setStep('standard')
  }

  const toggle = (id: string): void => {
    setDeclined((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSection = (section: ReportSection): void => {
    const ids = section.rows.map((r) => r.guideline.id)
    const allOn = ids.every((id) => !declined.has(id))
    setDeclined((prev) => {
      const next = new Set(prev)
      for (const id of ids) { if (allOn) next.add(id); else next.delete(id) }
      return next
    })
  }

  const apply = (): void => {
    if (stage.at !== 'read') return
    if (applyPrompt(sections, accepted).length === 0) return
    onApply({
      checkId: stage.id,
      name: stage.name,
      prompt: (source) => applyPrompt(sections, accepted, { ...source, tokens: tokenBlock })
    })
  }

  const close = (): void => {
    if (stage.at === 'read') void window.terminal42.guidelines.forget(stage.id)
    onClose()
  }

  // Setting the values by hand is the same questions as making a design
  // system, so it is the same wizard rather than a second, thinner copy of
  // it that would drift. It sits beside this dialog rather than inside it:
  // Modal is a plain overlay, not a portal, so nesting one puts a second
  // backdrop and a second scroll box inside the first and neither can be read.
  if (wizardOpen) {
    return (
      <DesignSystemWizard
        onCancel={() => setWizardOpen(false)}
        onComplete={(made) => {
          setSystems((prev) => [...prev.filter((s) => s.id !== made.id), made])
          setStandard((prev) => ({ ...prev, systemId: made.id }))
          setWizardOpen(false)
        }}
      />
    )
  }

  const toggleTheme = (lib: TokenLibrary, themeId: string): void => {
    setStandard((prev) => {
      // Choosing a theme of another library is choosing that library: two
      // libraries at once is two answers to the same question.
      const themeIds = prev.libraryId === lib.id
        ? prev.themeIds.includes(themeId)
          ? prev.themeIds.filter((t) => t !== themeId)
          : [...prev.themeIds, themeId]
        : [themeId]
      if (themeIds.length === 0) return { ...prev, libraryId: null, themeIds: [] }
      return { ...prev, libraryId: lib.id, themeIds }
    })
  }

  const stepNote: Record<Step, string> = {
    project: 'The page, stylesheet or app to measure.',
    standard: 'What to hold it to. The guidelines apply either way.',
    report:
      stage.at === 'read'
        ? `${reportSummary(sections, stage.name)} ${stage.fileCount} files read.`
        : ''
  }

  return (
    // One size throughout. A dialog that grows between one step and the next
    // moves the button you were reaching for.
    <Modal title="Design check" onClose={close} size="large">
      <ModalHeader title="Design check" note={stepNote[step]} />
      <div className="px-5 pt-3">
        <ModalSteps count={STEP_ORDER.length} at={STEP_ORDER.indexOf(step)} />
      </div>

      {step === 'project' && stage.at === 'intake' && (
        <ModalBody height={420} className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => void checkFolder()}
            className="flex items-center gap-3 rounded-lg bg-elevated px-4 py-3 text-left transition-colors hover:bg-raised"
          >
            <IconFolder size={16} className="shrink-0 text-text-secondary" />
            <span className="min-w-0">
              <span className="block text-[13px] text-text-primary">Choose a folder</span>
              <span className="block text-[11.5px] text-text-muted">A page, a stylesheet, or a whole app</span>
            </span>
          </button>

          <div className="flex flex-col gap-2">
            <label htmlFor="gl-link" className="text-[11.5px] text-text-muted">Or a public GitHub repository</label>
            <div className="flex gap-2">
              <input
                id="gl-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void checkLink() }}
                placeholder="github.com/owner/repo"
                className="h-9 min-w-0 flex-1 rounded-md bg-elevated px-3 text-[12.5px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => void checkLink()}
                disabled={!link.trim()}
                className="h-9 shrink-0 rounded-md bg-accent px-4 text-[12.5px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-35"
              >
                Read it
              </button>
            </div>
          </div>
        </ModalBody>
      )}

      {step === 'project' && stage.at === 'running' && (
        <ModalBody height={420} className="flex flex-col items-center justify-center gap-3">
          <span className="flex h-6 w-6">
            <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-accent/30" />
            <span className="relative inline-flex h-6 w-6 rounded-full bg-accent/60" />
          </span>
          <p className="text-[12.5px] text-text-secondary">Reading {stage.what}…</p>
        </ModalBody>
      )}

      {step === 'project' && stage.at === 'failed' && (
        <ModalBody height={420} className="flex flex-col items-center justify-center gap-3">
          <p className="max-w-sm text-center text-[12.5px] text-text-secondary">{stage.error}</p>
          <button
            type="button"
            onClick={() => setStage({ at: 'intake' })}
            className="h-8 rounded-md bg-elevated px-3 text-[12px] text-text-primary hover:bg-raised"
          >
            Try something else
          </button>
        </ModalBody>
      )}

      {step === 'standard' && (
        <ModalBody height={420} className="flex flex-col gap-5 overflow-y-auto">
          {libraries.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-[11.5px] text-text-muted">Your token libraries</h3>
              <ul className="flex flex-col gap-1">
                {libraries.map((lib) => {
                  const picked = standard.libraryId === lib.id
                  return (
                    <li key={lib.id} className="flex items-center gap-3 rounded-lg bg-elevated px-3 py-2">
                      <TokenGlyph className="shrink-0 text-text-secondary" />
                      <span className={`min-w-0 flex-1 truncate text-[12.5px] ${picked ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {lib.name}
                      </span>
                      <span className="flex h-4 shrink-0 overflow-hidden rounded">
                        {lib.swatches.slice(0, 5).map((c, i) => (
                          <span key={i} className="w-2.5" style={{ background: c }} />
                        ))}
                      </span>
                      {/* Both themes at once is a real answer: a page can be
                          right in Light and unreadable in Dark. */}
                      <span className="flex shrink-0 items-center gap-1">
                        {lib.themes.map((t) => {
                          const on = picked && standard.themeIds.includes(t.id)
                          return (
                            <button
                              key={t.id}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleTheme(lib, t.id)}
                              className={`rounded-md px-2 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                                on ? 'bg-accent text-black' : 'bg-surface text-text-muted hover:text-text-primary'
                              }`}
                            >
                              {t.name}
                            </button>
                          )
                        })}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-1.5">
            <h3 className="text-[11.5px] text-text-muted">Your design systems</h3>
            <ul className="flex flex-col gap-1">
              {systems.map((sys) => {
                const picked = standard.systemId === sys.id
                return (
                  <li key={sys.id}>
                    <button
                      type="button"
                      aria-pressed={picked}
                      onClick={() =>
                        setStandard((prev) => ({ ...prev, systemId: picked ? null : sys.id }))
                      }
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
                        picked ? 'bg-raised' : 'bg-elevated hover:bg-raised'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded ${
                          picked ? 'bg-accent text-black' : 'bg-surface text-transparent'
                        }`}
                      >
                        <IconCheck size={9} />
                      </span>
                      <span className={`min-w-0 flex-1 truncate text-[12.5px] ${picked ? 'text-text-primary' : 'text-text-secondary'}`}>
                        {sys.name}
                      </span>
                      <span className="flex h-4 shrink-0 overflow-hidden rounded">
                        {[sys.colors.primary, sys.colors.secondary, sys.colors.tertiary, sys.colors.surface, sys.colors.border].map((c, i) => (
                          <span key={i} className="w-2.5" style={{ background: c }} />
                        ))}
                      </span>
                    </button>
                  </li>
                )
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setWizardOpen(true)}
                  className="flex w-full items-center gap-3 rounded-lg bg-elevated px-3 py-2 text-left transition-colors hover:bg-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <span aria-hidden="true" className="grid h-[15px] w-[15px] shrink-0 place-items-center text-[13px] leading-none text-text-muted">+</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] text-text-primary">Set the values here</span>
                    <span className="block text-[11.5px] text-text-muted">The same questions as making a design system</span>
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <p className="text-[11.5px] text-text-muted">
            {tokenBlock
              ? `Held to ${tokenBlock.name}, on top of the design guidelines.`
              : 'Nothing chosen — held to the design guidelines alone.'}
          </p>
        </ModalBody>
      )}

      {step === 'report' && (
        <ModalBody height={420} className="flex flex-col gap-4 overflow-y-auto">
          {sections.length === 0 && (
            <p className="py-10 text-center text-[13px] text-text-secondary">
              Nothing to change. It already follows the guidelines.
            </p>
          )}
          {sections.map((section) => {
            const on = section.rows.filter((r) => !declined.has(r.guideline.id)).length
            return (
              <section key={section.group.id} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => toggleSection(section)}
                  title={on > 0 ? `Turn off all of ${section.group.label}` : `Turn on all of ${section.group.label}`}
                  className="flex items-center gap-2.5 rounded px-1 py-1 text-left hover:bg-elevated"
                >
                  <GroupPictogram
                    shape={section.group.pictogram}
                    className={on > 0 ? 'text-accent' : 'text-text-disabled'}
                  />
                  <span className="text-[12.5px] text-text-primary">{section.group.label}</span>
                  <span className="text-[11px] text-text-muted">{section.total}</span>
                </button>

                {section.rows.map((row) => {
                  const isOn = !declined.has(row.guideline.id)
                  const isOpen = open === row.guideline.id
                  return (
                    <div key={row.guideline.id} className="pl-[26px]">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isOn}
                          onClick={() => toggle(row.guideline.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 rounded px-1 py-1 text-left hover:bg-elevated"
                        >
                          <span
                            aria-hidden="true"
                            className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded ${
                              isOn ? 'bg-accent text-black' : 'bg-elevated text-transparent'
                            }`}
                          >
                            <IconCheck size={9} />
                          </span>
                          <span className={`min-w-0 flex-1 truncate text-[12.5px] ${isOn ? 'text-text-secondary' : 'text-text-disabled line-through'}`}>
                            {row.guideline.label}
                          </span>
                          {row.finding.count > 1 && (
                            <span className="shrink-0 text-[11px] tabular-nums text-text-muted">{row.finding.count}</span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : row.guideline.id)}
                          aria-label={isOpen ? 'Hide the detail' : 'Show the detail'}
                          aria-expanded={isOpen}
                          className="grid h-6 w-6 shrink-0 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"
                        >
                          <span aria-hidden="true" className="text-[13px] leading-none">{isOpen ? '−' : '+'}</span>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="mb-1 ml-[25px] mr-8 flex flex-col gap-1 rounded bg-elevated px-3 py-2">
                          <p className="text-[11.5px] text-text-secondary">{row.guideline.fix}</p>
                          {row.finding.example && (
                            <code className="truncate font-mono text-[10.5px] text-text-muted" title={row.finding.example}>
                              {row.finding.example}
                            </code>
                          )}
                          {row.finding.file && (
                            <span className="text-[10.5px] text-text-disabled">{row.finding.file}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            )
          })}
        </ModalBody>
      )}

      <ModalFooter
        left={
          step === 'report' && sections.length > 0 ? (
            <span className="text-[11.5px] text-text-muted">
              {accepted.size} of {sections.reduce((n, s) => n + s.rows.length, 0)} selected
              {tokenBlock ? `, held to ${tokenBlock.name}` : ''}
            </span>
          ) : undefined
        }
      >
        <button
          type="button"
          onClick={close}
          className="flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          <IconClose size={10} />
          <span>Close</span>
        </button>

        {/* Back only where there is something to go back to. Step one has
            nothing behind it, and going back from the report would leave the
            findings on screen for a project that is no longer chosen. */}
        {step === 'standard' && (
          <button
            type="button"
            onClick={() => { setStage({ at: 'intake' }); setStep('project') }}
            className="h-8 rounded-md px-3 text-[12.5px] text-text-secondary hover:bg-elevated hover:text-text-primary"
          >
            Back
          </button>
        )}
        {step === 'standard' && (
          <button
            type="button"
            onClick={() => setStep('report')}
            className="h-8 rounded-md bg-accent px-4 text-[12.5px] font-medium text-black transition-opacity hover:opacity-90"
          >
            {tokenBlock ? 'Check against it' : 'Check'}
          </button>
        )}
        {step === 'report' && stage.at === 'read' && (
          <button
            type="button"
            onClick={() => setStep('standard')}
            className="h-8 rounded-md px-3 text-[12.5px] text-text-secondary hover:bg-elevated hover:text-text-primary"
          >
            Back
          </button>
        )}
        {step === 'report' && stage.at === 'read' && stage.entry && sections.length > 0 && (
          <button
            type="button"
            onClick={apply}
            disabled={accepted.size === 0}
            className="h-8 rounded-md bg-accent px-4 text-[12.5px] font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-35"
          >
            Apply {accepted.size}
          </button>
        )}
      </ModalFooter>
    </Modal>
  )
}
