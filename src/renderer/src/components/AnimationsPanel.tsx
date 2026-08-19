import { useState } from 'react'
import { type FObj } from '../lib/freeformTypes'
import { type AnimKind, type AnimSpec, type PropName } from '../lib/timelineModel'
import { ANIM_KINDS, ANIM_KIND_ORDER, applyAnim, defaultSpec, PROP_ANIM_LABEL, removeAnim, summarize, targetProp, unspeccedProps } from '../lib/animBuilders'

const EASINGS: Array<{ label: string; value: string }> = [
  { label: 'Linear', value: 'cubic-bezier(0,0,1,1)' },
  { label: 'Ease in', value: 'cubic-bezier(0.42,0,1,1)' },
  { label: 'Ease out', value: 'cubic-bezier(0,0,0.58,1)' },
  { label: 'Ease in and out', value: 'cubic-bezier(0.42,0,0.58,1)' },
  { label: 'Ease out back', value: 'cubic-bezier(0.34,1.56,0.64,1)' }
]

const GROUPS: Array<AnimKind[]> = [
  ANIM_KIND_ORDER.filter((k) => ANIM_KINDS[k].group === 'Entrance'),
  ANIM_KIND_ORDER.filter((k) => ANIM_KINDS[k].group === 'Emphasis'),
  ANIM_KIND_ORDER.filter((k) => ANIM_KINDS[k].group === 'Exit')
]

const fieldBox = 'flex items-center gap-1 rounded bg-elevated px-2 py-1 text-text-muted'
const numInput = 'w-full bg-transparent text-[12px] text-text-primary focus:outline-none'

function amountField(kind: AnimKind): { label: string; toPct: (v: number) => number; fromPct: (p: number) => number } | null {
  if (kind === 'fade-in' || kind === 'fade-out') return { label: 'Start opacity', toPct: (v) => Math.round(v * 100), fromPct: (p) => p / 100 }
  if (kind === 'scale-in' || kind === 'scale-out' || kind === 'pop') return { label: 'Start scale', toPct: (v) => Math.round(v * 100), fromPct: (p) => p / 100 }
  return null
}

export function AnimationsPanel({ obj, duration, patch, pushHistory }: {
  obj: FObj
  duration: number
  patch: (id: string, p: Partial<FObj>) => void
  pushHistory: () => void
}): JSX.Element {
  const anims = obj.anims ?? []
  const [draft, setDraft] = useState<AnimSpec | null>(null)
  const editing = draft != null

  const open = (spec: AnimSpec): void => setDraft({ ...spec })
  const startAdd = (): void => setDraft(defaultSpec('fade-in'))

  const apply = (): void => {
    if (!draft) return
    pushHistory()
    const r = applyAnim(obj.motion, draft, duration)
    patch(obj.id, { motion: r.motion, anims: r.anims(anims) })
    setDraft(null)
  }
  const remove = (spec: AnimSpec): void => {
    pushHistory()
    const r = removeAnim(obj.motion, spec)
    patch(obj.id, { motion: r.motion, anims: r.anims(anims) })
    if (draft?.id === spec.id) setDraft(null)
  }
  const removeTrack = (prop: PropName): void => {
    pushHistory()
    const tracks = { ...(obj.motion?.tracks ?? {}) }
    delete tracks[prop]
    patch(obj.id, { motion: { duration: obj.motion?.duration ?? duration, tracks } })
  }

  const extras = unspeccedProps(obj.motion, anims)
  const meta = draft ? ANIM_KINDS[draft.kind] : null
  const amt = draft ? amountField(draft.kind) : null

  return (
    <div className="space-y-1.5">
      {/* current animations */}
      {anims.map((a) => (
        <div key={a.id} className={['flex items-center gap-2 rounded px-2 py-1.5', draft?.id === a.id ? 'bg-accent/15' : 'bg-elevated'].join(' ')}>
          <button type="button" onClick={() => open(a)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[12px] text-text-primary">{ANIM_KINDS[a.kind].label}</div>
            <div className="truncate text-[10.5px] text-text-muted">{summarize(a)}</div>
          </button>
          <button type="button" onClick={() => remove(a)} title="Remove animation" className="grid h-5 w-5 shrink-0 place-items-center rounded text-text-muted hover:text-error">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
      ))}

      {/* tracks animated elsewhere (timeline / preset) with no spec to edit here */}
      {extras.map((p) => (
        <div key={p} className="flex items-center gap-2 rounded bg-elevated px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] text-text-primary">{PROP_ANIM_LABEL[p]}</div>
            <div className="truncate text-[10.5px] text-text-muted">Keyframed in the timeline</div>
          </div>
          <button type="button" onClick={() => removeTrack(p)} title="Remove animation" className="grid h-5 w-5 shrink-0 place-items-center rounded text-text-muted hover:text-error">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
      ))}

      {/* editor */}
      {editing && draft && meta && (
        <div className="space-y-2 rounded bg-bg/40 p-2">
          <label className="flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
            <span className="shrink-0">Type</span>
            <select value={draft.kind} onChange={(e) => setDraft(defaultSpec(e.target.value as AnimKind))} className="min-w-0 flex-1 rounded bg-elevated px-2 py-1 text-[12px] text-text-primary focus:outline-none">
              {GROUPS.map((g, i) => (
                <optgroup key={i} label={['Entrance', 'Emphasis', 'Exit'][i]}>
                  {g.map((k) => <option key={k} value={k}>{ANIM_KINDS[k].label}</option>)}
                </optgroup>
              ))}
            </select>
          </label>

          {meta.fields.includes('dir') && (
            <label className="flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
              <span className="shrink-0">Direction</span>
              <select value={draft.dir ?? 'left'} onChange={(e) => setDraft({ ...draft, dir: e.target.value as AnimSpec['dir'] })} className="min-w-0 flex-1 rounded bg-elevated px-2 py-1 text-[12px] text-text-primary focus:outline-none">
                <option value="left">From left</option>
                <option value="right">From right</option>
                <option value="up">From top</option>
                <option value="down">From bottom</option>
              </select>
            </label>
          )}
          {meta.fields.includes('distance') && (
            <label className="flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
              <span className="shrink-0">Distance</span>
              <span className={[fieldBox, 'w-[90px]'].join(' ')}><input type="number" value={draft.distance ?? 200} onChange={(e) => setDraft({ ...draft, distance: parseFloat(e.target.value) || 0 })} className={numInput} /><span className="text-[10.5px]">px</span></span>
            </label>
          )}
          {meta.fields.includes('degrees') && (
            <label className="flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
              <span className="shrink-0">Rotation</span>
              <span className={[fieldBox, 'w-[90px]'].join(' ')}><input type="number" value={draft.degrees ?? 180} onChange={(e) => setDraft({ ...draft, degrees: parseFloat(e.target.value) || 0 })} className={numInput} /><span className="text-[10.5px]">°</span></span>
            </label>
          )}
          {meta.fields.includes('amount') && amt && (
            <label className="flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
              <span className="shrink-0">{amt.label}</span>
              <span className={[fieldBox, 'w-[90px]'].join(' ')}><input type="number" value={amt.toPct(draft.amount ?? 0)} onChange={(e) => setDraft({ ...draft, amount: amt.fromPct(parseFloat(e.target.value) || 0) })} className={numInput} /><span className="text-[10.5px]">%</span></span>
            </label>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <label className={fieldBox}><span className="w-9 shrink-0 text-[10.5px]">Delay</span><input type="number" value={draft.delay} min={0} step={50} onChange={(e) => setDraft({ ...draft, delay: Math.max(0, parseFloat(e.target.value) || 0) })} className={numInput} /></label>
            <label className={fieldBox}><span className="w-7 shrink-0 text-[10.5px]">Dur</span><input type="number" value={draft.duration} min={50} step={50} onChange={(e) => setDraft({ ...draft, duration: Math.max(50, parseFloat(e.target.value) || 50) })} className={numInput} /></label>
          </div>
          <label className="flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
            <span className="shrink-0">Easing</span>
            <select value={draft.easing} onChange={(e) => setDraft({ ...draft, easing: e.target.value })} className="min-w-0 flex-1 rounded bg-elevated px-2 py-1 text-[12px] text-text-primary focus:outline-none">
              {EASINGS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </label>

          <div className="flex items-center gap-1.5 pt-0.5">
            <button type="button" onClick={apply} className="flex-1 rounded bg-accent px-2 py-1.5 text-[12px] text-accent-text hover:opacity-90">{anims.some((a) => a.id === draft.id) ? 'Update animation' : 'Add animation'}</button>
            <button type="button" onClick={() => setDraft(null)} className="rounded px-2 py-1.5 text-[12px] text-text-muted hover:text-text-primary">Cancel</button>
          </div>
        </div>
      )}

      {!editing && (
        <button type="button" onClick={startAdd} className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed px-2 py-1.5 text-[12px] text-text-secondary hover:border-accent/60 hover:text-text-primary">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M7 2v10M2 7h10" /></svg>
          Add animation
        </button>
      )}

      {targetPropHint(draft)}
    </div>
  )
}

// Tiny helper so the editor reads which track it will write (keeps users oriented).
function targetPropHint(draft: AnimSpec | null): JSX.Element | null {
  if (!draft) return null
  return <p className="px-0.5 text-[10px] text-text-muted">Animates {PROP_ANIM_LABEL[targetProp(draft)]}</p>
}
