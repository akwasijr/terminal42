// Plan protocol parser
//
// The model is instructed (see planningProtocolBlock in src/main/design.ts)
// to emit a ```plan ...``` JSON block as its first reply listing 3-8 steps,
// then ```plan-update ...``` blocks before/after each step. This module
// scans assistant message bodies for those fenced blocks, builds an
// in-memory `PlanState`, and also produces a "clean" content string with
// the control fences stripped out so the chat doesn't show the JSON to
// the user.
//
// Scope: plan state is built PER assistant message (one plan per run).
// Each Copilot run emits exactly one assistant message that contains both
// the initial `plan` fence and all subsequent `plan-update` fences for
// that run, so per-message scope keeps plans for follow-up changes (e.g.
// annotations) cleanly separated from the initial design plan.
//
// Design choices:
// - Tolerant parser: allow ```plan, ```plan-update, optional language tag,
//   trailing whitespace, missing closing fence (mid-stream).
// - Last update wins per step id.
// - Plan order is fixed by the first ```plan block in the message; later
//   plan blocks in the same message are ignored.
// - needs_input is sticky until a subsequent in_progress/done arrives.

export type PlanStepStatus = 'pending' | 'in_progress' | 'done' | 'needs_input'

export type PlanStep = {
  id: string
  title: string
  detail?: string
  status: PlanStepStatus
  note?: string
  question?: string
}

export type PlanState = {
  steps: PlanStep[]
  // True once any plan-update marks the final "verify" step done.
  verified: boolean
  // True if at least one step has progressed past pending. Used to decide
  // whether to keep an inert (all-pending) plan visible in chat history.
  hasProgress: boolean
}

const FENCE_RE = /```(plan|plan-update)\b[^\n]*\n([\s\S]*?)(?:```|$)/g

type ParsedFence = { kind: 'plan' | 'update'; payload: unknown }

function parseFences(content: string): ParsedFence[] {
  const out: ParsedFence[] = []
  if (!content) return out
  FENCE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FENCE_RE.exec(content)) !== null) {
    const tag = m[1]
    const body = (m[2] ?? '').trim()
    if (!body) continue
    try {
      const json = JSON.parse(body)
      if (tag === 'plan' && json && typeof json === 'object' && Array.isArray((json as { plan?: unknown }).plan)) {
        out.push({ kind: 'plan', payload: json })
      } else if (tag === 'plan-update' && json && typeof json === 'object' && (json as { update?: unknown }).update) {
        out.push({ kind: 'update', payload: json })
      }
    } catch {
      // Mid-stream JSON or model typo — ignore and keep scanning.
    }
  }
  return out
}

// Build plan state from a single assistant message body. Returns null
// when the message contains no ```plan fence (no plan to render). Used
// so each Copilot run owns its own plan checklist, and plans for
// follow-up changes don't collide with the initial design plan.
export function buildPlanStateForMessage(content: string): PlanState | null {
  if (!content) return null
  const fences = parseFences(content)
  if (!fences.length) return null
  const steps: PlanStep[] = []
  const stepIndex = new Map<string, number>()
  let planSeen = false

  for (const f of fences) {
    if (f.kind === 'plan' && !planSeen) {
      planSeen = true
      const raw = (f.payload as { plan: Array<Record<string, unknown>> }).plan
      for (const s of raw) {
        const id = typeof s.id === 'string' && s.id ? s.id : `s${steps.length + 1}`
        const title = typeof s.title === 'string' ? s.title : '(untitled step)'
        const detail = typeof s.detail === 'string' ? s.detail : undefined
        if (stepIndex.has(id)) continue
        stepIndex.set(id, steps.length)
        steps.push({ id, title, detail, status: 'pending' })
      }
    } else if (f.kind === 'update') {
      const u = (f.payload as { update: Record<string, unknown> }).update
      const id = typeof u.id === 'string' ? u.id : null
      if (!id) continue
      const idx = stepIndex.get(id)
      if (idx == null) continue
      const status = (typeof u.status === 'string' ? u.status : 'pending') as PlanStepStatus
      const allowed: PlanStepStatus[] = ['pending', 'in_progress', 'done', 'needs_input']
      if (!allowed.includes(status)) continue
      const note = typeof u.note === 'string' ? u.note : steps[idx].note
      const question = typeof u.question === 'string' ? u.question : status === 'needs_input' ? steps[idx].question : undefined
      steps[idx] = { ...steps[idx], status, note, question }
    }
  }

  if (!planSeen) return null

  const verifyStep = steps.find((s) => s.id === 'verify')
  const verified = !!verifyStep && verifyStep.status === 'done'
  const hasProgress = steps.some((s) => s.status !== 'pending')
  return { steps, verified, hasProgress }
}

// Strip the control fences from a single message body so the chat shows
// only the user-facing prose. Safe to call on mid-stream content.
export function stripPlanFences(content: string): string {
  if (!content) return content
  // Replace each fenced block with an empty string, collapse blank-line
  // runs that result, trim.
  let out = content.replace(FENCE_RE, '')
  // Drop the leading whitespace left when the message is JUST a plan block.
  out = out.replace(/\n{3,}/g, '\n\n').trim()
  return out
}

// Test if a body contains a plan or plan-update fence. Used by callers
// that want to skip the empty-content placeholder when the only content
// so far is a control block.
export function containsPlanFence(content: string): boolean {
  if (!content) return false
  FENCE_RE.lastIndex = 0
  return FENCE_RE.test(content)
}
