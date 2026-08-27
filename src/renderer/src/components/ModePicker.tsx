import { useState } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { IconChevronRight } from './icons'

export type AgentMode = 'interactive' | 'plan' | 'autopilot'

const MODES: Array<{ id: AgentMode; label: string }> = [
  { id: 'interactive', label: 'Interactive' },
  { id: 'plan',        label: 'Plan' },
  { id: 'autopilot',   label: 'Autopilot' }
]

export function getDefaultMode(): AgentMode {
  try {
    const v = localStorage.getItem('t42:agent:mode')
    if (v === 'interactive' || v === 'plan' || v === 'autopilot') return v
  } catch {}
  return 'interactive'
}

export function persistMode(mode: AgentMode): void {
  try { localStorage.setItem('t42:agent:mode', mode) } catch {}
}

export function ModePicker({
  value,
  onChange,
  disabled,
  align = 'start'
}: {
  value: AgentMode
  onChange: (m: AgentMode) => void
  disabled?: boolean
  align?: 'start' | 'end'
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const current = MODES.find((m) => m.id === value) ?? MODES[0]
  return (
    <Dropdown.Root open={open} onOpenChange={setOpen}>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Agent mode"
          title={current.label}
          className="inline-flex h-7 max-w-[140px] items-center gap-1 rounded-md px-2 text-[12px] text-text-secondary outline-none hover:bg-elevated hover:text-text-primary focus-visible:outline-none data-[state=open]:bg-elevated data-[state=open]:text-text-primary disabled:opacity-50"
        >
          <span className="truncate">{current.label}</span>
          <IconChevronRight size={9} className="shrink-0 rotate-90 text-text-muted" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          side="top"
          sideOffset={8}
          collisionPadding={12}
          className="t42-menu z-50 min-w-[160px] rounded-lg bg-raised p-1 text-[12px] text-text-primary shadow-overlay"
        >
          {MODES.map((m) => {
            const active = m.id === value
            return (
              <Dropdown.Item
                key={m.id}
                onSelect={() => onChange(m.id)}
                className={[
                  'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 outline-none',
                  active ? 'bg-surface' : 'hover:bg-surface'
                ].join(' ')}
              >
                <span className="w-3 shrink-0 text-text-secondary">
                  {active ? '✓' : ''}
                </span>
                <span className="text-[12.5px] font-medium text-text-primary">{m.label}</span>
              </Dropdown.Item>
            )
          })}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
