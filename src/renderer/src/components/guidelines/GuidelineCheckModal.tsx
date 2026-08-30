import React, { useMemo, useState } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from '../Modal'
import { GroupPictogram } from './GroupPictogram'
import { buildReport, reportSummary, applyPrompt, type ReportSection } from '../../../../shared/guidelineReport'
import type { GuidelineFinding } from '../../../../preload/index'
import { IconCheck, IconClose, IconFolder } from '../icons'

// Checking a project against the design guidelines.
//
// Two steps and no more: say what to check, then read what came back. The
// report is the point, so it is a list of shapes and counts rather than
// paragraphs — every row is a rule, a number, and a tick that decides
// whether the second run touches it.

type Stage =
  | { at: 'intake' }
  | { at: 'running'; what: string }
  | { at: 'report'; id: string; name: string; fileCount: number; entry: string | null; findings: GuidelineFinding[] }
  | { at: 'failed'; error: string }

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
  const [stage, setStage] = useState<Stage>({ at: 'intake' })
  const [link, setLink] = useState('')
  // Everything is accepted until it is turned off: the report is a list of
  // things the guidelines already say, so agreeing with all of it is the
  // ordinary case and unticking is the decision worth making.
  const [declined, setDeclined] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)

  const sections: ReportSection[] = useMemo(
    () => (stage.at === 'report' ? buildReport(stage.findings) : []),
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
    setStage({ at: 'report', ...res })
  }

  const checkLink = async (): Promise<void> => {
    const url = link.trim()
    if (!url) return
    setStage({ at: 'running', what: url.replace(/^https?:\/\/(www\.)?github\.com\//, '') })
    const res = await window.terminal42.guidelines.checkGithub(url)
    if (!res.ok) { setStage({ at: 'failed', error: res.error }); return }
    setDeclined(new Set())
    setStage({ at: 'report', ...res })
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
    if (stage.at !== 'report') return
    if (applyPrompt(sections, accepted).length === 0) return
    onApply({
      checkId: stage.id,
      name: stage.name,
      prompt: (source) => applyPrompt(sections, accepted, source)
    })
  }

  const close = (): void => {
    if (stage.at === 'report') void window.terminal42.guidelines.forget(stage.id)
    onClose()
  }

  return (
    <Modal title="Design check" onClose={close} size={stage.at === 'report' ? 'large' : 'medium'}>
      <ModalHeader
        title="Design check"
        note={
          stage.at === 'report'
            ? `${reportSummary(sections, stage.name)} ${stage.fileCount} files read.`
            : 'Measure a project against the design guidelines.'
        }
      />

      {stage.at === 'intake' && (
        <ModalBody className="flex flex-col gap-4">
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
                Check
              </button>
            </div>
          </div>
        </ModalBody>
      )}

      {stage.at === 'running' && (
        <ModalBody className="flex min-h-[160px] flex-col items-center justify-center gap-3">
          <span className="flex h-6 w-6">
            <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-accent/30" />
            <span className="relative inline-flex h-6 w-6 rounded-full bg-accent/60" />
          </span>
          <p className="text-[12.5px] text-text-secondary">Reading {stage.what}…</p>
        </ModalBody>
      )}

      {stage.at === 'failed' && (
        <ModalBody className="flex min-h-[160px] flex-col items-center justify-center gap-3">
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

      {stage.at === 'report' && (
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
          stage.at === 'report' && sections.length > 0 ? (
            <span className="text-[11.5px] text-text-muted">
              {accepted.size} of {sections.reduce((n, s) => n + s.rows.length, 0)} selected
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
        {stage.at === 'report' && stage.entry && sections.length > 0 && (
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
