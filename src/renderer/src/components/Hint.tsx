// How the app explains a thing without shouting it.
//
// Instructions printed permanently under a canvas are read once and then
// become furniture: they take a line of space forever in exchange for being
// useful for about ten seconds. But they cannot simply be deleted, because
// nothing else says that a lane can be double-clicked.
//
// So the words stay and the space does not. A small mark, and the sentence on
// hover. It wraps the tooltip that already exists rather than growing a
// second one, which also means it is drawn in a portal and cannot be clipped
// by the timeline row it sits in.

import { Tooltip } from './Tooltip'

export function Hint({
  label,
  side = 'top'
}: {
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}): React.JSX.Element {
  return (
    <Tooltip label={label} side={side} delay={120}>
      <span
        role="note"
        aria-label={label}
        tabIndex={0}
        className="grid h-4 w-4 cursor-default place-items-center rounded-full text-[9px] leading-none text-text-muted ring-1 ring-inset ring-border transition-colors hover:text-text-primary hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        i
      </span>
    </Tooltip>
  )
}
