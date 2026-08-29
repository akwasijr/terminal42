import { useMemo, useState } from 'react'
import type { Skill } from '../../../preload/index'
import { STARTER_PACK, DOMAIN_LABEL, DOMAIN_DESCRIPTION, DOMAIN_ORDER, type StarterSkill, type SkillDomain } from './starterPack'
import { IconClose, IconCheck, IconChat, IconUser, IconCode, IconWorkflow, IconChevronRight } from './icons'
import { Modal, ModalHeader, ModalFooter } from './Modal'

const FORMAT_LABEL: Record<StarterSkill['format'], string> = {
  prompt: 'Prompt',
  persona: 'Persona',
  clip: 'Code clip',
  recipe: 'Recipe'
}
const FORMAT_ICON: Record<StarterSkill['format'], typeof IconChat> = {
  prompt: IconChat,
  persona: IconUser,
  clip: IconCode,
  recipe: IconWorkflow
}
const FORMAT_TINT: Record<StarterSkill['format'], string> = {
  prompt: 'text-accent',
  persona: 'text-violet-400',
  clip: 'text-emerald-400',
  recipe: 'text-amber-400'
}

export function StarterPackModal({
  existing,
  onClose,
  onInstalled
}: {
  existing: Skill[]
  onClose: () => void
  onInstalled: (count: number) => void
}) {
  const existingNames = useMemo(() => new Set(existing.map((s) => s.name.toLowerCase())), [existing])
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(STARTER_PACK.filter((s) => !existingNames.has(s.name.toLowerCase())).map((s) => s.name))
  )
  const [installing, setInstalling] = useState(false)
  const [preview, setPreview] = useState<StarterSkill | null>(STARTER_PACK[0] ?? null)
  const [collapsed, setCollapsed] = useState<Set<SkillDomain>>(new Set())

  const groupedByDomain = useMemo(() => {
    const map = new Map<SkillDomain, StarterSkill[]>()
    for (const d of DOMAIN_ORDER) map.set(d, [])
    for (const s of STARTER_PACK) map.get(s.domain)!.push(s)
    return DOMAIN_ORDER.map((d) => [d, map.get(d) ?? []] as const).filter(([, items]) => items.length > 0)
  }, [])

  const toggle = (name: string) => {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelected(next)
  }

  const toggleCollapse = (d: SkillDomain) => {
    const next = new Set(collapsed)
    if (next.has(d)) next.delete(d)
    else next.add(d)
    setCollapsed(next)
  }

  const install = async () => {
    if (selected.size === 0 || installing) return
    setInstalling(true)
    let count = 0
    for (const s of STARTER_PACK) {
      if (!selected.has(s.name)) continue
      if (existingNames.has(s.name.toLowerCase())) continue
      try {
        await window.terminal42.skills.save({
          name: s.name,
          body: s.body,
          format: s.format,
          tags: s.tags,
          scope: { kind: s.scope ?? 'manual' }
        })
        count++
      } catch {
        // continue
      }
    }
    setInstalling(false)
    onInstalled(count)
  }

  const totalNew = STARTER_PACK.filter((s) => !existingNames.has(s.name.toLowerCase())).length
  const selectedNew = STARTER_PACK.filter(
    (s) => selected.has(s.name) && !existingNames.has(s.name.toLowerCase())
  ).length

  return (
    <Modal title="Starter pack" onClose={onClose} size="xlarge" labelledBy="starter-pack-title">
      <ModalHeader
        title="Starter pack"
        id="starter-pack-title"
        note={`Curated skills grouped by domain. ${totalNew} new · ${STARTER_PACK.length - totalNew} already installed. Pick what you want: edit, rescope, or delete them later.`}
        right={
          <button
            type="button"
            onClick={onClose}
            aria-label="Close starter pack"
            className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <IconClose size={12} />
          </button>
        }
      />

      {/* Body: domain list + preview */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex w-[440px] shrink-0 flex-col overflow-y-auto">
            {groupedByDomain.map(([domain, items]) => {
              const isCollapsed = collapsed.has(domain)
              const eligible = items.filter((it) => !existingNames.has(it.name.toLowerCase()))
              const allOn = eligible.length > 0 && eligible.every((it) => selected.has(it.name))
              const someOn = eligible.some((it) => selected.has(it.name))
              return (
                <div key={domain} className="last:border-0">
                  <div className="flex items-center justify-between gap-2 bg-surface/50 px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(domain)}
                      className="flex flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                      aria-expanded={!isCollapsed}
                    >
                      <IconChevronRight
                        size={10}
                        className={'text-text-muted transition-transform ' + (isCollapsed ? '' : 'rotate-90')}
                      />
                      <div className="flex flex-col">
                        <span className="text-[12px] font-semibold text-text-primary">{DOMAIN_LABEL[domain]}</span>
                        <span className="text-[10px] text-text-muted">{DOMAIN_DESCRIPTION[domain]}</span>
                      </div>
                    </button>
                    <span className="shrink-0 rounded-sm bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                      {items.length}
                    </span>
                    {eligible.length > 0 && (
                      <button
                        type="button"
                        className="shrink-0 text-[10px] font-medium text-accent hover:underline"
                        onClick={() => {
                          const next = new Set(selected)
                          for (const it of eligible) {
                            if (allOn) next.delete(it.name)
                            else next.add(it.name)
                          }
                          setSelected(next)
                        }}
                      >
                        {allOn ? 'None' : someOn ? 'All' : 'All'}
                      </button>
                    )}
                  </div>
                  {!isCollapsed && (
                    <ul>
                      {items.map((s) => {
                        const Icon = FORMAT_ICON[s.format]
                        const tint = FORMAT_TINT[s.format]
                        const already = existingNames.has(s.name.toLowerCase())
                        const checked = selected.has(s.name)
                        return (
                          <li key={s.name}>
                            <label
                              className={
                                'flex cursor-pointer items-start gap-2.5 px-4 py-2.5 text-[12px] hover:bg-elevated ' +
                                (preview?.name === s.name ? 'bg-elevated' : '')
                              }
                              onMouseEnter={() => setPreview(s)}
                              onClick={() => setPreview(s)}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggle(s.name)}
                                disabled={already}
                                className="mt-0.5 h-3.5 w-3.5 cursor-pointer accent-accent disabled:opacity-40"
                                aria-label={`Select ${s.name}`}
                              />
                              <Icon size={12} className={'mt-0.5 shrink-0 ' + tint} />
                              <div className="flex flex-1 flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={'truncate font-medium ' + (already ? 'text-text-muted line-through' : 'text-text-primary')}>
                                    {s.name}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-text-muted">{FORMAT_LABEL[s.format]}</span>
                                  {already && (
                                    <span className="shrink-0 rounded-sm bg-elevated px-1 py-px text-[10px] text-text-muted">installed</span>
                                  )}
                                </div>
                                <span className="truncate text-[11px] text-text-muted">{s.description}</span>
                              </div>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          {/* Preview */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {preview ? (
              <>
                <div className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-sm bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                      {FORMAT_LABEL[preview.format]}
                    </span>
                    <span className="rounded-sm bg-elevated px-1.5 py-0.5 text-[10px] text-text-muted">
                      {DOMAIN_LABEL[preview.domain]}
                    </span>
                    <h3 className="truncate text-[14px] font-semibold text-text-primary">{preview.name}</h3>
                  </div>
                  <p className="mt-1 text-[12px] text-text-secondary">{preview.description}</p>
                  {preview.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {preview.tags.map((t) => (
                        <span key={t} className="rounded-sm bg-elevated px-1.5 py-0.5 text-[10px] text-text-secondary">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <pre className="flex-1 overflow-auto whitespace-pre-wrap p-5 font-mono text-[12px] leading-relaxed text-text-primary">
                  {preview.body}
                </pre>
              </>
            ) : (
              <div className="grid flex-1 place-items-center text-[13px] text-text-muted">
                Hover or click an item on the left to preview it.
              </div>
            )}
          </div>
      </div>

      <ModalFooter
        left={
          <span className="text-[12px] text-text-muted">
            {selectedNew} new selected · {selected.size} total selected
          </span>
        }
      >
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void install()}
          disabled={selectedNew === 0 || installing}
          className="flex items-center gap-1.5 rounded-md bg-action px-3 py-1.5 text-[12px] font-medium text-action-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          {installing ? 'Installing…' : (
            <>
              <IconCheck size={12} /> Install {selectedNew} skill{selectedNew === 1 ? '' : 's'}
            </>
          )}
        </button>
      </ModalFooter>
    </Modal>
  )
}
