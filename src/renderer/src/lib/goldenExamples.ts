// ── Golden example gallery + retrieval ───────────────────────────────────────
// LLMs adapt a strong worked example far better than they synthesise quality from
// a list of rules. So for every request we retrieve the closest hand-vetted
// design (a complete semantic UINode tree that compiles to a Figma-grade screen)
// and inject it as a QUALITY REFERENCE — the bar to match, not copy. Every tree
// here is locked in by a unit test that compiles + scores it (clean overlaps,
// AA contrast, real accent), so the reference is always good.

import { type UINode } from './uiTree'

export type Device = 'mobile' | 'desktop'

export interface GoldenExample {
  id: string
  title: string
  device: Device
  /** retrieval keywords — request words that should surface this example */
  tags: string[]
  tree: UINode
}

// — Mobile: add-expense form (finance / data entry) —
const expense: UINode = {
  stack: 'y', bg: 'bg', name: 'New expense', children: [
    { component: 'statusBar' },
    { component: 'navBar', props: { title: 'New expense', back: true } },
    { h: 24 },
    { component: 'heroAmount', props: { value: '$48.50', label: 'Amount' } },
    { h: 24 },
    { component: 'listRow', props: { icon: 'tag', label: 'Category', value: 'Groceries' } },
    { component: 'listRow', props: { icon: 'calendar', label: 'Date', value: 'Today, Jun 29' } },
    { component: 'inputRow', props: { icon: 'edit', placeholder: 'Add a note', divider: false } },
    { h: 180 },
    { stack: 'y', pad: 20, children: [{ component: 'primaryButton', props: { label: 'Save expense', icon: 'check' } }] },
    { h: 12 },
    { component: 'homeIndicator' }]
}

// — Mobile: habit tracker today screen (list + progress) —
const today: UINode = {
  stack: 'y', bg: 'bg', name: 'Today', children: [
    { component: 'statusBar' },
    { component: 'navBar', props: { title: 'Today', back: false, action: 'plus' } },
    { h: 10 },
    { component: 'progressRing', props: { value: 4, max: 6, label: 'done today', size: 150 } },
    { h: 16 },
    { stack: 'y', pad: 20, gap: 0, children: [
      { component: 'listRow', props: { icon: 'flame', label: 'Morning run', value: '12 days' } },
      { component: 'listRow', props: { icon: 'book', label: 'Read 20 pages', value: '5 days' } },
      { component: 'listRow', props: { icon: 'drop', label: 'Drink water', value: '6/8', divider: false } }] },
    { h: 120 },
    { component: 'tabBar', props: { items: [{ icon: 'home', active: true }, { icon: 'chart' }, { icon: 'calendar' }, { icon: 'user' }] } }]
}

// — Mobile: settings / account screen (rows + sign out) —
const settings: UINode = {
  stack: 'y', bg: 'bg', name: 'Settings', children: [
    { component: 'statusBar' },
    { component: 'navBar', props: { title: 'Settings', back: true } },
    { h: 16 },
    { stack: 'x', pad: 20, gap: 14, children: [
      { component: 'avatar', props: { initials: 'AF', size: 56 } },
      { stack: 'y', gap: 2, children: [
        { text: 'Akwasi Fosuhene', fontSize: 18, fontWeight: 600 },
        { text: 'akwasi@email.com', fontSize: 13, name: 'Email' }] }] },
    { h: 18 },
    { stack: 'y', pad: 20, gap: 0, children: [
      { component: 'listRow', props: { icon: 'user', label: 'Account', chevron: true } },
      { component: 'listRow', props: { icon: 'bell', label: 'Notifications', chevron: true } },
      { component: 'listRow', props: { icon: 'lock', label: 'Privacy', chevron: true } },
      { component: 'listRow', props: { icon: 'card', label: 'Billing', chevron: true } },
      { component: 'listRow', props: { icon: 'info', label: 'Help & support', chevron: true, divider: false } }] },
    { h: 24 },
    { stack: 'y', pad: 20, children: [{ component: 'primaryButton', props: { label: 'Sign out' } }] },
    { h: 12 },
    { component: 'homeIndicator' }]
}

// — Mobile: checkout / payment summary —
const checkout: UINode = {
  stack: 'y', bg: 'bg', name: 'Checkout', children: [
    { component: 'statusBar' },
    { component: 'navBar', props: { title: 'Checkout', back: true } },
    { h: 20 },
    { component: 'heroAmount', props: { value: '$72.40', label: 'Total' } },
    { h: 20 },
    { stack: 'y', pad: 20, gap: 0, children: [
      { component: 'listRow', props: { icon: 'bag', label: 'Subtotal', value: '$64.00' } },
      { component: 'listRow', props: { icon: 'send', label: 'Delivery', value: '$4.40' } },
      { component: 'listRow', props: { icon: 'tag', label: 'Tax', value: '$4.00', divider: false } }] },
    { h: 14 },
    { stack: 'y', pad: 20, gap: 0, children: [
      { component: 'listRow', props: { icon: 'card', label: 'Visa •••• 4242', chevron: true, divider: false } }] },
    { h: 120 },
    { stack: 'y', pad: 20, children: [{ component: 'primaryButton', props: { label: 'Pay $72.40', icon: 'lock' } }] },
    { h: 12 },
    { component: 'homeIndicator' }]
}

// — Desktop: analytics dashboard (sidebar + stats + chart) —
const dashboard: UINode = {
  stack: 'x', bg: 'surface', name: 'Dashboard', children: [
    { w: 240, component: 'sidebar', props: { brand: 'Streak', brandIcon: 'flame', h: 900, items: [
      { section: 'Track' },
      { icon: 'home', label: 'Dashboard', active: true }, { icon: 'check', label: 'Habits' }, { icon: 'chart', label: 'Statistics' }, { icon: 'calendar', label: 'Calendar' },
      { section: 'Account' },
      { icon: 'settings', label: 'Settings' }] } },
    { stack: 'y', pad: 32, gap: 22, children: [
      { component: 'topBar', props: { title: 'Good morning, Akwasi', subtitle: "You're on a 12-day streak, keep going.", action: 'New habit' } },
      { stack: 'x', gap: 20, children: [
        { component: 'statTile', props: { label: 'Current streak', value: '12 days', delta: '+2 vs last week', icon: 'flame' } },
        { component: 'statTile', props: { label: 'Completion rate', value: '84%', delta: '+6% this month', icon: 'chart' } },
        { component: 'statTile', props: { label: 'Active habits', value: '6', delta: '2 due today', icon: 'check' } }] },
      { stack: 'x', gap: 20, children: [
        { component: 'barChart', props: { title: 'This week', values: [60, 90, 75, 120, 150, 110, 175], labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], h: 300 } },
        { w: 360, stack: 'y', bg: 'white', radius: 14, pad: 18, name: 'Today', children: [
          { text: "Today's habits", fontSize: 16, fontWeight: 600 }, { h: 6 },
          { component: 'listRow', props: { icon: 'flame', label: 'Morning run', value: '12d' } },
          { component: 'listRow', props: { icon: 'book', label: 'Read 20 pages', value: '5d' } },
          { component: 'listRow', props: { icon: 'drop', label: 'Drink water', value: '6/8', divider: false } }] }] },
      { component: 'table', props: { title: 'Recent activity', columns: ['Date', 'Habit', 'Minutes', 'Status'], rows: [
        ['12 Aug', 'Morning run', '32', 'Done'], ['11 Aug', 'Read 20 pages', '18', 'Done'], ['10 Aug', 'Morning run', '0', 'Missed']] } }] }]
}

// — Mobile: music player "now playing" (media / player) —
const player: UINode = {
  stack: 'y', bg: 'bg', name: 'Now playing', children: [
    { component: 'statusBar' },
    { component: 'navBar', props: { title: 'Now playing', back: true, action: 'more' } },
    { h: 18 },
    { stack: 'y', pad: 24, gap: 0, children: [{ component: 'albumArt', props: { size: 300 } }] },
    { h: 24 },
    { component: 'trackInfo', props: { title: 'Midnight City', artist: 'M83' } },
    { h: 22 },
    { stack: 'y', pad: 24, gap: 0, children: [{ component: 'scrubber', props: { value: 84, max: 243, leftLabel: '1:24', rightLabel: '4:03' } }] },
    { h: 8 },
    { stack: 'y', pad: 16, gap: 0, children: [{ component: 'transport', props: {} }] },
    { h: 12 },
    { stack: 'y', pad: 24, gap: 0, children: [{ component: 'volumeRow', props: { value: 0.6 } }] },
    { h: 16 },
    { component: 'homeIndicator' }]
}

export const GOLDEN_EXAMPLES: GoldenExample[] = [
  { id: 'expense', title: 'Add expense (mobile form)', device: 'mobile', tree: expense,
    tags: ['expense', 'finance', 'budget', 'money', 'payment', 'form', 'add', 'entry', 'transaction', 'wallet', 'banking', 'cost', 'amount', 'input'] },
  { id: 'today', title: 'Habit tracker (mobile list)', device: 'mobile', tree: today,
    tags: ['habit', 'tracker', 'today', 'list', 'feed', 'tasks', 'todo', 'progress', 'streak', 'fitness', 'health', 'goals', 'daily', 'routine'] },
  { id: 'settings', title: 'Settings (mobile)', device: 'mobile', tree: settings,
    tags: ['settings', 'account', 'profile', 'preferences', 'options', 'menu', 'user', 'config'] },
  { id: 'checkout', title: 'Checkout (mobile)', device: 'mobile', tree: checkout,
    tags: ['checkout', 'payment', 'cart', 'pay', 'order', 'commerce', 'shop', 'store', 'purchase', 'billing', 'summary'] },
  { id: 'dashboard', title: 'Analytics dashboard (desktop)', device: 'desktop', tree: dashboard,
    tags: ['dashboard', 'analytics', 'admin', 'stats', 'statistics', 'metrics', 'overview', 'report', 'chart', 'sidebar', 'saas', 'panel', 'console', 'insights'] },
  { id: 'player', title: 'Now playing (mobile music player)', device: 'mobile', tree: player,
    tags: ['music', 'player', 'song', 'track', 'audio', 'playing', 'playback', 'spotify', 'podcast', 'album', 'artist', 'sound', 'media', 'volume', 'scrubber'] },
]

const STOP = new Set(['a', 'an', 'the', 'for', 'with', 'and', 'to', 'of', 'my', 'me', 'app', 'screen', 'page', 'design', 'create', 'make', 'build', 'ui', 'mobile', 'desktop', 'dashboard'])

/** Infer the target device from the artboard size (wide = desktop). */
export function deviceFromArtboard(w: number, h: number): Device {
  return w >= 1000 && w >= h ? 'desktop' : 'mobile'
}

/** Pure retrieval: score every example against the request + device and return
 * the best `n` (highest score first). Device match is weighted heavily; keyword
 * overlap breaks ties. Always returns the closest matches (never empty unless n<=0). */
export function pickGoldenExamples(userText: string, device: Device, n = 1): GoldenExample[] {
  if (n <= 0) return []
  const words = userText.toLowerCase().match(/[a-z]+/g) ?? []
  const wset = new Set(words.filter((w) => w.length > 2 && !STOP.has(w)))
  const scored = GOLDEN_EXAMPLES.map((ex) => {
    let score = 0
    for (const t of ex.tags) {
      if (wset.has(t)) score += 3
      else if (words.some((w) => w.length > 3 && (w.includes(t) || t.includes(w)))) score += 1
    }
    if (ex.device === device) score += 2
    else score -= 1
    return { ex, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, n).map((s) => s.ex)
}

/** Compact, prompt-ready text block presenting a golden example as the quality bar. */
export function formatGoldenForPrompt(examples: GoldenExample[]): string {
  if (!examples.length) return ''
  const blocks = examples.map((ex) =>
    `• ${ex.title} — a ${ex.device} screen at the quality bar:\n${JSON.stringify(ex.tree)}`
  ).join('\n')
  return [
    'QUALITY REFERENCE — match the structure, restraint and component use of this hand-vetted example. Do NOT copy its content; adapt the same level of polish to the user\'s request (right components, borderless rows + dividers, one accent on the primary action, real icons by name, clean spacing). Emit your own {kind:"screen"} tree in the same shape:',
    blocks,
  ].join('\n')
}
