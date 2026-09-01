// A curated set of common UI icons as single SVG path `d` strings in a 24×24
// viewBox, drawn as strokes (round caps/joins). The canvas assistant references
// these by NAME so the AI never has to hand-write fragile path data — it just
// says { type: "path", icon: "search" } and we drop in the real geometry.
export const ICON_PATHS: Record<string, string> = {
  search: 'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM21 21l-4.35-4.35',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12l5 5L20 6',
  x: 'M6 6l12 12M18 6L6 18',
  close: 'M6 6l12 12M18 6L6 18',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-up': 'M6 15l6-6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-left': 'M15 6l-6 6 6 6',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'arrow-up-right': 'M7 17L17 7M8 7h9v9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 3.5a4 4 0 0 1 0 7.7M22 21a7 7 0 0 0-5-6.7',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12c0-.5 0-.9-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2.2-1.3L14 2h-4l-.3 2.4a7 7 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6c-.1.4-.1.8-.1 1.3s0 .9.1 1.3l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2.2 1.3L10 22h4l.3-2.4a7 7 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.3z',
  calendar: 'M5 6a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6zM8 3v4M16 3v4M5 10h14',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  mail: 'M4 6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6zM4 7l8 6 8-6',
  phone: 'M5 4h3l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  home: 'M4 11l8-7 8 7M6 10v9h12v-9',
  heart: 'M12 20s-7-4.5-7-9.5A3.5 3.5 0 0 1 12 7a3.5 3.5 0 0 1 7 3.5C19 15.5 12 20 12 20z',
  star: 'M12 3l2.6 5.6 6 .7-4.5 4 1.3 6L12 16.6 6.6 19.3l1.3-6-4.5-4 6-.7z',
  bell: 'M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0',
  trash: 'M4 6h16M9 6V4h6v2M6 6l1 14h10l1-14',
  edit: 'M14 4l6 6L9 21H3v-6L14 4zM13 5l6 6',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  upload: 'M12 20V8M7 13l5-5 5 5M5 4h14',
  filter: 'M3 5h18l-7 8v6l-4-2v-4z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  dollar: 'M12 3v18M16 7a4 3 0 0 0-4-2h-2a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-2a4 3 0 0 1-4-2',
  tag: 'M4 4h7l9 9-7 7-9-9V4zM8 8h.01',
  card: 'M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7zM3 10h18',
  image: 'M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5zM8 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM5 17l5-5 4 4 2-2 3 3',
  lock: 'M6 11a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-8zM8 10V7a4 4 0 0 1 8 0v3',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  alert: 'M12 3l9 16H3zM12 9v4M12 17h.01',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  folder: 'M4 6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6z',
  file: 'M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v4h4',
  send: 'M4 12l16-7-7 16-2-7z',
  link: 'M9 15l6-6M10 7l1-1a4 4 0 0 1 6 6l-1 1M14 17l-1 1a4 4 0 0 1-6-6l1-1',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM13 13h7v7h-7zM4 13h7v7H4z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  refresh: 'M20 11a8 8 0 1 0-2 5M20 4v6h-6',
  play: 'M7 5l11 7-11 7z',
  chart: 'M5 19V5M5 19h14M8 16v-4M12 16V9M16 16v-7',
  bag: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  share: 'M6 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 24a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.5 10.5l7-4M8.5 13.5l7 4',
  shuffle: 'M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
  repeat: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  'skip-back': 'M19 20L9 12l10-8zM5 19V5',
  'skip-forward': 'M5 4l10 8-10 8zM19 5v14',
  pause: 'M9 5v14M15 5v14',
  stop: 'M7 7h10v10H7z',
  'volume-2': 'M11 5L6 9H2v6h4l5 4zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07',
  'volume-1': 'M11 5L6 9H2v6h4l5 4zM15.54 8.46a5 5 0 0 1 0 7.07',
  'volume-x': 'M11 5L6 9H2v6h4l5 4zM22 9l-6 6M16 9l6 6',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  mic: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10a7 7 0 0 1-14 0M12 19v3',
  rewind: 'M11 19l-9-7 9-7zM22 19l-9-7 9-7z',
  'fast-forward': 'M13 5l9 7-9 7zM2 5l9 7-9 7z',
  queue: 'M4 7h11M4 12h11M4 17h7M16 13l5 3-5 3z',
  'plus-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M8 12h8',
  'check-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12l2.5 2.5 4.5-5',
  'x-circle': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15 9l-6 6M9 9l6 6',
  'arrow-up': 'M12 19V5M6 11l6-6 6 6',
  'arrow-down': 'M12 5v14M6 13l6 6 6-6',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  'log-out': 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  camera: 'M3 8a1 1 0 0 1 1-1h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  flame: 'M12 22a6 6 0 0 0 6-6c0-4-3-5.5-3.5-10C13 7 11.5 9 11.5 11c0 1.4-1 2-1.8 1.4C9 12 8.6 11 8.6 11 7.4 12.4 6 14 6 16a6 6 0 0 0 6 6z',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM19 19H6',
  drop: 'M12 21a6 6 0 0 0 6-6c0-4-6-11-6-11S6 11 6 15a6 6 0 0 0 6 6z'
}

export const ICON_NAMES = Object.keys(ICON_PATHS)

// Common synonyms → a real library key, so the model never has to hit an exact
// name. Anything that doesn't resolve becomes a box, which is exactly the
// "AI drew its own wonky icon" failure we want to avoid.
const ICON_ALIASES: Record<string, string> = {
  magnifier: 'search', 'magnifying-glass': 'search', find: 'search', look: 'search',
  add: 'plus', new: 'plus', create: 'plus',
  remove: 'minus', subtract: 'minus',
  done: 'check', tick: 'check', confirm: 'check', success: 'check', complete: 'check',
  cancel: 'x', delete: 'trash', 'trash-can': 'trash', bin: 'trash', 'delete-bin': 'trash', remove2: 'trash',
  gear: 'settings', cog: 'settings', preferences: 'settings', config: 'settings', options: 'settings', 'sliders-h': 'settings',
  profile: 'user', account: 'user', person: 'user', avatar: 'user', member: 'user',
  people: 'users', team: 'users', group: 'users', contacts: 'users',
  notification: 'bell', notifications: 'bell', alarm: 'bell', ring: 'bell',
  warning: 'alert', caution: 'alert', error: 'alert', danger: 'alert', triangle: 'alert',
  about: 'info', help: 'info', question: 'info',
  cart: 'bag', 'shopping-cart': 'bag', basket: 'bag', shop: 'bag', store: 'bag', 'shopping-bag': 'bag',
  money: 'dollar', price: 'dollar', cost: 'dollar', payment: 'dollar', currency: 'dollar', usd: 'dollar', cash: 'dollar', wallet: 'dollar',
  label: 'tag', tags: 'tag', category: 'tag', categories: 'tag',
  'credit-card': 'card', 'debit-card': 'card', visa: 'card',
  photo: 'image', picture: 'image', img: 'image', gallery: 'image', media: 'image',
  date: 'calendar', schedule: 'calendar', 'calendar-days': 'calendar', event: 'calendar', day: 'calendar',
  time: 'clock', timer: 'clock', history: 'clock', recent: 'clock', watch: 'clock',
  email: 'mail', message: 'mail', envelope: 'mail', inbox: 'mail', contact: 'mail',
  house: 'home', dashboard: 'home', main: 'home',
  favorite: 'heart', like: 'heart', love: 'heart', favourite: 'heart', save2: 'heart',
  bookmark: 'star', rate: 'star', rating: 'star', featured: 'star',
  pencil: 'edit', write: 'edit', compose: 'edit', pen: 'edit', modify: 'edit', update: 'edit',
  view: 'eye', show: 'eye', visible: 'eye', preview: 'eye', visibility: 'eye',
  hidden: 'lock', secure: 'lock', private: 'lock', password: 'lock', security: 'lock', locked: 'lock',
  directory: 'folder', folders: 'folder',
  document: 'file', doc: 'file', page: 'file', report: 'file', invoice: 'file',
  submit: 'send', share2: 'send', paperplane: 'send', dm: 'send',
  url: 'link', chain: 'link', attach: 'link', attachment: 'link', hyperlink: 'link',
  apps: 'grid', menu2: 'grid', categories2: 'grid', widgets: 'grid',
  bullet: 'list', items: 'list', lines: 'list', feed: 'list', activity: 'list',
  reload: 'refresh', sync: 'refresh', retry: 'refresh', repeat: 'refresh', loading: 'refresh',
  start: 'play', video: 'play', media2: 'play',
  graph: 'chart', stats: 'chart', analytics: 'chart', report2: 'chart', bars: 'chart', 'bar-chart': 'chart', trending: 'chart', insights: 'chart',
  lightning: 'bolt', flash: 'bolt', power: 'bolt', energy: 'bolt', fast: 'bolt', boost: 'bolt',
  world: 'globe', web: 'globe', internet: 'globe', language: 'globe', network: 'globe', site: 'globe',
  location: 'map', place: 'map', pin: 'map', directions: 'map', route: 'map', navigation: 'map',
  call: 'phone', telephone: 'phone', mobile: 'phone',
  hamburger: 'menu', nav: 'menu', navbar: 'menu', sidebar: 'menu',
  ellipsis: 'more', 'more-horizontal': 'more', dots: 'more', overflow: 'more', kebab: 'more',
  next: 'chevron-right', forward: 'chevron-right', expand: 'chevron-right',
  prev: 'chevron-left', previous: 'chevron-left', back: 'chevron-left',
  up: 'chevron-up', collapse: 'chevron-up', caret: 'chevron-down', dropdown: 'chevron-down', down: 'chevron-down',
  external: 'arrow-up-right', 'external-link': 'arrow-up-right', launch: 'arrow-up-right', open: 'arrow-up-right',
  get: 'download', save: 'download', export: 'download', import: 'upload', 'cloud-upload': 'upload',
  funnel: 'filter', sort: 'filter',
  // media / player
  'skip-previous': 'skip-back', 'skip-next': 'skip-forward', 'previous-track': 'skip-back', 'next-track': 'skip-forward',
  'fast-backward': 'rewind', mute: 'volume-x', silent: 'volume-x', volume: 'volume-2', 'volume-up': 'volume-2',
  'volume-down': 'volume-1', sound: 'volume-2', speaker: 'volume-2', audio: 'music', song: 'music', track: 'music',
  note: 'music', notes: 'music', playlist: 'queue', 'up-next': 'queue', upnext: 'queue', tracks: 'queue',
  microphone: 'mic', record: 'mic', logout: 'log-out', 'sign-out': 'log-out', signout: 'log-out',
  exit: 'log-out', adjust: 'sliders', equalizer: 'sliders', controls: 'sliders', mixer: 'sliders',
  fire: 'flame', streak: 'flame', hot: 'flame', trending2: 'flame',
  reading: 'book', library: 'book', guide: 'book', docs: 'book', manual: 'book',
  droplet: 'drop', water: 'drop', humidity: 'drop', liquid: 'drop', rain: 'drop',
}

// Words that name the CONTAINER an icon sits in rather than the icon itself.
// "nav-dashboard" is a dashboard icon inside a nav, not a nav icon. Before this
// existed the resolver took the FIRST word, so nav-dashboard, nav-usage and
// nav-billing all came back as the hamburger and an entire sidebar drew the same
// glyph on every row.
const WRAPPER_WORDS = new Set([
  'nav', 'navigation', 'navbar', 'sidebar', 'side', 'drawer', 'rail', 'menu',
  'item', 'items', 'entry', 'row', 'tab', 'button', 'btn', 'field', 'input',
  'box', 'panel', 'section', 'group', 'wrapper', 'container',
])

/** Exact key, alias, or singular form of one word. '' when the word is unknown. */
function resolveWord(w: string): string {
  if (ICON_PATHS[w]) return w
  if (ICON_ALIASES[w]) return ICON_ALIASES[w]
  if (w.endsWith('s')) {
    const s = w.slice(0, -1)
    if (ICON_PATHS[s]) return s
    if (ICON_ALIASES[s]) return ICON_ALIASES[s]
  }
  return ''
}

/** Resolve any icon name (synonyms, plurals, "-icon" suffixes, separators) to a
 * real library key, or '' if there's genuinely no sensible match. */
export function resolveIcon(name?: string): string {
  if (!name || typeof name !== 'string') return ''
  const k = name.toLowerCase().trim()
    .replace(/\s+/g, '-')
    .replace(/[_]+/g, '-')
    .replace(/-(icon|outline|line|solid|filled|24|stroke|svg)$/g, '')
    .replace(/^(icon|ic)-/g, '')
    .trim()
  const whole = resolveWord(k)
  if (whole) return whole
  // Multi-word: read right to left, because English puts the subject last
  // ("credit-card", "nav-dashboard"). Container words are skipped on the first
  // pass and only considered if nothing else in the name is known.
  const words = k.split('-').filter(Boolean)
  if (words.length < 2) return ''
  const reversed = [...words].reverse()
  for (const w of reversed.filter((x) => !WRAPPER_WORDS.has(x))) {
    const hit = resolveWord(w)
    if (hit) return hit
  }
  for (const w of reversed) {
    const hit = resolveWord(w)
    if (hit) return hit
  }
  return ''
}
