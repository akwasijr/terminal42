import { FEEL_PRESETS, type CornerStyle, type Vibe } from './designSystem'
import { studioFromFeel, type Feel } from '../../../shared/tokens/scaffold'
import type { TokenStudio } from '../../../shared/tokens/types'

/**
 * Turning a feel preset into a real token library.
 *
 * The design system wizard and the token wizard describe the same nine feels
 * in slightly different words. This is the translation between them, so a
 * token template and a design system template can start from one definition
 * rather than drifting apart.
 */

/**
 * Corner radius in pixels, per corner style.
 *
 * A preset can be a squircle, which a token library has no way to express —
 * the scaffold only carries a radius. It reads as the roundest thing the
 * library can say, which is what a squircle looks like anyway.
 */
export const CORNER_PX: Record<CornerStyle, number> = {
  angular: 0, slight: 4, rounded: 8, curved: 12, full: 20, squircle: 16
}

/** The token library's own vocabulary for a corner, which has no squircle. */
const CORNER_AS_FEEL: Record<CornerStyle, Feel['corner']> = {
  angular: 'angular', slight: 'slight', rounded: 'rounded',
  curved: 'curved', full: 'full', squircle: 'curved'
}

/** The wizard's feel and a preset describe the same thing in different words. */
export function feelFromPreset(vibe: Vibe): Feel {
  const p = FEEL_PRESETS[vibe]
  return {
    name: p.label,
    primary: p.primary,
    secondary: p.secondary,
    tertiary: p.tertiary,
    headingFont: p.headingFont,
    bodyFont: p.bodyFont,
    corner: CORNER_AS_FEEL[p.cornerStyle],
    density: p.density,
    scale: p.scale,
    elevation: p.elevation
  }
}

/** A template's library, built the same way the wizard would build it. */
export function studioFromPreset(vibe: Vibe, name?: string): TokenStudio {
  const feel = feelFromPreset(vibe)
  return studioFromFeel(name ?? feel.name, feel)
}
