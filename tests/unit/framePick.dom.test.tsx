import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeSelector, readStyles, classifyToken, readProjectTokens
} from '../../src/shared/framePick'

// jsdom, because every one of these reads a real document.

function page(html: string): Document {
  document.body.innerHTML = html
  return document
}

beforeEach(() => { document.head.innerHTML = ''; document.body.innerHTML = '' })

describe('computeSelector', () => {
  it('uses an id on its own when there is one', () => {
    const doc = page('<div class="a b"><p id="hi">x</p></div>')
    expect(computeSelector(doc.querySelector('#hi'))).toBe('#hi')
  })

  it('names an element by tag and its first two classes', () => {
    const doc = page('<section class="card wide extra"><span>x</span></section>')
    expect(computeSelector(doc.querySelector('span'))).toBe('section.card.wide > span')
  })

  it('stops at the body rather than walking into html', () => {
    const doc = page('<main><p>x</p></main>')
    expect(computeSelector(doc.querySelector('p'))).toBe('main > p')
  })

  it('separates repeated siblings by position', () => {
    const doc = page('<ul><li>a</li><li>b</li><li>c</li></ul>')
    expect(computeSelector(doc.querySelectorAll('li')[2])).toBe('ul > li:nth-of-type(3)')
  })

  it('leaves a lone child unnumbered', () => {
    const doc = page('<ul><li>a</li></ul>')
    expect(computeSelector(doc.querySelector('li'))).toBe('ul > li')
  })

  it('never names our own selection class', () => {
    const doc = page('<div class="t42-selected card"><b>x</b></div>')
    expect(computeSelector(doc.querySelector('b'))).toBe('div.card > b')
  })

  it('keeps to four levels however deep the element is', () => {
    const doc = page('<a><b><c><d><e><f>x</f></e></d></c></b></a>')
    const sel = computeSelector(doc.querySelector('f'))
    expect(sel.split(' > ')).toHaveLength(4)
    expect(sel.endsWith('f')).toBe(true)
  })

  it('answers with nothing for nothing', () => {
    expect(computeSelector(null)).toBe('')
    expect(computeSelector(document.createTextNode('x') as unknown as Element)).toBe('')
  })

  it('finds the element it named', () => {
    const doc = page('<div class="row"><ul><li>a</li><li>b</li></ul></div>')
    const target = doc.querySelectorAll('li')[1]
    expect(doc.querySelector(computeSelector(target))).toBe(target)
  })
})

describe('readStyles', () => {
  it('calls an element with only text a text element', () => {
    const doc = page('<p style="color: rgb(255, 0, 0)">Hello</p>')
    const s = readStyles(doc.querySelector('p') as HTMLElement)
    expect(s.isText).toBe(true)
    expect(s.color).toBe('#ff0000')
  })

  it('does not call a wrapper a text element', () => {
    const doc = page('<div>text<span>and a child</span></div>')
    expect(readStyles(doc.querySelector('div') as HTMLElement).isText).toBe(false)
  })

  it('turns rgb into hex and keeps hex as it is', () => {
    const doc = page('<p style="background-color: rgb(1, 2, 3)">x</p>')
    expect(readStyles(doc.querySelector('p') as HTMLElement).background).toBe('#010203')
  })

  it('rounds sizes to whole pixels', () => {
    const doc = page('<p style="font-size: 15.6px; padding-top: 3.4px">x</p>')
    const s = readStyles(doc.querySelector('p') as HTMLElement)
    expect(s.fontSize).toBe(16)
    expect(s.paddingTop).toBe(3)
  })

  it('falls back to a normal weight when there is nothing to read', () => {
    const doc = page('<p>x</p>')
    expect(readStyles(doc.querySelector('p') as HTMLElement).fontWeight).toBe(400)
  })
})

describe('classifyToken', () => {
  it('knows a colour in any of its spellings', () => {
    for (const v of ['#fff', '#ff0000', '#ff0000ff', 'rgb(0,0,0)', 'rgba(0,0,0,.5)', 'hsl(0 0% 0%)']) {
      expect(classifyToken(v)).toBe('color')
    }
  })

  it('knows a measurement', () => {
    for (const v of ['16px', '1.5rem', '100%', '-4px', '200ms', '12']) {
      expect(classifyToken(v)).toBe('number')
    }
  })

  it('calls everything else text', () => {
    for (const v of ['DM Sans, sans-serif', 'var(--other)', 'ease-in-out']) {
      expect(classifyToken(v)).toBe('text')
    }
  })
})

describe('readProjectTokens', () => {
  it('reads the declarations off a root block', () => {
    document.head.innerHTML = '<style>:root { --brand: #b34700; --gap: 16px }</style>'
    const tokens = readProjectTokens(document, classifyToken)
    expect(tokens.map((t) => t.name)).toEqual(['--brand', '--gap'])
    expect(tokens.map((t) => t.kind)).toEqual(['color', 'number'])
  })

  it('keeps the first of a name declared twice', () => {
    document.head.innerHTML = '<style>:root{--a:#111}</style><style>:root{--a:#222}</style>'
    const tokens = readProjectTokens(document, classifyToken)
    expect(tokens).toHaveLength(1)
  })

  it('reads a block written on html as well as on :root', () => {
    document.head.innerHTML = '<style>html { --a: 4px }</style>'
    expect(readProjectTokens(document, classifyToken).map((t) => t.name)).toEqual(['--a'])
  })

  it('finds nothing in a page that declares nothing', () => {
    document.head.innerHTML = '<style>.card { color: red }</style>'
    expect(readProjectTokens(document, classifyToken)).toEqual([])
  })

  it('finds nothing in a page with no styles at all', () => {
    expect(readProjectTokens(document, classifyToken)).toEqual([])
  })
})
