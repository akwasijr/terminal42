// User-saved custom easing curves ("variables"), persisted in localStorage so they
// are reusable consistently across every layer and design in the project.

export interface EasingVar {
  id: string
  name: string
  value: string
}

const KEY = 't42-easing-vars'

export function loadEasingVars(): EasingVar[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((v) => v && typeof v.value === 'string') : []
  } catch {
    return []
  }
}

function persist(vars: EasingVar[]): EasingVar[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(vars))
  } catch {
    /* ignore quota / serialization issues */
  }
  return vars
}

export function saveEasingVar(name: string, value: string): EasingVar[] {
  const clean = name.trim() || 'Easing'
  const vars = loadEasingVars()
  const existing = vars.find((v) => v.name === clean)
  if (existing) existing.value = value
  else vars.push({ id: `ev${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`, name: clean, value })
  return persist(vars)
}

export function deleteEasingVar(id: string): EasingVar[] {
  return persist(loadEasingVars().filter((v) => v.id !== id))
}
