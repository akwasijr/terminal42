import {
  parseAgentReply, buildAssistantPrompt,
  STRUCTURE_DIRECTIVE, visualDirective, critiqueDirective, variantDirective, VISION_BRIEF_DIRECTIVE,
  type AgentAction, type AgentReply, type CanvasContext, type ChatTurn
} from './canvasAgent'

// A model call: returns raw text. Injected so the pipeline is testable without a
// live model and so the same orchestration can drive text or vision completions.
export type Completer = (prompt: string, images?: string[]) => Promise<string>

export interface RunOpts {
  ctx: CanvasContext
  brain?: string
  history: ChatTurn[]
  userText: string
  quality: boolean
  images?: string[]
  /** total design options to produce (1 = just the primary, no extra variants) */
  variants?: number
  complete: Completer
  onStage?: (label: string) => void
}

export interface StageTrace {
  stage: string
  ms: number
  ok: boolean
  raw: string
  actions: string[]
  error?: string
}

export interface RunResult {
  primary: AgentReply
  /** each entry is a full action set for an alternate, placed on its own artboard */
  variants: AgentAction[][]
  styleBrief?: string
  /** every model call, captured for the generation inspector */
  trace: StageTrace[]
}

const hasKind = (r: AgentReply, k: AgentAction['kind']): boolean => r.actions.some((a) => a.kind === k)
const isBuild = (r: AgentReply): boolean => hasKind(r, 'create') || hasKind(r, 'screen')
const summarize = (r: AgentReply): string[] => r.actions.map((a) => ('summary' in a && a.summary ? `${a.kind}: ${a.summary}` : a.kind))

/**
 * Senior-designer pipeline. Fast mode = one pass. Quality mode runs
 * structure → visual → critique, then explores N-1 variants, with graceful
 * fallback at every stage so a weak/garbled stage never loses the prior good result.
 * Every model call is recorded in `trace` for the generation inspector.
 */
export async function runDesignPipeline(o: RunOpts): Promise<RunResult> {
  const variantsN = Math.max(1, o.variants ?? 1)
  const trace: StageTrace[] = []

  // Wrap one model call: time it, capture raw output + any error, parse, record.
  const step = async (stage: string, prompt: string, images?: string[]): Promise<{ reply: AgentReply; rawText: string }> => {
    const t0 = Date.now()
    let rawText = ''
    let error: string | undefined
    try { rawText = await o.complete(prompt, images) } catch (e) { error = String(e) }
    const reply = error ? { actions: [] } : parseAgentReply(rawText)
    trace.push({ stage, ms: Date.now() - t0, ok: !error && (reply.actions.length > 0 || !!reply.reply), raw: rawText.slice(0, 12000), actions: error ? [] : summarize(reply), error })
    return { reply, rawText }
  }

  // 0) Reference grounding (vision) — extract a style brief from attached images.
  let styleBrief = ''
  if (o.images && o.images.length) {
    o.onStage?.('Reading your reference')
    const t0 = Date.now()
    try { styleBrief = (await o.complete(VISION_BRIEF_DIRECTIVE, o.images)).trim() } catch (e) { trace.push({ stage: 'Reference (vision)', ms: Date.now() - t0, ok: false, raw: '', actions: [], error: String(e) }) }
    if (styleBrief) trace.push({ stage: 'Reference (vision)', ms: Date.now() - t0, ok: true, raw: styleBrief.slice(0, 4000), actions: ['style brief extracted'] })
  }
  const ctx: CanvasContext = {
    ...o.ctx,
    brain: [o.brain ?? '', styleBrief ? `REFERENCE STYLE BRIEF (match this look closely):\n${styleBrief}` : ''].filter(Boolean).join('\n\n') || undefined
  }
  const mk = (extra: string, includeGolden = false): string => buildAssistantPrompt(ctx, o.history, o.userText, o.quality, extra, includeGolden)

  // Fast mode: single pass (golden reference on — it's the only shot at quality).
  if (!o.quality) {
    o.onStage?.('Designing your screen')
    const r = await step('Design (fast)', mk('', true))
    return { primary: r.reply, variants: [], styleBrief, trace }
  }

  // Quality stage 1 — structure / wireframe. Only this stage carries the golden
  // reference; later stages already receive the full prior design, so re-sending
  // the example just burns tokens (and time).
  o.onStage?.('Planning the layout')
  const s1 = await step('Structure', mk(STRUCTURE_DIRECTIVE, true))
  if (hasKind(s1.reply, 'question') || !isBuild(s1.reply)) {
    return { primary: s1.reply, variants: [], styleBrief, trace }
  }

  // Variants depend ONLY on the structure, so fire them off now and let them run
  // concurrently with the visual→critique chain instead of after it (big speed win).
  const variantJobs: Promise<{ reply: AgentReply; rawText: string }>[] = []
  for (let i = 2; i <= variantsN; i++) variantJobs.push(step(`Variant ${i}`, mk(variantDirective(s1.rawText, i))))

  // Quality stage 2 — visual design (falls back to structure).
  o.onStage?.('Applying visual design')
  let primary = s1.reply
  let primaryRaw = s1.rawText
  const s2 = await step('Visual design', mk(visualDirective(s1.rawText)))
  if (isBuild(s2.reply)) { primary = s2.reply; primaryRaw = s2.rawText }

  // Quality stage 3 — critique & fix (falls back to visual).
  o.onStage?.('Reviewing & polishing')
  const s3 = await step('Critique & fix', mk(critiqueDirective(primaryRaw)))
  if (isBuild(s3.reply)) primary = s3.reply

  // Collect the variants that ran in the background.
  const variants: AgentAction[][] = []
  if (variantJobs.length) {
    o.onStage?.('Finishing options')
    for (const sv of await Promise.all(variantJobs)) if (isBuild(sv.reply)) variants.push(sv.reply.actions)
  }

  return { primary, variants, styleBrief, trace }
}
