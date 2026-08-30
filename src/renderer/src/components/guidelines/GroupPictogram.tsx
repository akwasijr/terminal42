import React from 'react'
import type { GuidelineGroup } from '../../../../shared/guidelines'

// A shape per group, so the eye finds the section before it reads anything.
//
// Nine groups is more than a list of words can be scanned at a glance, and
// the alternative — an emoji per row — is the exact habit the guidelines
// themselves forbid. These are drawn, so they render the same everywhere and
// take their colour from the row.

const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const

const SHAPES: Record<GuidelineGroup['pictogram'], React.JSX.Element> = {
  // Stacked slabs: the interchangeable boxes an AI reaches for by default.
  blocks: (
    <><rect x="2.5" y="2.5" width="11" height="4" rx="1" /><rect x="2.5" y="9.5" width="11" height="4" rx="1" /></>
  ),
  // A document outline, indented.
  tree: <><path d="M3 3h10" /><path d="M5 6.5h8" /><path d="M5 10h5" /><path d="M3 13.5h10" /></>,
  braces: (
    <>
      <path d="M6 2.5C4.5 2.5 5 6 3.5 8c1.5 2 1 5.5 2.5 5.5" />
      <path d="M10 2.5c1.5 0 1 3.5 2.5 5.5-1.5 2-1 5.5-2.5 5.5" />
    </>
  ),
  grid: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </>
  ),
  // A part being fitted into a whole.
  component: (
    <><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M2.5 6.5h4V10h-4" /></>
  ),
  image: (
    <>
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1" />
      <path d="M3.5 11.5 6.5 8.5l3 3 2-1.5 2 1.5" />
    </>
  ),
  // The access mark, drawn rather than borrowed from a font.
  access: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="5" r=".9" fill="currentColor" />
      <path d="M5.2 6.9h5.6" />
      <path d="M8 6.9v3M8 9.9 6.4 12.4M8 9.9l1.6 2.5" />
    </>
  ),
  gauge: <><path d="M2.8 11.5a5.8 5.8 0 1 1 10.4 0" /><path d="M8 11.5 11 7" /></>,
  contrast: (
    <><circle cx="8" cy="8" r="5.5" /><path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none" /></>
  )
}

export function GroupPictogram({
  shape,
  size = 16,
  className = ''
}: {
  shape: GuidelineGroup['pictogram']
  size?: number
  className?: string
}): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className={className} {...S}>
      {SHAPES[shape]}
    </svg>
  )
}
