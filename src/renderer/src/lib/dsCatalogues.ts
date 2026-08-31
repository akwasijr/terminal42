// The parts of a design system that are not values.
//
// A library says what our blue is. A system says what a button is, when to
// reach for one, what the sign-up screen looks like, and what we do about
// empty states — none of which is a colour, and none of which had anywhere to
// live. Foundations and a component gallery were the whole system, which is
// why it read as a second copy of the palette.
//
// The catalogues below are the menu, not the answer. Nothing is switched on
// until somebody says their system has it, because a system claiming all nine
// patterns on the day it is created has documented nothing.

/** Jobs made of several components, agreed once so the second one matches. */
export const PATTERN_CATALOGUE: { id: string; name: string; hint: string; uses: string[] }[] = [
  { id: 'login', name: 'Login', hint: 'Getting a returning person back in.', uses: ['TextInput', 'Button', 'Link'] },
  { id: 'signup', name: 'Sign up', hint: 'The first screen, and the one most often abandoned.', uses: ['TextInput', 'Checkbox', 'Button'] },
  { id: 'forms', name: 'Forms', hint: 'Labels, help text, and where the error goes.', uses: ['TextInput', 'Select', 'Button'] },
  { id: 'search', name: 'Search', hint: 'Asking, and what comes back when nothing does.', uses: ['SearchInput', 'List'] },
  { id: 'filtering', name: 'Filtering', hint: 'Narrowing a list without losing your place in it.', uses: ['Checkbox', 'Tag', 'Button'] },
  { id: 'checkout', name: 'Checkout', hint: 'Several steps where a mistake costs money.', uses: ['Stepper', 'TextInput', 'Button'] },
  { id: 'onboarding', name: 'Onboarding', hint: 'The first five minutes, once.', uses: ['Stepper', 'Button', 'Card'] },
  { id: 'errors', name: 'Error handling', hint: 'What broke, and what to do about it.', uses: ['Alert', 'Notification', 'Button'] },
  { id: 'empty', name: 'Empty states', hint: 'A screen with nothing on it yet, which is most screens on day one.', uses: ['Card', 'Button'] }
]

/** How the page is arranged, above and around anything drawn on it. */
export const LAYOUT_CATALOGUE: { id: string; name: string; hint: string }[] = [
  { id: 'grid', name: 'Grid', hint: 'Columns, gutters, and what they do at each screen.' },
  { id: 'containers', name: 'Containers', hint: 'How wide content is allowed to get before it stops.' },
  { id: 'page', name: 'Page layouts', hint: 'The two or three shapes every screen is one of.' },
  { id: 'responsive', name: 'Responsive layouts', hint: 'What moves, what stacks, what disappears.' },
  { id: 'navigation', name: 'Navigation layouts', hint: 'Where the way out lives on each of them.' }
]

/** The rules a person reads, as opposed to the toggles a generator obeys. */
export const GUIDELINE_FIELDS: { key: 'componentUsage' | 'accessibility' | 'content' | 'interaction' | 'responsive'; label: string; hint: string }[] = [
  { key: 'componentUsage', label: 'Component usage', hint: 'Which one to reach for, and which one people reach for instead.' },
  { key: 'accessibility', label: 'Accessibility', hint: 'Contrast, focus, keyboard order, and what a screen reader hears.' },
  { key: 'content', label: 'Content', hint: 'How things are worded. Button labels, errors, empty states.' },
  { key: 'interaction', label: 'Interaction', hint: 'What happens on hover, on press, and while waiting.' },
  { key: 'responsive', label: 'Responsive behaviour', hint: 'What the layout does as the screen narrows.' }
]

/** The six states every component argument is really about. */
export const COMPONENT_STATES = ['Default', 'Hover', 'Focus', 'Active', 'Disabled', 'Loading']

/**
 * The variants a component of each kind usually needs.
 *
 * Offered as a starting point per category rather than per component, because
 * a menu of seventy bespoke lists is a menu nobody reads.
 */
export const VARIANTS_BY_CATEGORY: Record<string, string[]> = {
  Actions: ['Primary', 'Secondary', 'Tertiary', 'Destructive', 'Icon only'],
  Forms: ['Default', 'With help text', 'Required', 'Error', 'Read-only'],
  Navigation: ['Default', 'Compact', 'With icons'],
  Notifications: ['Info', 'Success', 'Warning', 'Error'],
  Containers: ['Default', 'Elevated', 'Bordered'],
  Data: ['Default', 'Compact', 'Selectable'],
  Visual: ['Default']
}
