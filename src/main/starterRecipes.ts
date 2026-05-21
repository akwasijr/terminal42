// Distilled "design DNA" from the Studio42Starkit collection.
// Source: https://github.com/akwasijr/Studio42Starkit
// These recipes are used silently as design foundations during generation.
// Never exposed in the UI. Skipped when a formal design system is selected.

export type StarterRecipe = {
  slug: string
  kinds: string[] // matches DesignBrief.kind values
  industries: string[] // keyword vocabulary used to score against brief.idea
  mood: string // one-line characterization
  palette: { bg: string; surface: string; primary: string; text: string; accent?: string }
  font: string
  radius: 'sharp' | 'small' | 'medium' | 'large'
  surface: 'dark' | 'light'
  sections: string[] // composition recipe
}

export const STARTER_RECIPES: StarterRecipe[] = [
  {
    slug: 'dashboard',
    kinds: ['dashboard', 'admin', 'internal-tool', 'analytics'],
    industries: ['saas', 'admin', 'internal', 'crm', 'analytics', 'ops', 'platform'],
    mood: 'Clean enterprise SaaS dashboard, light, neutral, professional',
    palette: { bg: '#FFFFFF', surface: '#F8FAFC', primary: '#0066CC', text: '#0F172A' },
    font: 'Geist Sans',
    radius: 'medium',
    surface: 'light',
    sections: ['top nav with workspace switcher', 'left sidebar with grouped nav', 'KPI strip (4 cards)', 'primary chart panel', 'recent activity table', 'detail drawer'],
  },
  {
    slug: 'consumer-app',
    kinds: ['mobile', 'consumer', 'app', 'onboarding'],
    industries: ['consumer', 'mobile', 'wallet', 'rewards', 'social', 'messaging', 'transactions', 'profile'],
    mood: 'Mobile-first consumer flow, bold primary, generous white space',
    palette: { bg: '#FFFFFF', surface: '#F5F3FF', primary: '#7C3AED', text: '#1F2937' },
    font: 'Geist Sans',
    radius: 'large',
    surface: 'light',
    sections: ['hero card', 'quick actions row (4 icon tiles)', 'transactions list with avatars', 'sticky bottom tab bar (5 items)'],
  },
  {
    slug: 'fluent-enterprise-dashboard',
    kinds: ['dashboard', 'enterprise', 'admin', 'internal-tool'],
    industries: ['microsoft', 'fluent', 'enterprise', 'm365', 'azure', 'power platform'],
    mood: 'Microsoft Fluent, blue, dense info, command-bar driven',
    palette: { bg: '#FAFAFA', surface: '#FFFFFF', primary: '#0078D4', text: '#242424' },
    font: 'Segoe UI',
    radius: 'small',
    surface: 'light',
    sections: ['command bar (icons + search)', 'breadcrumb + page title', 'KPI tiles', 'primary chart', 'data grid with selection'],
  },
  {
    slug: 'fluent-internal-tools',
    kinds: ['dashboard', 'internal-tool', 'admin'],
    industries: ['microsoft', 'fluent', 'internal', 'tools', 'admin', 'devops'],
    mood: 'Fluent for internal IT/ops tools, dense tables, status-driven',
    palette: { bg: '#FAFAFA', surface: '#FFFFFF', primary: '#0078D4', text: '#242424' },
    font: 'Segoe UI',
    radius: 'small',
    surface: 'light',
    sections: ['filter bar', 'data table with bulk actions', 'side detail panel', 'status pill column'],
  },
  {
    slug: 'fluent-teams-app',
    kinds: ['app', 'collaboration', 'consumer', 'messaging'],
    industries: ['teams', 'microsoft', 'collaboration', 'chat', 'meetings', 'channels'],
    mood: 'Teams-style three-column collaboration app, purple accent',
    palette: { bg: '#F5F5F5', surface: '#FFFFFF', primary: '#6264A7', text: '#252423' },
    font: 'Segoe UI',
    radius: 'small',
    surface: 'light',
    sections: ['app rail (vertical icons)', 'channel/list column', 'main content (chat or doc)', 'compose bar'],
  },
  {
    slug: 'industry-banking',
    kinds: ['dashboard', 'analytics', 'enterprise'],
    industries: ['bank', 'banking', 'finance', 'wealth', 'trading', 'investment', 'portfolio', 'fintech', 'capital', 'markets'],
    mood: 'Dense dark trading terminal, sharp corners, amber accent',
    palette: { bg: '#0a0a0a', surface: '#111111', primary: '#f59e0b', text: '#ffffff', accent: '#10b981' },
    font: 'Plus Jakarta Sans',
    radius: 'sharp',
    surface: 'dark',
    sections: ['KPI strip (4 cols, uppercase eyebrow)', 'portfolio table with status badges (critical/warning/healthy)', 'AI chat sidebar', 'sankey flow chart', 'activity log column'],
  },
  {
    slug: 'industry-ceo-dashboard',
    kinds: ['dashboard', 'executive', 'analytics'],
    industries: ['ceo', 'executive', 'leadership', 'board', 'briefing', 'editorial'],
    mood: 'Editorial executive briefing, dark navy, glassy cards, serif accents',
    palette: { bg: '#0a1628', surface: 'rgba(255,255,255,0.05)', primary: '#3b82f6', text: '#ffffff' },
    font: 'Inter (Playfair Display for headlines)',
    radius: 'large',
    surface: 'dark',
    sections: ['hero metric with large serif headline', 'quarterly summary cards', 'priorities list', 'risk heatmap', 'leadership team strip'],
  },
  {
    slug: 'industry-education-higher',
    kinds: ['dashboard', 'portal', 'enterprise'],
    industries: ['university', 'higher education', 'campus', 'student', 'faculty', 'admissions', 'research'],
    mood: 'Trusted institutional portal, deep navy, calm and legible',
    palette: { bg: '#FFFFFF', surface: '#F8FAFC', primary: '#1e3a8a', text: '#0F172A' },
    font: 'Inter',
    radius: 'medium',
    surface: 'light',
    sections: ['top utility bar', 'page header with crest', 'role-based card grid (apply, learn, research, life)', 'announcements list', 'support footer'],
  },
  {
    slug: 'industry-education-k12',
    kinds: ['dashboard', 'portal', 'app'],
    industries: ['school', 'k12', 'kindergarten', 'classroom', 'teacher', 'parent', 'student'],
    mood: 'Friendly classroom portal, rounded cards, bright accents',
    palette: { bg: '#FFFFFF', surface: '#F9FAFB', primary: '#2563eb', text: '#111827' },
    font: 'Plus Jakarta Sans',
    radius: 'large',
    surface: 'light',
    sections: ['greeting header with avatar', 'today schedule timeline', 'assignments cards', 'progress chart', 'message list'],
  },
  {
    slug: 'industry-energy',
    kinds: ['dashboard', 'analytics', 'monitoring'],
    industries: ['energy', 'oil', 'gas', 'renewable', 'grid', 'power', 'generation', 'lng'],
    mood: 'Dark control-room, lime accent, soft cards with subtle borders',
    palette: { bg: '#0f0f0f', surface: '#1a1a1a', primary: '#a3e635', text: '#ffffff' },
    font: 'DM Sans',
    radius: 'large',
    surface: 'dark',
    sections: ['site map / facility selector', 'production KPIs', 'asset health table', 'incident timeline', 'AI insight card'],
  },
  {
    slug: 'industry-government',
    kinds: ['dashboard', 'portal', 'enterprise'],
    industries: ['government', 'gov', 'public', 'civic', 'ministry', 'agency', 'permits', 'cases'],
    mood: 'Authoritative government portal, deep blue, plain forms-first',
    palette: { bg: '#f8fafc', surface: '#FFFFFF', primary: '#2563eb', text: '#0f172a' },
    font: 'IBM Plex Sans',
    radius: 'small',
    surface: 'light',
    sections: ['government header with seal area', 'service tiles grid', 'case status table', 'announcements panel', 'accessibility footer'],
  },
  {
    slug: 'industry-healthcare',
    kinds: ['dashboard', 'app', 'portal'],
    industries: ['health', 'healthcare', 'hospital', 'clinic', 'patient', 'doctor', 'nurse', 'medical', 'lab'],
    mood: 'Calm clinical UI, soft greens, white cards on warm grey',
    palette: { bg: '#f5f5f5', surface: '#FFFFFF', primary: '#16a34a', text: '#111827' },
    font: 'Plus Jakarta Sans',
    radius: 'large',
    surface: 'light',
    sections: ['patient header with vitals strip', 'today schedule', 'lab results table with trend sparks', 'documents list', 'care team panel'],
  },
  {
    slug: 'industry-insurance',
    kinds: ['dashboard', 'portal', 'app'],
    industries: ['insurance', 'claims', 'policy', 'underwriting', 'broker', 'risk'],
    mood: 'Premium advisor UI, warm cream background, navy accents',
    palette: { bg: '#faf9f7', surface: '#FFFFFF', primary: '#0f172a', text: '#1f2937' },
    font: 'DM Sans',
    radius: 'medium',
    surface: 'light',
    sections: ['policy overview hero', 'claims pipeline kanban', 'risk score card', 'recent activity', 'document vault'],
  },
  {
    slug: 'industry-pharma',
    kinds: ['dashboard', 'analytics', 'enterprise'],
    industries: ['pharma', 'pharmaceutical', 'biotech', 'clinical trial', 'r&d', 'molecule', 'pipeline'],
    mood: 'Scientific R&D dashboard, restrained palette, dark/light dual mode',
    palette: { bg: '#FFFFFF', surface: '#F8FAFC', primary: '#0ea5e9', text: '#0f172a' },
    font: 'IBM Plex Sans',
    radius: 'large',
    surface: 'light',
    sections: ['pipeline phase columns (Discovery → Phase III)', 'molecule cards', 'trial enrollment chart', 'regulatory milestone timeline'],
  },
  {
    slug: 'industry-retail',
    kinds: ['dashboard', 'analytics', 'enterprise'],
    industries: ['retail', 'ecommerce', 'merchandising', 'store', 'inventory', 'sales', 'orders'],
    mood: 'Merchandising ops dashboard, navy/white, dense data tables',
    palette: { bg: '#f8fafc', surface: '#FFFFFF', primary: '#0f172a', text: '#0f172a', accent: '#f97316' },
    font: 'DM Sans',
    radius: 'medium',
    surface: 'light',
    sections: ['sales KPI strip', 'product performance grid with thumbnails', 'orders table', 'customer cohort chart'],
  },
  {
    slug: 'industry-smart-factory',
    kinds: ['dashboard', 'monitoring', 'analytics'],
    industries: ['factory', 'manufacturing', 'iot', 'oee', 'plant', 'equipment', 'production line'],
    mood: 'Industrial control room, neutral light, lime/green status accents',
    palette: { bg: '#fafafa', surface: '#FFFFFF', primary: '#4ade80', text: '#0a0a0a' },
    font: 'IBM Plex Sans',
    radius: 'medium',
    surface: 'light',
    sections: ['plant floor map / line selector', 'OEE gauges row', 'equipment status table', 'shift performance chart', 'alarms panel'],
  },
  {
    slug: 'industry-supply-chain',
    kinds: ['dashboard', 'monitoring', 'analytics'],
    industries: ['supply chain', 'logistics', 'shipping', 'freight', 'warehouse', 'inventory', 'tracking'],
    mood: 'Warm logistics ops UI, parchment background, map-centric',
    palette: { bg: '#f5f1eb', surface: '#FFFFFF', primary: '#1a1a1a', text: '#1a1a1a', accent: '#f59e0b' },
    font: 'Roboto',
    radius: 'medium',
    surface: 'light',
    sections: ['shipment map (left)', 'KPI strip', 'in-transit table with ETAs', 'inventory by warehouse list', 'exception alerts'],
  },
  {
    slug: 'industry-sustainability',
    kinds: ['dashboard', 'analytics', 'reporting'],
    industries: ['sustainability', 'esg', 'carbon', 'emissions', 'climate', 'green', 'net zero'],
    mood: 'Editorial ESG report, off-white background, restrained data ink',
    palette: { bg: '#f8f7f4', surface: '#FFFFFF', primary: '#16a34a', text: '#1a1a1a' },
    font: 'DM Sans',
    radius: 'medium',
    surface: 'light',
    sections: ['scope 1/2/3 emissions cards', 'reduction trajectory chart', 'initiatives table', 'supplier scorecard list', 'report download row'],
  },
  {
    slug: 'industry-telco',
    kinds: ['dashboard', 'monitoring', 'enterprise'],
    industries: ['telco', 'telecom', 'network', 'carrier', '5g', 'subscribers', 'noc'],
    mood: 'Network operations center, dark slate, real-time feel',
    palette: { bg: '#0b1220', surface: 'rgba(17,24,39,0.9)', primary: '#3b82f6', text: '#FFFFFF' },
    font: 'Inter',
    radius: 'medium',
    surface: 'dark',
    sections: ['network map / topology', 'traffic gauges', 'subscriber growth chart', 'incident queue', 'service health pills'],
  },
  {
    slug: 'industry-utilities',
    kinds: ['dashboard', 'app', 'portal'],
    industries: ['utility', 'utilities', 'water', 'electric', 'gas', 'meter', 'billing', 'outage'],
    mood: 'Utility customer portal, light, billing-clear, calm',
    palette: { bg: '#FFFFFF', surface: '#F8FAFC', primary: '#0ea5e9', text: '#0f172a' },
    font: 'Inter',
    radius: 'medium',
    surface: 'light',
    sections: ['account header with current bill', 'usage chart with comparison', 'outage alerts banner', 'payment methods row', 'support links'],
  },
]

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3),
  )
}

// Score how well a recipe matches a brief. Higher = better match.
export function scoreRecipe(recipe: StarterRecipe, kind: string | null | undefined, idea: string | null | undefined): number {
  let score = 0
  const k = (kind || '').toLowerCase()
  if (k && recipe.kinds.some((rk) => rk === k || k.includes(rk) || rk.includes(k))) score += 5
  const ideaTokens = tokenize(idea || '')
  if (ideaTokens.size > 0) {
    for (const word of recipe.industries) {
      const parts = word.toLowerCase().split(/\s+/)
      if (parts.every((p) => ideaTokens.has(p))) score += 4
      else if (parts.some((p) => ideaTokens.has(p))) score += 2
    }
  }
  return score
}

// Pick the top N recipes for a given brief. Returns empty array if none score.
export function pickRecipes(kind: string | null | undefined, idea: string | null | undefined, limit = 2): StarterRecipe[] {
  const scored = STARTER_RECIPES.map((r) => ({ r, s: scoreRecipe(r, kind, idea) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
  return scored.slice(0, limit).map((x) => x.r)
}

// Format chosen recipes into a compact prompt block.
export function formatRecipesForPrompt(recipes: StarterRecipe[]): string {
  if (recipes.length === 0) return ''
  const lines: string[] = []
  lines.push('REFERENCE PATTERNS (use as design foundation; adapt visually to brief, do not copy literally):')
  recipes.forEach((r, i) => {
    const p = r.palette
    const palette = `bg ${p.bg} / surface ${p.surface} / primary ${p.primary} / text ${p.text}${p.accent ? ' / accent ' + p.accent : ''}`
    lines.push(`${i + 1}. ${r.mood}.`)
    lines.push(`   Palette: ${palette}. Font: ${r.font}. Radius: ${r.radius}. Mode: ${r.surface}.`)
    lines.push(`   Sections: ${r.sections.join('; ')}.`)
  })
  return lines.join('\n')
}
