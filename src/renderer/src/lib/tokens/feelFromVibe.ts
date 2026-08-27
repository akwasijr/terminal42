// The design system's nine feels, said in the vocabulary the token scaffold
// reads. Kept out of the setup component so the component file exports only
// components, and so anything else that needs a feel can ask for one.

import { FEEL_PRESETS, type Vibe } from '../designSystem'
import type { Feel } from '../../../../shared/tokens/scaffold'

export function feelFromVibe(v: Vibe): Feel {
  const p = FEEL_PRESETS[v]
  return {
    name: p.label,
    primary: p.primary,
    secondary: p.secondary,
    tertiary: p.tertiary,
    headingFont: p.headingFont,
    bodyFont: p.bodyFont,
    corner: p.cornerStyle === 'squircle' ? 'curved' : p.cornerStyle,
    density: p.density,
    scale: p.scale,
    elevation: p.elevation
  }
}
