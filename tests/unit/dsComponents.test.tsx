import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DS_COMPONENTS, DS_CATEGORIES } from '../../src/renderer/src/components/dsComponents'
import { generateSystem, DEFAULT_ANSWERS } from '../../src/renderer/src/lib/designSystem'

const SYSTEM = generateSystem(DEFAULT_ANSWERS)

// Every component in the library is a live preview that reads the system's
// tokens as it draws. A component that throws only does so on the page that
// shows it, and there are dozens of those pages, so nothing here is seen by
// hand often enough to catch a mistake. Rendering the whole catalogue is the
// only cheap way to know the library still stands up.

describe('design system component library', () => {
  it('covers the Carbon catalogue', () => {
    // The names Carbon publishes, mapped to ours where we call them something
    // plainer. If one of these disappears, a documented component has gone.
    const carbon = [
      'Accordion', 'Breadcrumb', 'Button', 'Checkbox', 'CodeSnippet', 'ContainedList',
      'ContentSwitcher', 'Table', 'DateInput', 'Select', 'FileInput', 'Fieldset',
      'InlineLoading', 'Link', 'List', 'LoadingSpinner', 'Menu', 'Dialog', 'Notification',
      'NumberInput', 'OverflowMenu', 'Pagination', 'Popover', 'Progress', 'Stepper',
      'RadioButton', 'Search', 'Slider', 'StructuredList', 'Tabs', 'Tag', 'TextInput',
      'Card', 'Switch', 'Toggletip', 'Tooltip', 'TreeView', 'Header', 'SideNavigation',
      'RightPanel', 'ComboButton', 'MenuButton', 'TextArea', 'AILabel', 'AspectRatio'
    ]
    const have = new Set(DS_COMPONENTS.map((c) => c.name))
    expect(carbon.filter((n) => !have.has(n))).toEqual([])
  })

  it('gives every component a category the overview knows about', () => {
    for (const c of DS_COMPONENTS) expect(DS_CATEGORIES).toContain(c.category)
  })

  it('names each component once', () => {
    const names = DS_COMPONENTS.map((c) => c.name)
    expect(names.length).toBe(new Set(names).size)
  })

  it('describes each component in a sentence', () => {
    for (const c of DS_COMPONENTS) {
      expect(c.desc.length, c.name).toBeGreaterThan(20)
      expect(c.desc.trim().endsWith('.'), c.name).toBe(true)
    }
  })

  it('renders every component, and every variant, without throwing', () => {
    for (const c of DS_COMPONENTS) {
      expect(() => renderToStaticMarkup(c.render(SYSTEM)), c.name).not.toThrow()
      for (const v of c.variants ?? []) {
        expect(() => renderToStaticMarkup(v.render(SYSTEM)), `${c.name}/${v.id}`).not.toThrow()
      }
    }
  })

  it('renders every component when the system turns its outlines off', () => {
    // Borderless systems take a different path through dsBorder and dsDivider.
    const flat = { ...SYSTEM, borderStyle: 'none' as const, shadow: 'off' as const }
    for (const c of DS_COMPONENTS) {
      expect(() => renderToStaticMarkup(c.render(flat)), c.name).not.toThrow()
    }
  })

  it('draws something for each component', () => {
    for (const c of DS_COMPONENTS) {
      expect(renderToStaticMarkup(c.render(SYSTEM)).length, c.name).toBeGreaterThan(30)
    }
  })
})
