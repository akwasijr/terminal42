import { AI_RULES, AI_RULE_GROUPS } from './aiRules'

export interface BrainPreference {
  id: string
  label: string
  text: string
  enabled: boolean
  groupId: string
}

export interface BrainGroup {
  id: string
  label: string
  collapsed?: boolean
}

export interface BrainSkill {
  id: string
  title: string
  content: string
  enabled: boolean
}

export interface AssistantBrain {
  groups: BrainGroup[]
  prefs: BrainPreference[]
  skills: BrainSkill[]
}

const KEY = 't42-form-assistant-brain'

export const DEFAULT_PREFS: BrainPreference[] = [
  ...AI_RULES.filter((r) => ['no-gradients', 'flat-surfaces', 'no-card-outlines', 'one-dominant-color', 'no-default-palette', 'no-emoji-icons', 'no-icon-containers', 'no-all-caps', 'no-em-dash', 'a11y-contrast'].includes(r.id))
    .map((r) => ({ id: r.id, label: r.label, enabled: true, text: r.hint || r.description, groupId: r.group || 'rules' })),
  { id: 'strong-hierarchy', label: 'Strong hierarchy', enabled: true, text: 'One focal point, clear sections, useful metadata, good whitespace.', groupId: 'layout' },
  { id: 'specific-copy', label: 'Specific copy', enabled: true, text: 'Short labels, no lorem ipsum, no vague slogans.', groupId: 'copy' },
  { id: 'include-icons', label: 'Include icons', enabled: true, text: 'Use simple SVG line icons where they help comprehension.', groupId: 'icons' },
  { id: 'token-fidelity', label: 'Respect tokens', enabled: true, text: 'Use active design-system color, radius, density, border and type choices.', groupId: 'system' }
]

export const DEFAULT_GROUPS: BrainGroup[] = [
  ...AI_RULE_GROUPS.map((g) => ({ id: g.id, label: g.label })),
  { id: 'system', label: 'Design system' }
]

function newId(prefix = 'skill'): string { return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}` }

export function loadAssistantBrain(): AssistantBrain {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { groups: DEFAULT_GROUPS, prefs: DEFAULT_PREFS, skills: [] }
    const parsed = JSON.parse(raw) as Partial<AssistantBrain>
    const savedGroups = Array.isArray(parsed.groups) ? parsed.groups : []
    const saved = Array.isArray(parsed.prefs) ? parsed.prefs : []
    const groups = [...DEFAULT_GROUPS.map((d) => ({ ...d, ...(savedGroups.find((g) => g.id === d.id) ?? {}) })), ...savedGroups.filter((g) => g && typeof g.id === 'string' && !DEFAULT_GROUPS.some((d) => d.id === g.id))]
    const prefs = DEFAULT_PREFS.map((d) => ({ ...d, ...(saved.find((p) => p.id === d.id) ?? {}) }))
    const customPrefs = saved.filter((p) => p && typeof p.id === 'string' && !DEFAULT_PREFS.some((d) => d.id === p.id)).map((p) => ({ ...p, groupId: p.groupId || 'system' })) as BrainPreference[]
    const skills = Array.isArray(parsed.skills) ? parsed.skills.filter((s) => s && typeof s.title === 'string' && typeof s.content === 'string') : []
    return { groups, prefs: [...prefs, ...customPrefs], skills }
  } catch {
    return { groups: DEFAULT_GROUPS, prefs: DEFAULT_PREFS, skills: [] }
  }
}

export function saveAssistantBrain(brain: AssistantBrain): AssistantBrain {
  localStorage.setItem(KEY, JSON.stringify(brain))
  return brain
}

export function addBrainSkill(brain: AssistantBrain, title: string, content: string): AssistantBrain {
  const skill: BrainSkill = { id: newId(), title: title.trim() || 'Untitled skill', content: content.trim(), enabled: true }
  return saveAssistantBrain({ ...brain, skills: [skill, ...brain.skills] })
}

export function addBrainGroup(brain: AssistantBrain, label: string): AssistantBrain {
  const group: BrainGroup = { id: newId('group'), label: label.trim() || 'New group' }
  return saveAssistantBrain({ ...brain, groups: [...brain.groups, group] })
}

export function addBrainPreference(brain: AssistantBrain, groupId: string, label: string, text: string): AssistantBrain {
  const pref: BrainPreference = { id: newId('pref'), label: label.trim() || 'New preference', text: text.trim() || 'Describe the design rule.', groupId, enabled: true }
  return saveAssistantBrain({ ...brain, prefs: [...brain.prefs, pref] })
}

export function brainPrompt(brain: AssistantBrain): string {
  const prefs = brain.prefs.filter((p) => p.enabled).map((p) => `- ${p.label}: ${p.text}`)
  const skills = brain.skills.filter((s) => s.enabled && s.content.trim()).map((s) => `### ${s.title}\n${s.content.trim().slice(0, 3000)}`)
  if (!prefs.length && !skills.length) return ''
  return [
    'FORM ASSISTANT BRAIN:',
    prefs.length ? `Preferences:\n${prefs.join('\n')}` : '',
    skills.length ? `Skills:\n${skills.join('\n\n')}` : '',
    'Apply this brain only to this Form assistant response. If a skill conflicts with the active design system, ask one brief question or follow the design system.'
  ].filter(Boolean).join('\n')
}
