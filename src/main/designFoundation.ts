// Design foundation directives: the studio's quality bar and look anatomy,
// distilled from the Studio Ark builds. Injected at the top of the generation
// prompt so every design starts from the same considered baseline.

export type LookAnatomy = {
  surfaces: string
  type: string
  shape: string
  motion: string
  signature: string
}

export function buildFoundationBlock(opts: {
  look?: string | null
  designSystem?: string | null
  theme?: string | null
}): string {
  const lines: string[] = [
    'DESIGN FOUNDATION',
    'You are a senior product / brand designer. The bar is editorial, calm, premium and confident: it must look hand-designed by a studio, never like a template and never like generic "AI" output. Whitespace, real typography and real imagery do the work.',
    '',
    'Look anatomy:',
    '- Surfaces: flat. One page background, a calm surface for panels, and at most a soft flat tint. No elevation games, no gradients.',
    '- Type: a clear hierarchy from one characterful display face and one clean body face. Prefer a modern sans or grotesque; reach for serif only as a deliberate choice, not a default. Strong size contrast between a large headline and calm body copy. Sentence or title case.',
    '- Color: one dominant brand color plus neutrals and lots of whitespace. Color is used with intent, not sprinkled everywhere.',
    '- Shape: a consistent corner radius and a consistent, generous spacing scale on a 4px grid. Alignment is deliberate.',
    '- Motion: understated. Gentle reveals on scroll, soft hovers. Only transform and opacity, always honoring reduced motion.',
    '- Signature: every design needs one considered, memorable detail (a distinctive type treatment, a confident hero, a quiet but precise layout), never decoration for its own sake.',
    '',
    'When in doubt, remove decoration and add whitespace.',
  ]

  if (opts.look) lines.push('', `Requested look / mood: ${opts.look}.`)
  if (opts.designSystem) lines.push(`Follow the conventions of the ${opts.designSystem} design system where they do not conflict with the rules below.`)
  if (opts.theme) lines.push(`Theme: ${opts.theme}.`)

  return lines.join('\n')
}
