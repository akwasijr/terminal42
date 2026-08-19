import { type ObjectSpec } from './canvasAgent'
import { type DesignSystem, applyBase } from './designSystem'

export type CanvasComponentName =
  | 'Button'
  | 'Card'
  | 'Header'
  | 'Table'
  | 'Tabs'
  | 'Dialog'

export const CANVAS_DS_COMPONENTS: { name: CanvasComponentName; desc: string }[] = [
  { name: 'Button', desc: 'Action button' },
  { name: 'Card', desc: 'Content card with action' },
  { name: 'Header', desc: 'Top navigation bar' },
  { name: 'Table', desc: 'Three-column data table' },
  { name: 'Tabs', desc: 'Segmented navigation tabs' },
  { name: 'Dialog', desc: 'Decision dialog' }
]

function radius(s: DesignSystem): number { return Math.min(28, s.radii.md) }
function borderOn(s: DesignSystem): boolean { return s.borderStyle !== 'none' }
function text(s: DesignSystem, name: string, x: number, y: number, value: string, size = s.type.sm, weight = s.weights.medium, color = s.colors.text, w = 160): ObjectSpec {
  return { type: 'text', name, x, y, w, h: Math.round(size * 1.45), text: value, color, fontSize: size, fontFamily: s.font.family, fontWeight: weight }
}
function rect(s: DesignSystem, name: string, x: number, y: number, w: number, h: number, fill: string, r = radius(s), stroke = s.colors.border): ObjectSpec {
  return { type: 'rect', name, x, y, w, h, fill, fillEnabled: true, radius: r, stroke, strokeWidth: 1, strokeEnabled: borderOn(s) }
}

export function designSystemSummary(s: DesignSystem): string {
  return [
    `Design system: ${s.name}`,
    `Base ${s.base}, primary ${s.colors.primary}, surface ${s.colors.surface}, text ${s.colors.text}`,
    `Fonts heading ${s.font.heading}, body ${s.font.family}`,
    `Corners ${s.cornerStyle ?? 'rounded'}, outlines ${s.borderStyle ?? 'outlined'}, density ${s.density ?? 'comfortable'}, icons ${s.iconStyle ?? 'outlined'}`,
    `Available components: ${CANVAS_DS_COMPONENTS.map((c) => c.name).join(', ')}`
  ].join('\n')
}

export function componentToObjects(system: DesignSystem, component: CanvasComponentName, x = 80, y = 80): ObjectSpec[] {
  const s = applyBase(system, system.base)
  const r = radius(s)
  const primaryText = s.base === 'dark' ? '#0b0f17' : '#ffffff'
  if (component === 'Button') {
    return [
      { ...rect(s, 'Button / Primary', x, y, 132, 42, s.colors.primary, r, s.colors.primary), componentName: 'Button', componentSource: system.id, componentVariant: 'Type=Primary, Size=Medium, State=Rest' },
      { ...text(s, 'Button label', x + 24, y + 12, 'Primary', s.type.sm, s.weights.semibold, primaryText, 84), componentSlot: 'label' }
    ]
  }
  if (component === 'Card') {
    return [
      { ...rect(s, 'Card', x, y, 280, 180, s.colors.surface, s.radii.lg), componentName: 'Card', componentSource: system.id, componentVariant: 'Default', layoutMode: 'vertical', layoutGap: 12, layoutPadding: 20 },
      text(s, 'Card title', x + 20, y + 20, 'Card title', s.type.lg, s.weights.semibold, s.colors.text, 200),
      text(s, 'Card body', x + 20, y + 56, 'Short supporting copy for this card.', s.type.sm, s.weights.regular, s.colors.textMuted, 220),
      rect(s, 'Card button', x + 20, y + 120, 100, 36, s.colors.primary, r, s.colors.primary),
      text(s, 'Card button label', x + 42, y + 130, 'Action', s.type.xs, s.weights.semibold, primaryText, 60)
    ]
  }
  if (component === 'Header') {
    return [
      { ...rect(s, 'Header', x, y, 720, 72, s.colors.surface, s.radii.md), componentName: 'Header', componentSource: system.id, componentVariant: 'Desktop', layoutMode: 'horizontal', layoutGap: 24, layoutPadding: 24 },
      text(s, 'Brand', x + 24, y + 23, s.brief?.brandName || s.name || 'Brand', s.type.md, s.weights.bold, s.colors.text, 180),
      text(s, 'Nav product', x + 330, y + 26, 'Product', s.type.sm, s.weights.medium, s.colors.textMuted, 80),
      text(s, 'Nav pricing', x + 420, y + 26, 'Pricing', s.type.sm, s.weights.medium, s.colors.textMuted, 80),
      rect(s, 'Header button', x + 590, y + 18, 104, 36, s.colors.primary, r, s.colors.primary),
      text(s, 'Header button label', x + 612, y + 28, 'Sign in', s.type.xs, s.weights.semibold, primaryText, 64)
    ]
  }
  if (component === 'Table') {
    const out: ObjectSpec[] = [{ ...rect(s, 'Table', x, y, 420, 176, s.colors.surface, s.radii.md), componentName: 'Table', componentSource: system.id, componentVariant: 'Default' }]
    ;['Name', 'Role', 'Status'].forEach((h, i) => out.push(text(s, `Table heading ${h}`, x + 18 + i * 130, y + 16, h, s.type.xs, s.weights.semibold, s.colors.text, 100)))
    ;[['Project Alpha', 'Admin', 'Active'], ['Project Beta', 'Editor', 'Pending'], ['Project Gamma', 'Viewer', 'Active']].forEach((row, ri) => row.forEach((v, ci) => out.push(text(s, `Table ${ri + 1} ${ci + 1}`, x + 18 + ci * 130, y + 52 + ri * 34, v, s.type.xs, s.weights.regular, ci === 2 ? s.colors.primary : s.colors.textMuted, 110))))
    return out
  }
  if (component === 'Tabs') {
    return [
      { ...rect(s, 'Tabs', x, y, 300, 44, s.colors.surface, r), componentName: 'Tabs', componentSource: system.id, componentVariant: 'Overview active', layoutMode: 'horizontal', layoutGap: 2, layoutPadding: 4 },
      rect(s, 'Tab active', x + 4, y + 4, 96, 36, s.colors.primary, Math.max(0, r - 3), s.colors.primary),
      text(s, 'Tab overview', x + 24, y + 14, 'Overview', s.type.xs, s.weights.semibold, primaryText, 70),
      text(s, 'Tab activity', x + 116, y + 14, 'Activity', s.type.xs, s.weights.medium, s.colors.textMuted, 70),
      text(s, 'Tab settings', x + 208, y + 14, 'Settings', s.type.xs, s.weights.medium, s.colors.textMuted, 70)
    ]
  }
  return [
    { ...rect(s, 'Dialog', x, y, 320, 190, s.colors.surface, s.radii.lg), componentName: 'Dialog', componentSource: system.id, componentVariant: 'Danger confirmation', layoutMode: 'vertical', layoutGap: 12, layoutPadding: 20 },
    text(s, 'Dialog title', x + 20, y + 22, 'Delete project?', s.type.lg, s.weights.semibold, s.colors.text, 220),
    text(s, 'Dialog body', x + 20, y + 62, 'This action cannot be undone.', s.type.sm, s.weights.regular, s.colors.textMuted, 240),
    rect(s, 'Dialog cancel', x + 92, y + 128, 88, 36, s.colors.bg, r),
    text(s, 'Dialog cancel label', x + 116, y + 138, 'Cancel', s.type.xs, s.weights.medium, s.colors.text, 58),
    rect(s, 'Dialog delete', x + 192, y + 128, 88, 36, s.colors.error, r, s.colors.error),
    text(s, 'Dialog delete label', x + 218, y + 138, 'Delete', s.type.xs, s.weights.semibold, '#ffffff', 58)
  ]
}
