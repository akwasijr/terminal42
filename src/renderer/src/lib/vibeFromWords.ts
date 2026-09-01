import type { Vibe } from './designSystem'

/**
 * The nine feel tiles are gone from the wizard, so the words someone writes
 * have to carry the choice. Each feel keeps a small vocabulary; the feel whose
 * words show up most in the description wins, and minimal holds the floor.
 */
const VOCAB: Record<Vibe, string[]> = {
  minimal: ['minimal', 'minimalist', 'clean', 'calm', 'quiet', 'simple', 'plain', 'neutral', 'sparse', 'airy', 'understated', 'restrained', 'whitespace', 'uncluttered', 'spacious'],
  professional: ['professional', 'corporate', 'business', 'enterprise', 'formal', 'trustworthy', 'reliable', 'serious', 'banking', 'finance', 'fintech', 'accessible', 'structured', 'saas', 'b2b', 'dashboard', 'admin'],
  bold: ['bold', 'loud', 'confident', 'dramatic', 'striking', 'punchy', 'strong', 'contrast', 'impact', 'energetic', 'vivid', 'statement', 'daring', 'brave'],
  playful: ['playful', 'fun', 'friendly', 'cheerful', 'happy', 'bright', 'lively', 'quirky', 'joyful', 'colourful', 'colorful', 'whimsical', 'kids', 'game', 'gaming', 'casual', 'approachable'],
  soft: ['soft', 'gentle', 'warm', 'pastel', 'pastels', 'wellness', 'calming', 'cosy', 'cozy', 'tender', 'rounded', 'welcoming', 'health', 'care', 'kind'],
  elegant: ['elegant', 'editorial', 'refined', 'serif', 'magazine', 'sophisticated', 'graceful', 'classic', 'timeless', 'literary', 'publishing', 'journal', 'boutique'],
  brutalist: ['brutalist', 'brutal', 'raw', 'angular', 'harsh', 'stark', 'unpolished', 'concrete', 'aggressive', 'blocky', 'anti-design', 'zine', 'punk'],
  technical: ['technical', 'developer', 'devtool', 'engineer', 'engineering', 'mono', 'monospace', 'terminal', 'code', 'dense', 'data', 'cli', 'api', 'infrastructure', 'analytics', 'ide'],
  luxe: ['luxe', 'luxury', 'luxurious', 'premium', 'gold', 'expensive', 'exclusive', 'high-end', 'opulent', 'lavish', 'couture', 'jewellery', 'jewelry', 'watch', 'fashion']
}

const ORDER: Vibe[] = ['minimal', 'professional', 'bold', 'playful', 'soft', 'elegant', 'brutalist', 'technical', 'luxe']

/** Split a description into lowercase word stems we can match against. */
export function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z-]+/).filter(Boolean)
}

/** Score every feel against a description. Exported so the tests can see the shape. */
export function vibeScores(text: string): Record<Vibe, number> {
  const seen = new Set(words(text))
  const out = {} as Record<Vibe, number>
  for (const v of ORDER) out[v] = VOCAB[v].filter((w) => seen.has(w)).length
  return out
}

/**
 * The feel a description reads as. Ties break towards the earlier feel in
 * ORDER, and a description that matches nothing stays minimal.
 */
export function vibeFromWords(text: string, fallback: Vibe = 'minimal'): Vibe {
  const scores = vibeScores(text)
  let best: Vibe | null = null
  for (const v of ORDER) {
    if (scores[v] > 0 && (best === null || scores[v] > scores[best])) best = v
  }
  return best ?? fallback
}
