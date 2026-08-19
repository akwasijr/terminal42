import { useCallback, useEffect, useMemo, useState } from 'react'
import type { VizSelected } from '../lib/vizInject'

/**
 * VizTweakPanel: side-panel host for the in-browser visual editor.
 *
 * Mirrors the section structure of the standalone VizTweak project (Layout,
 * Spacing, Size, Typography, Fill, Border & Radius, Shadow) but uses our own
 * tokens, sentence-case labels, flat inputs, and a single column layout sized
 * for the existing ~300 px right pane. No outlines on inputs, no all-caps,
 * no transparent surfaces.
 */

export type VizDiff = {
  selector: string
  tag: string
  text: string
  annotation: string
  props: Record<string, { old: string; next: string }>
}

type Props = {
  activeSessionId: string | null
  selected: VizSelected | null
  pickMode: boolean
  diffs: Record<string, VizDiff>
  onTogglePick: () => void
  onClearAll: () => void
  onResetSelected: () => void
  onApply: (selector: string, props: Record<string, string>) => void
  onAnnotate: (selector: string, text: string) => void
  onClose: () => void
}

const sectionTitle = 'mb-1.5 text-[11px] font-medium text-text-secondary'
const rowLabel = 'w-[68px] shrink-0 text-[11px] text-text-muted'
const inputBase =
  'h-7 w-full rounded-md bg-elevated px-2 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/60'
const numInput = inputBase
const colorInput = 'h-7 w-9 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0'
const segmentBtn =
  'h-7 flex-1 rounded-md text-[11.5px] text-text-secondary hover:text-text-primary'
const segmentBtnActive = 'bg-accent/15 text-accent'

function px(v: string | undefined): string {
  if (!v) return ''
  const n = parseFloat(v)
  return Number.isFinite(n) ? String(Math.round(n)) : ''
}
function rgbToHex(rgb: string | undefined): string {
  if (!rgb) return '#000000'
  const m = rgb.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!m) return '#000000'
  const to = (n: number) => n.toString(16).padStart(2, '0')
  return '#' + to(+m[1]) + to(+m[2]) + to(+m[3])
}
function num(v: string): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export function VizTweakPanel({
  activeSessionId,
  selected,
  pickMode,
  diffs,
  onTogglePick,
  onClearAll,
  onResetSelected,
  onApply,
  onAnnotate,
  onClose
}: Props) {
  const diffCount = Object.keys(diffs).length

  return (
    <aside
      className="flex h-full w-[320px] shrink-0 flex-col bg-surface"
      aria-label="Visual edit"
    >
      <header className="flex h-9 shrink-0 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-2 text-[12px]">
          <span className="font-medium text-text-primary">Visual edit</span>
          {diffCount > 0 && <span className="text-text-muted">· {diffCount}</span>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close visual edit"
          className="grid h-6 w-6 place-items-center rounded-md text-text-secondary hover:bg-elevated hover:text-text-primary"
        >
          <svg width="11" height="11" viewBox="0 0 16 16"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
      </header>

      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onTogglePick}
          className={[
            'h-7 rounded-md px-3 text-[11.5px] font-medium transition-colors',
            pickMode ? 'bg-accent text-white' : 'bg-elevated text-text-primary hover:bg-elevated/80'
          ].join(' ')}
        >
          {pickMode ? 'Picking…' : 'Pick element'}
        </button>
        <span className="truncate text-[11px] text-text-muted">
          {pickMode ? 'Click any element' : selected ? 'Element selected' : 'Click to select'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <EmptyState />
        ) : (
          <Editor
            key={selected.selector}
            selected={selected}
            diff={diffs[selected.selector]}
            onApply={(props) => onApply(selected.selector, props)}
            onAnnotate={(t) => onAnnotate(selected.selector, t)}
            onResetSelected={onResetSelected}
          />
        )}
      </div>

      {diffCount > 0 && (
        <ChangeList diffs={diffs} />
      )}

      <Footer
        diffCount={diffCount}
        diffs={diffs}
        activeSessionId={activeSessionId}
        onClearAll={onClearAll}
      />
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col gap-2 px-4 py-5 text-[11.5px] text-text-secondary">
      <p className="text-[12px] font-medium text-text-primary">Nothing selected</p>
      <p className="leading-relaxed text-text-muted">
        Hit Pick element, then click anything in the page to tweak its layout, spacing, type, or colors. Each change is collected into a list you can copy or send straight to the chat.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Editor({
  selected,
  diff,
  onApply,
  onAnnotate,
  onResetSelected
}: {
  selected: VizSelected
  diff: VizDiff | undefined
  onApply: (props: Record<string, string>) => void
  onAnnotate: (text: string) => void
  onResetSelected: () => void
}) {
  const cs = selected.computed
  const isFlex = (cs.display || '').includes('flex')
  const [annotation, setAnnotation] = useState(diff?.annotation || '')
  useEffect(() => { setAnnotation(diff?.annotation || '') }, [selected.selector, diff?.annotation])

  return (
    <div className="flex flex-col gap-3 px-3 py-3 text-[11.5px]">
      <ElementHeader selected={selected} onReset={onResetSelected} />

      <Section title="Notes for chat">
        <textarea
          value={annotation}
          onChange={(e) => { setAnnotation(e.target.value); onAnnotate(e.target.value) }}
          placeholder="Optional: describe what should change"
          className="min-h-[56px] w-full resize-y rounded-md bg-elevated px-2 py-1.5 text-[12px] leading-snug text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent/60"
        />
      </Section>

      <Section title="Layout">
        <SegmentedRow
          label="Display"
          value={cs.display || 'block'}
          options={[
            ['block', 'Block'],
            ['flex', 'Flex'],
            ['grid', 'Grid'],
            ['inline-block', 'Inline']
          ]}
          onChange={(v) => onApply({ display: v })}
        />
        {isFlex && (
          <>
            <SegmentedRow
              label="Direction"
              value={cs.flexDirection || 'row'}
              options={[['row', 'Row'], ['column', 'Column']]}
              onChange={(v) => onApply({ flexDirection: v })}
            />
            <SegmentedRow
              label="Justify"
              value={cs.justifyContent || 'flex-start'}
              options={[
                ['flex-start', 'Start'],
                ['center', 'Center'],
                ['space-between', 'Between'],
                ['flex-end', 'End']
              ]}
              onChange={(v) => onApply({ justifyContent: v })}
            />
            <SegmentedRow
              label="Align"
              value={cs.alignItems || 'stretch'}
              options={[
                ['flex-start', 'Start'],
                ['center', 'Center'],
                ['stretch', 'Stretch'],
                ['flex-end', 'End']
              ]}
              onChange={(v) => onApply({ alignItems: v })}
            />
            <NumberRow
              label="Gap"
              value={px(cs.gap)}
              onChange={(v) => onApply({ gap: v + 'px' })}
            />
          </>
        )}
      </Section>

      <Section title="Spacing">
        <BoxRow
          label="Padding"
          values={{
            t: px(cs.paddingTop), r: px(cs.paddingRight),
            b: px(cs.paddingBottom), l: px(cs.paddingLeft)
          }}
          onChange={(side, v) => {
            const map: Record<string, string> = {
              t: 'paddingTop', r: 'paddingRight', b: 'paddingBottom', l: 'paddingLeft'
            }
            onApply({ [map[side]]: v + 'px' })
          }}
          onChangeAll={(v) => onApply({
            paddingTop: v + 'px', paddingRight: v + 'px',
            paddingBottom: v + 'px', paddingLeft: v + 'px'
          })}
        />
        <BoxRow
          label="Margin"
          values={{
            t: px(cs.marginTop), r: px(cs.marginRight),
            b: px(cs.marginBottom), l: px(cs.marginLeft)
          }}
          onChange={(side, v) => {
            const map: Record<string, string> = {
              t: 'marginTop', r: 'marginRight', b: 'marginBottom', l: 'marginLeft'
            }
            onApply({ [map[side]]: v + 'px' })
          }}
          onChangeAll={(v) => onApply({
            marginTop: v + 'px', marginRight: v + 'px',
            marginBottom: v + 'px', marginLeft: v + 'px'
          })}
        />
      </Section>

      <Section title="Size">
        <Row label="Width">
          <input
            className={numInput}
            value={cs.width || ''}
            onChange={(e) => onApply({ width: e.target.value })}
            placeholder="auto"
          />
        </Row>
        <Row label="Height">
          <input
            className={numInput}
            value={cs.height || ''}
            onChange={(e) => onApply({ height: e.target.value })}
            placeholder="auto"
          />
        </Row>
      </Section>

      <Section title="Typography">
        <ColorRow
          label="Color"
          value={rgbToHex(cs.color)}
          onChange={(v) => onApply({ color: v })}
        />
        <NumberRow
          label="Size"
          value={px(cs.fontSize)}
          onChange={(v) => onApply({ fontSize: v + 'px' })}
        />
        <SegmentedRow
          label="Weight"
          value={String(num(cs.fontWeight || '400'))}
          options={[
            ['400', '400'],
            ['500', '500'],
            ['600', '600'],
            ['700', '700']
          ]}
          onChange={(v) => onApply({ fontWeight: v })}
        />
        <NumberRow
          label="Line"
          value={px(cs.lineHeight)}
          onChange={(v) => onApply({ lineHeight: v + 'px' })}
          placeholder="auto"
        />
        <NumberRow
          label="Tracking"
          value={px(cs.letterSpacing)}
          onChange={(v) => onApply({ letterSpacing: v + 'px' })}
          placeholder="0"
        />
        <SegmentedRow
          label="Align"
          value={cs.textAlign || 'left'}
          options={[
            ['left', 'Left'],
            ['center', 'Center'],
            ['right', 'Right'],
            ['justify', 'Just.']
          ]}
          onChange={(v) => onApply({ textAlign: v })}
        />
      </Section>

      <Section title="Fill">
        <ColorRow
          label="Background"
          value={rgbToHex(cs.backgroundColor)}
          onChange={(v) => onApply({ backgroundColor: v })}
        />
      </Section>

      <Section title="Border &amp; radius">
        <NumberRow
          label="Width"
          value={px(cs.borderTopWidth)}
          onChange={(v) => onApply({
            borderTopWidth: v + 'px', borderRightWidth: v + 'px',
            borderBottomWidth: v + 'px', borderLeftWidth: v + 'px',
            borderStyle: cs.borderTopStyle === 'none' ? 'solid' : (cs.borderTopStyle || 'solid')
          })}
        />
        <ColorRow
          label="Color"
          value={rgbToHex(cs.borderTopColor)}
          onChange={(v) => onApply({
            borderTopColor: v, borderRightColor: v,
            borderBottomColor: v, borderLeftColor: v
          })}
        />
        <NumberRow
          label="Radius"
          value={px(cs.borderRadius)}
          onChange={(v) => onApply({ borderRadius: v + 'px' })}
        />
      </Section>

      <Section title="Shadow">
        <div className="flex flex-wrap gap-1">
          {[
            ['None', 'none'],
            ['Subtle', '0 1px 3px rgba(0,0,0,0.12)'],
            ['Medium', '0 4px 12px rgba(0,0,0,0.15)'],
            ['Strong', '0 10px 24px rgba(0,0,0,0.22)']
          ].map(([label, val]) => (
            <button
              key={label}
              type="button"
              onClick={() => onApply({ boxShadow: val })}
              className="h-7 rounded-md bg-elevated px-2.5 text-[11px] text-text-primary hover:bg-elevated/80"
            >
              {label}
            </button>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ElementHeader({ selected, onReset }: { selected: VizSelected; onReset: () => void }) {
  const label = useMemo(() => {
    if (selected.id) return '#' + selected.id
    if (selected.classes.length) return '.' + selected.classes[0]
    return selected.tag
  }, [selected])
  return (
    <div className="flex items-center justify-between rounded-md bg-elevated px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="truncate text-[12px] font-medium text-text-primary">{label}</div>
        <div className="truncate text-[10.5px] text-text-muted" title={selected.selector}>
          {selected.selector}
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="ml-2 shrink-0 rounded-md px-2 py-0.5 text-[10.5px] text-text-secondary hover:bg-bg hover:text-text-primary"
        title="Discard tweaks for this element"
      >
        Reset
      </button>
    </div>
  )
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className={sectionTitle}>{title}</div>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className={rowLabel}>{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  )
}

function NumberRow({
  label, value, placeholder, onChange
}: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  return (
    <Row label={label}>
      <input
        className={numInput}
        value={local}
        placeholder={placeholder}
        inputMode="decimal"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local || '0') }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur() }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const delta = e.shiftKey ? 10 : 1
            const next = num(local) + (e.key === 'ArrowUp' ? delta : -delta)
            const s = String(next)
            setLocal(s); onChange(s)
          }
        }}
      />
    </Row>
  )
}

function ColorRow({
  label, value, onChange
}: { label: string; value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  return (
    <Row label={label}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={colorInput}
        aria-label={label + ' color'}
      />
      <input
        className={inputBase}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if (local !== value) onChange(local) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
    </Row>
  )
}

function SegmentedRow({
  label, value, options, onChange
}: {
  label: string
  value: string
  options: Array<[string, string]>
  onChange: (v: string) => void
}) {
  return (
    <Row label={label}>
      <div className="flex h-7 w-full items-center rounded-md bg-elevated p-0.5">
        {options.map(([val, lab]) => {
          const active = val === value
          return (
            <button
              key={val}
              type="button"
              onClick={() => onChange(val)}
              className={[segmentBtn, active ? segmentBtnActive : ''].join(' ')}
            >
              {lab}
            </button>
          )
        })}
      </div>
    </Row>
  )
}

function BoxRow({
  label, values, onChange, onChangeAll
}: {
  label: string
  values: { t: string; r: string; b: string; l: string }
  onChange: (side: 't' | 'r' | 'b' | 'l', v: string) => void
  onChangeAll: (v: string) => void
}) {
  const [linked, setLinked] = useState(
    values.t === values.r && values.r === values.b && values.b === values.l
  )
  useEffect(() => {
    setLinked(values.t === values.r && values.r === values.b && values.b === values.l)
  }, [values.t, values.r, values.b, values.l])
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-text-muted">{label}</span>
        <button
          type="button"
          onClick={() => setLinked((v) => !v)}
          className={[
            'rounded-md px-1.5 py-0.5 text-[10px]',
            linked ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'
          ].join(' ')}
          title={linked ? 'Edit each side independently' : 'Link all sides'}
        >
          {linked ? 'Linked' : 'Per side'}
        </button>
      </div>
      {linked ? (
        <input
          className={numInput}
          value={values.t}
          inputMode="decimal"
          onChange={(e) => onChangeAll(e.target.value || '0')}
        />
      ) : (
        <div className="grid grid-cols-4 gap-1">
          {(['t', 'r', 'b', 'l'] as const).map((side) => (
            <input
              key={side}
              className={numInput}
              value={values[side]}
              inputMode="decimal"
              aria-label={label + ' ' + side}
              onChange={(e) => onChange(side, e.target.value || '0')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ChangeList({ diffs }: { diffs: Record<string, VizDiff> }) {
  const entries = Object.values(diffs)
  return (
    <div className="shrink-0">
      <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-text-secondary">Changes</div>
      <ul className="max-h-[140px] overflow-y-auto">
        {entries.map((d) => (
          <li key={d.selector} className="px-3 py-1.5 text-[11px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-text-primary">{d.tag}</span>
              <span className="text-[10px] text-text-muted">
                {Object.keys(d.props).length}
                {d.annotation ? ' · note' : ''}
              </span>
            </div>
            <div className="truncate text-[10.5px] text-text-muted" title={d.selector}>
              {d.selector}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function Footer({
  diffCount, diffs, activeSessionId, onClearAll
}: {
  diffCount: number
  diffs: Record<string, VizDiff>
  activeSessionId: string | null
  onClearAll: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState(false)

  const formatPrompt = useCallback(() => {
    const items = Object.values(diffs)
    if (!items.length) return ''
    const lines: string[] = [
      'I tweaked these elements in the live preview. Apply the equivalent changes to the source code:',
      ''
    ]
    items.forEach((d, i) => {
      lines.push(`${i + 1}. ${d.tag}: \`${d.selector}\``)
      if (d.text) lines.push(`   text: "${d.text}"`)
      Object.entries(d.props).forEach(([prop, ov]) => {
        lines.push(`   - ${prop}: ${ov.old || '(unset)'} → ${ov.next}`)
      })
      if (d.annotation.trim()) lines.push(`   note: ${d.annotation.trim()}`)
      lines.push('')
    })
    return lines.join('\n')
  }, [diffs])

  const handleCopy = async () => {
    const p = formatPrompt(); if (!p) return
    try { await navigator.clipboard.writeText(p) } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  const handleSend = async () => {
    const p = formatPrompt(); if (!p || !activeSessionId) return
    try { await window.terminal42.pty.write(activeSessionId, p) } catch {}
    setSent(true); setTimeout(() => setSent(false), 1500)
  }

  return (
    <footer className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
      <button
        type="button"
        onClick={onClearAll}
        disabled={diffCount === 0}
        className="text-[11px] text-text-muted hover:text-error disabled:opacity-40 disabled:hover:text-text-muted"
      >
        Clear all
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={diffCount === 0}
          className="text-[11.5px] text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:hover:text-text-secondary"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={diffCount === 0 || !activeSessionId}
          title={activeSessionId ? 'Paste into the active terminal' : 'No active terminal session'}
          className="h-7 rounded-md bg-accent px-3 text-[11.5px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sent ? 'Sent' : 'Send to chat'}
        </button>
      </div>
    </footer>
  )
}
