import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { InfoRail } from '../../src/renderer/src/components/InfoRail'
import { summarizeInsights, EMPTY_INSIGHTS } from '../../src/shared/sessionInsights'

// Rendered rather than merely typechecked, because the failure this guards
// against is a component that throws on first mount: the rail is behind a tab
// nobody opens during e2e, so a crash there would ship unnoticed.

const LONG_VAGUE = 'make the app faster and improve the user experience across the board'
const LONG_GOOD = 'reduce terminal cold start from 1583ms to under 800ms, measured by npm run bench'

function render(insights = EMPTY_INSIGHTS): string {
  return renderToStaticMarkup(<InfoRail insights={insights} />)
}

describe('InfoRail', () => {
  it('renders an empty session without throwing', () => {
    expect(render()).toContain('<aside')
  })

  it('renders a populated session', () => {
    const html = render(
      summarizeInsights({
        tasks: [
          { text: LONG_GOOD, status: 'in_progress' },
          { text: LONG_VAGUE, status: 'pending' },
          { text: 'Validate schema', status: 'pending' }
        ],
        memories: 3,
        autoContinue: { enabled: true, pokes: 2, lastReason: null }
      })
    )
    expect(html).toContain('<aside')
    expect(html.length).toBeGreaterThan(200)
  })

  // The whole reason hill is nullable. Rendering a bar for an unscored goal
  // would read as "scored near zero", which is the misleading number the
  // nullable type exists to avoid.
  it('draws no score bar for a goal too short to judge', () => {
    const html = render(summarizeInsights({ tasks: [{ text: 'Validate schema' }] }))
    // Scoped to the hill meter: the todo-progress bar is a separate, valid meter.
    expect(html).not.toContain('aria-label="How clear this step is')
    // And it says so in words the user can act on, rather than a number.
    expect(html.toLowerCase()).toContain('too short to judge')
  })

  it('draws a score bar for a goal it could judge', () => {
    const html = render(summarizeInsights({ tasks: [{ text: LONG_GOOD }] }))
    expect(html).toContain('aria-label="How clear this step is')
  })

  it('distinguishes a weak goal from a strong one', () => {
    const weak = render(summarizeInsights({ tasks: [{ text: LONG_VAGUE }] }))
    const strong = render(summarizeInsights({ tasks: [{ text: LONG_GOOD }] }))
    expect(weak).not.toBe(strong)
    expect(weak.toLowerCase()).toContain('needs a finish line')
    expect(strong.toLowerCase()).not.toContain('needs a finish line')
  })

  it('surfaces why auto-continue last stood down', () => {
    const html = render(
      summarizeInsights({
        tasks: [{ text: LONG_GOOD }],
        autoContinue: { enabled: true, pokes: 0, lastReason: 'Agent is waiting for you' }
      })
    )
    expect(html).toContain('Agent is waiting for you')
  })

  it('reports the scorable denominator so a median is not read as covering everything', () => {
    const html = render(
      summarizeInsights({ tasks: [{ text: 'Validate schema' }, { text: LONG_GOOD }] })
    )
    expect(html).toMatch(/1[^<]{0,20}2|2[^<]{0,20}1/)
  })

  // Project rules: no emoji as iconography, and there is no `danger` token, so
  // a class referencing one would silently render unstyled.
  it('uses no emoji and no non-existent tokens', () => {
    const html = render(
      summarizeInsights({
        tasks: [{ text: LONG_VAGUE }, { text: 'Validate schema' }],
        memories: 2,
        autoContinue: { enabled: false, pokes: 0, lastReason: 'Auto-continue is off' }
      })
    )
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(html).not.toMatch(/\b(bg|text|border)-danger\b/)
  })
})
