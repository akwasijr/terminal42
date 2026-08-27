// Asking the model for a feel, not for two hundred tokens.
//
// The temptation with tokens and a language model is to have it emit the
// whole set. It will, and roughly a tenth of the aliases will point at
// nothing. So the model is asked for the only part it is actually good at:
// reading a sentence about a product and choosing colours, type and a
// temperament. The two hundred tokens are then derived from that by code
// that cannot get an alias wrong.

import type { Feel } from '../../../shared/tokens/scaffold'

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export function buildFeelPrompt(brief: string): string {
  return [
    'You are choosing the visual character of a product from a short brief.',
    '',
    'Brief:',
    brief.trim() || 'A general purpose product with no stated character.',
    '',
    'Reply with JSON only, no prose and no code fence, exactly this shape:',
    '{',
    '  "name": "two or three words naming the look",',
    '  "primary": "#rrggbb",',
    '  "secondary": "#rrggbb",',
    '  "tertiary": "#rrggbb",',
    '  "headingFont": "a real font family name",',
    '  "bodyFont": "a real font family name",',
    '  "corner": "angular | slight | rounded | curved | full",',
    '  "density": "compact | cozy | comfortable | spacious",',
    '  "scale": "compact | balanced | expressive",',
    '  "elevation": "flat | subtle | elevated"',
    '}',
    '',
    'Rules:',
    '- primary carries the brand. secondary and tertiary must be clearly',
    '  different from it in hue, not three shades of one colour.',
    '- Every colour must read as text on white, so nothing paler than a',
    '  mid tone.',
    '- Fonts must be families that really exist and are available on Google',
    '  Fonts. Avoid Inter unless the brief asks for something plain.',
    '- Choose the temperament from the brief. A bank is not playful and a',
    '  childrens app is not brutalist.'
  ].join('\n')
}

const CORNERS = ['angular', 'slight', 'rounded', 'curved', 'full'] as const
const DENSITIES = ['compact', 'cozy', 'comfortable', 'spacious'] as const
const SCALES = ['compact', 'balanced', 'expressive'] as const
const ELEVATIONS = ['flat', 'subtle', 'elevated'] as const

function pick<T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] {
  const s = String(v ?? '').toLowerCase().trim()
  return (list as readonly string[]).includes(s) ? (s as T[number]) : fallback
}

function colour(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim()
  return HEX.test(s) ? s : fallback
}

function font(v: unknown, fallback: string): string {
  const s = String(v ?? '').trim()
  return s.length > 0 && s.length < 48 ? s : fallback
}

/**
 * Read a reply into a feel, replacing anything wrong rather than failing.
 *
 * A reply that is half right is worth keeping: the studio it makes is still
 * a better start than a blank one, and every field it got wrong is visible
 * on screen and one click from being changed.
 */
export function parseFeelReply(text: string, fallback: Feel): Feel {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return fallback
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return fallback
  }
  const name = String(raw.name ?? '').trim()
  return {
    name: name.length > 0 && name.length < 48 ? name : fallback.name,
    primary: colour(raw.primary, fallback.primary),
    secondary: colour(raw.secondary, fallback.secondary),
    tertiary: colour(raw.tertiary, fallback.tertiary),
    headingFont: font(raw.headingFont, fallback.headingFont),
    bodyFont: font(raw.bodyFont, fallback.bodyFont),
    corner: pick(CORNERS, raw.corner, fallback.corner),
    density: pick(DENSITIES, raw.density, fallback.density),
    scale: pick(SCALES, raw.scale, fallback.scale),
    elevation: pick(ELEVATIONS, raw.elevation, fallback.elevation)
  }
}
