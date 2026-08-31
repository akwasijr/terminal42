export type GoalQualityReasonKind =
  | 'measurable-target'
  | 'verification-method'
  | 'concrete-target'
  | 'specificity'
  | 'vague-language'
  | 'missing-measure'
  | 'missing-verification'
  | 'not-goal'

export type GoalQualityReason = {
  kind: GoalQualityReasonKind
  impact: 'positive' | 'negative' | 'neutral'
  text: string
  suggestion?: string
}

export type GoalQualityAnalysis = {
  score: number
  reasons: GoalQualityReason[]
  suggestions: string[]
  isLikelyGoal: boolean
}

const CLIMBABLE_SCORE = 90
const MAX_REASON_SUGGESTIONS = 4

const VAGUE_TERMS = [
  'better',
  'faster',
  'slower',
  'cleaner',
  'improve',
  'improved',
  'improving',
  'optimize',
  'optimise',
  'optimized',
  'optimised',
  'nice',
  'nicer',
  'polish',
  'refactor',
  'streamline',
  'enhance',
  'fix up',
  'robust',
  'performant'
]

const GOAL_VERBS = [
  'make',
  'build',
  'create',
  'add',
  'implement',
  'fix',
  'reduce',
  'increase',
  'cut',
  'raise',
  'lower',
  'ensure',
  'convert',
  'replace',
  'remove',
  'support',
  'ship',
  'update',
  'write'
]

const COMMAND_VERBS = ['run', 'show', 'list', 'open', 'start', 'stop', 'restart', 'install', 'test', 'lint', 'build']

const GREETING_RE = /^(hi|hello|hey|thanks|thank you|ok|okay|cool|great|nice|yo|sup)[.!\s]*$/i
const QUESTION_RE = /^(what|why|how|where|when|who|can|could|would|should|is|are|do|does|did)\b/i
const STACK_TRACE_RE = /(?:^|\n)\s*(?:at\s+\S+\s+\(|File "[^"]+", line \d+|Caused by:|Traceback \(most recent call last\)|\w*Error:)/
const MEASURE_RE = /(?:\b\d+(?:\.\d+)?\s?(?:ms|s|sec|seconds?|min|minutes?|%|percent|px|kb|mb|gb|lines?|files?|tests?|errors?|warnings?|fps|requests?|req\/s|tokens?|chars?|characters?|words?|items?|rows?|columns?|steps?)\b|\b(?:under|below|over|above|at least|at most|no more than|less than|more than|within|by)\s+\d+(?:\.\d+)?\b|[<>]=?\s*\d+(?:\.\d+)?|\b\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\b)/i
const VERIFY_RE = /(?:\b(?:measured by|verified by|using|via|with|by running|run|passes?|passing|fails?|failing|test|tests|spec|benchmark|metric|profile|trace|assert|assertion|command|npm|pnpm|yarn|vitest|playwright|eslint|tsc|curl)\b|`[^`]+`)/i
const CONCRETE_RE = /(?:\b(?:src|tests|test|components?|functions?|classes?|files?|commands?|api|endpoint|route|module|screen|page|button|composer|terminal|renderer|main)\b|[\w./-]+\.(?:ts|tsx|js|jsx|css|json|md|yml|yaml)|`[^`]+`|\b[A-Z][A-Za-z0-9]+(?:[A-Z][A-Za-z0-9]+)+\b|\b[a-z][A-Za-z0-9]+\([^)]*\))/

export function analyzeGoalQuality(goalText: string): GoalQualityAnalysis {
  const text = goalText.trim()
  const words = wordsOf(text)

  if (!text) return ignoredAnalysis('Empty input is not a goal.')
  if (isNonGoal(text, words)) return ignoredAnalysis('This looks like a short exchange, command, question, or pasted output rather than a goal.')

  const reasons: GoalQualityReason[] = []
  let score = 58

  const measures = matches(text, MEASURE_RE)
  if (measures.length > 0) {
    score += 24
    reasons.push({
      kind: 'measurable-target',
      impact: 'positive',
      text: `Measurable target: “${measures[0]}”.`
    })
  } else {
    score -= 16
    reasons.push({
      kind: 'missing-measure',
      impact: 'negative',
      text: 'No measurable target or threshold found.',
      suggestion: 'Add the number that decides success, such as “below 100ms”, “0 failing tests”, or “at least 95%”.'
    })
  }

  const verification = matches(text, VERIFY_RE)
  if (verification.length > 0) {
    score += 18
    reasons.push({
      kind: 'verification-method',
      impact: 'positive',
      text: `Verification method: “${verification[0]}”.`
    })
  } else {
    score -= 14
    reasons.push({
      kind: 'missing-verification',
      impact: 'negative',
      text: 'No verification method found.',
      suggestion: 'Name the check the agent should run, for example “measured with npm run test -- goalQuality” or “verified by the benchmark output”.'
    })
  }

  const concrete = matches(text, CONCRETE_RE)
  if (concrete.length > 0) {
    score += 12
    reasons.push({
      kind: 'concrete-target',
      impact: 'positive',
      text: `Concrete target: “${concrete[0]}”.`
    })
  } else {
    score -= 8
    reasons.push({
      kind: 'concrete-target',
      impact: 'negative',
      text: 'No named file, function, command, screen, or component found.',
      suggestion: 'Name the surface to change, such as “Composer.tsx”, “terminal render path”, or the exact command output.'
    })
  }

  const vagueTerms = findVagueTerms(text)
  for (const term of vagueTerms) {
    if (!isVagueTermAnchored(text, term)) {
      score -= 11
      reasons.push({
        kind: 'vague-language',
        impact: 'negative',
        text: `Vague wording: “${term}”.`,
        suggestion: `${term} — compared to what, and measured how? Add the baseline and the target value.`
      })
    }
  }

  const specificity = specificityBonus(words.length, text)
  score += specificity
  reasons.push({
    kind: 'specificity',
    impact: specificity >= 0 ? 'positive' : 'negative',
    text: specificity >= 0 ? 'Enough detail to identify the intended work.' : 'Very little detail to distinguish a good attempt from a bad one.',
    suggestion: specificity >= 0 ? undefined : 'Add the affected surface, expected outcome, and how to verify it.'
  })

  const finalScore = clamp(Math.round(score), 0, 100)
  return {
    score: finalScore,
    reasons,
    suggestions: reasons.flatMap((reason) => reason.suggestion ? [reason.suggestion] : []).slice(0, MAX_REASON_SUGGESTIONS),
    isLikelyGoal: true
  }
}

export function goalQualityGateScore(): number {
  return CLIMBABLE_SCORE
}

function ignoredAnalysis(reason: string): GoalQualityAnalysis {
  return {
    score: 100,
    reasons: [{ kind: 'not-goal', impact: 'neutral', text: reason }],
    suggestions: [],
    isLikelyGoal: false
  }
}

function wordsOf(text: string): string[] {
  return text.match(/[A-Za-z0-9][A-Za-z0-9'-]*/g) ?? []
}

function isNonGoal(text: string, words: string[]): boolean {
  if (GREETING_RE.test(text)) return true
  if (STACK_TRACE_RE.test(text) && text.split('\n').length >= 3) return true
  if (words.length <= 2) return true
  if (QUESTION_RE.test(text) && text.endsWith('?')) return true
  if (words.length <= 5 && COMMAND_VERBS.includes(words[0].toLowerCase())) return true
  if (words.length <= 7 && !containsAny(text, GOAL_VERBS) && !containsAny(text, VAGUE_TERMS) && !MEASURE_RE.test(text)) return true
  return false
}

function containsAny(text: string, terms: string[]): boolean {
  const lower = text.toLowerCase()
  return terms.some((term) => lower.includes(term))
}

function matches(text: string, pattern: RegExp): string[] {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const re = new RegExp(pattern.source, flags)
  return [...text.matchAll(re)].map((match) => match[0].trim()).filter(Boolean)
}

function findVagueTerms(text: string): string[] {
  const found: string[] = []
  const lower = text.toLowerCase()
  for (const term of VAGUE_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${escaped}\\b`, 'i')
    if (re.test(lower)) found.push(term)
  }
  return found
}

function isVagueTermAnchored(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nearbyMeasure = new RegExp(`(?:${escaped}.{0,48}${MEASURE_RE.source}|${MEASURE_RE.source}.{0,48}${escaped})`, 'i')
  return nearbyMeasure.test(text)
}

function specificityBonus(wordCount: number, text: string): number {
  let score = 0
  if (wordCount >= 12) score += 8
  else if (wordCount >= 8) score += 4
  else score -= 8

  if (/[`/.-]/.test(text)) score += 3
  if (/[;:]/.test(text)) score += 2
  return score
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
