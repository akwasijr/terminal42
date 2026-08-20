// Pictograms for the starter tiles and the templates modal.
//
// Wireframe thumbnails rather than icons: a small drawing of a bar chart says
// "dashboard" faster than any label, which is what lets the tiles carry a
// single line of text and no supporting copy. Shared by both surfaces so a
// template looks the same wherever it appears.
//
// Drawn on a 100x64 canvas. `currentColor` is the accent, so the art picks up
// hover state from the button around it.

import type { ReactNode } from 'react'
import type { StarterId } from './starterPrompts'

// Same palette the design wizard's thumbnails use, redeclared rather than
// imported: DesignWizard is a large lazy-loaded chunk, and importing it here
// would pull the whole wizard into the chat bundle for three colours.
const COL = {
  paper: '#e7e5e4',
  ink: '#374151',
  muted: 'rgba(120,120,120,0.5)'
}

/** Artwork keyed by kind; the text itself lives in starterPrompts.ts. */
export const STARTER_ART: Record<StarterId, ReactNode> = {
  tool: (
    <>
      <rect x="8" y="6" width="30" height="52" rx="2" fill={COL.ink} opacity="0.85" />
      <rect x="12" y="12" width="16" height="2" rx="0.5" fill={COL.paper} opacity="0.6" />
      <rect x="15" y="18" width="13" height="2" rx="0.5" fill={COL.paper} opacity="0.4" />
      <rect x="15" y="24" width="15" height="2" rx="0.5" fill={COL.paper} opacity="0.4" />
      <rect x="12" y="30" width="18" height="2" rx="0.5" fill={COL.paper} opacity="0.6" />
      <rect x="15" y="36" width="12" height="2" rx="0.5" fill={COL.paper} opacity="0.4" />
      <rect x="42" y="6" width="50" height="52" rx="2" fill={COL.paper} />
      <rect x="48" y="14" width="24" height="3" rx="1" fill={COL.ink} />
      <rect x="48" y="24" width="38" height="2" rx="1" fill={COL.muted} />
      <rect x="48" y="30" width="38" height="2" rx="1" fill={COL.muted} />
      <rect x="48" y="36" width="30" height="2" rx="1" fill={COL.muted} />
      <rect x="48" y="46" width="20" height="4" rx="1" fill="currentColor" />
    </>
  ),
  dashboard: (
    <>
      <rect x="6" y="8" width="88" height="48" rx="3" fill={COL.paper} />
      <line x1="16" y1="48" x2="86" y2="48" stroke={COL.muted} strokeWidth="0.5" />
      <rect x="22" y="34" width="9" height="14" rx="1" fill={COL.muted} />
      <rect x="35" y="28" width="9" height="20" rx="1" fill={COL.muted} />
      <rect x="48" y="30" width="9" height="18" rx="1" fill={COL.muted} />
      <rect x="61" y="20" width="9" height="28" rx="1" fill="currentColor" />
      <line x1="16" y1="18" x2="86" y2="18" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
      <circle cx="80" cy="18" r="3" fill="currentColor" />
    </>
  ),
  site: (
    <>
      <rect x="8" y="6" width="84" height="52" rx="3" fill={COL.paper} />
      <line x1="8" y1="14" x2="92" y2="14" stroke={COL.muted} strokeWidth="0.5" />
      <circle cx="14" cy="10" r="1" fill={COL.muted} />
      <circle cx="18" cy="10" r="1" fill={COL.muted} />
      <circle cx="22" cy="10" r="1" fill={COL.muted} />
      <rect x="14" y="22" width="22" height="3" rx="1" fill={COL.ink} />
      <rect x="14" y="30" width="34" height="2" rx="1" fill={COL.muted} />
      <rect x="14" y="42" width="14" height="6" rx="2" fill="currentColor" />
      <rect x="56" y="22" width="32" height="26" rx="2" fill="currentColor" opacity="0.45" />
    </>
  ),
  // Two stacked endpoint rows feeding a response block: the shape of a service
  // rather than a page.
  api: (
    <>
      <rect x="6" y="8" width="52" height="48" rx="3" fill={COL.paper} />
      <rect x="12" y="15" width="10" height="5" rx="1.5" fill="currentColor" />
      <rect x="25" y="16" width="26" height="3" rx="1" fill={COL.muted} />
      <rect x="12" y="26" width="10" height="5" rx="1.5" fill={COL.ink} opacity="0.7" />
      <rect x="25" y="27" width="20" height="3" rx="1" fill={COL.muted} />
      <rect x="12" y="37" width="10" height="5" rx="1.5" fill={COL.ink} opacity="0.7" />
      <rect x="25" y="38" width="24" height="3" rx="1" fill={COL.muted} />
      <path d="M60 32 h8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      <rect x="70" y="18" width="24" height="28" rx="2" fill={COL.ink} opacity="0.85" />
      <rect x="74" y="24" width="14" height="2" rx="0.5" fill={COL.paper} opacity="0.6" />
      <rect x="74" y="30" width="16" height="2" rx="0.5" fill={COL.paper} opacity="0.4" />
      <rect x="74" y="36" width="11" height="2" rx="0.5" fill={COL.paper} opacity="0.4" />
    </>
  ),
  // A contents column beside body text: the shape of a documentation page.
  docs: (
    <>
      <rect x="8" y="6" width="84" height="52" rx="3" fill={COL.paper} />
      <rect x="14" y="14" width="18" height="3" rx="1" fill="currentColor" />
      <rect x="14" y="22" width="14" height="2" rx="1" fill={COL.muted} />
      <rect x="14" y="28" width="16" height="2" rx="1" fill={COL.muted} />
      <rect x="14" y="34" width="12" height="2" rx="1" fill={COL.muted} />
      <line x1="38" y1="12" x2="38" y2="52" stroke={COL.muted} strokeWidth="0.5" />
      <rect x="46" y="14" width="30" height="3" rx="1" fill={COL.ink} />
      <rect x="46" y="24" width="40" height="2" rx="1" fill={COL.muted} />
      <rect x="46" y="30" width="40" height="2" rx="1" fill={COL.muted} />
      <rect x="46" y="36" width="34" height="2" rx="1" fill={COL.muted} />
      <rect x="46" y="42" width="38" height="2" rx="1" fill={COL.muted} />
    </>
  )
}
