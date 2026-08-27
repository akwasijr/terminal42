import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'
import type { Project, Session } from '../../../preload/index'
import { MODELS, ProviderLogo } from './ModelDropdown'

type NavId = 'terminal' | 'projects' | 'workbench' | 'brain' | 'activity' | 'settings'

export function FindAnything({
  open,
  onOpenChange,
  projects,
  onPickProject,
  onSetView,
  onPickModel,
  onAddProject
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  projects: Project[]
  onPickProject: (p: Project) => void
  onSetView: (n: NavId) => void
  onPickModel: (id: string) => void
  onAddProject: () => void
}) {
  const [query, setQuery] = useState('')
  const [sessionsResults, setSessionsResults] = useState<Session[]>([])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setSessionsResults([])
      return
    }
    let cancelled = false
    void window.terminal42.search.history(query).then((r) => {
      if (cancelled) return
      setSessionsResults(r.sessions as Session[])
    })
    return () => { cancelled = true }
  }, [query])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-[18%] z-50 w-[560px] -translate-x-1/2 rounded-md bg-raised shadow-overlay outline-none">
          <Dialog.Title className="sr-only">Find anything</Dialog.Title>
          <Command label="Find anything" shouldFilter>
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search projects, sessions, recipes, settings…"
              className="w-full bg-transparent px-3.5 py-3 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <Command.List className="max-h-[360px] overflow-y-auto p-1.5 text-[12px]">
              <Command.Empty className="px-3 py-6 text-center text-text-muted">No matches.</Command.Empty>
              <Command.Group heading="Go to" className="text-text-muted">
                <Item value="View terminal" onSelect={() => { onSetView('terminal'); onOpenChange(false) }}>Terminal</Item>
                <Item value="View automations" onSelect={() => { onSetView('workbench'); onOpenChange(false) }}>Automations</Item>
                <Item value="View brain" onSelect={() => { onSetView('brain'); onOpenChange(false) }}>Brain</Item>
                <Item value="View activity" onSelect={() => { onSetView('activity'); onOpenChange(false) }}>Activity</Item>
                <Item value="View settings" onSelect={() => { onSetView('settings'); onOpenChange(false) }}>Settings</Item>
                <Item value="View tokens design system shared library basis" onSelect={() => { window.dispatchEvent(new Event('t42:open-tokens')); onOpenChange(false) }}>Tokens</Item>
              </Command.Group>
              <Command.Group heading="Actions">
                <Item value="Add a folder" onSelect={() => { onAddProject(); onOpenChange(false) }}>Add a folder…</Item>
              </Command.Group>
              <Command.Group heading="Projects">
                {projects.map((p) => (
                  <Item key={p.id} value={`project ${p.name} ${p.path}`} onSelect={() => { onPickProject(p); onOpenChange(false) }}>
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto truncate text-text-muted">{p.path}</span>
                  </Item>
                ))}
              </Command.Group>
              {sessionsResults.length > 0 && (
                <Command.Group heading="Sessions">
                  {sessionsResults.slice(0, 8).map((s) => (
                    <Item key={s.id} value={`session ${s.title}`} onSelect={() => onOpenChange(false)}>
                      {s.title}
                    </Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Switch model">
                {MODELS.map((m) => (
                  <Item key={m.id} value={`model ${m.label}`} onSelect={() => { onPickModel(m.id); onOpenChange(false) }}>
                    {m.label}
                    <span className="ml-auto flex items-center gap-1 text-text-muted"><ProviderLogo provider={m.group} />{m.group}</span>
                  </Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Item({ value, onSelect, children }: { value: string; onSelect: () => void; children: React.ReactNode }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-text-primary aria-selected:bg-elevated"
    >
      {children}
    </Command.Item>
  )
}
