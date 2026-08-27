// The chip that says which token library a chat turn follows.

import type { JSX } from 'react'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import type { TokenLibrary } from '../../lib/tokens/useTokenLibraries'
import type { ChatTokens } from '../../lib/tokens/chatTokens'

export function TokensChip({
  libraries,
  chosen,
  onChoose
}: {
  libraries: TokenLibrary[]
  chosen: ChatTokens | null
  onChoose: (next: ChatTokens | null) => void
}): JSX.Element | null {
  // Nothing to offer, so nothing to explain. The chip appears the moment a
  // first library exists.
  if (libraries.length === 0) return null
  const active = chosen ? libraries.find((l) => l.id === chosen.id) ?? null : null
  const theme = active
    ? active.themes.find((t) => t.id === (chosen?.themeId ?? active.studio.activeTheme)) ?? null
    : null

  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          title={active ? `Every turn follows ${active.name}` : 'Follow a token library in this chat'}
          className={`flex h-6 items-center gap-1.5 rounded-full px-2 text-[11.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
            active
              ? 'bg-accent/12 text-text-primary'
              : 'text-text-muted hover:bg-raised hover:text-text-primary'
          }`}
        >
          {active ? (
            <span className="flex items-center gap-[2px]">
              {active.swatches.slice(0, 4).map((c, i) => (
                <span
                  key={`${c}-${i}`}
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </span>
          ) : null}
          <span className="max-w-[9rem] truncate">
            {active ? (theme ? `${active.name} · ${theme.name}` : active.name) : 'Tokens'}
          </span>
        </button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[13rem] rounded-lg border border-border bg-elevated p-1 shadow-lg"
        >
          <Dropdown.Item
            onSelect={() => onChoose(null)}
            className="cursor-default rounded-md px-2 py-1.5 text-[12px] text-text-secondary outline-none data-[highlighted]:bg-raised data-[highlighted]:text-text-primary"
          >
            Follow nothing
          </Dropdown.Item>
          {libraries.map((lib) => (
            <Dropdown.Sub key={lib.id}>
              <Dropdown.SubTrigger className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-text-primary outline-none data-[highlighted]:bg-raised">
                <span className="flex items-center gap-[2px]">
                  {lib.swatches.slice(0, 4).map((c, i) => (
                    <span
                      key={`${c}-${i}`}
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate">{lib.name}</span>
              </Dropdown.SubTrigger>
              <Dropdown.Portal>
                <Dropdown.SubContent
                  sideOffset={4}
                  className="z-50 min-w-[9rem] rounded-lg border border-border bg-elevated p-1 shadow-lg"
                >
                  {lib.themes.map((t) => (
                    <Dropdown.Item
                      key={t.id}
                      onSelect={() => onChoose({ id: lib.id, themeId: t.id })}
                      className="cursor-default rounded-md px-2 py-1.5 text-[12px] text-text-primary outline-none data-[highlighted]:bg-raised"
                    >
                      {t.name}
                    </Dropdown.Item>
                  ))}
                </Dropdown.SubContent>
              </Dropdown.Portal>
            </Dropdown.Sub>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}
