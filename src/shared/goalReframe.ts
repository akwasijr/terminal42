import { analyzeGoalQuality, type GoalQualityAnalysis } from './goalQuality'
import { canScoreGoal, HILL_GATE } from './sessionInsights'

export type GoalReframeMissingKind =
  | 'objective'
  | 'affected_surface'
  | 'measurable_quantity'
  | 'current_baseline'
  | 'target_value'
  | 'feedback_loop'
  | 'deadline_or_bound'

export type GoalReframeMissingElement = {
  kind: GoalReframeMissingKind
  label: string
  reason: string
  add: string
  slot: string
  examples: readonly string[]
}

export type GoalReframeField = {
  label: string
  value: string
}

export type GoalFeedbackLoopSuggestion = {
  slot: 'feedback_loop'
  add: string
  examples: readonly string[]
}

export type GoalReframe = {
  originalText: string
  analysis: GoalQualityAnalysis
  rawScore: number
  credibleScore: number | null
  gate: number
  canScore: boolean
  meetsGate: boolean
  shouldPushBack: boolean
  missing: readonly GoalReframeMissingElement[]
  fields: readonly GoalReframeField[]
  feedbackLoop: GoalFeedbackLoopSuggestion
}

type MissingTemplate = Omit<GoalReframeMissingElement, 'examples'>

const MISSING_TEMPLATES: Record<GoalReframeMissingKind, MissingTemplate> = {
  objective: {
    kind: 'objective',
    label: 'Objective',
    reason: 'The goal does not state the specific outcome the agent should climb toward.',
    add: 'State the concrete result to produce.',
    slot: '<objective>'
  },
  affected_surface: {
    kind: 'affected_surface',
    label: 'Affected surface',
    reason: 'The goal does not name the file, module, screen, command, or behavior to change.',
    add: 'Name the exact surface where success should appear.',
    slot: '<file/module/screen/command>'
  },
  measurable_quantity: {
    kind: 'measurable_quantity',
    label: 'Measurable quantity',
    reason: 'The goal has no metric that distinguishes a better iteration from a worse one.',
    add: 'Choose the quantity the agent should improve.',
    slot: '<metric>'
  },
  current_baseline: {
    kind: 'current_baseline',
    label: 'Current baseline',
    reason: 'The goal does not say where the metric starts, so improvement cannot be compared.',
    add: 'Record the current measured value before changing code.',
    slot: '<current baseline>'
  },
  target_value: {
    kind: 'target_value',
    label: 'Target value',
    reason: 'The goal does not define the value that counts as done.',
    add: 'Set a threshold, count, or pass condition.',
    slot: '<target value>'
  },
  feedback_loop: {
    kind: 'feedback_loop',
    label: 'Feedback loop',
    reason: 'The goal does not name the process that measures each iteration.',
    add: 'Name the command, benchmark, test, trace, or review process to rerun.',
    slot: '<feedback_loop>'
  },
  deadline_or_bound: {
    kind: 'deadline_or_bound',
    label: 'Deadline or bound',
    reason: 'The goal is open-ended without a stopping boundary.',
    add: 'Add a timebox, scope limit, or threshold that prevents endless polishing.',
    slot: '<deadline/scope bound>'
  }
}

const DEFAULT_FEEDBACK_EXAMPLES = ['npm run test', 'npm run typecheck', 'npm run bench'] as const

export function meetsHillGate(score: number | null): boolean {
  return score !== null && score >= HILL_GATE
}

export function reframeGoal(text: string): GoalReframe {
  const originalText = text.trim()
  const analysis = analyzeGoalQuality(originalText)
  const scorable = canScoreGoal(originalText)
  const credibleScore = scorable && analysis.isLikelyGoal ? analysis.score : null
  const passesGate = meetsHillGate(credibleScore)
  const feedbackLoop = suggestFeedbackLoop(originalText)
  const missing = buildMissingElements(originalText, analysis, scorable, passesGate, feedbackLoop.examples)

  return {
    originalText,
    analysis,
    rawScore: analysis.score,
    credibleScore,
    gate: HILL_GATE,
    canScore: scorable,
    meetsGate: passesGate,
    shouldPushBack: !passesGate && missing.length > 0,
    missing,
    fields: buildFields(originalText, missing, feedbackLoop),
    feedbackLoop
  }
}

/**
 * Renders the push-back as terse prompt text.
 *
 * Returns an empty string when the goal already passes, because this is
 * spliced into a live prompt: telling a model to "reframe into a verifiable
 * goal" when its goal already scores 100 is worse than saying nothing, and
 * every token here is paid for on a message that did not need it.
 *
 * Only missing elements are listed. Echoing slots the goal already satisfies
 * ("Metric: <existing metric>") adds length without adding information.
 */
export function renderGoalReframePrompt(reframe: GoalReframe): string {
  if (!reframe.shouldPushBack) return ''

  const wanted = new Set(reframe.missing.map((item) => item.kind))
  const asks = reframe.fields
    .filter((field) => {
      const kind = FIELD_KIND[field.label]
      return kind !== undefined && wanted.has(kind)
    })
    .map((field) => `${field.label}: ${field.value}`)

  const parts = ['This goal has nothing measurable to iterate against.']
  if (asks.length) parts.push(`Restate it with ${asks.join('; ')}.`)
  // Only demanded when it is actually absent; a goal that already names its
  // verification does not need to be told to name one.
  if (wanted.has('feedback_loop')) {
    parts.push('Name the feedback_loop you will rerun to check whether each attempt improved.')
  }
  return parts.join(' ')
}

// Maps the display labels back onto the diagnosis, so the renderer can drop
// fields the goal already covers.
const FIELD_KIND: Record<string, GoalReframeMissingKind | undefined> = {
  Objective: 'objective',
  Surface: 'affected_surface',
  Metric: 'measurable_quantity',
  Baseline: 'current_baseline',
  Target: 'target_value',
  feedback_loop: 'feedback_loop',
  Bound: 'deadline_or_bound'
}

function buildMissingElements(
  text: string,
  analysis: GoalQualityAnalysis,
  scorable: boolean,
  passesGate: boolean,
  feedbackExamples: readonly string[]
): GoalReframeMissingElement[] {
  if (passesGate) return []

  const kinds = new Set<GoalReframeMissingKind>()
  const negativeReasons = new Set(
    analysis.reasons.filter((reason) => reason.impact === 'negative').map((reason) => reason.kind)
  )

  if (!scorable || !analysis.isLikelyGoal) kinds.add('objective')
  if (negativeReasons.has('concrete-target')) kinds.add('affected_surface')
  if (negativeReasons.has('missing-measure')) {
    kinds.add('measurable_quantity')
    kinds.add('current_baseline')
    kinds.add('target_value')
    kinds.add('deadline_or_bound')
  }
  if (negativeReasons.has('missing-verification')) kinds.add('feedback_loop')
  if (negativeReasons.has('vague-language')) {
    kinds.add('measurable_quantity')
    if (!hasBaseline(text)) kinds.add('current_baseline')
    if (!hasTarget(text)) kinds.add('target_value')
  }
  if (negativeReasons.has('specificity')) {
    kinds.add('objective')
    kinds.add('affected_surface')
  }

  if (!hasFeedbackLoop(analysis)) kinds.add('feedback_loop')
  if (!hasBaseline(text) && kinds.has('measurable_quantity')) kinds.add('current_baseline')
  if (!hasTarget(text) && kinds.has('measurable_quantity')) kinds.add('target_value')

  return [...kinds].map((kind) => ({
    ...MISSING_TEMPLATES[kind],
    examples: examplesFor(kind, feedbackExamples)
  }))
}

function buildFields(
  text: string,
  missing: readonly GoalReframeMissingElement[],
  feedbackLoop: GoalFeedbackLoopSuggestion
): GoalReframeField[] {
  const missingKinds = new Set(missing.map((item) => item.kind))
  const metricSlot = missingKinds.has('measurable_quantity') ? '<metric>' : '<existing metric>'
  const baselineSlot = missingKinds.has('current_baseline') ? '<current baseline>' : '<existing baseline>'
  const targetSlot = missingKinds.has('target_value') ? '<target value>' : '<existing target>'
  const surfaceSlot = missingKinds.has('affected_surface') ? '<affected surface>' : '<named surface>'

  return [
    { label: 'Objective', value: missingKinds.has('objective') ? '<specific outcome>' : text },
    { label: 'Surface', value: surfaceSlot },
    { label: 'Metric', value: metricSlot },
    { label: 'Baseline', value: baselineSlot },
    { label: 'Target', value: targetSlot },
    { label: 'feedback_loop', value: feedbackLoop.examples[0] ?? feedbackLoop.slot },
    { label: 'Bound', value: missingKinds.has('deadline_or_bound') ? '<timebox or scope limit>' : '<existing bound>' }
  ]
}

function suggestFeedbackLoop(text: string): GoalFeedbackLoopSuggestion {
  const lower = text.toLowerCase()
  const examples = feedbackExamplesFor(lower)
  return {
    slot: 'feedback_loop',
    add: 'Run this after each iteration and compare the measured result with the baseline and target.',
    examples
  }
}

function feedbackExamplesFor(lowerText: string): readonly string[] {
  if (/(fast|faster|slow|slower|startup|start|cold start|bench|benchmark|performance|performant|latency|ms)\b/.test(lowerText)) {
    return ['npm run bench', 'npm run test', 'npm run typecheck']
  }
  if (/(test|tests|vitest|passing|failing|regression|spec)\b/.test(lowerText)) {
    return ['npm run test', 'npm run typecheck']
  }
  if (/(type|typescript|tsc|refactor|module|maintainable|codebase)\b/.test(lowerText)) {
    return ['npm run typecheck', 'npm run test']
  }
  return DEFAULT_FEEDBACK_EXAMPLES
}

function examplesFor(kind: GoalReframeMissingKind, feedbackExamples: readonly string[]): readonly string[] {
  switch (kind) {
    case 'objective':
      return ['reduce terminal cold start', 'get unit tests passing after the pty refactor']
    case 'affected_surface':
      return ['src/renderer/src/components/TerminalPane.tsx', 'pty module', 'composer input flow']
    case 'measurable_quantity':
      return ['cold start time in ms', 'failing test count', 'TypeScript error count']
    case 'current_baseline':
      return ['from <current ms>', 'currently <failing test count> failing', 'baseline from the first benchmark run']
    case 'target_value':
      return ['under <target ms>', '0 failing tests', 'no typecheck errors']
    case 'feedback_loop':
      return feedbackExamples
    case 'deadline_or_bound':
      return ['within this refactor', 'for the pty module only', 'before adding new features']
  }
}

function hasFeedbackLoop(analysis: GoalQualityAnalysis): boolean {
  return analysis.reasons.some((reason) => reason.kind === 'verification-method' && reason.impact === 'positive')
}

function hasBaseline(text: string): boolean {
  return /\b(?:from|baseline|current(?:ly)?|today|now)\b.{0,32}\d/i.test(text) || /\d+(?:\.\d+)?\s?(?:ms|s|%|tests?|errors?)\b.{0,24}\b(?:today|currently|now)\b/i.test(text)
}

function hasTarget(text: string): boolean {
  return /\b(?:under|below|over|above|at least|at most|no more than|less than|more than|within|to|all|zero|0)\b.{0,40}(?:\d|passing|failing|errors?)/i.test(text)
}
