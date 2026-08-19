import { describe, it, expect } from 'vitest'
import { runDesignPipeline, type Completer } from '../../src/renderer/src/lib/designPipeline'
import { type CanvasContext } from '../../src/renderer/src/lib/canvasAgent'

const ctx: CanvasContext = { artboard: { w: 390, h: 844, bg: '#ffffff' }, layers: [], selection: [] }
const base = { ctx, history: [], userText: 'build a profile screen' }

const createReply = (name: string): string => JSON.stringify({ actions: [{ kind: 'create', summary: name, objects: [{ type: 'frame', name }] }] })

/** Fake model that responds based on which stage directive is in the prompt. */
function fake(opts: { struct?: string; visual?: string; critique?: string; variant?: string; vision?: string; fast?: string } = {}): { complete: Completer; prompts: string[]; images: number } {
  const state = { prompts: [] as string[], images: 0 }
  const complete: Completer = async (prompt, images) => {
    state.prompts.push(prompt)
    if (images && images.length) { state.images++; return opts.vision ?? 'Palette: #111; minimal; rounded.' }
    if (prompt.includes('STAGE 1 of 3')) return opts.struct ?? createReply('Structure')
    if (prompt.includes('STAGE 2 of 3')) return opts.visual ?? createReply('Visual')
    if (prompt.includes('STAGE 3 of 3')) return opts.critique ?? createReply('Critique')
    if (prompt.includes('VARIANT')) return opts.variant ?? createReply('Variant')
    return opts.fast ?? createReply('Fast')
  }
  return { complete, get prompts() { return state.prompts }, get images() { return state.images } }
}

describe('runDesignPipeline — fast mode', () => {
  it('makes exactly one model call', async () => {
    const f = fake()
    const r = await runDesignPipeline({ ...base, quality: false, complete: f.complete })
    expect(f.prompts).toHaveLength(1)
    expect(r.primary.actions[0]).toMatchObject({ kind: 'create', summary: 'Fast' })
    expect(r.variants).toHaveLength(0)
  })
})

describe('runDesignPipeline — quality mode', () => {
  it('runs structure → visual → critique and returns the critique result', async () => {
    const f = fake()
    const r = await runDesignPipeline({ ...base, quality: true, variants: 1, complete: f.complete })
    expect(f.prompts).toHaveLength(3)
    expect(r.primary.actions[0]).toMatchObject({ summary: 'Critique' })
  })
  it('produces N-1 variants on top of the primary', async () => {
    const f = fake()
    const r = await runDesignPipeline({ ...base, quality: true, variants: 3, complete: f.complete })
    // structure + visual + critique + 2 variants = 5
    expect(f.prompts).toHaveLength(5)
    expect(r.variants).toHaveLength(2)
  })
  it('short-circuits on a clarifying question (only the structure call)', async () => {
    const f = fake({ struct: JSON.stringify({ actions: [{ kind: 'question', text: 'Phone or desktop?', options: ['Phone', 'Desktop'] }] }) })
    const r = await runDesignPipeline({ ...base, quality: true, variants: 3, complete: f.complete })
    expect(f.prompts).toHaveLength(1)
    expect(r.primary.actions[0].kind).toBe('question')
  })
  it('falls back to structure when the visual stage returns junk', async () => {
    const f = fake({ visual: 'not json at all' })
    const r = await runDesignPipeline({ ...base, quality: true, variants: 1, complete: f.complete })
    // critique also runs on the fallback; with default critique it returns Critique
    expect(r.primary.actions.some((a) => a.kind === 'create')).toBe(true)
  })
  it('keeps the visual result when critique returns junk', async () => {
    const f = fake({ critique: 'garbage' })
    const r = await runDesignPipeline({ ...base, quality: true, variants: 1, complete: f.complete })
    expect(r.primary.actions[0]).toMatchObject({ summary: 'Visual' })
  })
  it('records a trace of every model call (raw + parsed + timing)', async () => {
    const f = fake()
    const r = await runDesignPipeline({ ...base, quality: true, variants: 2, complete: f.complete })
    // Variants run concurrently with visual/critique, so assert membership not order.
    expect(r.trace.map((t) => t.stage).sort()).toEqual(['Critique & fix', 'Structure', 'Variant 2', 'Visual design'])
    expect(r.trace.every((t) => t.ok && t.raw.length > 0)).toBe(true)
    expect(r.trace.find((t) => t.stage === 'Structure')!.actions[0]).toContain('create')
  })
})

describe('runDesignPipeline — reference grounding', () => {
  it('calls vision first when images are attached and feeds the brief downstream', async () => {
    const f = fake()
    await runDesignPipeline({ ...base, quality: false, images: ['data:image/png;base64,AAAA'], complete: f.complete })
    expect(f.images).toBe(1)
    // fast pass prompt should carry the extracted style brief
    expect(f.prompts.some((p) => p.includes('REFERENCE STYLE BRIEF'))).toBe(true)
  })
})
