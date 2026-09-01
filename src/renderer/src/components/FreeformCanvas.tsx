import { createContext, Fragment, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ColorPicker, type PickerRequest } from './ColorPicker'
import { useTokenSwatches } from '../lib/tokens/useTokenSwatches'
import { lerpHex } from '../lib/color'
import { TimelinePanel } from './TimelinePanel'
import { Tooltip } from './Tooltip'
import { CanvasAssistant } from './CanvasAssistant'
import { AnimationsPanel } from './AnimationsPanel'
import { BoxesThinking } from './PencilThinking'
import { type CanvasContext, type ObjectSpec, buildObject, sanitizeObjectPatch } from '../lib/canvasAgent'
import { lintObjects } from '../lib/designQA'
import { expandComponents, DEFAULT_KIT, kitFromDesignSystem, vibrantAccent, type Kit } from '../lib/uiKit'
import { themeColorRoles, themeColorRolesDark, bindObjectToTokens, buildFieldMaps, numberTokens, type NumberMaps } from '../lib/themeBinding'
import { isFigmaClipboard, decodeFigmaClipboard } from '../lib/figmaClipboard'
import { loadSystems, type DesignSystem } from '../lib/designSystem'
import { CANVAS_DS_COMPONENTS, componentToObjects, designSystemSummary, type CanvasComponentName } from '../lib/designSystemCanvas'
import { type LayerMotion, type PropName, hasAnyKeys as motionHasKeys, sampleTrack, setKey, removeKey, emptyMotion } from '../lib/timelineModel'
import { composeArtboardHtml } from '../lib/freeformExport'
import { composeArtboardSvg, frameSvg } from '../lib/svgExport'
import { toTailwind, toReactCss } from '../lib/layerCode'
import { docIsEmpty, readDoc } from '../lib/freeformDoc'
import { ThemePanel } from './tokens/ThemePanel'
import type { TokenKind } from '../lib/tokens/themeRows'
import { addToken } from '../../../shared/tokens/edit'
import { emptyStudio, studioFromFeel } from '../../../shared/tokens/scaffold'
import { feelFromVibe } from '../lib/tokens/feelFromVibe'
import {
  type FObj,
  type Shape,
  type TextAlign,
  type GradientStop,
  FONTS,
  WEIGHTS,
  fontByLabel,
  objectFillCss,
  transformOriginCss,
  objectTextColorCss,
  newStopId,
  type PaintCfg,
  FILL_PAINT,
  STROKE_PAINT,
  BORDER_PAINT,
  paintStopsOf,
  paintCssOf,
  paintIsRich,
  svgLinearCoords,
  polygonPoints,
  starPoints,
  googleFontsHref,
  makeObject,
  shapeClipPath,
  pathFromPoints,
  staticFilter,
  staticBoxShadow,
  backdropFilterCss,
  rgbaFrom,
  type Effect,
  type EffectType,
} from '../lib/freeformTypes'
import { EFFECT_LABEL, EFFECT_ORDER, makeEffect, migrateEffects, effectsBoxShadow, effectsFilter, effectsBackdrop, effectsOverlays, effectsTextureFilters, effectsTextureFilterCss, effectsClipsShape } from '../lib/effects'
import { reflowAll } from '../lib/autoLayout'
import {
  type VariableCollection,
  type Variable,
  type VarMode,
  type VarType,
  type VarValue,
  type BindField,
  type VarScope,
  type VarClip,
  resolveObjects,
  makeCollection,
  makeVariable,
  newModeId,
  newCollectionId,
  newVariableId,
  isAlias,
  resolveVarValue,
  variablesOfType,
  variablesForField,
  scopesForType,
  SCOPE_LABEL,
  variableLabel,
  groupedVariables,
  variableGroups,
  splitVarName,
  defaultValueFor,
  findVariable,
  uniqueVarName,
  fieldVarType,
  FIELD_LABEL,
} from '../lib/variables'
import { exportDTCG, importDTCG, uniqueCollectionName } from '../lib/dtcg'
import {
  type StyleLibrary, type ColorStyle, type TextStyle, type StyleType,
  makeStyleLibrary, normalizeLibrary, findColorStyle, findTextStyle, findEffectStyle,
  resolveColorStyle, colorStyleFromObj, textStyleFromObj, effectStyleFromObj,
  applyColorStyle, applyTextStyle, applyEffectStyle, uniqueStyleName,
} from '../lib/styles'
import { type PublishedLibrary, loadLibraries, publishLibrary, deleteLibrary, mergeLibraryInto, totalAssets } from '../lib/library'
import { syncTokensCollection, sameCollections } from '../lib/tokens/toForm'
import { TokensPicker } from './tokens/TokensPicker'
import { hydrateStudio } from '../../../shared/tokens/types'
import type { TokenStudio } from '../../../shared/tokens/types'
import { timelineKeyframeSel } from '../lib/timelineSelection'
import { SHADERS, SHADER_CATEGORIES, shaderById, defaultShaderParams, ShaderLayer, type ShaderDef, type ShaderParam } from '../lib/shaders'
import {
  type Box,
  type Handle,
  type SnapGuide,
  groupBounds,
  resizeBox,
  computeSnaps,
  normalizeBox,
  boxesIntersect,
  alignBoxes,
  distributeBoxes,
  type AlignMode,
} from '../lib/freeformGeom'
import {
  type Artboard,
  ARTBOARD_GROUPS,
  abBox,
  worldBounds,
  artboardAt,
  frameIntent,
  ownerArtboard,
  placeNewArtboard,
  newArtboardId,
} from '../lib/artboards'

// ── Local helpers ───────────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
type Snapshot = { objects: FObj[]; artboards: Artboard[] }
const boxOf = (o: FObj): Box => ({ x: o.x, y: o.y, w: o.w, h: o.h })

type Tool = 'select' | 'frame' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'polygon' | 'star' | 'text' | 'image' | 'pencil' | 'hand'
const CREATE_TOOLS: Tool[] = ['frame', 'rect', 'ellipse', 'line', 'arrow', 'polygon', 'star', 'text', 'image']

type Drag =
  | { mode: 'create'; id: string; sx: number; sy: number }
  | { mode: 'move'; sx: number; sy: number; orig: Record<string, { x: number; y: number }>; cloneFrom?: { x: number; y: number } }
  | { mode: 'resize'; id: string; handle: Handle; box: Box; sx: number; sy: number; rot: number; aspect: boolean }
  | { mode: 'rotate'; id: string; cx: number; cy: number; start: number; orig: number }
  | { mode: 'rotategroup'; cx: number; cy: number; start: number; orig: Record<string, { x: number; y: number; w: number; h: number; rotation: number }> }
  | { mode: 'resizegroup'; handle: Handle; box: Box; orig: Record<string, { x: number; y: number; w: number; h: number }> }
  | { mode: 'marquee'; sx: number; sy: number }
  | { mode: 'pan'; sx: number; sy: number; px: number; py: number }
  | { mode: 'mpath'; id: string; t: number }
  | { mode: 'createab'; id: string; sx: number; sy: number }
  | { mode: 'resizeab'; id: string; handle: Handle; box: Box; sx: number; sy: number }
  | { mode: 'moveab'; id: string; sx: number; sy: number; ox: number; oy: number; objs: Record<string, { x: number; y: number }> }
  | { mode: 'draw' }
  | null

// Tiny inline icons (no emoji, no boxes around them).
const Eye = ({ on }: { on: boolean }): JSX.Element =>
  on ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18" /><path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.2 6.3A17 17 0 0 0 2 12s3.5 6 10 6a10 10 0 0 0 3.3-.5" /></svg>
  )
const Lock = ({ on }: { on: boolean }): JSX.Element =>
  on ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 7-2" /></svg>
  )

/** Monochrome, distinct layer-row glyph per object type (Figma-style: no per-kind
 * colours, just a recognisable icon). */
function layerKind(o: FObj, hasChildren = false): { label: string; icon: JSX.Element } {
  const ic = (children: React.ReactNode): JSX.Element => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  const brackets = ic(<path d="M5 3H3v2M11 3h2v2M13 11v2h-2M5 13H3v-2" />)
  if (o.componentName) return { label: 'Component', icon: ic(<path d="M8 1.8 14.2 8 8 14.2 1.8 8z" />) }
  if (o.componentSlot) return { label: 'Slot', icon: ic(<><rect x="3" y="3" width="10" height="10" rx="1.5" /><path d="M8 5.5v5M5.5 8h5" /></>) }
  if (o.type === 'frame' && o.layoutMode && o.layoutMode !== 'none') return { label: 'Flow', icon: ic(<><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><path d="M5 6h6M5 8h6M5 10h4" /></>) }
  if (o.type === 'frame' && hasChildren) return { label: 'Group', icon: brackets }
  if (o.type === 'frame') return { label: 'Frame', icon: brackets }
  if (o.type === 'text') return { label: 'Text', icon: <span className="text-[10px] font-semibold leading-none">Aa</span> }
  if (o.type === 'image') return { label: 'Image', icon: ic(<><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><path d="M4 11l3-3 2 2 1.5-1.5L13 11" /><circle cx="6" cy="6" r="1" /></>) }
  if (o.type === 'rect') return { label: 'Rectangle', icon: ic(<rect x="3" y="3" width="10" height="10" rx="1.5" />) }
  if (o.type === 'ellipse') return { label: 'Ellipse', icon: ic(<circle cx="8" cy="8" r="5.5" />) }
  if (o.type === 'line') return { label: 'Line', icon: ic(<path d="M3 13L13 3" />) }
  if (o.type === 'arrow') return { label: 'Arrow', icon: ic(<path d="M3 13L13 3M7 3h6v6" />) }
  if (o.type === 'polygon') return { label: 'Polygon', icon: ic(<path d="M8 2.5l5.5 10H2.5z" />) }
  if (o.type === 'star') return { label: 'Star', icon: ic(<path d="M8 2l1.7 3.7 4 .5-2.9 2.7.8 4L8 11l-3.6 1.9.8-4-2.9-2.7 4-.5z" />) }
  if (o.type === 'path') return { label: 'Vector', icon: ic(<><rect x="3.5" y="3.5" width="9" height="9" rx="1" /><circle cx="3.5" cy="3.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12.5" cy="3.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="3.5" cy="12.5" r="1.3" fill="currentColor" stroke="none" /><circle cx="12.5" cy="12.5" r="1.3" fill="currentColor" stroke="none" /></>) }
  return { label: 'Layer', icon: ic(<path d="M8 2.5 13.5 8 8 13.5 2.5 8z" />) }
}

// Figma-style tool glyphs (stroked, 18px). No emoji, no boxes behind them.
const TOOL_ICONS: Record<Tool, JSX.Element> = {
  select: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 7-6 1.6L9 18z" /></svg>,
  frame: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 3v18M17 3v18M3 7h18M3 17h18" /></svg>,
  rect: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>,
  ellipse: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /></svg>,
  line: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 19L19 5" /></svg>,
  arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19L19 5M11 5h8v8" /></svg>,
  polygon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 4l8 15H4z" /></svg>,
  star: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M12 3l2.6 5.6 6 .7-4.5 4 1.3 6-5.4-3.1L6.6 19.3l1.3-6L3.4 9.3l6-.7z" /></svg>,
  text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 6h14M12 6v12" /></svg>,
  image: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-6 6" /></svg>,
  pencil: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /><path d="M14.5 5.5l3 3" /></svg>,
  hand: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-.5V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V15a5 5 0 0 1-5 5h-1.5a4 4 0 0 1-3-1.4L6 16.5c-.8-1-.6-1.8.2-2.3.6-.4 1.4-.2 1.8.4l1 1.3" /></svg>,
}

type OpenPicker = (r: Omit<PickerRequest, 'onClose'>) => void

const EditContext = createContext<{ openPicker: OpenPicker; pushHistory: () => void }>({ openPicker: () => {}, pushHistory: () => {} })

// Variable binding context: lets deeply-nested inspector editors read the document's
// variable collections and bind/unbind the selected object's fields.
const VarBindContext = createContext<{
  collections: VariableCollection[]
  bindFieldToVar: (field: BindField, varId: string) => void
  unbindField: (field: BindField) => void
  openVariables: () => void
  createColorVarForField: (field: BindField, hex: string) => void
  setVarMode: (colId: string, modeId: string | null) => void
}>({ collections: [], bindFieldToVar: () => {}, unbindField: () => {}, openVariables: () => {}, createColorVarForField: () => {}, setVarMode: () => {} })

/** After a floating panel mounts, nudge it fully on-screen using its measured size
 * (so a panel anchored near the bottom/right never spills off the viewport). The
 * panel stays draggable afterwards. */
function useClampPanel(ref: React.RefObject<HTMLElement>, setPos: React.Dispatch<React.SetStateAction<{ left: number; top: number }>>): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth, h = el.offsetHeight, pad = 8
    setPos((p) => {
      const left = Math.max(pad, Math.min(p.left, window.innerWidth - w - pad))
      const top = Math.max(pad, Math.min(p.top, window.innerHeight - h - pad))
      return left === p.left && top === p.top ? p : { left, top }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** A colour swatch that opens the custom floating colour picker. */
function ColorWell({ value, onChange, size = 'sm', opacity, onOpacity, varField }: { value: string; onChange: (v: string) => void; size?: 'sm' | 'md'; opacity?: number; onOpacity?: (v: number) => void; varField?: BindField }): JSX.Element {
  const { openPicker } = useContext(EditContext)
  const { collections, bindFieldToVar, createColorVarForField } = useContext(VarBindContext)
  const ref = useRef<HTMLButtonElement>(null)
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
  const dim = size === 'md' ? 'h-[22px] w-[22px]' : 'h-5 w-5'
  const open = (): void => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return
    const varExtras = varField
      ? {
          colorVars: variablesForField(collections, varField).map(({ collection, variable }) => ({
            id: variable.id,
            name: collections.length > 1 ? `${collection.name} / ${variable.name}` : variable.name,
            hex: (() => { const v = resolveVarValue(collections, variable.id); return typeof v === 'string' ? v : '#000000' })(),
          })),
          onBindVar: (id: string) => bindFieldToVar(varField, id),
          onCreateVar: (hex: string) => createColorVarForField(varField, hex),
        }
      : {}
    openPicker({ value: safe, opacity: opacity ?? 1, showAlpha: !!onOpacity, anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, onChange: (hex, op) => { onChange(hex); if (onOpacity && op != null) onOpacity(op) }, ...varExtras })
  }
  return <button ref={ref} type="button" onClick={open} className={`relative ${dim} shrink-0 overflow-hidden rounded-[5px]`} style={{ background: safe }} />
}

/** Six-digit uppercase hex without the leading hash, for inspector labels. */
function hexLabel(c: string): string {
  const m = /^#?([0-9a-fA-F]{3,6})$/.exec(c.trim())
  if (!m) return c.replace('#', '').toUpperCase()
  let h = m[1]
  if (h.length === 3) h = h.split('').map((x) => x + x).join('')
  return h.toUpperCase()
}

/** Render one ObjectSpec as an absolutely-positioned node inside a thumbnail. */
function SpecNode({ sp, ox, oy }: { sp: ObjectSpec; ox: number; oy: number }): JSX.Element {
  const left = (sp.x ?? 0) - ox, top = (sp.y ?? 0) - oy, w = sp.w ?? 0, h = sp.h ?? 0
  if (sp.type === 'text') {
    return <div style={{ position: 'absolute', left, top, width: w, height: h, color: sp.color, fontSize: sp.fontSize, fontWeight: sp.fontWeight, fontFamily: fontByLabel(sp.fontFamily ?? '').stack, lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden' }}>{sp.text}</div>
  }
  return <div style={{ position: 'absolute', left, top, width: w, height: h, background: sp.fillEnabled ? sp.fill : 'transparent', border: sp.strokeEnabled ? `${sp.strokeWidth ?? 1}px solid ${sp.stroke}` : undefined, borderRadius: sp.radius }} />
}

/** A faithful, scaled-down preview of a design-system component — the exact objects
 * that get inserted, drawn with the active system's colours. */
function DsComponentPreview({ s, name }: { s: DesignSystem; name: CanvasComponentName }): JSX.Element {
  const specs = useMemo(() => componentToObjects(s, name, 0, 0), [s, name])
  const box = 92, maxW = 232, pad = 14
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const sp of specs) { const x = sp.x ?? 0, y = sp.y ?? 0, w = sp.w ?? 0, h = sp.h ?? 0; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h) }
  const cw = Math.max(1, maxX - minX), ch = Math.max(1, maxY - minY)
  const scale = Math.min((maxW - pad * 2) / cw, (box - pad * 2) / ch, 1)
  return (
    <div style={{ height: box, background: s.colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ width: cw * scale, height: ch * scale, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: cw, height: ch, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {specs.map((sp, i) => <SpecNode key={i} sp={sp} ox={minX} oy={minY} />)}
        </div>
      </div>
    </div>
  )
}

// Small inspector icons (plain glyphs, no containers).
// Hard rule: every side-panel section header (both the left tabs and the right
// inspector) uses these exact styles, so headers line up at the same size,
// weight, colour and vertical position no matter which tab is open.
const PANEL_HEADER_TEXT = 'text-[11px] font-medium text-text-muted'
const PANEL_HEADER_ROW = 'px-3 pt-2.5 pb-1'
const IcoMinus = (): JSX.Element => <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2.5 6h7" /></svg>
const IcoPlus = (): JSX.Element => <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 2.5v7M2.5 6h7" /></svg>
const IcoSliders = (): JSX.Element => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M5 3v3M5 10v3M11 3v6M11 11v2" /><circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="9.5" r="1.5" /></svg>
const IcoRotate = (): JSX.Element => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a5 5 0 0 1 8.5-3.5L13 6M13 3v3h-3" /></svg>
const IcoWeight = (): JSX.Element => <svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 5h10M3 8.5h10M3 12h7" /></svg>
const IcoOffset = (): JSX.Element => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="10" height="10" rx="2" /><rect x="6" y="6" width="4" height="4" rx="1" /></svg>

/** One colour row: swatch + editable hex + opacity %, matching the reference fill UI.
 * Keeps a local hex draft so typing partial values doesn't fight the live object. */
function ColorRow({ color, opacity = 1, onColor, onOpacity, varField }: {
  color: string
  opacity?: number
  onColor: (v: string) => void
  onOpacity?: (v: number) => void
  varField?: BindField
}): JSX.Element {
  const { pushHistory } = useContext(EditContext)
  const [draft, setDraft] = useState(hexLabel(color))
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setDraft(hexLabel(color)) }, [color, editing])
  const commit = (raw: string): void => {
    const h = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    if (h.length === 3) onColor('#' + h.split('').map((x) => x + x).join(''))
    else if (h.length === 6) onColor('#' + h)
  }
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-elevated/70 px-2 py-1.5">
      <ColorWell value={color} onChange={onColor} opacity={opacity} onOpacity={onOpacity} varField={varField} />
      <input
        value={draft}
        spellCheck={false}
        onFocus={() => { setEditing(true); pushHistory() }}
        onBlur={() => { setEditing(false); setDraft(hexLabel(color)) }}
        onChange={(e) => { setDraft(e.target.value.toUpperCase()); commit(e.target.value) }}
        className="min-w-0 flex-1 bg-transparent text-[12px] uppercase tracking-wide text-text-primary focus:outline-none"
      />
      {onOpacity ? (
        <NumberField value={Math.round(opacity * 100)} onChange={(v) => onOpacity(v / 100)} min={0} max={100} suffix="%" grow={false} fieldClassName="" inputWidth="w-7 text-right" />
      ) : (
        <span className="shrink-0 text-[12px] tabular-nums text-text-muted">{Math.round(opacity * 100)} %</span>
      )}
    </div>
  )
}

/** A small icon button used in the paint sections (eye, minus, plus, sliders…). */
function IconBtn({ onClick, title, children, active }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }): JSX.Element {
  return (
    <button type="button" onClick={onClick} title={title}
      className={['grid h-6 w-6 shrink-0 place-items-center rounded transition-colors', active ? 'text-text-primary' : 'text-text-muted hover:bg-elevated hover:text-text-primary'].join(' ')}>
      {children}
    </button>
  )
}

const IcoScrub = ({ className }: { className?: string }): JSX.Element => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-3.5 4" />
  </svg>
)

/** A numeric field with a Figma-style drag scrubber: hovering reveals a left/right
 * arrows handle; press-dragging it left/right decreases/increases the value,
 * clamped to [min, max]. Click the value to type. One undo entry per scrub/edit.
 * This is the standard control for every numeric input in the inspector. */
function NumberField({ value, onChange, min, max, step = 1, dragStep, precision = 0, icon, suffix, title, dim, fieldClassName = 'rounded-md bg-elevated/70 px-1.5 py-1.5', inputWidth, grow = true, kf }: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  dragStep?: number
  precision?: number
  icon?: React.ReactNode
  suffix?: React.ReactNode
  title?: string
  dim?: boolean
  fieldClassName?: string
  inputWidth?: string
  grow?: boolean
  kf?: { keyed: boolean; toggle: () => void }
}): JSX.Element {
  const { pushHistory } = useContext(EditContext)
  const [hover, setHover] = useState(false)
  const [scrubbing, setScrubbing] = useState(false)
  const clampV = (v: number): number => {
    let n = v
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    return precision > 0 ? +n.toFixed(precision) : Math.round(n)
  }
  const startScrub = (e: React.PointerEvent): void => {
    e.preventDefault(); e.stopPropagation()
    pushHistory()
    setScrubbing(true)
    const ds = dragStep ?? step
    let raw = value
    const move = (ev: PointerEvent): void => {
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1
      raw = clampV(raw + ev.movementX * ds * mult)
      onChange(raw)
    }
    const up = (): void => {
      setScrubbing(false); document.body.style.cursor = ''
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
    }
    document.body.style.cursor = 'ew-resize'
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const showArrows = hover || scrubbing
  return (
    <label
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={['flex min-w-0 items-center gap-1 text-text-muted', grow ? 'flex-1' : '', fieldClassName, dim ? 'opacity-50' : ''].join(' ')}
      title={title}
    >
      <span onPointerDown={startScrub} className="grid shrink-0 cursor-ew-resize select-none place-items-center text-text-muted hover:text-text-primary" style={{ minWidth: 12 }} title="Drag to adjust">
        {showArrows ? <IcoScrub /> : icon ?? <IcoScrub className="opacity-0" />}
      </span>
      <input
        type="number"
        value={precision > 0 ? value : Math.round(value)}
        min={min} max={max} step={step}
        onFocus={pushHistory}
        onChange={(e) => { const v = parseFloat(e.target.value); onChange(Number.isNaN(v) ? (min ?? 0) : clampV(v)) }}
        className={[inputWidth ?? 'w-full', 'min-w-0 bg-transparent text-[12px] text-text-primary [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'].join(' ')}
      />
      {suffix && <span className="shrink-0 text-[11px] text-text-muted">{suffix}</span>}
      {kf && (
        <button type="button" title={`${kf.keyed ? 'Remove' : 'Add'} keyframe at playhead`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); kf.toggle() }}
          className="grid h-3.5 w-3.5 shrink-0 place-items-center">
          <span className="block h-2 w-2 rotate-45 rounded-[1px]" style={{ background: kf.keyed ? 'rgb(var(--accent,34 197 94))' : 'transparent', border: `1px solid ${kf.keyed ? 'rgb(var(--accent,34 197 94))' : '#6b7280'}` }} />
        </button>
      )}
    </label>
  )
}

const FILL_TABS: { id: 'solid' | 'gradient' | 'image'; label: string }[] = [
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'image', label: 'Image' },
]

/** Text fill reuses the fill gradient/colour fields but stores its solid colour in
 * `color` and never offers an image. */
const TEXTFILL_PAINT: PaintCfg = { ...FILL_PAINT, color: 'color', allowImage: false }

/** Generic paint editor body: Solid / Gradient / Image controls driven by a {@link
 * PaintCfg}, shared by Fill, Outline/Stroke and Border. The gradient bar supports
 * click-to-add, drag-to-move and drag-off / Delete / row-minus to remove stops. */
function PaintBody({ sel, cfg, patch, patchObj, pushHistory, gradOptsOpen, onToggleGradOpts, onEye, onRemove }: {
  sel: FObj
  cfg: PaintCfg
  patch: (id: string, p: Partial<FObj>) => void
  patchObj: (id: string, fn: (o: FObj) => Partial<FObj>) => void
  pushHistory: () => void
  gradOptsOpen: boolean
  onToggleGradOpts: (anchor: DOMRect | null, cfg: PaintCfg) => void
  onEye?: () => void
  onRemove?: () => void
}): JSX.Element {
  const mode: 'solid' | 'gradient' | 'image' = (() => {
    const m = (sel[cfg.mode] as 'solid' | 'gradient' | 'image' | undefined) ?? 'solid'
    return m === 'image' && !cfg.allowImage ? 'solid' : m
  })()
  const visible = !(sel[cfg.hidden] as boolean | undefined)
  const solidColor = (sel[cfg.color] as string | undefined) ?? cfg.defaultColor
  const opacity = (sel[cfg.opacity] as number | undefined) ?? 1

  const barRef = useRef<HTMLDivElement>(null)
  const [selStop, setSelStop] = useState<string | null>(null)
  const [dragOffId, setDragOffId] = useState<string | null>(null)
  const optsBtnRef = useRef<HTMLButtonElement>(null)

  const wp = (p: Record<string, unknown>): Partial<FObj> => p as Partial<FObj>
  const stopCount = (): number => (sel[cfg.stops] as GradientStop[] | undefined)?.length ?? 2

  const setMode = (m: 'solid' | 'gradient' | 'image'): void => {
    pushHistory()
    if (m === 'gradient') {
      const existing = sel[cfg.stops] as GradientStop[] | undefined
      const base = existing && existing.length >= 2
        ? existing
        : [{ color: solidColor, pos: 0, opacity: 1 }, { color: '#A4A4A4', pos: 1, opacity: 1 }]
      const init = base.map((s) => ({ ...s, id: s.id ?? newStopId() }))
      patch(sel.id, wp({ [cfg.mode]: 'gradient', [cfg.stops]: init, [cfg.gtype]: (sel[cfg.gtype] as string | undefined) ?? 'linear' }))
      setSelStop(init[0].id ?? null)
    } else {
      patch(sel.id, wp({ [cfg.mode]: m }))
    }
  }

  useEffect(() => {
    if (mode === 'gradient') {
      const st = sel[cfg.stops] as GradientStop[] | undefined
      if (st && st.some((s) => !s.id)) patch(sel.id, wp({ [cfg.stops]: st.map((s) => ({ ...s, id: s.id ?? newStopId() })) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sel.id, sel[cfg.stops]])

  const fromObjStops = (o: FObj): GradientStop[] => paintStopsOf(o, cfg).map((s, i) => ({ ...s, id: s.id ?? `i${i}` }))
  const stops = fromObjStops(sel)
  const commitStops = (next: GradientStop[]): Partial<FObj> => {
    const sorted = [...next].sort((a, b) => a.pos - b.pos)
    return wp({ [cfg.stops]: sorted, [cfg.color]: sorted[0].color })
  }
  const updateStop = (id: string, partial: Partial<GradientStop>): void =>
    patchObj(sel.id, (o) => commitStops(fromObjStops(o).map((s) => (s.id === id ? { ...s, ...partial } : s))))
  const setStopColor = (id: string, v: string): void => updateStop(id, { color: v })
  const setStopOpacity = (id: string, v: number): void => updateStop(id, { opacity: v })
  const removeStop = (id: string): void => {
    pushHistory()
    patchObj(sel.id, (o) => { const st = fromObjStops(o); if (st.length <= 2) return {}; return commitStops(st.filter((s) => s.id !== id)) })
  }
  const reverseStops = (): void => { pushHistory(); patchObj(sel.id, (o) => { const st = fromObjStops(o); return commitStops(st.map((s, i) => ({ ...s, color: st[st.length - 1 - i].color, opacity: st[st.length - 1 - i].opacity }))) }) }
  const colorAt = (st: GradientStop[], pos: number): string => {
    const sorted = [...st].sort((a, b) => a.pos - b.pos)
    if (pos <= sorted[0].pos) return sorted[0].color
    if (pos >= sorted[sorted.length - 1].pos) return sorted[sorted.length - 1].color
    for (let i = 0; i < sorted.length - 1; i++) {
      if (pos >= sorted[i].pos && pos <= sorted[i + 1].pos) {
        const t = (pos - sorted[i].pos) / Math.max(0.0001, sorted[i + 1].pos - sorted[i].pos)
        return lerpHex(sorted[i].color, sorted[i + 1].color, t)
      }
    }
    return sorted[0].color
  }

  const posFromX = (clientX: number): number => {
    const r = barRef.current?.getBoundingClientRect(); if (!r) return 0
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width))
  }
  const startStopDrag = (e: React.PointerEvent, id: string, skipHistory = false): void => {
    e.preventDefault(); e.stopPropagation()
    setSelStop(id); barRef.current?.focus()
    if (!skipHistory) pushHistory()
    const rect = barRef.current?.getBoundingClientRect()
    let off = false
    const move = (ev: PointerEvent): void => {
      const dy = rect ? Math.abs(ev.clientY - (rect.top + rect.height / 2)) : 0
      const canRemove = stopCount() > 2
      off = dy > 30 && canRemove
      setDragOffId(off ? id : null)
      if (!off) updateStop(id, { pos: posFromX(ev.clientX) })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      setDragOffId(null)
      if (off) patchObj(sel.id, (o) => { const st = fromObjStops(o); if (st.length <= 2) return {}; return commitStops(st.filter((s) => s.id !== id)) })
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const addStopAt = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    pushHistory()
    const pos = posFromX(e.clientX)
    const id = newStopId()
    patchObj(sel.id, (o) => { const st = fromObjStops(o); return commitStops([...st, { id, color: colorAt(st, pos), pos, opacity: 1 }]) })
    setSelStop(id); barRef.current?.focus()
    startStopDrag(e, id, true)
  }
  const startMidDrag = (e: React.PointerEvent, id: string): void => {
    e.preventDefault(); e.stopPropagation()
    pushHistory(); barRef.current?.focus()
    const move = (ev: PointerEvent): void => {
      patchObj(sel.id, (o) => {
        const st = fromObjStops(o)
        const sorted = [...st].sort((a, b) => a.pos - b.pos)
        const idx = sorted.findIndex((x) => x.id === id)
        if (idx < 0 || idx >= sorted.length - 1) return {}
        const a = sorted[idx].pos, b = sorted[idx + 1].pos
        const p = posFromX(ev.clientX)
        const mid = Math.max(0.05, Math.min(0.95, b === a ? 0.5 : (p - a) / (b - a)))
        return commitStops(st.map((x) => (x.id === id ? { ...x, mid } : x)))
      })
    }
    const up = (): void => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const onBarKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selStop) {
      e.preventDefault(); e.stopPropagation()
      removeStop(selStop)
    }
  }

  const ramp = `linear-gradient(90deg, ${[...stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${Math.round(s.pos * 100)}%`).join(', ')})`
  const gradTypes: { id: 'linear' | 'radial' | 'conic'; preview: string; title: string }[] = [
    { id: 'linear', preview: 'linear-gradient(90deg,#e7e7e7,#7a7a7a)', title: 'Linear' },
    { id: 'radial', preview: 'radial-gradient(circle at 50% 50%,#e7e7e7,#5f5f5f)', title: 'Radial' },
    { id: 'conic', preview: 'conic-gradient(from 0deg,#e7e7e7,#5f5f5f,#e7e7e7)', title: 'Angular' },
  ]
  const tabs = FILL_TABS.filter((t) => !(t.id === 'image' && !cfg.allowImage))
  const sortedRows = [...stops].sort((a, b) => a.pos - b.pos)
  const curType = (sel[cfg.gtype] as string | undefined) ?? 'linear'
  const imgVal = sel[cfg.image] as string | undefined

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2.5">
        <div className={['flex flex-1 items-center gap-0.5 rounded-lg bg-bg/40 p-1', visible ? '' : 'opacity-50'].join(' ')}>
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setMode(t.id)}
              className={['flex-1 rounded-md px-2 py-1 text-[12px] transition-colors', mode === t.id ? 'bg-border-strong text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'].join(' ')}>
              {t.label}
            </button>
          ))}
        </div>
        {(onEye || onRemove) && (
          <div className="flex shrink-0 items-center gap-1.5">
            {onEye && <IconBtn onClick={onEye} title={visible ? 'Hide' : 'Show'}><Eye on={visible} /></IconBtn>}
            {onRemove && <IconBtn onClick={onRemove} title="Remove"><IcoMinus /></IconBtn>}
          </div>
        )}
      </div>

      {mode === 'solid' && (
        <ColorRow color={solidColor} opacity={opacity} varField={cfg.color as BindField}
          onColor={(v) => patch(sel.id, wp({ [cfg.color]: v }))}
          onOpacity={(v) => patch(sel.id, wp({ [cfg.opacity]: v }))} />
      )}

      {mode === 'gradient' && (
        <div className="space-y-2">
          <div
            ref={barRef}
            tabIndex={0}
            onPointerDown={addStopAt}
            onKeyDown={onBarKeyDown}
            className="relative h-7 rounded-md outline-none"
            style={{ background: ramp }}
          >
            {sortedRows.slice(0, -1).map((s, i) => {
              const next = sortedRows[i + 1]
              const mid = Math.max(0.05, Math.min(0.95, s.mid ?? 0.5))
              const p = s.pos + mid * (next.pos - s.pos)
              return (
                <button
                  key={'mid' + s.id}
                  type="button"
                  onPointerDown={(e) => startMidDrag(e, s.id!)}
                  title="Drag to bias the gradient midpoint"
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize rounded-[2px] bg-white shadow"
                  style={{ left: `${Math.round(p * 100)}%` }}
                />
              )
            })}
            {sortedRows.map((s) => (
              <button
                key={s.id}
                type="button"
                onPointerDown={(e) => startStopDrag(e, s.id!)}
                title="Drag to move · drag up/down or Delete to remove"
                className={['t42-handle absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-[4px] active:cursor-grabbing', selStop === s.id ? 'ring-1 ring-accent' : '', dragOffId === s.id ? 'opacity-30' : ''].join(' ')}
                style={{ left: `${Math.round(s.pos * 100)}%`, background: s.color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1">
            {gradTypes.map((g) => (
              <button key={g.id} type="button" onClick={() => { pushHistory(); patch(sel.id, wp({ [cfg.gtype]: g.id })) }} title={g.title}
                className={['grid h-7 w-9 place-items-center rounded transition-colors', curType === g.id ? 'bg-border-strong' : 'bg-elevated/60 hover:bg-elevated'].join(' ')}>
                <span className="block h-3.5 w-5 rounded-[2px]" style={{ background: g.preview }} />
              </button>
            ))}
            <div className="flex-1" />
            <button ref={optsBtnRef} type="button" onClick={() => onToggleGradOpts(gradOptsOpen ? null : (optsBtnRef.current?.getBoundingClientRect() ?? null), cfg)} title="Gradient options"
              className={['grid h-6 w-6 place-items-center rounded transition-colors', gradOptsOpen ? 'text-text-primary' : 'text-text-muted hover:bg-elevated hover:text-text-primary'].join(' ')}><IcoSliders /></button>
            <IconBtn onClick={reverseStops} title="Reverse stops"><IcoRotate /></IconBtn>
            <IconBtn onClick={() => { pushHistory(); const pos = 0.5; const id = newStopId(); patchObj(sel.id, (o) => { const st = fromObjStops(o); return commitStops([...st, { id, color: colorAt(st, pos), pos, opacity: 1 }]) }); setSelStop(id) }} title="Add stop"><IcoPlus /></IconBtn>
          </div>
          <div className="space-y-1">
            {sortedRows.map((s) => (
              <div key={s.id} onPointerDownCapture={() => setSelStop(s.id!)} className={['flex items-center gap-1.5 rounded-md', selStop === s.id ? 'bg-elevated/40' : ''].join(' ')}>
                <ColorRow color={s.color} opacity={s.opacity ?? 1} onColor={(v) => setStopColor(s.id!, v)} onOpacity={(v) => setStopOpacity(s.id!, v)} />
                <IconBtn onClick={() => removeStop(s.id!)} title="Remove stop"><IcoMinus /></IconBtn>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'image' && cfg.allowImage && (
        imgVal ? (
          <div className="flex items-center gap-3 rounded-md bg-elevated/60 p-2">
            <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded">
              <img src={imgVal} alt="" className="h-full w-full object-cover" />
              <label className="absolute inset-0 grid cursor-pointer place-items-center bg-black/40 text-[11px] text-white opacity-0 transition-opacity hover:opacity-100">
                Edit
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]; e.currentTarget.value = ''
                  if (!f) return
                  const r = new FileReader(); r.onload = () => { pushHistory(); patch(sel.id, wp({ [cfg.image]: String(r.result) })) }; r.readAsDataURL(f)
                }} />
              </label>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] text-text-primary">Image</div>
              <button type="button" onClick={() => { pushHistory(); patch(sel.id, wp({ [cfg.image]: undefined })) }} className="text-[11px] text-text-muted hover:text-text-primary">Remove</button>
            </div>
          </div>
        ) : (
          <label className="block cursor-pointer rounded-md bg-elevated/60 px-3 py-3 text-center text-[12px] text-text-secondary hover:text-text-primary">
            Choose image
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]; e.currentTarget.value = ''
              if (!f) return
              const r = new FileReader(); r.onload = () => { pushHistory(); patch(sel.id, wp({ [cfg.image]: String(r.result) })) }; r.readAsDataURL(f)
            }} />
          </label>
        )
      )}
    </div>
  )
}

/** Fill editor: solid / gradient / image. Applies to every fillable layer and to
 * text (text stores its colour in `color` and excludes Image). */
function FillEditor({ sel, patch, patchObj, pushHistory, gradOptsOpen, onToggleGradOpts }: {
  sel: FObj
  patch: (id: string, p: Partial<FObj>) => void
  patchObj: (id: string, fn: (o: FObj) => Partial<FObj>) => void
  pushHistory: () => void
  gradOptsOpen: boolean
  onToggleGradOpts: (anchor: DOMRect | null, cfg: PaintCfg) => void
}): JSX.Element {
  const textFill = sel.type === 'text'
  const cfg = textFill ? TEXTFILL_PAINT : FILL_PAINT
  return (
    <PaintBody sel={sel} cfg={cfg} patch={patch} patchObj={patchObj} pushHistory={pushHistory} gradOptsOpen={gradOptsOpen} onToggleGradOpts={onToggleGradOpts}
      onEye={() => { pushHistory(); patch(sel.id, { fillHidden: !sel.fillHidden }) }}
      onRemove={() => {
        pushHistory()
        if (textFill) patch(sel.id, { fillHidden: true })
        else patch(sel.id, { fillEnabled: false, fillHidden: false, fillMode: 'solid', gradientStops: undefined, fillImage: undefined })
      }} />
  )
}

/** Floating, draggable "Gradient options" window (Angle, Interpolation, Distribute). */
function GradientOptions({ sel, cfg, patch, patchObj, pushHistory, anchor, onClose }: {
  sel: FObj
  cfg: PaintCfg
  patch: (id: string, p: Partial<FObj>) => void
  patchObj: (id: string, fn: (o: FObj) => Partial<FObj>) => void
  pushHistory: () => void
  anchor: DOMRect
  onClose: () => void
}): JSX.Element {
  const [pos, setPos] = useState(() => {
    const w = 232
    let left = anchor.left - w - 12
    if (left < 8) left = Math.max(8, anchor.left - w)
    return { left: Math.max(8, left), top: Math.min(anchor.top, window.innerHeight - 220) }
  })
  const wp = (p: Record<string, unknown>): Partial<FObj> => p as Partial<FObj>
  const panelRef = useRef<HTMLDivElement>(null)
  useClampPanel(panelRef, setPos)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const onTitleDown = (e: React.PointerEvent): void => {
    e.preventDefault()
    dragRef.current = { x: e.clientX, y: e.clientY }
    const move = (ev: PointerEvent): void => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.x, dy = ev.clientY - dragRef.current.y
      dragRef.current = { x: ev.clientX, y: ev.clientY }
      setPos((p) => ({ left: Math.max(0, Math.min(window.innerWidth - 80, p.left + dx)), top: Math.max(0, Math.min(window.innerHeight - 40, p.top + dy)) }))
    }
    const up = (): void => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const distribute = (): void => { pushHistory(); patchObj(sel.id, (o) => { const st = paintStopsOf(o, cfg); const sorted = [...st].sort((a, b) => a.pos - b.pos).map((s, i) => ({ ...s, pos: sorted2(i, st.length) })); return wp({ [cfg.stops]: sorted, [cfg.color]: sorted[0].color }) }) }
  return (
    <div ref={panelRef} className="fixed z-[60] w-[232px] select-none rounded-xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.5)]" style={{ left: pos.left, top: pos.top }}>
      <div onPointerDown={onTitleDown} className="flex cursor-grab items-center justify-between rounded-t-xl px-3 py-2 active:cursor-grabbing">
        <span className="text-[12px] text-text-primary">Gradient options</span>
        <button type="button" onClick={onClose} title="Close" className="grid h-5 w-5 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary">
          <svg width="12" height="12" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
      <div className="space-y-2.5 px-3 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Angle</span>
          <NumberField value={Math.round((sel[cfg.gangle] as number | undefined) ?? 90)} onChange={(v) => patch(sel.id, wp({ [cfg.gangle]: v }))} min={0} max={360} suffix="°" grow={false} fieldClassName="rounded-md bg-elevated/70 px-2 py-1" inputWidth="w-12 text-right" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-text-muted">Interpolation</span>
          <select value={(sel[cfg.ginterp] as string | undefined) ?? 'linear'} onChange={(e) => { pushHistory(); patch(sel.id, wp({ [cfg.ginterp]: e.target.value })) }}
            className="rounded-md bg-elevated/70 px-2 py-1 text-[12px] text-text-primary focus:outline-none">
            <option value="linear">Linear</option>
            <option value="average">Average color</option>
          </select>
        </div>
        <button type="button" onClick={distribute} className="w-full rounded-md bg-elevated/70 px-2 py-1.5 text-[12px] text-text-secondary hover:text-text-primary">Distribute colors</button>
      </div>
    </div>
  )
}
function sorted2(i: number, n: number): number { return n <= 1 ? 0 : i / (n - 1) }

/** Outline editor: thickness + position offset + Solid/Gradient/Image paint. */
function OutlineEditor({ sel, patch, patchObj, pushHistory, gradOptsOpen, onToggleGradOpts }: {
  sel: FObj
  patch: (id: string, p: Partial<FObj>) => void
  patchObj: (id: string, fn: (o: FObj) => Partial<FObj>) => void
  pushHistory: () => void
  gradOptsOpen: boolean
  onToggleGradOpts: (anchor: DOMRect | null, cfg: PaintCfg) => void
}): JSX.Element {
  const visible = !sel.strokeHidden
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <NumIcon icon={<IcoWeight />} title="Thickness" value={sel.strokeWidth} min={0} dim={!visible} on={(v) => patch(sel.id, { strokeWidth: v })} />
        <NumIcon icon={<IcoOffset />} title="Position: 0 on the edge, negative inside, positive outside" value={sel.strokeOffset ?? 0} dim={!visible} on={(v) => patch(sel.id, { strokeOffset: v })} />
      </div>
      <PaintBody sel={sel} cfg={STROKE_PAINT} patch={patch} patchObj={patchObj} pushHistory={pushHistory} gradOptsOpen={gradOptsOpen} onToggleGradOpts={onToggleGradOpts}
        onEye={() => { pushHistory(); patch(sel.id, { strokeHidden: !sel.strokeHidden }) }}
        onRemove={() => { pushHistory(); patch(sel.id, { strokeEnabled: false, strokeHidden: false }) }} />
    </div>
  )
}

const IcoBlur = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    {[3, 6, 9, 12].map((y) => [3, 6, 9, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" />))}
  </svg>
)
const IcoBox = (): JSX.Element => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="10" height="10" rx="1.5" /></svg>
const IcoChevron = (): JSX.Element => <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5l3 3 3-3" /></svg>

interface MenuItem { label: string; active?: boolean; onClick: () => void; hint?: string; disabled?: boolean; sep?: boolean }

/** Positions a dropdown as a fixed, viewport-anchored panel beside its trigger
 * (the menu element's parent). It opens downward by default but flips upward when
 * there isn't room below, and caps its height (scrolling) so it can never be
 * clipped or hidden off-screen. Returns the style to spread on the menu element. */
function useAnchoredMenuStyle(open: boolean, menuRef: React.RefObject<HTMLDivElement>, width: number, align: 'left' | 'right', revision: number): React.CSSProperties {
  const [style, setStyle] = useState<React.CSSProperties>({ position: 'fixed', left: -9999, top: -9999, width })
  useLayoutEffect(() => {
    if (!open) return
    const el = menuRef.current
    const anchor = el?.parentElement
    if (!el || !anchor) return
    const tr = anchor.getBoundingClientRect()
    const menuH = el.offsetHeight
    const vw = window.innerWidth, vh = window.innerHeight, gap = 4, pad = 8
    const spaceBelow = vh - tr.bottom - gap - pad
    const spaceAbove = tr.top - gap - pad
    const up = menuH > spaceBelow && spaceAbove > spaceBelow
    const top = up ? Math.max(pad, tr.top - gap - menuH) : tr.bottom + gap
    const maxHeight = Math.max(80, up ? spaceAbove : spaceBelow)
    let left = align === 'right' ? tr.right - width : tr.left
    left = Math.max(pad, Math.min(left, vw - width - pad))
    setStyle({ position: 'fixed', left, top, width, maxHeight })
  }, [open, width, align, revision, menuRef])
  return style
}

function Menu({ open, onClose, items, align = 'right', width = 176 }: { open: boolean; onClose: () => void; items: MenuItem[]; align?: 'left' | 'right'; width?: number }): JSX.Element | null {
  const menuRef = useRef<HTMLDivElement>(null)
  const style = useAnchoredMenuStyle(open, menuRef, width, align, items.length)
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-[70]" onPointerDown={onClose} />
      <div ref={menuRef} className="z-[71] overflow-y-auto rounded-lg bg-raised p-1 shadow-overlay" style={style}>
        {items.map((it) => (
          <Fragment key={it.label}>
            {it.sep && <div className="my-1 h-px bg-bg/60" />}
            <button
              type="button"
              disabled={it.disabled}
              onPointerDown={(e) => { e.preventDefault(); if (it.disabled) return; it.onClick(); onClose() }}
              className={['flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px]', it.disabled ? 'cursor-default text-text-muted opacity-50' : 'text-text-primary hover:bg-bg/60'].join(' ')}
            >
              <span className="w-3 text-text-primary">{it.active ? '✓' : ''}</span>
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.hint && <span className="shrink-0 text-[11px] text-text-muted">{it.hint}</span>}
            </button>
          </Fragment>
        ))}
      </div>
    </>
  )
}

/** A header sliders icon that opens a small options menu (line style, shadow type). */
function HeaderMenu({ items, icon, title = 'Options', width }: { items: MenuItem[]; icon?: React.ReactNode; title?: string; width?: number }): JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} title={title} className={['grid h-6 w-6 place-items-center rounded hover:bg-elevated hover:text-text-primary', open ? 'text-text-primary' : 'text-text-muted'].join(' ')}>{icon ?? <IcoSliders />}</button>
      <Menu open={open} onClose={() => setOpen(false)} items={items} width={width} />
    </div>
  )
}

function NumIcon({ icon, value, on, title, dim, min, max, step, precision, dragStep, suffix }: { icon: React.ReactNode; value: number; on: (v: number) => void; title: string; dim?: boolean; min?: number; max?: number; step?: number; precision?: number; dragStep?: number; suffix?: React.ReactNode }): JSX.Element {
  return <NumberField icon={icon} value={value} onChange={on} title={title} dim={dim} min={min} max={max} step={step} precision={precision} dragStep={dragStep} suffix={suffix} />
}

// ── Unified effects (floating panel) ───────────────────────────────────────────
const EFFECT_ICON: Record<EffectType, JSX.Element> = {
  'inner-shadow': <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="10" height="10" rx="2" /><rect x="5.5" y="5.5" width="5" height="5" rx="1" opacity="0.5" /></svg>,
  'drop-shadow': <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="9" height="9" rx="2" /></svg>,
  'layer-blur': <IcoBlur />,
  'background-blur': <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>{[2.5, 5.5, 8.5, 11.5].map((y) => [2.5, 5.5, 8.5, 11.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.95" />))}</svg>,
  noise: <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>{[3, 5, 7, 9, 11, 13].map((y, i) => [3, 6, 9, 12].map((x, j) => <circle key={`${i}-${j}`} cx={x + (i % 2)} cy={y} r="0.8" />))}</svg>,
  texture: <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>{[4, 8, 12].map((y) => [4, 8, 12].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" />))}</svg>,
  glass: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="5.5" /><path d="M5 6.5a4 4 0 0 1 3-2" opacity="0.6" /></svg>,
  shader: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 6c1.5-1.5 3-1.5 4 0s2.5 1.5 4 0 2.5-1.5 3 0M2 10c1.5-1.5 3-1.5 4 0s2.5 1.5 4 0 2.5-1.5 3 0" /></svg>,
}
const IcoGrid = (): JSX.Element => <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="5" r="1.6" /><circle cx="11" cy="5" r="1.6" /><circle cx="5" cy="11" r="1.6" /><circle cx="11" cy="11" r="1.6" /></svg>
const IcoDroplet = (): JSX.Element => <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"><path d="M8 2.5s4 4.2 4 7a4 4 0 0 1-8 0c0-2.8 4-7 4-7z" /></svg>
const IcoOpacity = (): JSX.Element => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    {[3, 6, 9, 12].map((y, i) => [3, 6, 9, 12].map((x, j) => ((i + j) % 2 === 0 ? <rect key={`${x}-${y}`} x={x - 1.5} y={y - 1.5} width="3" height="3" /> : null)))}
  </svg>
)

const BLEND_MODES: { label: string; value: string }[] = [
  { label: 'Normal', value: 'normal' }, { label: 'Darken', value: 'darken' }, { label: 'Multiply', value: 'multiply' }, { label: 'Color burn', value: 'color-burn' },
  { label: 'Lighten', value: 'lighten' }, { label: 'Screen', value: 'screen' }, { label: 'Color dodge', value: 'color-dodge' },
  { label: 'Overlay', value: 'overlay' }, { label: 'Soft light', value: 'soft-light' }, { label: 'Hard light', value: 'hard-light' },
  { label: 'Difference', value: 'difference' }, { label: 'Exclusion', value: 'exclusion' },
  { label: 'Hue', value: 'hue' }, { label: 'Saturation', value: 'saturation' }, { label: 'Color', value: 'color' }, { label: 'Luminosity', value: 'luminosity' },
]

/** A label + range slider + value row (used by the Glass popover). */
function RangeRow({ label, value, min, max, step = 1, onChange, mul = 1, suffix = '', labelW = 'w-[74px]' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; mul?: number; suffix?: string; labelW?: string }): JSX.Element {
  const { pushHistory } = useContext(EditContext)
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <div className="flex items-center gap-2">
      <span className={['shrink-0 truncate text-[12px] text-text-muted', labelW].join(' ')} title={label}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={pushHistory} onChange={(e) => onChange(parseFloat(e.target.value))} className="t42-range min-w-0 flex-1" style={{ background: `linear-gradient(to right, rgb(var(--accent)) ${pct}%, rgb(var(--border-strong)) ${pct}%)` }} />
      <span className="w-12 shrink-0 rounded bg-elevated/70 py-1 text-center text-[12px] tabular-nums text-text-primary">{Math.round(value * mul)}{suffix}</span>
    </div>
  )
}

/** The "+" / grid button (or a wide "Add effect" row) that opens the type menu. */
function EffectAddMenu({ onAdd, variant, types, label = 'Add effect' }: { onAdd: (type: EffectType, anchor: DOMRect) => void; variant: 'plus' | 'grid' | 'wide'; types?: EffectType[]; label?: string }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const order = types ?? EFFECT_ORDER
  const menuStyle = useAnchoredMenuStyle(open, menuRef, 208, variant === 'wide' ? 'left' : 'right', order.length)
  const pick = (t: EffectType): void => { const r = ref.current?.getBoundingClientRect(); setOpen(false); if (r) onAdd(t, r) }
  return (
    <div className={variant === 'wide' ? 'relative' : 'relative inline-block'}>
      {variant === 'wide' ? (
        <button ref={ref} type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-elevated/60 px-2 py-2 text-[12px] text-text-secondary hover:text-text-primary"><IcoPlus /> {label}</button>
      ) : (
        <button ref={ref} type="button" onClick={() => setOpen((o) => !o)} title={label} className={['grid h-6 w-6 place-items-center rounded hover:bg-elevated hover:text-text-primary', open ? 'text-text-primary' : 'text-text-muted'].join(' ')}>
          {variant === 'grid' ? <IcoGrid /> : <IcoPlus />}
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onPointerDown={() => setOpen(false)} />
          <div ref={menuRef} className="z-[71] overflow-y-auto rounded-lg bg-raised p-1 shadow-overlay" style={menuStyle}>
            {order.map((t) => (
              <div key={t}>
                {t === 'shader' && <div className="my-1" />}
                <button type="button" onPointerDown={(e) => { e.preventDefault(); pick(t) }} className="flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-[12px] text-text-primary hover:bg-bg/60">
                  <span className="grid w-4 place-items-center text-text-secondary">{EFFECT_ICON[t]}</span>{EFFECT_LABEL[t]}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Effects section body: a row per effect; click a row to open its popover. */
function EffectsEditor({ sel, patch, pushHistory, onOpenEffect, activeId, only }: { sel: FObj; patch: (id: string, p: Partial<FObj>) => void; pushHistory: () => void; onOpenEffect: (id: string, anchor: DOMRect) => void; activeId: string | null; only?: EffectType[] }): JSX.Element | null {
  const list = sel.effects ?? []
  const shownList = only ? list.filter((e) => only.includes(e.type)) : list
  if (!shownList.length) return null
  return (
    <div className="space-y-1">
      {shownList.map((e) => {
        const visible = !e.hidden
        return (
          <div key={e.id} className={['flex items-center gap-1.5 rounded-md', activeId === e.id ? 'bg-elevated/40' : ''].join(' ')}>
            <button type="button" onClick={(ev) => onOpenEffect(e.id!, ev.currentTarget.getBoundingClientRect())} className={['flex min-w-0 flex-1 items-center gap-2 rounded-md bg-elevated/70 px-2 py-1.5 text-left', visible ? '' : 'opacity-50'].join(' ')}>
              <span className="shrink-0 text-text-secondary">{EFFECT_ICON[e.type]}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-text-primary">{EFFECT_LABEL[e.type]}</span>
            </button>
            <IconBtn onClick={() => { pushHistory(); patch(sel.id, { effects: list.map((x) => (x.id === e.id ? { ...x, hidden: !x.hidden } : x)) }) }} title={visible ? 'Hide' : 'Show'}><Eye on={visible} /></IconBtn>
            <IconBtn onClick={() => { pushHistory(); patch(sel.id, { effects: list.filter((x) => x.id !== e.id) }) }} title="Remove"><IcoMinus /></IconBtn>
          </div>
        )
      })}
    </div>
  )
}

/** Floating, draggable popover that edits a single effect. */
function EffectPopover({ effect, sel, patchObj, pushHistory, anchor, onClose, onBrowseShader }: { effect: Effect; sel: FObj; patchObj: (id: string, fn: (o: FObj) => Partial<FObj>) => void; pushHistory: () => void; anchor: DOMRect; onClose: () => void; onBrowseShader: (anchor: DOMRect) => void }): JSX.Element {
  const [pos, setPos] = useState(() => {
    const w = 264
    let left = anchor.left - w - 12
    if (left < 8) left = Math.max(8, Math.min(window.innerWidth - w - 8, anchor.left - w))
    return { left: Math.max(8, left), top: Math.max(8, Math.min(anchor.top - 8, window.innerHeight - 360)) }
  })
  const [typeMenu, setTypeMenu] = useState(false)
  const [blendMenu, setBlendMenu] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useClampPanel(panelRef, setPos)
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const onTitleDown = (e: React.PointerEvent): void => {
    e.preventDefault(); dragRef.current = { x: e.clientX, y: e.clientY }
    const move = (ev: PointerEvent): void => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.x, dy = ev.clientY - dragRef.current.y
      dragRef.current = { x: ev.clientX, y: ev.clientY }
      setPos((p) => ({ left: Math.max(0, Math.min(window.innerWidth - 80, p.left + dx)), top: Math.max(0, Math.min(window.innerHeight - 40, p.top + dy)) }))
    }
    const up = (): void => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const setE = (p: Partial<Effect>): void => patchObj(sel.id, (o) => ({ effects: (o.effects ?? []).map((x) => (x.id === effect.id ? { ...x, ...p } : x)) }))
  const changeType = (t: EffectType): void => { pushHistory(); patchObj(sel.id, (o) => ({ effects: (o.effects ?? []).map((x) => (x.id === effect.id ? { ...makeEffect(t), id: x.id } : x)) })) }
  const hasBlend = effect.type === 'inner-shadow' || effect.type === 'drop-shadow' || effect.type === 'noise'
  const lbl = (t: string): JSX.Element => <span className="w-2.5 text-center text-[10.5px]">{t}</span>

  return (
    <div ref={panelRef} className="fixed z-[60] w-[264px] select-none rounded-xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.5)]" style={{ left: pos.left, top: pos.top }}>
      <div onPointerDown={onTitleDown} className="flex cursor-grab items-center justify-between gap-2 rounded-t-xl px-2.5 py-2 active:cursor-grabbing">
        <div className="relative flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-text-secondary">{EFFECT_ICON[effect.type]}</span>
          <button type="button" onClick={() => setTypeMenu((o) => !o)} className="flex min-w-0 items-center gap-1 text-[12px] text-text-primary">
            <span className="truncate">{EFFECT_LABEL[effect.type]}</span><IcoChevron />
          </button>
          <Menu open={typeMenu} onClose={() => setTypeMenu(false)} align="left" items={EFFECT_ORDER.map((t) => ({ label: EFFECT_LABEL[t], active: t === effect.type, onClick: () => changeType(t) }))} />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 text-text-muted">
          {hasBlend && (
            <div className="relative">
              <button type="button" onClick={() => setBlendMenu((o) => !o)} title="Blend mode" className={['grid h-6 w-6 place-items-center rounded hover:bg-elevated hover:text-text-primary', blendMenu ? 'text-text-primary' : ''].join(' ')}><IcoDroplet /></button>
              <Menu open={blendMenu} onClose={() => setBlendMenu(false)} align="right" items={BLEND_MODES.map((b) => ({ label: b.label, active: (effect.blend ?? 'normal') === b.value, onClick: () => { pushHistory(); setE({ blend: b.value }) } }))} />
            </div>
          )}
          <button type="button" onClick={onClose} title="Close" className="grid h-6 w-6 place-items-center rounded hover:bg-elevated hover:text-text-primary"><svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg></button>
        </div>
      </div>
      <div className="max-h-[72vh] space-y-3 overflow-y-auto px-3 py-3">
        {(effect.type === 'inner-shadow' || effect.type === 'drop-shadow') && (
          <>
            <div className="grid grid-cols-[44px_1fr] items-center gap-2">
              <span className="text-[12px] text-text-muted">Position</span>
              <div className="grid grid-cols-2 gap-1.5">
                <NumIcon icon={lbl('X')} title="X" value={effect.x ?? 0} on={(v) => setE({ x: v })} />
                <NumIcon icon={lbl('Y')} title="Y" value={effect.y ?? 0} on={(v) => setE({ y: v })} />
              </div>
            </div>
            <div className="grid grid-cols-[44px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">Blur</span><NumIcon icon={<IcoBlur />} title="Blur" value={effect.blur ?? 0} min={0} on={(v) => setE({ blur: v })} /></div>
            <div className="grid grid-cols-[44px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">Spread</span><NumIcon icon={<IcoBox />} title="Spread" value={effect.spread ?? 0} on={(v) => setE({ spread: v })} /></div>
            <div className="grid grid-cols-[44px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">Color</span><ColorRow color={effect.color ?? '#000000'} opacity={effect.opacity ?? 1} onColor={(v) => setE({ color: v })} onOpacity={(v) => setE({ opacity: v })} /></div>
          </>
        )}

        {(effect.type === 'layer-blur' || effect.type === 'background-blur') && (
          <>
            <div className="flex items-center rounded-lg bg-bg/40 p-1">
              {(['uniform', 'progressive'] as const).map((m) => (
                <button key={m} type="button" onClick={() => { pushHistory(); setE({ progressive: m === 'progressive' }) }} className={['flex-1 rounded-md px-2 py-1 text-[12px] capitalize transition-colors', (effect.progressive ? 'progressive' : 'uniform') === m ? 'bg-border-strong text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'].join(' ')}>{m}</button>
              ))}
            </div>
            {!effect.progressive ? (
              <div className="grid grid-cols-[44px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">Blur</span><NumIcon icon={<IcoBlur />} title="Blur" value={effect.amount ?? 4} min={0} on={(v) => setE({ amount: v })} /></div>
            ) : (
              <>
                <div className="grid grid-cols-[44px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">Start</span><NumIcon icon={<IcoBlur />} title="Start" value={effect.start ?? 0} min={0} on={(v) => setE({ start: v })} /></div>
                <div className="grid grid-cols-[44px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">End</span><NumIcon icon={<IcoBlur />} title="End" value={effect.end ?? 4} min={0} on={(v) => setE({ end: v })} /></div>
              </>
            )}
          </>
        )}

        {effect.type === 'noise' && (
          <>
            <div className="flex items-center rounded-lg bg-bg/40 p-1">
              {(['mono', 'duo', 'multi'] as const).map((m) => (
                <button key={m} type="button" onClick={() => { pushHistory(); setE({ noiseMode: m }) }} className={['flex-1 rounded-md px-2 py-1 text-[12px] capitalize transition-colors', (effect.noiseMode ?? 'mono') === m ? 'bg-border-strong text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'].join(' ')}>{m}</button>
              ))}
            </div>
            <div className="grid grid-cols-[64px_1fr] items-center gap-2">
              <span className="text-[12px] text-text-muted">Noise size</span>
              <div className="grid grid-cols-2 gap-1.5">
                <NumIcon icon={lbl('X')} title="Size X" value={effect.sizeX ?? 2.5} min={0.1} step={0.1} precision={1} dragStep={0.1} on={(v) => setE({ sizeX: v })} />
                <NumIcon icon={lbl('Y')} title="Size Y" value={effect.sizeY ?? 1.9} min={0.1} step={0.1} precision={1} dragStep={0.1} on={(v) => setE({ sizeY: v })} />
              </div>
            </div>
            <div className="grid grid-cols-[64px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">Density</span><NumIcon icon={<IcoGrid />} title="Density" value={effect.density ?? 100} min={0} max={100} suffix="%" on={(v) => setE({ density: v })} /></div>
            {effect.noiseMode === 'multi' ? (
              <div className="grid grid-cols-[64px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">Opacity</span><NumIcon icon={<IcoBox />} title="Opacity" value={Math.round((effect.opacity ?? 0.25) * 100)} min={0} max={100} suffix="%" on={(v) => setE({ opacity: v / 100 })} /></div>
            ) : (
              <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                <span className="text-[12px] text-text-muted">{effect.noiseMode === 'duo' ? 'Colors' : 'Color'}</span>
                <div className="space-y-1">
                  <ColorRow color={effect.color ?? '#000000'} opacity={effect.opacity ?? 0.25} onColor={(v) => setE({ color: v })} onOpacity={(v) => setE({ opacity: v })} />
                  {effect.noiseMode === 'duo' && <ColorRow color={effect.color2 ?? '#ffffff'} opacity={effect.opacity2 ?? 0.25} onColor={(v) => setE({ color2: v })} onOpacity={(v) => setE({ opacity2: v })} />}
                </div>
              </div>
            )}
          </>
        )}

        {effect.type === 'texture' && (
          <>
            <div className="grid grid-cols-[64px_1fr] items-center gap-2">
              <span className="text-[12px] text-text-muted">Size</span>
              <div className="grid grid-cols-2 gap-1.5">
                <NumIcon icon={lbl('X')} title="Size X" value={effect.sizeX ?? 4} min={0.1} step={0.1} precision={1} dragStep={0.1} on={(v) => setE({ sizeX: v })} />
                <NumIcon icon={lbl('Y')} title="Size Y" value={effect.sizeY ?? 4} min={0.1} step={0.1} precision={1} dragStep={0.1} on={(v) => setE({ sizeY: v })} />
              </div>
            </div>
            <div className="grid grid-cols-[64px_1fr] items-center gap-2"><span className="text-[12px] text-text-muted">Radius</span><NumIcon icon={<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="2" /><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.8 3.8l1 1M11.2 11.2l1 1M12.2 3.8l-1 1M4.8 11.2l-1 1" /></svg>} title="Radius — edge roughness" value={effect.radius ?? 6} min={0} max={40} precision={1} dragStep={0.2} on={(v) => setE({ radius: v })} /></div>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-secondary">
              <input type="checkbox" checked={!!effect.clipShape} onChange={(e) => { pushHistory(); setE({ clipShape: e.target.checked }) }} className="accent-current" />
              Clip to shape
            </label>
          </>
        )}

        {effect.type === 'glass' && (
          <>
            <div className="grid grid-cols-[44px_1fr] items-center gap-2">
              <span className="text-[12px] text-text-muted">Light</span>
              <div className="grid grid-cols-2 gap-1.5">
                <NumIcon icon={<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2" /></svg>} title="Angle" value={effect.angle ?? -45} suffix="°" on={(v) => setE({ angle: v })} />
                <NumIcon icon={<IcoBox />} title="Intensity" value={effect.intensity ?? 80} min={0} max={100} suffix="%" on={(v) => setE({ intensity: v })} />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <RangeRow label="Refraction" value={effect.refraction ?? 80} min={0} max={100} onChange={(v) => setE({ refraction: v })} />
              <RangeRow label="Depth" value={effect.depth ?? 20} min={0} max={100} onChange={(v) => setE({ depth: v })} />
              <RangeRow label="Dispersion" value={effect.dispersion ?? 50} min={0} max={100} onChange={(v) => setE({ dispersion: v })} />
              <RangeRow label="Frost" value={effect.frost ?? 4} min={0} max={40} onChange={(v) => setE({ frost: v })} />
              <RangeRow label="Splay" value={effect.splay ?? 0} min={0} max={100} onChange={(v) => setE({ splay: v })} />
            </div>
          </>
        )}

        {effect.type === 'shader' && (() => {
          const def = shaderById(effect.shaderId)
          if (!def) {
            return <button type="button" onClick={(e) => onBrowseShader(e.currentTarget.getBoundingClientRect())} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-elevated/60 px-3 py-2.5 text-[12px] text-text-secondary hover:text-text-primary">Browse shaders…</button>
          }
          const params = { ...defaultShaderParams(def), ...(effect.shaderParams ?? {}) }
          const setParam = (k: string, v: number): void => setE({ shaderParams: { ...params, [k]: v } })
          const colors = effect.shaderColors ?? def.colors ?? []
          const setColors = (arr: string[]): void => setE({ shaderColors: arr })
          return (
            <>
              <button type="button" onClick={(e) => onBrowseShader(e.currentTarget.getBoundingClientRect())} className="flex w-full items-center justify-between gap-2 rounded-md bg-elevated/70 px-2.5 py-1.5 text-[12px] text-text-primary hover:bg-elevated">
                <span className="truncate">{def.label}</span><span className="text-[11px] text-text-muted">Change</span>
              </button>
              <div className="space-y-2">
                <div className="text-[11px] text-text-muted">Parameters</div>
                {def.params.map((pp: ShaderParam) => (
                  <RangeRow key={pp.key} label={pp.label} value={params[pp.key]} min={pp.min} max={pp.max} step={pp.step ?? 1} mul={pp.mul ?? 1} suffix={pp.suffix ?? ''} labelW="w-[88px]" onChange={(v) => setParam(pp.key, v)} />
                ))}
              </div>
              {def.colors && (() => {
                const fitN = (arr: string[]): string[] => {
                  const n = Math.max(2, def.colors?.length ?? colors.length)
                  return Array.from({ length: n }, (_, i) => arr[i % arr.length])
                }
                const presets: { name: string; c: string[] }[] = [
                  { name: 'Default', c: def.colors ?? [] },
                  { name: 'Sunset', c: ['#FF4C00', '#FF991E', '#FFE679', '#2F2A6A'] },
                  { name: 'Sea', c: ['#7EF9E0', '#00A8C5', '#0A2A55', '#02030F'] },
                  { name: 'Mono', c: ['#FFFFFF', '#9AA0A6', '#3C4043', '#0B0B0C'] },
                  { name: 'Neon', c: ['#39FF14', '#00E5FF', '#FF00E5', '#0B0220'] },
                ]
                return (
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[11px] text-text-muted">Presets</div>
                    <div className="flex items-center gap-1.5">
                      {presets.map((p) => (
                        <button key={p.name} type="button" title={p.name} onClick={() => { pushHistory(); setColors(fitN(p.c)) }}
                          className="h-6 flex-1 rounded-md transition-transform hover:scale-105"
                          style={{ background: `linear-gradient(90deg, ${p.c.join(', ')})` }} />
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-text-muted">Colours</span>
                      <IconBtn onClick={() => { pushHistory(); setColors([...colors, colors[colors.length - 1] ?? '#ffffff']) }} title="Add colour"><IcoPlus /></IconBtn>
                    </div>
                    {colors.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <ColorRow color={c} onColor={(v) => setColors(colors.map((x, idx) => (idx === i ? v : x)))} />
                        {colors.length > 1 && <IconBtn onClick={() => { pushHistory(); setColors(colors.filter((_, idx) => idx !== i)) }} title="Remove colour"><IcoMinus /></IconBtn>}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          )
        })()}
      </div>
    </div>
  )
}

/** Floating, draggable "Shaders" gallery. Picking a shader applies it live to the
 * selected layer's shader effect (matches the gradient/picker floating windows). */
function ShaderGallery({ effectId, sel, patchObj, pushHistory, anchor, onClose }: { effectId: string; sel: FObj; patchObj: (id: string, fn: (o: FObj) => Partial<FObj>) => void; pushHistory: () => void; anchor: DOMRect; onClose: () => void }): JSX.Element {
  const W = 560
  const [pos, setPos] = useState(() => {
    let left = anchor.left - W - 12
    if (left < 8) left = 8
    return { left, top: Math.max(8, Math.min(anchor.top - 40, window.innerHeight - 520)) }
  })
  const dragRef = useRef<{ x: number; y: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useClampPanel(panelRef, setPos)
  const onTitleDown = (e: React.PointerEvent): void => {
    e.preventDefault(); dragRef.current = { x: e.clientX, y: e.clientY }
    const move = (ev: PointerEvent): void => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.x, dy = ev.clientY - dragRef.current.y
      dragRef.current = { x: ev.clientX, y: ev.clientY }
      setPos((p) => ({ left: Math.max(0, Math.min(window.innerWidth - 120, p.left + dx)), top: Math.max(0, Math.min(window.innerHeight - 40, p.top + dy)) }))
    }
    const up = (): void => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const current = (sel.effects ?? []).find((e) => e.id === effectId)?.shaderId
  const apply = (def: ShaderDef): void => {
    pushHistory()
    patchObj(sel.id, (o) => ({ effects: (o.effects ?? []).map((e) => (e.id === effectId ? { ...e, shaderId: def.id, shaderParams: defaultShaderParams(def), shaderColors: def.colors } : e)) }))
  }
  return (
    <div ref={panelRef} className="fixed z-[61] flex max-h-[80vh] flex-col rounded-xl bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.5)]" style={{ left: pos.left, top: pos.top, width: W }}>
      <div onPointerDown={onTitleDown} className="flex cursor-grab items-center justify-between rounded-t-xl px-3 py-2 active:cursor-grabbing">
        <span className="text-[13px] font-medium text-text-primary">Shaders</span>
        <button type="button" onClick={onClose} title="Close" className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"><svg width="13" height="13" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg></button>
      </div>
      <div className="space-y-4 overflow-y-auto px-4 py-4">
        {SHADER_CATEGORIES.map((cat) => (
          <div key={cat} className="space-y-2">
            <div className="text-[12px] text-text-muted">{cat}</div>
            <div className="grid grid-cols-4 gap-3">
              {SHADERS.filter((s) => s.category === cat).map((s) => (
                <button key={s.id} type="button" onClick={() => apply(s)} className="group text-left">
                  <div className={['h-20 w-full overflow-hidden rounded-lg', current === s.id ? 'ring-2 ring-accent' : ''].join(' ')} style={{ background: s.thumb }} />
                  <div className={['mt-1 truncate text-[11.5px]', current === s.id ? 'text-text-primary' : 'text-text-secondary'].join(' ')}>{s.label}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** CSS border editor (width, sides, line style) + Solid/Gradient/Image paint. */
function BorderEditor({ sel, patch, patchObj, pushHistory, gradOptsOpen, onToggleGradOpts }: {
  sel: FObj
  patch: (id: string, p: Partial<FObj>) => void
  patchObj: (id: string, fn: (o: FObj) => Partial<FObj>) => void
  pushHistory: () => void
  gradOptsOpen: boolean
  onToggleGradOpts: (anchor: DOMRect | null, cfg: PaintCfg) => void
}): JSX.Element {
  const [sidesMenu, setSidesMenu] = useState(false)
  const visible = !sel.borderHidden
  const sides = sel.borderSides ?? 'all'
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <NumIcon icon={<IcoWeight />} title="Width" value={sel.borderWidth ?? 1} dim={!visible} min={0} on={(v) => patch(sel.id, { borderWidth: v })} />
        <div className="relative min-w-0 flex-1">
          <button type="button" onClick={() => setSidesMenu((o) => !o)} className={['flex w-full items-center gap-1 rounded-md bg-elevated/70 px-2 py-1.5 text-text-muted', visible ? '' : 'opacity-50'].join(' ')}>
            <IcoBox /><span className="min-w-0 flex-1 truncate text-left text-[12px] text-text-primary">{cap(sides)}</span><IcoChevron />
          </button>
          <Menu open={sidesMenu} onClose={() => setSidesMenu(false)} align="left" items={(['all', 'top', 'right', 'bottom', 'left'] as const).map((s) => ({ label: cap(s), active: sides === s, onClick: () => { pushHistory(); patch(sel.id, { borderSides: s }) } }))} />
        </div>
      </div>
      <PaintBody sel={sel} cfg={BORDER_PAINT} patch={patch} patchObj={patchObj} pushHistory={pushHistory} gradOptsOpen={gradOptsOpen} onToggleGradOpts={onToggleGradOpts}
        onEye={() => { pushHistory(); patch(sel.id, { borderHidden: !sel.borderHidden }) }}
        onRemove={() => { pushHistory(); patch(sel.id, { borderEnabled: false, borderHidden: false }) }} />
    </div>
  )
}

// ── SVG stroke painting (gradient / image outlines, borders and line strokes) ──────
/** SVG `<defs>` paint (gradient or image pattern) for a rich stroke/border paint. */
function SvgPaintDef({ id, o, cfg }: { id: string; o: FObj; cfg: PaintCfg }): JSX.Element | null {
  const mode = (o[cfg.mode] as string | undefined) ?? 'solid'
  if (mode === 'gradient') {
    const stops = paintStopsOf(o, cfg)
    const baseOp = (o[cfg.opacity] as number | undefined) ?? 1
    const type = (o[cfg.gtype] as string | undefined) ?? 'linear'
    const stopEls = stops.map((s, i) => (
      <stop key={i} offset={`${Math.round(Math.max(0, Math.min(1, s.pos)) * 100)}%`} stopColor={s.color} stopOpacity={(s.opacity ?? 1) * baseOp} />
    ))
    if (type === 'radial' || type === 'conic') {
      return <radialGradient id={id} cx="50%" cy="50%" r="50%">{stopEls}</radialGradient>
    }
    const { x1, y1, x2, y2 } = svgLinearCoords((o[cfg.gangle] as number | undefined) ?? 90)
    return <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>{stopEls}</linearGradient>
  }
  if (mode === 'image') {
    const img = o[cfg.image] as string | undefined
    if (img) {
      return (
        <pattern id={id} patternContentUnits="objectBoundingBox" width="1" height="1">
          <image href={img} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice" />
        </pattern>
      )
    }
  }
  return null
}

/** The `stroke`/`fill` reference for an SVG shape: a `url(#id)` for rich paints, else
 * the solid colour. */
function svgPaintRef(o: FObj, cfg: PaintCfg, id: string): string {
  if (paintIsRich(o, cfg)) return `url(#${id})`
  return (o[cfg.color] as string | undefined) ?? cfg.defaultColor
}

/** An absolutely-positioned SVG that traces an object's outline/border with a rich
 * (gradient or image) paint, used when CSS `outline`/`border` cannot express it. */
function StrokePaintOverlay({ o, cfg, kind }: { o: FObj; cfg: PaintCfg; kind: 'outline' | 'border' }): JSX.Element {
  const w = Math.max(0.5, kind === 'outline' ? o.strokeWidth : (o.borderWidth ?? 1))
  const offset = kind === 'outline' ? (o.strokeOffset ?? 0) : 0
  // Stroke centreline inset from the box edge: border draws inside, outline outside.
  const inset = kind === 'outline' ? -(offset + w / 2) : w / 2
  const id = `${o.id}-${kind}-paint`
  const ref = svgPaintRef(o, cfg, id)
  const style: React.CSSProperties = { position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', borderRadius: 'inherit' }
  const common = { fill: 'none', stroke: ref, strokeWidth: w } as const
  let shape: JSX.Element
  if (o.type === 'ellipse') {
    shape = <ellipse cx={o.w / 2} cy={o.h / 2} rx={Math.max(0, o.w / 2 - inset)} ry={Math.max(0, o.h / 2 - inset)} {...common} />
  } else if (o.type === 'polygon' || o.type === 'star') {
    const pct = o.type === 'polygon' ? polygonPoints(o.sides ?? 3) : starPoints(o.points ?? 5, o.innerRatio ?? 0.45)
    const pts = pct.split(',').map((p) => {
      const [px, py] = p.trim().split(/\s+/).map((n) => parseFloat(n) / 100)
      return `${(px * o.w).toFixed(2)},${(py * o.h).toFixed(2)}`
    }).join(' ')
    shape = <polygon points={pts} strokeLinejoin="round" {...common} />
  } else {
    const r = Math.max(0, (o.type === 'frame' ? 0 : o.radius) - inset)
    shape = <rect x={inset} y={inset} width={Math.max(0, o.w - inset * 2)} height={Math.max(0, o.h - inset * 2)} rx={r} ry={r} {...common} />
  }
  return (
    <svg width={o.w} height={o.h} viewBox={`0 0 ${o.w} ${o.h}`} style={style} aria-hidden>
      {paintIsRich(o, cfg) && <defs><SvgPaintDef id={id} o={o} cfg={cfg} /></defs>}
      {shape}
    </svg>
  )
}

export function FreeformCanvas({ designId, title, onClose, onRename }: {
  designId: string
  title: string
  onClose: () => void
  onRename?: (newTitle: string) => void
}): JSX.Element {
  const [objects, setObjects] = useState<FObj[]>([])
  const [renamingTitle, setRenamingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [selIds, setSelIds] = useState<string[]>([])
  const [tool, setTool] = useState<Tool>('select')
  const [artboards, setArtboards] = useState<Artboard[]>([])
  const [activeAb, setActiveAb] = useState('')
  const [scale, setScale] = useState(0.6)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<Box | null>(null)
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [leftTab, setLeftTab] = useState<'layers' | 'assistant' | 'system' | 'variables'>('layers')
  const [rightTab, setRightTab] = useState<'design' | 'theme'>('design')
  const [varColId, setVarColId] = useState<string>('')
  const [varQuery, setVarQuery] = useState('')
  const [varGroupFilter, setVarGroupFilter] = useState<string | null>(null)
  // Variables full-page tab sub-mode: token collections vs reusable styles.
  const [varTabMode, setVarTabMode] = useState<'variables' | 'styles'>('variables')
  const [styleTypeFilter, setStyleTypeFilter] = useState<StyleType>('color')
  // Clipboard for copy/paste of a variable across collections (resolved literals).
  const [varClip, setVarClip] = useState<VarClip | null>(null)
  const varClipRef = useRef<VarClip | null>(null)
  useEffect(() => { varClipRef.current = varClip }, [varClip])
  // Design variables: document-scoped collections (modes + variables). Bound object
  // fields resolve to a variable's value for its collection's active mode.
  const [collections, setCollections] = useState<VariableCollection[]>([])
  // Document-scoped styles (colour / text / effect). Applied styles write their
  // values onto objects and record a styleRef; editing a style re-syncs referrers.
  const [styles, setStyles] = useState<StyleLibrary>(makeStyleLibrary())
  // Published shared libraries (app-wide, across files).
  const [libraries, setLibraries] = useState<PublishedLibrary[]>(() => loadLibraries())
  // Pages: a Form holds multiple pages; each page has its own artboards + objects.
  // The active page's content lives in the `objects`/`artboards` state above; other
  // pages are parked in pageStoreRef until switched to.
  const [pages, setPages] = useState<{ id: string; name: string }[]>([{ id: 'p1', name: 'Page 1' }])
  const [activePage, setActivePage] = useState('p1')
  const [renamingPageId, setRenamingPageId] = useState<string | null>(null)
  const [pageRenameVal, setPageRenameVal] = useState('')
  const pageStoreRef = useRef<Record<string, { objects: FObj[]; artboards: Artboard[]; activeAb: string }>>({})
  const [leftW, setLeftW] = useState(244)
  const [rightW, setRightW] = useState(248)
  const [abSelected, setAbSelected] = useState(true)
  // Undo, delete and load can all take the active artboard away without going
  // through removeArtboard, and a selection pointing at nothing hides the
  // panels that would let you make a new one. Clear it wherever it happens.
  useEffect(() => {
    if (abSelected && !artboards.some((a) => a.id === activeAb)) setAbSelected(false)
  }, [abSelected, artboards, activeAb])
  const [aiBusy, setAiBusy] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const [motionDur, setMotionDur] = useState(2000)
  const [autoKey, setAutoKey] = useState(false)
  const [status, setStatus] = useState('')
  const [designSystems, setDesignSystems] = useState<DesignSystem[]>(() => loadSystems())
  const [activeDsId, setActiveDsId] = useState('')
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [renamingAbId, setRenamingAbId] = useState<string | null>(null)
  const [abRenameVal, setAbRenameVal] = useState('')
  const [layerMenu, setLayerMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [canvasMenu, setCanvasMenu] = useState<{ x: number; y: number; under: FObj[] } | null>(null)
  const [subMenu, setSubMenu] = useState<{ name: 'layer' | 'copyas'; y: number } | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(new Set())
  const dragLayerRef = useRef<string | null>(null)

  const stageRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<Drag>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const drawRef = useRef<{ x: number; y: number }[]>([])
  const [drawing, setDrawing] = useState<{ x: number; y: number }[] | null>(null)
  const objectsRef = useRef<FObj[]>(objects)
  const selRef = useRef<string[]>(selIds)
  const toolRef = useRef<Tool>(tool)
  const scaleRef = useRef(scale)
  const editingRef = useRef<string | null>(editingId)
  const artboardsRef = useRef<Artboard[]>(artboards)
  const activeAbRef = useRef<string>(activeAb)
  const abSelectedRef = useRef<boolean>(abSelected)
  const timelineOpenRef = useRef<boolean>(timelineOpen)
  const autoKeyRef = useRef<boolean>(false)
  const playheadRef = useRef<number>(0)
  const motionDurRef = useRef<number>(2000)
  const pastRef = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])
  const clipRef = useRef<FObj[]>([])
  const spaceRef = useRef(false)
  const collectionsRef = useRef<VariableCollection[]>(collections)

  useEffect(() => { collectionsRef.current = collections }, [collections])
  useEffect(() => { objectsRef.current = objects }, [objects])
  useEffect(() => { selRef.current = selIds }, [selIds])
  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { scaleRef.current = scale }, [scale])
  useEffect(() => { editingRef.current = editingId }, [editingId])
  useEffect(() => { artboardsRef.current = artboards }, [artboards])
  useEffect(() => { activeAbRef.current = activeAb }, [activeAb])
  useEffect(() => { abSelectedRef.current = abSelected }, [abSelected])
  // Figma copy→paste import (decode SPIKE): when the clipboard holds a Figma copy,
  // decode the fig-kiwi scene and dump a summary (console + localStorage + status) so
  // we can see real node data before writing the node→FObj mapping. No objects yet.
  // Returns true if the html was a Figma copy (so the caller skips the normal paste).
  const handleFigmaPaste = useCallback((html: string): boolean => {
    if (!html || !isFigmaClipboard(html)) return false
    const dec = decodeFigmaClipboard(html)
    const changes = (dec.message as { nodeChanges?: Record<string, unknown>[] } | undefined)?.nodeChanges
    try {
      localStorage.setItem('t42-figma-paste-debug', JSON.stringify({
        ok: dec.ok, error: dec.error, version: dec.version, nodeCount: dec.nodeCount, nodeTypes: dec.nodeTypes,
        schemaTypes: (dec.schemaTypes ?? []).slice(0, 100),
        sampleNodes: (changes ?? []).slice(0, 4).map((n) => ({ type: n.type, name: n.name, guid: n.guid, size: n.size, transform: n.transform, fillsLen: Array.isArray(n.fillPaints) ? n.fillPaints.length : undefined, keys: Object.keys(n).slice(0, 50) }))
      }))
    } catch { /* ignore */ }
    // eslint-disable-next-line no-console
    console.log('[Figma paste decode]', dec)
    setStatus(dec.ok ? `Figma paste decoded: ${dec.nodeCount} nodes (${Object.keys(dec.nodeTypes ?? {}).join(', ')})` : `Figma decode failed: ${dec.error}`)
    return true
  }, [])
  const handleFigmaPasteRef = useRef(handleFigmaPaste)
  useEffect(() => { handleFigmaPasteRef.current = handleFigmaPaste }, [handleFigmaPaste])
  useEffect(() => { timelineOpenRef.current = timelineOpen }, [timelineOpen])
  useEffect(() => { autoKeyRef.current = autoKey }, [autoKey])
  useEffect(() => { playheadRef.current = playhead }, [playhead])
  useEffect(() => { motionDurRef.current = motionDur }, [motionDur])
  useEffect(() => {
    const refresh = (): void => setDesignSystems(loadSystems())
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])
  useEffect(() => {
    if (!editingId) return
    const t = setTimeout(() => { editRef.current?.focus(); editRef.current?.select() }, 0)
    return () => clearTimeout(t)
  }, [editingId])

  // ── Auto-save / restore (per design, localStorage) ───────────────────────────
  const saveKey = `t42-freeform:${designId}`
  const restoredRef = useRef(false)
  // Saving waits on this matching saveKey, so the first write of a session can
  // only happen once the restored content is actually in state. A ref would go
  // true during the same commit that reads it and let empty state save over a
  // full file.
  const [hydratedKey, setHydratedKey] = useState<string | null>(null)
  const [savedTick, setSavedTick] = useState(0)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(saveKey)
      if (raw) {
        const data = JSON.parse(raw) as {
          objects?: FObj[]; artboards?: Artboard[]
          pages?: { id: string; name: string }[]; activePage?: string
          perPage?: Record<string, { objects: FObj[]; artboards: Artboard[]; activeAb: string }>
          variables?: VariableCollection[]
          styles?: Partial<StyleLibrary>
        }
        if (Array.isArray(data.variables)) setCollections(data.variables)
        if (data.styles) setStyles(normalizeLibrary(data.styles))
        if (Array.isArray(data.pages) && data.pages.length && data.perPage) {
          // v2: multi-page document
          setPages(data.pages)
          const active = data.activePage && data.perPage[data.activePage] ? data.activePage : data.pages[0].id
          pageStoreRef.current = { ...data.perPage }
          const cur = data.perPage[active]
          setActivePage(active)
          if (cur) {
            setArtboards(cur.artboards ?? [])
            setActiveAb(cur.activeAb ?? cur.artboards?.[0]?.id ?? '')
            setObjects(cur.objects ?? [])
          }
        } else {
          // v1: single-page legacy data → wrap into Page 1
          if (Array.isArray(data.artboards) && data.artboards.length) { setArtboards(data.artboards); setActiveAb(data.artboards[0].id) }
          if (Array.isArray(data.objects)) setObjects(data.objects)
        }
      }
    } catch { /* ignore a corrupt save */ }
    restoredRef.current = true
    setHydratedKey(saveKey)
  }, [saveKey])

  // ── The token library this file is bound to ──────────────────────────────────
  // Rebuilt from the library every time the file opens, so a colour changed in
  // the library is a colour changed here. The ids are derived from the token
  // paths, so rebuilding does not unbind anything that was bound to them.
  const [tokensBinding, setTokensBinding] = useState<{ id: string; themeId: string | null } | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      const design = await window.terminal42.designs.get(designId)
      if (!alive) return
      const id = design?.brief?.tokensId ?? null
      setTokensBinding(id ? { id, themeId: design?.brief?.tokensThemeId ?? null } : null)
    })()
    return () => { alive = false }
  }, [designId])

  const [tokenStudio, setTokenStudio] = useState<TokenStudio | null>(null)
  useEffect(() => {
    if (!restoredRef.current) return
    let alive = true
    void (async () => {
      const record = tokensBinding ? await window.terminal42.tokens.get(tokensBinding.id) : null
      if (!alive) return
      const studio = record ? hydrateStudio(record.studio) : null
      if (studio && tokensBinding?.themeId) studio.activeTheme = tokensBinding.themeId
      setTokenStudio(studio)
      setCollections((cols) => {
        const next = syncTokensCollection(cols, studio, tokensBinding?.id ?? null)
        return sameCollections(cols, next) ? cols : next
      })
    })()
    return () => { alive = false }
  }, [tokensBinding])

  // ── The Theme tab ────────────────────────────────────────────────────────────
  // Everything here edits the library the design is bound to. A design with no
  // library gets one on its first token, so nothing is ever written to a second
  // store that only this screen can see.
  const bindStudio = async (studio: TokenStudio): Promise<{ id: string; studio: TokenStudio }> => {
    const rec = await window.terminal42.tokens.create(studio.name, studio)
    await window.terminal42.designs.setTokens(designId, rec.id, studio.activeTheme ?? null)
    setTokensBinding({ id: rec.id, themeId: studio.activeTheme ?? null })
    return { id: rec.id, studio }
  }
  const createToken = async (kind: TokenKind): Promise<void> => {
    let id = tokensBinding?.id ?? null
    let studio = tokenStudio
    if (!id || !studio) {
      const made = await bindStudio(emptyStudio(title || 'Theme'))
      id = made.id
      studio = made.studio
    }
    // The set the active theme stacks last, because that is the one whose
    // values win, and a new token nobody can see is not a new token.
    const theme = studio.themes.find((t) => t.id === studio?.activeTheme) ?? studio.themes[0]
    const enabled = [...studio.sets].sort((a, b) => a.order - b.order).filter((s) => !theme || theme.sets[s.id] !== 'off')
    const setId = enabled[enabled.length - 1]?.id ?? studio.sets[0]?.id
    if (!setId) return
    const next = addToken(studio, setId, kind.type, kind.tier, kind.path).studio
    setTokenStudio(next)
    await window.terminal42.tokens.save(id, next)
    setTokensBinding((b) => (b ? { ...b } : b))
  }
  const applyStarterTheme = async (): Promise<void> => {
    const studio = studioFromFeel(title || 'Theme', feelFromVibe('minimal'))
    const made = await bindStudio(studio)
    setTokenStudio(made.studio)
  }
  useEffect(() => {
    if (hydratedKey !== saveKey) return
    const t = setTimeout(() => {
      const perPage = { ...pageStoreRef.current, [activePage]: { objects, artboards, activeAb } }
      const doc = { pages, activePage, perPage, variables: collections, styles, v: 2 }
      try {
        // Emptying a file is a real edit, so it saves. It also keeps a copy of
        // the last version that had something in it.
        if (docIsEmpty(doc)) {
          const prev = localStorage.getItem(saveKey)
          if (prev && !docIsEmpty(readDoc(saveKey))) localStorage.setItem(`${saveKey}:last-nonempty`, prev)
        }
        localStorage.setItem(saveKey, JSON.stringify(doc)); setSavedTick((n) => n + 1)
      } catch { /* quota / private mode */ }
    }, 700)
    return () => clearTimeout(t)
  }, [objects, artboards, activeAb, pages, activePage, saveKey, hydratedKey, collections, styles])

  // ── Pages ────────────────────────────────────────────────────────────────────
  const switchPage = (id: string): void => {
    if (id === activePage) return
    pageStoreRef.current[activePage] = { objects, artboards, activeAb }
    const next = pageStoreRef.current[id]
    setActivePage(id)
    setSelIds([]); setAbSelected(true); setEditingId(null)
    if (next) {
      setArtboards(next.artboards ?? [])
      setActiveAb(next.activeAb ?? next.artboards?.[0]?.id ?? '')
      setObjects(next.objects ?? [])
      setAbSelected(!!(next.artboards && next.artboards.length))
    } else {
      setArtboards([]); setActiveAb(''); setObjects([]); setAbSelected(false)
    }
  }
  const addPage = (): void => {
    pageStoreRef.current[activePage] = { objects, artboards, activeAb }
    const id = `p${Date.now().toString(36)}`
    pageStoreRef.current[id] = { objects: [], artboards: [], activeAb: '' }
    setPages((ps) => [...ps, { id, name: `Page ${ps.length + 1}` }])
    setActivePage(id)
    setSelIds([]); setAbSelected(false); setEditingId(null)
    setArtboards([]); setActiveAb(''); setObjects([])
  }
  const renamePage = (id: string, name: string): void => {
    const v = name.trim(); if (!v) return
    setPages((ps) => ps.map((p) => (p.id === id ? { ...p, name: v } : p)))
  }
  const removePage = (id: string): void => {
    if (pages.length <= 1) return
    const remaining = pages.filter((p) => p.id !== id)
    delete pageStoreRef.current[id]
    setPages(remaining)
    if (activePage === id) {
      const target = remaining[0].id
      const next = pageStoreRef.current[target]
      setActivePage(target)
      setSelIds([]); setAbSelected(true)
      if (next) { setArtboards(next.artboards); setActiveAb(next.activeAb); setObjects(next.objects) }
    }
  }


  // Auto-layout: keep every flex frame's children packed/aligned. Idempotent, so
  // setting the same positions is a no-op (no render loop).
  useEffect(() => {
    setObjects((os) => reflowAll(os))
  }, [objects])

  const selObjs = useMemo(() => objects.filter((o) => selIds.includes(o.id)), [objects, selIds])
  const sel = selObjs.length === 1 ? selObjs[0] : null
  // id → object, for walking the parent chain (e.g. hiding a frame hides its children)
  const objById = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects])
  // Objects with variable bindings applied (bound fields → the variable's value for
  // its collection's active mode). Used for canvas rendering; the inspector still
  // reads the raw objects so it can show variable names and edit bindings.
  const renderObjects = useMemo(() => resolveObjects(objects, collections), [objects, collections])
  // An object is shown only if it AND every ancestor frame is visible.
  const effectivelyVisible = (o: FObj): boolean => {
    if (!o.visible) return false
    let p = o.parent ? objById.get(o.parent) : undefined
    for (let g = 0; p && g < 16; p = p.parent ? objById.get(p.parent) : undefined, g++) {
      if (!p.visible) return false
    }
    return true
  }
  const selBounds = useMemo(() => groupBounds(selObjs.map(boxOf)), [selObjs])
  // Figma-style sizing label: "390 Fill × 324 Hug" (fixed shows just the px value).
  const sizeLabel = (o: FObj): string => {
    const m = (mode?: string): string => (mode === 'fill' ? ' Fill' : mode === 'fit' ? ' Hug' : '')
    return `${Math.round(o.w)}${m(o.widthMode)} × ${Math.round(o.h)}${m(o.heightMode)}`
  }
  const world = useMemo(() => worldBounds(artboards), [artboards])
  // Selection sync: when the selection changes, reveal it in the Layers panel —
  // expand any collapsed ancestor frames/artboard, then scroll the row into view.
  const layersScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (leftTab !== 'layers' || !selIds.length) return
    const id = selIds[selIds.length - 1]
    const anc = new Set<string>()
    let cur: FObj | undefined = objById.get(id)
    for (let g = 0; cur?.parent && g < 24; g++) { anc.add(cur.parent); cur = objById.get(cur.parent) }
    const o = objById.get(id)
    const ab = o ? artboardAt(artboardsRef.current, o.x + o.w / 2, o.y + o.h / 2) : null
    if (ab) anc.add(ab.id)
    setCollapsedLayers((s) => { if (![...anc].some((a) => s.has(a))) return s; const n = new Set(s); anc.forEach((a) => n.delete(a)); return n })
    const t = setTimeout(() => {
      try { layersScrollRef.current?.querySelector(`[data-layer-id="${(window.CSS && CSS.escape) ? CSS.escape(id) : id}"]`)?.scrollIntoView({ block: 'nearest' }) } catch { /* ignore */ }
    }, 40)
    return () => clearTimeout(t)
  }, [selIds, leftTab, objById])
  const activeArtboard = useMemo(() => artboards.find((a) => a.id === activeAb) ?? artboards[0], [artboards, activeAb])
  const motionPath = useMemo(() => {
    if (!sel?.motion) return null
    const xs = sel.motion.tracks.x ?? []
    const ys = sel.motion.tracks.y ?? []
    if (!xs.length && !ys.length) return null
    const times = Array.from(new Set([...xs.map((k) => k.t), ...ys.map((k) => k.t)])).sort((a, b) => a - b)
    return times.map((t) => ({
      t,
      x: sel.x + sel.w / 2 + sampleTrack(sel.motion!.tracks.x, t, 0),
      y: sel.y + sel.h / 2 + sampleTrack(sel.motion!.tracks.y, t, 0),
    }))
  }, [sel])

  // ── History (objects + artboards) ────────────────────────────────────────────
  const syncHist = (): void => { setCanUndo(pastRef.current.length > 0); setCanRedo(futureRef.current.length > 0) }
  const snapshot = (): Snapshot => ({ objects: objectsRef.current.map((o) => ({ ...o })), artboards: artboardsRef.current.map((a) => ({ ...a })) })
  const restore = (s: Snapshot): void => { setObjects(s.objects); setArtboards(s.artboards) }
  const pushHistory = useCallback((): void => {
    pastRef.current = [...pastRef.current.slice(-80), snapshot()]
    futureRef.current = []
    syncHist()
  }, [])
  const undo = useCallback((): void => {
    if (!pastRef.current.length) return
    futureRef.current = [snapshot(), ...futureRef.current]
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    restore(prev)
    syncHist()
  }, [])
  const redo = useCallback((): void => {
    if (!futureRef.current.length) return
    pastRef.current = [...pastRef.current, snapshot()]
    const next = futureRef.current[0]
    futureRef.current = futureRef.current.slice(1)
    restore(next)
    syncHist()
  }, [])

  // ── Mutators ─────────────────────────────────────────────────────────────────
  const patch = (id: string, p: Partial<FObj>): void =>
    setObjects((os) => os.map((o) => (o.id === id ? { ...o, ...p } : o)))
  // Functional patch: applies an updater to the latest object, so live editors
  // (colour picker drags, gradient-stop drags) never read a stale snapshot.
  const patchObj = useCallback((id: string, fn: (o: FObj) => Partial<FObj>): void =>
    setObjects((os) => os.map((o) => (o.id === id ? { ...o, ...fn(o) } : o))), [])

  // Replace one colour with another across a set of objects (Selection colors).
  // History is stamped by openPicker when the picker opens, so this stays history-free
  // to allow many live updates while dragging in the colour picker.
  const replaceColorInObjects = useCallback((ids: string[], oldHex: string, newHex: string): void => {
    const set = new Set(ids)
    const oh = (oldHex || '').toUpperCase()
    const hit = (c?: string): boolean => { const h = c?.trim().toUpperCase(); return !!h && (h === oh || h === `#${oh.replace('#', '')}` || h.replace('#', '') === oh.replace('#', '')) }
    setObjects((os) => os.map((o) => {
      if (!set.has(o.id)) return o
      const n: FObj = { ...o }
      if (hit(n.fill)) n.fill = newHex
      if (hit(n.stroke)) n.stroke = newHex
      if (hit(n.color)) n.color = newHex
      if (hit(n.shadowColor)) n.shadowColor = newHex
      if (n.glowColor && hit(n.glowColor)) n.glowColor = newHex
      if (n.gradientStops) n.gradientStops = n.gradientStops.map((s) => (hit(s.color) ? { ...s, color: newHex } : s))
      return n
    }))
  }, [])

  // Floating colour picker + gradient options windows (rendered over the canvas,
  // outside the clipped inspector). Opening the picker stamps one undo entry.
  const [pickerReq, setPickerReq] = useState<PickerRequest | null>(null)
  // The library's colours, offered by every colour control in Form. Injected
  // at the one place the picker is rendered rather than at each control, so a
  // new control cannot forget them.
  const tokenSwatches = useTokenSwatches()
  const [gradOpts, setGradOpts] = useState<{ anchor: DOMRect; cfg: PaintCfg } | null>(null)
  const [effectPopover, setEffectPopover] = useState<{ id: string; anchor: DOMRect } | null>(null)
  const [shaderGallery, setShaderGallery] = useState<{ effectId: string; anchor: DOMRect } | null>(null)
  const openPicker = useCallback<OpenPicker>((r) => { pushHistory(); setPickerReq({ ...r, onClose: () => setPickerReq(null) }) }, [pushHistory])
  const editCtx = useMemo(() => ({ openPicker, pushHistory }), [openPicker, pushHistory])

  // ── Variable collections (document-scoped) ───────────────────────────────────
  const patchCollection = useCallback((colId: string, fn: (c: VariableCollection) => VariableCollection): void => {
    setCollections((cs) => cs.map((c) => (c.id === colId ? fn(c) : c)))
  }, [])
  const patchVariable = useCallback((colId: string, varId: string, fn: (v: Variable) => Variable): void => {
    patchCollection(colId, (c) => ({ ...c, variables: c.variables.map((v) => (v.id === varId ? fn(v) : v)) }))
  }, [patchCollection])
  const addCollection = useCallback((): void => {
    setCollections((cs) => [...cs, makeCollection(`Collection ${cs.length + 1}`)])
  }, [])
  const removeCollection = useCallback((colId: string): void => {
    setCollections((cs) => cs.filter((c) => c.id !== colId))
  }, [])
  // Export every collection to a DTCG (W3C design-tokens) JSON file.
  const exportTokens = useCallback((): void => {
    const json = exportDTCG(collections)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'design-tokens.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [collections])
  // Import a DTCG token file, appending its collections (names de-duplicated).
  const importTokens = useCallback((): void => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = (): void => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (): void => {
        try {
          const parsed = importDTCG(String(reader.result))
          if (!parsed.length) return
          setCollections((cs) => {
            const merged = [...cs]
            for (const c of parsed) { c.name = uniqueCollectionName(merged, c.name); merged.push(c) }
            return merged
          })
        } catch { /* invalid token file — ignore */ }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])
  // ── Styles (document-scoped colour / text / effect) ───────────────────────────
  // Re-apply a colour style's resolved hex to every object that references it.
  const resyncColorStyle = useCallback((s: ColorStyle): void => {
    const hex = s.colorVar ? (() => { const v = resolveVarValue(collections, s.colorVar!); return typeof v === 'string' ? v : s.color })() : s.color
    setObjects((os) => os.map((o) => {
      if (o.styleRefs?.fill !== s.id) return o
      return o.type === 'text' ? { ...o, color: hex } : { ...o, fill: hex, fillEnabled: true, fillMode: 'solid' }
    }))
  }, [collections])
  const addColorStyle = useCallback((): void => {
    setStyles((lib) => {
      const src = selObjs[0]
      const name = uniqueStyleName(lib, 'color', 'Color')
      const s = colorStyleFromObj(src, name)
      return { ...lib, colors: [...lib.colors, s] }
    })
  }, [selObjs])
  const addTextStyle = useCallback((): void => {
    setStyles((lib) => {
      const src = selObjs.find((o) => o.type === 'text') ?? selObjs[0]
      const s = textStyleFromObj(src, uniqueStyleName(lib, 'text', 'Text'))
      return { ...lib, text: [...lib.text, s] }
    })
  }, [selObjs])
  const addEffectStyle = useCallback((): void => {
    setStyles((lib) => {
      const src = selObjs.find((o) => (o.effects?.length ?? 0) > 0) ?? selObjs[0]
      const s = effectStyleFromObj(src, uniqueStyleName(lib, 'effect', 'Effect'))
      return { ...lib, effects: [...lib.effects, s] }
    })
  }, [selObjs])
  const updateColorStyle = useCallback((id: string, patch: Partial<ColorStyle>): void => {
    setStyles((lib) => {
      const colors = lib.colors.map((s) => (s.id === id ? { ...s, ...patch } : s))
      const updated = colors.find((s) => s.id === id)
      if (updated) resyncColorStyle(updated)
      return { ...lib, colors }
    })
  }, [resyncColorStyle])
  const updateTextStyle = useCallback((id: string, patch: Partial<TextStyle>): void => {
    setStyles((lib) => {
      const text = lib.text.map((s) => (s.id === id ? { ...s, ...patch } : s))
      const s = text.find((x) => x.id === id)
      if (s) setObjects((os) => os.map((o) => (o.styleRefs?.text === id ? { ...o, ...applyTextStyle(o, s) } : o)))
      return { ...lib, text }
    })
  }, [])
  const renameStyle = useCallback((type: StyleType, id: string, name: string): void => {
    setStyles((lib) => {
      if (type === 'color') return { ...lib, colors: lib.colors.map((s) => (s.id === id ? { ...s, name } : s)) }
      if (type === 'text') return { ...lib, text: lib.text.map((s) => (s.id === id ? { ...s, name } : s)) }
      return { ...lib, effects: lib.effects.map((s) => (s.id === id ? { ...s, name } : s)) }
    })
  }, [])
  const removeStyle = useCallback((type: StyleType, id: string): void => {
    setStyles((lib) => {
      if (type === 'color') return { ...lib, colors: lib.colors.filter((s) => s.id !== id) }
      if (type === 'text') return { ...lib, text: lib.text.filter((s) => s.id !== id) }
      return { ...lib, effects: lib.effects.filter((s) => s.id !== id) }
    })
    // drop dangling refs so the inspector no longer shows the deleted style
    const slot = type === 'color' ? 'fill' : type
    setObjects((os) => os.map((o) => (o.styleRefs?.[slot as 'fill' | 'text' | 'effect'] === id ? { ...o, styleRefs: { ...o.styleRefs, [slot]: undefined } } : o)))
  }, [])
  const applyStyleToSel = useCallback((type: StyleType, id: string): void => {
    if (!selIds.length) return
    pushHistory()
    setObjects((os) => os.map((o) => {
      if (!selIds.includes(o.id)) return o
      if (type === 'color') { const s = findColorStyle(styles, id); if (!s) return o; const hex = resolveColorStyle(styles, collections, id) ?? s.color; return { ...o, ...applyColorStyle(o, s, hex) } }
      if (type === 'text') { const s = findTextStyle(styles, id); if (!s) return o; return { ...o, ...applyTextStyle(o, s) } }
      const s = findEffectStyle(styles, id); if (!s) return o; return { ...o, ...applyEffectStyle(o, s) }
    }))
  }, [selIds, styles, collections, pushHistory])
  // ── Shared libraries (publish / consume across files) ─────────────────────────
  const publishToLibrary = useCallback((): void => {
    if (!collections.length && (styles.colors.length + styles.text.length + styles.effects.length) === 0) return
    setLibraries(publishLibrary(title || 'Untitled library', collections, styles))
  }, [title, collections, styles])
  const addLibraryToFile = useCallback((libId: string): void => {
    const lib = libraries.find((l) => l.id === libId)
    if (!lib) return
    const merged = mergeLibraryInto(lib, collections, styles)
    setCollections(merged.collections)
    setStyles(merged.styles)
  }, [libraries, collections, styles])
  const removeLibrary = useCallback((libId: string): void => {
    setLibraries(deleteLibrary(libId))
  }, [])
  const addMode = useCallback((colId: string): void => {
    patchCollection(colId, (c) => {
      const mode = { id: newModeId(), name: `Mode ${c.modes.length + 1}` }
      const first = c.modes[0]?.id
      const variables = c.variables.map((v) => ({ ...v, values: { ...v.values, [mode.id]: first ? v.values[first] : defaultValueFor(v.type) } }))
      return { ...c, modes: [...c.modes, mode], variables }
    })
  }, [patchCollection])
  const removeMode = useCallback((colId: string, modeId: string): void => {
    patchCollection(colId, (c) => {
      if (c.modes.length <= 1) return c
      const modes = c.modes.filter((m) => m.id !== modeId)
      const variables = c.variables.map((v) => { const values = { ...v.values }; delete values[modeId]; return { ...v, values } })
      const activeMode = c.activeMode === modeId ? modes[0].id : c.activeMode
      return { ...c, modes, variables, activeMode }
    })
  }, [patchCollection])
  const setActiveMode = useCallback((colId: string, modeId: string): void => {
    patchCollection(colId, (c) => ({ ...c, activeMode: modeId }))
  }, [patchCollection])
  const addVariable = useCallback((colId: string, type: VarType): void => {
    patchCollection(colId, (c) => {
      const n = c.variables.filter((v) => v.type === type).length + 1
      const label = type === 'color' ? `color/${n}` : type === 'number' ? `number/${n}` : `${type}/${n}`
      return { ...c, variables: [...c.variables, makeVariable(type, label, c.modes)] }
    })
  }, [patchCollection])
  const removeVariable = useCallback((colId: string, varId: string): void => {
    patchCollection(colId, (c) => ({ ...c, variables: c.variables.filter((v) => v.id !== varId) }))
    // drop any object bindings that referenced it
    setObjects((os) => os.map((o) => {
      if (!o.bindings) return o
      const hit = Object.values(o.bindings).includes(varId)
      if (!hit) return o
      const bindings = Object.fromEntries(Object.entries(o.bindings).filter(([, id]) => id !== varId))
      return { ...o, bindings: Object.keys(bindings).length ? bindings : undefined }
    }))
  }, [patchCollection])
  const setVarValue = useCallback((colId: string, varId: string, modeId: string, value: VarValue): void => {
    patchVariable(colId, varId, (v) => ({ ...v, values: { ...v.values, [modeId]: value } }))
  }, [patchVariable])
  // ── Table operations: reorder / duplicate modes, duplicate + copy/paste vars ──
  const moveMode = useCallback((colId: string, modeId: string, dir: -1 | 1): void => {
    patchCollection(colId, (c) => {
      const i = c.modes.findIndex((m) => m.id === modeId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= c.modes.length) return c
      const modes = [...c.modes]
      const [m] = modes.splice(i, 1)
      modes.splice(j, 0, m)
      return { ...c, modes }
    })
  }, [patchCollection])
  const duplicateMode = useCallback((colId: string, modeId: string): void => {
    patchCollection(colId, (c) => {
      const src = c.modes.find((m) => m.id === modeId)
      if (!src) return c
      const mode = { id: newModeId(), name: `${src.name} copy` }
      const variables = c.variables.map((v) => ({ ...v, values: { ...v.values, [mode.id]: v.values[modeId] } }))
      const i = c.modes.findIndex((m) => m.id === modeId)
      const modes = [...c.modes]
      modes.splice(i + 1, 0, mode)
      return { ...c, modes, variables }
    })
  }, [patchCollection])
  const duplicateVariable = useCallback((colId: string, varId: string): void => {
    patchCollection(colId, (c) => {
      const idx = c.variables.findIndex((v) => v.id === varId)
      if (idx < 0) return c
      const v = c.variables[idx]
      const clone: Variable = { ...v, id: newVariableId(), name: uniqueVarName(c, v.name), values: { ...v.values } }
      const variables = [...c.variables]
      variables.splice(idx + 1, 0, clone)
      return { ...c, variables }
    })
  }, [patchCollection])
  const copyVariable = useCallback((colId: string, varId: string): void => {
    const found = findVariable(collections, varId)
    if (!found) return
    const { collection: c, variable: v } = found
    const values = c.modes.map((m) => resolveVarValue(collections, varId, { [c.id]: m.id }) ?? defaultValueFor(v.type))
    setVarClip({ type: v.type, name: splitVarName(v.name).leaf, values })
  }, [collections])
  const pasteVariable = useCallback((colId: string): void => {
    const clip = varClipRef.current
    if (!clip) return
    patchCollection(colId, (c) => {
      const values: Record<string, VarValue> = {}
      c.modes.forEach((m, i) => { values[m.id] = clip.values[i] ?? clip.values[0] ?? defaultValueFor(clip.type) })
      const variable: Variable = { id: newVariableId(), name: uniqueVarName(c, clip.name), type: clip.type, values }
      return { ...c, variables: [...c.variables, variable] }
    })
  }, [patchCollection])
  // Move a variable into a group by rewriting its "/"-path prefix (drag-nest).
  const setVariableGroup = useCallback((colId: string, varId: string, groupPath: string): void => {
    patchCollection(colId, (c) => ({
      ...c,
      variables: c.variables.map((v) => {
        if (v.id !== varId) return v
        const leaf = splitVarName(v.name).leaf
        return { ...v, name: groupPath ? `${groupPath}/${leaf}` : leaf }
      }),
    }))
  }, [patchCollection])

  // Bind / unbind a field on the current selection to a variable.
  const bindFieldToVar = useCallback((field: BindField, varId: string): void => {
    pushHistory()
    const ids = selRef.current
    setObjects((os) => os.map((o) => (ids.includes(o.id) ? { ...o, bindings: { ...o.bindings, [field]: varId } } : o)))
  }, [pushHistory])
  const unbindField = useCallback((field: BindField): void => {
    pushHistory()
    const ids = selRef.current
    setObjects((os) => os.map((o) => {
      if (!ids.includes(o.id) || !o.bindings) return o
      const bindings = Object.fromEntries(Object.entries(o.bindings).filter(([k]) => k !== field))
      return { ...o, bindings: Object.keys(bindings).length ? bindings : undefined }
    }))
  }, [pushHistory])
  const openVariables = useCallback((): void => {
    if (!collections.length) addCollection()
    setLeftTab('variables')
  }, [collections.length, addCollection])
  // Pin (or clear) a collection's mode on the current selection, so its subtree
  // renders in that mode regardless of the document default.
  const setVarMode = useCallback((colId: string, modeId: string | null): void => {
    pushHistory()
    const ids = selRef.current
    setObjects((os) => os.map((o) => {
      if (!ids.includes(o.id)) return o
      const varModes = { ...o.varModes }
      if (modeId === null) delete varModes[colId]
      else varModes[colId] = modeId
      return { ...o, varModes: Object.keys(varModes).length ? varModes : undefined }
    }))
  }, [pushHistory])
  // Create a color variable from a hex value and bind the current selection's
  // field to it, in a single history step (used by the color picker).
  const createColorVarForField = useCallback((field: BindField, hex: string): void => {
    pushHistory()
    const ids = selRef.current
    const newId = newVariableId()
    setCollections((cs) => {
      const base = cs.length ? cs : [makeCollection('Collection 1')]
      const target = base[0]
      const n = target.variables.filter((v) => v.type === 'color').length + 1
      const values: Record<string, VarValue> = {}
      for (const m of target.modes) values[m.id] = hex
      const variable: Variable = { id: newId, name: `color/${n}`, type: 'color', values }
      return base.map((c, i) => (i === 0 ? { ...c, variables: [...c.variables, variable] } : c))
    })
    setObjects((os) => os.map((o) => (ids.includes(o.id) ? { ...o, bindings: { ...o.bindings, [field]: newId } } : o)))
  }, [pushHistory])
  const varCtx = useMemo(() => ({ collections, bindFieldToVar, unbindField, openVariables, createColorVarForField, setVarMode }), [collections, bindFieldToVar, unbindField, openVariables, createColorVarForField, setVarMode])
  // Keep the selected variable collection valid as collections change.
  const varCol = collections.find((c) => c.id === varColId) ?? collections[0]
  useEffect(() => { if (varCol && varCol.id !== varColId) setVarColId(varCol.id) }, [varCol, varColId])
  useEffect(() => { setVarGroupFilter(null); setVarQuery('') }, [varColId])

  // Close the floating windows when the selection changes (their callbacks target
  // the previously selected object).
  useEffect(() => { setPickerReq(null); setGradOpts(null); setEffectPopover(null); setShaderGallery(null) }, [sel?.id])

  // ── Keyframing from the inspector ────────────────────────────────────────────
  const isKeyed = (o: FObj, prop: PropName): boolean => !!o.motion?.tracks[prop]?.length
  // Toggle a keyframe for a property at the current playhead.
  const toggleKey = (o: FObj, prop: PropName, value: number): void => {
    const m = o.motion ?? emptyMotion(motionDur)
    const existing = m.tracks[prop]?.find((k) => Math.abs(k.t - playhead) < 1)
    if (existing) patch(o.id, { motion: removeKey(m, prop, existing.id) })
    else patch(o.id, { motion: setKey({ ...m, duration: motionDur }, prop, playhead, value) })
  }
  // When auto-keyframing is on, record a keyframe at the playhead on value change.
  const autoRecord = (o: FObj, prop: PropName, value: number): void => {
    if (!autoKey) return
    const m = o.motion ?? emptyMotion(motionDur)
    patch(o.id, { motion: setKey({ ...m, duration: motionDur }, prop, playhead, value) })
  }
  // Record a keyframe at the playhead unconditionally (for explicit transform edits).
  const recordKey = (o: FObj, prop: PropName, value: number): void => {
    const m = o.motion ?? emptyMotion(motionDur)
    patch(o.id, { motion: setKey({ ...m, duration: motionDur }, prop, playhead, value) })
  }
  // Reset a layer's transform: clear rotation/opacity to defaults and drop the
  // transform animation tracks (position/scale/rotation/opacity), keep effects.
  const resetTransform = (o: FObj): void => {
    pushHistory()
    const tracks = { ...(o.motion?.tracks ?? {}) }
    for (const p of ['x', 'y', 'scale', 'rotate', 'opacity'] as PropName[]) delete tracks[p]
    patch(o.id, { rotation: 0, opacity: 1, motion: o.motion ? { ...o.motion, tracks } : undefined })
  }

  // ── Artboard helpers (shared by the layers panel + inspector) ────────────────
  const patchAb = (id: string, p: Partial<Artboard>): void =>
    setArtboards((as) => as.map((a) => (a.id === id ? { ...a, ...p } : a)))
  const addArtboard = (w: number, h: number, label: string): void => {
    pushHistory()
    const n = artboards.filter((a) => a.name.startsWith(label)).length
    const ab = placeNewArtboard(artboards, w, h, `${label}${n ? ` ${n + 1}` : ''}`)
    setArtboards((as) => [...as, ab])
    setActiveAb(ab.id)
    setSelIds([])
    setAbSelected(true)
    setTool('select')
  }
  const removeArtboard = (id: string): void => {
    pushHistory()
    const remaining = artboards.filter((a) => a.id !== id)
    setArtboards(remaining)
    if (activeAb === id) {
      setActiveAb(remaining[0]?.id ?? '')
      if (!remaining.length) setAbSelected(false)
    }
  }

  // ── Coordinate conversion (world space) ──────────────────────────────────────
  const toArt = useCallback((cx: number, cy: number): { x: number; y: number } => {
    const r = sceneRef.current?.getBoundingClientRect()
    if (!r) return { x: 0, y: 0 }
    return { x: (cx - r.left) / scaleRef.current, y: (cy - r.top) / scaleRef.current }
  }, [])

  // ── Selection helpers ────────────────────────────────────────────────────────
  const selectOne = (id: string, additive: boolean): void => {
    setSelIds((cur) => {
      if (additive) return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      return [id]
    })
  }

  // ── Pointer: artboard (create / marquee / pan) ───────────────────────────────
  const onArtDown = (e: React.PointerEvent): void => {
    if (editingRef.current) return
    const t = toolRef.current
    if (t === 'hand' || spaceRef.current || e.button === 1) {
      dragRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y }
      return
    }
    const p = toArt(e.clientX, e.clientY)
    // activate the artboard under the pointer (for export + snapping)
    const hit = artboardAt(artboardsRef.current, p.x, p.y)
    if (hit) { setActiveAb(hit.id); setAbSelected(true) }
    if (t === 'frame' && frameIntent(artboardsRef.current, p.x, p.y) === 'artboard') {
      // bare canvas → this is a new artboard, not a nested frame
      const id = newArtboardId()
      setArtboards((as) => [...as, { id, name: `Artboard ${as.length + 1}`, x: Math.round(p.x), y: Math.round(p.y), w: 1, h: 1, bg: '#ffffff' }])
      setActiveAb(id); setSelIds([])
      dragRef.current = { mode: 'createab', id, sx: p.x, sy: p.y }
      return
    }
    if (t === 'image') { fileRef.current?.click(); return }
    if (t === 'pencil') {
      drawRef.current = [{ x: p.x, y: p.y }]
      setDrawing([{ x: p.x, y: p.y }])
      dragRef.current = { mode: 'draw' }
      return
    }
    if (t === 'text') {
      pushHistory()
      const o = makeObject('text', Math.round(p.x), Math.round(p.y))
      setObjects((os) => [...os, o])
      setSelIds([o.id]); setTool('select'); setEditingId(o.id)
      return
    }
    if (CREATE_TOOLS.includes(t)) {
      pushHistory()
      const o = makeObject(t as Shape, Math.round(p.x), Math.round(p.y))
      setObjects((os) => [...os, o])
      setSelIds([o.id])
      dragRef.current = { mode: 'create', id: o.id, sx: p.x, sy: p.y }
      return
    }
    // select tool on empty space → marquee; deselect the artboard if the click
    // was outside any artboard (so its handles/settings hide).
    setSelIds([])
    setAbSelected(!!hit)
    dragRef.current = { mode: 'marquee', sx: p.x, sy: p.y }
    setMarquee({ x: p.x, y: p.y, w: 0, h: 0 })
  }

  const onObjDown = (e: React.PointerEvent, o: FObj): void => {
    if (toolRef.current !== 'select' || o.locked || editingRef.current) return
    e.stopPropagation()
    const additive = e.shiftKey
    let ids = selRef.current
    if (additive) ids = ids.includes(o.id) ? ids.filter((x) => x !== o.id) : [...ids, o.id]
    else if (!ids.includes(o.id)) ids = [o.id]
    // include descendants so parented children move with their parent
    const moveIds = new Set(ids)
    let grew = true
    while (grew) { grew = false; for (const ob of objectsRef.current) { if (ob.parent && moveIds.has(ob.parent) && !moveIds.has(ob.id) && !ob.locked) { moveIds.add(ob.id); grew = true } } }
    // Alt/Option-drag → duplicate: clone the selection (+ descendants) in place and drag
    // the clones, leaving the originals untouched (Figma-style).
    if (e.altKey) {
      pushHistory()
      const idMap = new Map<string, string>()
      for (const ob of objectsRef.current) if (moveIds.has(ob.id)) idMap.set(ob.id, makeObject(ob.type, 0, 0).id)
      const clones: FObj[] = objectsRef.current.filter((ob) => moveIds.has(ob.id)).map((ob) => ({
        ...ob, id: idMap.get(ob.id)!, parent: ob.parent && idMap.has(ob.parent) ? idMap.get(ob.parent)! : ob.parent
      }))
      setObjects((os) => [...os, ...clones])
      const newSel = ids.map((id) => idMap.get(id)).filter((x): x is string => !!x)
      setSelIds(newSel)
      const corig: Record<string, { x: number; y: number }> = {}
      for (const c of clones) corig[c.id] = { x: c.x, y: c.y }
      const cp = toArt(e.clientX, e.clientY)
      dragRef.current = { mode: 'move', sx: cp.x, sy: cp.y, orig: corig, cloneFrom: { x: o.x, y: o.y } }
      return
    }
    setSelIds(ids)
    pushHistory()
    const orig: Record<string, { x: number; y: number }> = {}
    for (const id of moveIds) {
      const t = objectsRef.current.find((x) => x.id === id)
      if (t) orig[id] = { x: t.x, y: t.y }
    }
    const p = toArt(e.clientX, e.clientY)
    dragRef.current = { mode: 'move', sx: p.x, sy: p.y, orig }
  }

  // Hover preview: highlight the top-most object under the cursor (solid blue for a
  // shape, dashed blue for a frame/group — like Figma) so structure is legible.
  const onStageHover = (e: React.PointerEvent): void => {
    if (dragRef.current || toolRef.current !== 'select' || editingRef.current || spaceRef.current) { if (hoverId) setHoverId(null); return }
    const p = toArt(e.clientX, e.clientY)
    let hit: string | null = null
    const objs = objectsRef.current
    for (let i = objs.length - 1; i >= 0; i--) {
      const ob = objs[i]
      if (!ob.visible || ob.locked) continue
      if (p.x >= ob.x && p.x <= ob.x + ob.w && p.y >= ob.y && p.y <= ob.y + ob.h) { hit = ob.id; break }
    }
    if (hit !== hoverId) setHoverId(hit)
  }

  const onHandleDown = (e: React.PointerEvent, o: FObj, handle: Handle): void => {
    e.stopPropagation()
    pushHistory()
    const p = toArt(e.clientX, e.clientY)
    dragRef.current = { mode: 'resize', id: o.id, handle, box: boxOf(o), sx: p.x, sy: p.y, rot: o.rotation, aspect: e.shiftKey }
  }
  const onRotateDown = (e: React.PointerEvent, o: FObj): void => {
    e.stopPropagation()
    pushHistory()
    const cx = o.x + o.w / 2
    const cy = o.y + o.h / 2
    const p = toArt(e.clientX, e.clientY)
    dragRef.current = { mode: 'rotate', id: o.id, cx, cy, start: Math.atan2(p.y - cy, p.x - cx), orig: o.rotation }
  }
  // Rotate a whole multi-selection around its bounding-box center.
  const onGroupRotateDown = (e: React.PointerEvent): void => {
    e.stopPropagation()
    const items = objectsRef.current.filter((o) => selRef.current.includes(o.id))
    if (items.length < 2) return
    const b = groupBounds(items.map(boxOf))
    if (!b) return
    pushHistory()
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    const p = toArt(e.clientX, e.clientY)
    const orig: Record<string, { x: number; y: number; w: number; h: number; rotation: number }> = {}
    for (const o of items) orig[o.id] = { x: o.x, y: o.y, w: o.w, h: o.h, rotation: o.rotation }
    dragRef.current = { mode: 'rotategroup', cx, cy, start: Math.atan2(p.y - cy, p.x - cx), orig }
  }
  // Scale a whole multi-selection from the opposite corner/edge.
  const onGroupHandleDown = (e: React.PointerEvent, handle: Handle): void => {
    e.stopPropagation()
    const items = objectsRef.current.filter((o) => selRef.current.includes(o.id))
    if (items.length < 2) return
    const b = groupBounds(items.map(boxOf))
    if (!b) return
    pushHistory()
    const orig: Record<string, { x: number; y: number; w: number; h: number }> = {}
    for (const o of items) orig[o.id] = { x: o.x, y: o.y, w: o.w, h: o.h }
    dragRef.current = { mode: 'resizegroup', handle, box: b, orig }
  }
  const onAbHandleDown = (e: React.PointerEvent, a: Artboard, handle: Handle): void => {
    e.stopPropagation()
    pushHistory()
    const p = toArt(e.clientX, e.clientY)
    dragRef.current = { mode: 'resizeab', id: a.id, handle, box: { x: a.x, y: a.y, w: a.w, h: a.h }, sx: p.x, sy: p.y }
  }
  // Click the artboard title to select it; drag it to move the artboard (and the
  // objects sitting inside it).
  const onAbLabelDown = (e: React.PointerEvent, a: Artboard): void => {
    e.stopPropagation()
    if (toolRef.current !== 'select') return
    setActiveAb(a.id); setSelIds([]); setAbSelected(true)
    pushHistory()
    const p = toArt(e.clientX, e.clientY)
    const objs: Record<string, { x: number; y: number }> = {}
    for (const o of objectsRef.current) {
      const cx = o.x + o.w / 2
      const cy = o.y + o.h / 2
      if (cx >= a.x && cx <= a.x + a.w && cy >= a.y && cy <= a.y + a.h) objs[o.id] = { x: o.x, y: o.y }
    }
    dragRef.current = { mode: 'moveab', id: a.id, sx: p.x, sy: p.y, ox: a.x, oy: a.y, objs }
  }

  // ── Global pointer move / up ─────────────────────────────────────────────────
  useEffect(() => {
    const move = (e: PointerEvent): void => {
      const d = dragRef.current
      if (!d) return
      if (d.mode === 'pan') {
        setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) })
        return
      }
      if (d.mode === 'createab') {
        const p = toArt(e.clientX, e.clientY)
        const b = normalizeBox({ x: d.sx, y: d.sy, w: p.x - d.sx, h: p.y - d.sy })
        setArtboards((as) => as.map((a) => (a.id === d.id ? { ...a, x: Math.round(b.x), y: Math.round(b.y), w: Math.max(1, Math.round(b.w)), h: Math.max(1, Math.round(b.h)) } : a)))
        return
      }
      if (d.mode === 'resizeab') {
        const p = toArt(e.clientX, e.clientY)
        const nb = resizeBox(d.box, d.handle, p.x - d.sx, p.y - d.sy, false, 20)
        setArtboards((as) => as.map((a) => (a.id === d.id ? { ...a, x: Math.round(nb.x), y: Math.round(nb.y), w: Math.max(20, Math.round(nb.w)), h: Math.max(20, Math.round(nb.h)) } : a)))
        return
      }
      if (d.mode === 'moveab') {
        const p = toArt(e.clientX, e.clientY)
        const dx = Math.round(p.x - d.sx)
        const dy = Math.round(p.y - d.sy)
        setArtboards((as) => as.map((a) => (a.id === d.id ? { ...a, x: d.ox + dx, y: d.oy + dy } : a)))
        if (Object.keys(d.objs).length) setObjects((os) => os.map((o) => (d.objs[o.id] ? { ...o, x: d.objs[o.id].x + dx, y: d.objs[o.id].y + dy } : o)))
        return
      }
      if (d.mode === 'mpath') {
        const o = objectsRef.current.find((x) => x.id === d.id)
        if (!o?.motion) return
        const p = toArt(e.clientX, e.clientY)
        let m = setKey({ ...o.motion }, 'x', d.t, Math.round(p.x - o.x - o.w / 2))
        m = setKey(m, 'y', d.t, Math.round(p.y - o.y - o.h / 2))
        patch(o.id, { motion: m })
        return
      }
      const p = toArt(e.clientX, e.clientY)
      if (d.mode === 'draw') {
        const pts = drawRef.current
        const last = pts[pts.length - 1]
        // skip near-duplicate points to keep the path light
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 1.5) {
          pts.push({ x: p.x, y: p.y })
          setDrawing(pts.slice())
        }
        return
      }
      if (d.mode === 'create') {
        const co = objectsRef.current.find((x) => x.id === d.id)
        if (co?.type === 'line' || co?.type === 'arrow') {
          // a line is a thin bar centered on the start→end midpoint, rotated to match
          const midX = (d.sx + p.x) / 2
          const midY = (d.sy + p.y) / 2
          const len = Math.hypot(p.x - d.sx, p.y - d.sy)
          const ang = (Math.atan2(p.y - d.sy, p.x - d.sx) * 180) / Math.PI
          patch(d.id, { x: Math.round(midX - len / 2), y: Math.round(midY - co.strokeWidth / 2), w: Math.max(1, Math.round(len)), h: co.strokeWidth, rotation: Math.round(ang) })
        } else {
          const b = normalizeBox({ x: d.sx, y: d.sy, w: p.x - d.sx, h: p.y - d.sy })
          patch(d.id, { x: Math.round(b.x), y: Math.round(b.y), w: Math.max(1, Math.round(b.w)), h: Math.max(1, Math.round(b.h)) })
        }
      } else if (d.mode === 'move') {
        let dx = p.x - d.sx
        let dy = p.y - d.sy
        const movingBoxes = Object.keys(d.orig).map((id) => {
          const ob = objectsRef.current.find((x) => x.id === id)!
          return { x: d.orig[id].x + dx, y: d.orig[id].y + dy, w: ob.w, h: ob.h }
        })
        const gb = groupBounds(movingBoxes)
        if (gb && movingBoxes.length) {
          const others = objectsRef.current.filter((o) => !d.orig[o.id]).map(boxOf)
          const ab = ownerArtboard(artboardsRef.current, gb)
          const snap = computeSnaps(gb, others, ab ? abBox(ab) : null, 6 / scaleRef.current)
          dx += snap.dx; dy += snap.dy
          setGuides(snap.guides)
        }
        setObjects((os) => os.map((o) => (d.orig[o.id] ? { ...o, x: Math.round(d.orig[o.id].x + dx), y: Math.round(d.orig[o.id].y + dy) } : o)))
      } else if (d.mode === 'resize') {
        let dx = p.x - d.sx
        let dy = p.y - d.sy
        if (d.rot) {
          const r = (-d.rot * Math.PI) / 180
          const c = Math.cos(r); const s = Math.sin(r)
          const ux = dx * c - dy * s
          const uy = dx * s + dy * c
          dx = ux; dy = uy
        }
        const nb = resizeBox(d.box, d.handle, dx, dy, d.aspect)
        patch(d.id, { x: Math.round(nb.x), y: Math.round(nb.y), w: Math.max(1, Math.round(nb.w)), h: Math.max(1, Math.round(nb.h)) })
      } else if (d.mode === 'rotate') {
        const ang = Math.atan2(p.y - d.cy, p.x - d.cx)
        let deg = d.orig + ((ang - d.start) * 180) / Math.PI
        if (e.shiftKey) deg = Math.round(deg / 15) * 15
        patch(d.id, { rotation: Math.round(deg) })
      } else if (d.mode === 'rotategroup') {
        const ang = Math.atan2(p.y - d.cy, p.x - d.cx)
        let dd = ((ang - d.start) * 180) / Math.PI
        if (e.shiftKey) dd = Math.round(dd / 15) * 15
        const rad = (dd * Math.PI) / 180
        const cos = Math.cos(rad); const sin = Math.sin(rad)
        setObjects((os) => os.map((o) => {
          const g = d.orig[o.id]
          if (!g) return o
          const ox = g.x + g.w / 2 - d.cx
          const oy = g.y + g.h / 2 - d.cy
          const nx = ox * cos - oy * sin + d.cx
          const ny = ox * sin + oy * cos + d.cy
          return { ...o, x: Math.round(nx - g.w / 2), y: Math.round(ny - g.h / 2), rotation: Math.round(g.rotation + dd) }
        }))
      } else if (d.mode === 'resizegroup') {
        const anchorX = d.handle.includes('w') ? d.box.x + d.box.w : d.box.x
        const anchorY = d.handle.includes('n') ? d.box.y + d.box.h : d.box.y
        const horiz = d.handle.includes('w') || d.handle.includes('e')
        const vert = d.handle.includes('n') || d.handle.includes('s')
        let sx = horiz ? (d.handle.includes('w') ? (anchorX - p.x) : (p.x - anchorX)) / d.box.w : 1
        let sy = vert ? (d.handle.includes('n') ? (anchorY - p.y) : (p.y - anchorY)) / d.box.h : 1
        // corner drag scales uniformly to preserve aspect
        if (horiz && vert) { const s = Math.max(Math.abs(sx), Math.abs(sy)); sx = s; sy = s }
        sx = Math.max(0.05, sx); sy = Math.max(0.05, sy)
        setObjects((os) => os.map((o) => {
          const g = d.orig[o.id]
          if (!g) return o
          return {
            ...o,
            x: Math.round(anchorX + (g.x - anchorX) * sx),
            y: Math.round(anchorY + (g.y - anchorY) * sy),
            w: Math.max(1, Math.round(g.w * sx)),
            h: Math.max(1, Math.round(g.h * sy)),
          }
        }))
      } else if (d.mode === 'marquee') {
        const b = normalizeBox({ x: d.sx, y: d.sy, w: p.x - d.sx, h: p.y - d.sy })
        setMarquee(b)
        const hit = objectsRef.current.filter((o) => o.visible && !o.locked && boxesIntersect(b, boxOf(o))).map((o) => o.id)
        setSelIds(hit)
      }
    }
    const up = (): void => {
      const d = dragRef.current
      if (d?.mode === 'draw') {
        const pts = drawRef.current
        const res = pathFromPoints(pts, 2)
        if (res) {
          pushHistory()
          const o = makeObject('path', Math.round(res.x), Math.round(res.y))
          o.w = Math.round(res.w)
          o.h = Math.round(res.h)
          o.path = res.d
          setObjects((os) => [...os, o])
          setSelIds([o.id])
        }
        drawRef.current = []
        setDrawing(null)
        dragRef.current = null
        return
      }
      // Auto-keyframe: when the stopwatch is on and the timeline is scrubbed past
      // the start, record canvas moves/rotations as keyframes (animating from the
      // object's home value at t0) instead of permanently shifting the object.
      if (d && autoKeyRef.current && timelineOpenRef.current && playheadRef.current > 0) {
        const ph = playheadRef.current
        const dur = motionDurRef.current
        if (d.mode === 'move') {
          for (const id of Object.keys(d.orig)) {
            const o = objectsRef.current.find((x) => x.id === id)
            if (!o) continue
            const dx = o.x - d.orig[id].x
            const dy = o.y - d.orig[id].y
            if (dx === 0 && dy === 0) continue
            let m: LayerMotion = { ...(o.motion ?? emptyMotion(dur)), duration: dur }
            if (!m.tracks.x?.length) m = setKey(m, 'x', 0, 0)
            if (!m.tracks.y?.length) m = setKey(m, 'y', 0, 0)
            const offX = sampleTrack(m.tracks.x, ph, 0) + dx
            const offY = sampleTrack(m.tracks.y, ph, 0) + dy
            m = setKey(m, 'x', ph, Math.round(offX))
            m = setKey(m, 'y', ph, Math.round(offY))
            patch(id, { x: d.orig[id].x, y: d.orig[id].y, motion: m })
          }
          dragRef.current = null
          setGuides([])
          return
        }
        if (d.mode === 'rotate') {
          const o = objectsRef.current.find((x) => x.id === d.id)
          if (o && o.rotation !== d.orig) {
            let m: LayerMotion = { ...(o.motion ?? emptyMotion(dur)), duration: dur }
            if (!m.tracks.rotate?.length) m = setKey(m, 'rotate', 0, d.orig)
            m = setKey(m, 'rotate', ph, o.rotation)
            patch(d.id, { rotation: d.orig, motion: m })
          }
          dragRef.current = null
          return
        }
      }
      if (d?.mode === 'create') {
        const o = objectsRef.current.find((x) => x.id === d.id)
        if (o && o.w < 3 && o.h < 3) {
          // a click without a drag → give it a sensible default size
          const isLine = o.type === 'line' || o.type === 'arrow'
          patch(d.id, { w: isLine ? 160 : 120, h: isLine ? o.h : 120 })
        }
        setTool('select')
      }
      if (d?.mode === 'createab') {
        const a = artboardsRef.current.find((x) => x.id === d.id)
        if (a && a.w < 8 && a.h < 8) setArtboards((as) => as.map((x) => (x.id === d.id ? { ...x, w: 800, h: 600 } : x)))
        setTool('select')
      }
      dragRef.current = null
      setMarquee(null)
      setGuides([])
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [toArt, pushHistory])

  // ── Z-order / duplicate / clipboard / delete ─────────────────────────────────
  const arrange = (dir: 'front' | 'back' | 'forward' | 'backward'): void => {
    const ids = selRef.current
    if (!ids.length) return
    pushHistory()
    setObjects((os) => {
      const arr = os.slice()
      const picked = arr.filter((o) => ids.includes(o.id))
      const rest = arr.filter((o) => !ids.includes(o.id))
      if (dir === 'front') return [...rest, ...picked]
      if (dir === 'back') return [...picked, ...rest]
      const out = arr.slice()
      if (dir === 'forward') {
        for (let i = out.length - 2; i >= 0; i--) if (ids.includes(out[i].id) && !ids.includes(out[i + 1].id)) { const t = out[i]; out[i] = out[i + 1]; out[i + 1] = t }
      } else {
        for (let i = 1; i < out.length; i++) if (ids.includes(out[i].id) && !ids.includes(out[i - 1].id)) { const t = out[i]; out[i] = out[i - 1]; out[i - 1] = t }
      }
      return out
    })
  }
  const duplicate = (): void => {
    const ids = selRef.current
    if (!ids.length) return
    pushHistory()
    const copies = objectsRef.current.filter((o) => ids.includes(o.id)).map((o) => ({ ...o, id: makeObject(o.type, 0, 0).id, name: `${o.name} copy`, x: o.x + 16, y: o.y + 16 }))
    setObjects((os) => [...os, ...copies])
    setSelIds(copies.map((c) => c.id))
  }
  const copy = (): void => { clipRef.current = objectsRef.current.filter((o) => selRef.current.includes(o.id)).map((o) => ({ ...o })) }
  const paste = (): void => {
    if (!clipRef.current.length) return
    pushHistory()
    const copies = clipRef.current.map((o) => ({ ...o, id: makeObject(o.type, 0, 0).id, x: o.x + 24, y: o.y + 24 }))
    setObjects((os) => [...os, ...copies])
    setSelIds(copies.map((c) => c.id))
  }

  /** Paste over the selection instead of beside it: the copies land on the
   * selection's top-left corner, so one layer can be swapped for another. */
  const pasteOnTop = (): void => {
    if (!clipRef.current.length) return
    const target = objectsRef.current.filter((o) => selRef.current.includes(o.id))
    const anchor = target.length ? { x: Math.min(...target.map((o) => o.x)), y: Math.min(...target.map((o) => o.y)) } : null
    const src = { x: Math.min(...clipRef.current.map((o) => o.x)), y: Math.min(...clipRef.current.map((o) => o.y)) }
    pushHistory()
    const dx = anchor ? anchor.x - src.x : 0
    const dy = anchor ? anchor.y - src.y : 0
    const copies = clipRef.current.map((o) => ({ ...o, id: makeObject(o.type, 0, 0).id, x: o.x + dx, y: o.y + dy }))
    setObjects((os) => [...os, ...copies])
    setSelIds(copies.map((c) => c.id))
  }

  /** Paste on top and delete what was under it. */
  const pasteToReplace = (): void => {
    if (!clipRef.current.length || !selRef.current.length) return
    const gone = selRef.current
    const target = objectsRef.current.filter((o) => gone.includes(o.id))
    const anchor = { x: Math.min(...target.map((o) => o.x)), y: Math.min(...target.map((o) => o.y)) }
    const src = { x: Math.min(...clipRef.current.map((o) => o.x)), y: Math.min(...clipRef.current.map((o) => o.y)) }
    pushHistory()
    const copies = clipRef.current.map((o) => ({ ...o, id: makeObject(o.type, 0, 0).id, x: o.x + anchor.x - src.x, y: o.y + anchor.y - src.y }))
    setObjects((os) => [...os.filter((o) => !gone.includes(o.id)), ...copies])
    setSelIds(copies.map((c) => c.id))
  }

  // Copy/paste styles: the look of a layer without its box or its place.
  const styleClipRef = useRef<Partial<FObj> | null>(null)
  const STYLE_KEYS = [
    'fill', 'fillEnabled', 'fillHidden', 'fillMode', 'fillOpacity', 'fillImage',
    'gradientFrom', 'gradientTo', 'gradientAngle', 'gradientType', 'gradientStops', 'gradientInterpolation',
    'stroke', 'strokeWidth', 'strokeEnabled', 'strokeHidden', 'strokeOffset', 'strokeStyle', 'strokeMode', 'strokeOpacity',
    'borderEnabled', 'borderHidden', 'borderWidth', 'borderColor', 'borderOpacity', 'borderSides', 'borderStyle', 'borderMode',
    'radius', 'opacity', 'blendMode', 'effects', 'filters',
    'color', 'fontSize', 'fontFamily', 'fontWeight', 'italic', 'underline', 'align', 'lineHeight', 'letterSpacing'
  ] as const
  const copyStyles = (): void => {
    const o = objectsRef.current.find((x) => x.id === selRef.current[0])
    if (!o) return
    const picked: Record<string, unknown> = {}
    for (const k of STYLE_KEYS) if (o[k] !== undefined) picked[k] = o[k]
    styleClipRef.current = picked as Partial<FObj>
    setStatus('Styles copied')
    setTimeout(() => setStatus(''), 1500)
  }
  const pasteStyles = (): void => {
    const s = styleClipRef.current
    if (!s || !selRef.current.length) return
    const ids = selRef.current
    pushHistory()
    setObjects((os) => os.map((o) => (ids.includes(o.id) ? { ...o, ...s } : o)))
  }

  /** Select the frame this layer sits in, or the layers sitting in it. */
  const selectParent = (): void => {
    const o = objectsRef.current.find((x) => x.id === selRef.current[0])
    if (o?.parent) setSelIds([o.parent])
  }
  const selectChildren = (): void => {
    const ids = selRef.current
    const kids = objectsRef.current.filter((o) => o.parent && ids.includes(o.parent)).map((o) => o.id)
    if (kids.length) setSelIds(kids)
  }

  /** Every layer whose box covers this point, topmost first. */
  const layersUnder = (clientX: number, clientY: number): FObj[] => {
    const p = toArt(clientX, clientY)
    return objectsRef.current
      .filter((o) => o.visible && p.x >= o.x && p.x <= o.x + o.w && p.y >= o.y && p.y <= o.y + o.h)
      .reverse()
  }

  const writeClipboard = (text: string, said: string): void => {
    const say = (ok: boolean): void => { setStatus(ok ? said : 'Clipboard blocked'); setTimeout(() => setStatus(''), 1800) }
    const api = (window as { terminal42?: { canvas?: { writeClipboardText?: (t: string) => Promise<boolean> } } }).terminal42?.canvas?.writeClipboardText
    if (api) { void api(text).then(say, () => say(false)); return }
    void navigator.clipboard.writeText(text).then(() => say(true), () => say(false))
  }
  const copyAsTailwind = (): void => {
    const o = objectsRef.current.find((x) => x.id === selRef.current[0])
    if (o) writeClipboard(toTailwind(o), 'Tailwind copied')
  }
  const copyAsReactCss = (): void => {
    const o = objectsRef.current.find((x) => x.id === selRef.current[0])
    if (o) writeClipboard(toReactCss(o), 'React CSS copied')
  }
  /** A link that reopens this design with the layer selected. */
  const copyLink = (): void => {
    const id = selRef.current[0]
    if (id) writeClipboard(`terminal42://design/${designId}?layer=${id}`, 'Link copied')
  }
  /** Put the layer on the clipboard as a picture. */
  const copyAsPng = (): void => {
    const ids = selRef.current
    if (!ids.length) return
    const wanted = new Set(ids)
    let grew = true
    while (grew) {
      grew = false
      for (const o of objectsRef.current) if (o.parent && wanted.has(o.parent) && !wanted.has(o.id)) { wanted.add(o.id); grew = true }
    }
    const picked = objectsRef.current.filter((o) => wanted.has(o.id) && o.visible)
    if (!picked.length) return
    const minX = Math.min(...picked.map((o) => o.x))
    const minY = Math.min(...picked.map((o) => o.y))
    const w = Math.max(1, Math.round(Math.max(...picked.map((o) => o.x + o.w)) - minX))
    const h = Math.max(1, Math.round(Math.max(...picked.map((o) => o.y + o.h)) - minY))
    const svg = composeArtboardSvg({ w, h, bg: 'transparent' }, picked.map((o) => ({ ...o, x: o.x - minX, y: o.y - minY })))
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const say = (ok: boolean): void => { setStatus(ok ? 'PNG copied' : 'Clipboard blocked'); setTimeout(() => setStatus(''), 1800) }
      const api = (window as { terminal42?: { canvas?: { writeClipboardImage?: (d: string) => Promise<boolean> } } }).terminal42?.canvas?.writeClipboardImage
      if (api) { void api(c.toDataURL('image/png')).then(say, () => say(false)); return }
      c.toBlob((b) => {
        if (!b) { say(false); return }
        if (!navigator.clipboard.write) { say(false); return }
        void navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(() => say(true), () => say(false))
      }, 'image/png')
    }
    img.onerror = () => setStatus('Copy as PNG failed')
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }

  const removeSel = (): void => {
    if (!selRef.current.length) return
    pushHistory()
    const ids = selRef.current
    setObjects((os) => os.filter((o) => !ids.includes(o.id)))
    setSelIds([])
  }
  const groupSelection = (mode: 'none' | 'horizontal' | 'vertical' = 'none'): void => {
    const ids = selRef.current
    const picked = objectsRef.current.filter((o) => ids.includes(o.id))
    if (picked.length < 2) return
    const baseBounds = groupBounds(picked.map(boxOf))
    if (!baseBounds) return
    pushHistory()
    const pad = mode === 'none' ? 12 : 16
    const gap = 12
    let frame = makeObject('frame', Math.round(baseBounds.x - pad), Math.round(baseBounds.y - pad))
    frame = {
      ...frame,
      name: mode === 'none' ? 'Group' : 'Flow',
      w: Math.round(baseBounds.w + pad * 2),
      h: Math.round(baseBounds.h + pad * 2),
      fillEnabled: false,
      strokeEnabled: false,
      radius: 8,
      layoutMode: mode,
      layoutGap: gap,
      layoutPadding: pad,
      layoutPadX: pad,
      layoutPadY: pad,
      widthMode: mode === 'none' ? 'fixed' : 'fit',
      heightMode: mode === 'none' ? 'fixed' : 'fit',
    }
    const ordered = picked.slice().sort((a, b) => mode === 'vertical' ? a.y - b.y : a.x - b.x)
    let cursor = mode === 'vertical' ? frame.y + pad : frame.x + pad
    const placed = new Map<string, Partial<FObj>>()
    if (mode !== 'none') {
      for (const o of ordered) {
        if (mode === 'horizontal') {
          placed.set(o.id, { x: Math.round(cursor), y: Math.round(frame.y + pad), parent: frame.id })
          cursor += o.w + gap
        } else {
          placed.set(o.id, { x: Math.round(frame.x + pad), y: Math.round(cursor), parent: frame.id })
          cursor += o.h + gap
        }
      }
      if (mode === 'horizontal') {
        frame.w = Math.round(ordered.reduce((n, o) => n + o.w, 0) + Math.max(0, ordered.length - 1) * gap + pad * 2)
        frame.h = Math.round(Math.max(...ordered.map((o) => o.h)) + pad * 2)
      } else {
        frame.w = Math.round(Math.max(...ordered.map((o) => o.w)) + pad * 2)
        frame.h = Math.round(ordered.reduce((n, o) => n + o.h, 0) + Math.max(0, ordered.length - 1) * gap + pad * 2)
      }
    }
    setObjects((os) => [
      ...os.map((o) => ids.includes(o.id) ? { ...o, parent: frame.id, ...(placed.get(o.id) ?? {}) } : o),
      frame,
    ])
    setSelIds([frame.id])
  }

  /** Figma "Wrap in flex" (⇧A): multi-select → group into an auto-layout frame;
   * a single frame → toggle auto-layout on; a single shape → wrap it in one. */
  const wrapInFlex = (): void => {
    const ids = selRef.current
    if (ids.length > 1) { groupSelection('horizontal'); return }
    if (ids.length !== 1) return
    const o = objectsRef.current.find((x) => x.id === ids[0])
    if (!o) return
    if (o.type === 'frame') {
      pushHistory()
      patch(o.id, {
        layoutMode: o.layoutMode && o.layoutMode !== 'none' ? o.layoutMode : 'horizontal',
        layoutGap: o.layoutGap ?? 12,
        layoutPadX: o.layoutPadX ?? o.layoutPadding ?? 16,
        layoutPadY: o.layoutPadY ?? o.layoutPadding ?? 16,
      })
      return
    }
    pushHistory()
    const pad = 16
    const frame: FObj = {
      ...makeObject('frame', Math.round(o.x - pad), Math.round(o.y - pad)),
      name: 'Flow', w: Math.round(o.w + pad * 2), h: Math.round(o.h + pad * 2),
      fillEnabled: false, strokeEnabled: false, radius: 8,
      layoutMode: 'horizontal', layoutGap: 12, layoutPadX: pad, layoutPadY: pad, widthMode: 'fit', heightMode: 'fit',
    }
    setObjects((os) => [...os.map((x) => x.id === o.id ? { ...x, parent: frame.id } : x), frame])
    setSelIds([frame.id])
  }

  // ── Layer panel actions ──────────────────────────────────────────────────────
  const startRename = (o: FObj): void => { setLayerMenu(null); setRenamingId(o.id); setRenameVal(o.name) }
  const commitRename = (): void => {
    if (!renamingId) return
    const v = renameVal.trim()
    if (v) { pushHistory(); patch(renamingId, { name: v }) }
    setRenamingId(null)
  }
  const moveLayer = (id: string, dir: 'up' | 'down' | 'top' | 'bottom'): void => {
    pushHistory()
    setObjects((os) => {
      const arr = os.slice()
      const i = arr.findIndex((o) => o.id === id)
      if (i < 0) return os
      const [item] = arr.splice(i, 1)
      if (dir === 'up') arr.splice(Math.min(arr.length, i + 1), 0, item)
      else if (dir === 'down') arr.splice(Math.max(0, i - 1), 0, item)
      else if (dir === 'top') arr.push(item)
      else arr.unshift(item)
      return arr
    })
  }
  const reorderLayer = (dragId: string, targetId: string): void => {
    if (dragId === targetId) return
    pushHistory()
    setObjects((os) => {
      const arr = os.slice()
      const from = arr.findIndex((o) => o.id === dragId)
      if (from < 0) return os
      const [item] = arr.splice(from, 1)
      const to = arr.findIndex((o) => o.id === targetId)
      if (to < 0) return os
      arr.splice(to, 0, item)
      return arr
    })
  }
  // Operate on a single layer (right-clicked) without disturbing the selection.
  const duplicateId = (id: string): void => {
    pushHistory()
    const src = objectsRef.current.find((o) => o.id === id)
    if (!src) return
    const dupe = { ...src, id: makeObject(src.type, 0, 0).id, name: `${src.name} copy`, x: src.x + 16, y: src.y + 16 }
    setObjects((os) => [...os, dupe])
    setSelIds([dupe.id])
  }
  const copyId = (id: string): void => { const o = objectsRef.current.find((x) => x.id === id); if (o) clipRef.current = [{ ...o }] }
  const deleteId = (id: string): void => { pushHistory(); setObjects((os) => os.filter((o) => o.id !== id)); setSelIds((s) => s.filter((x) => x !== id)) }

  // ── Canvas assistant (AI) bridge ─────────────────────────────────────────────
  const activeDs = useMemo(() => designSystems.find((s) => s.id === activeDsId) ?? designSystems[0] ?? null, [activeDsId, designSystems])
  // Derive a component Kit from the active DS so kit screens render on-brand (and
  // dark when the DS is dark). Mirrored into a ref for the stable create callback.
  const assistantKit = useMemo<Kit>(() => (activeDs ? kitFromDesignSystem(activeDs) : DEFAULT_KIT), [activeDs])
  const assistantKitRef = useRef(assistantKit)
  useEffect(() => { assistantKitRef.current = assistantKit }, [assistantKit])

  const assistantContext = useCallback((): CanvasContext => {
    const ab = artboardsRef.current.find((a) => a.id === activeAbRef.current) ?? artboardsRef.current[0]
    return {
      artboard: { w: ab?.w ?? 1280, h: ab?.h ?? 800, bg: ab?.bg ?? '#ffffff' },
      layers: objectsRef.current.slice().reverse().map((o) => ({ name: o.name, type: o.type })),
      selection: objectsRef.current.filter((o) => selRef.current.includes(o.id)).map((o) => o.name),
      designSystem: activeDs ? designSystemSummary(activeDs) : undefined,
    }
  }, [activeDs])
  // ── AI-generated designs get a real design system ────────────────────────────
  // Every generation upserts a single "Theme" collection mirroring the palette the
  // generator used, then binds each object's colour fields to those variables. This
  // is why the Variables tab fills in after a generation and why editing a token
  // (e.g. Accent) live-recolours the whole design. Ids are preserved across
  // regenerations so existing bindings keep resolving.
  const ensureTheme = useCallback((kit: Kit, objs: FObj[]): { roleVarId: Map<string, string>; nums: NumberMaps } => {
    const roles = themeColorRoles(kit)
    const darkByName = new Map(themeColorRolesDark(kit).map((r) => [r.name, r.hex]))
    const nums = numberTokens(objs)
    const cols = [...collectionsRef.current]
    let ci = cols.findIndex((c) => c.name === 'Theme')
    if (ci === -1) {
      // Seed a fresh Theme with Light + Dark modes so generated designs are
      // mode-switchable end to end (toggle via the collection's mode selector).
      const light: VarMode = { id: newModeId(), name: 'Light' }
      const dark: VarMode = { id: newModeId(), name: 'Dark' }
      cols.push({ id: newCollectionId(), name: 'Theme', modes: [light, dark], activeMode: light.id, variables: [] })
      ci = cols.length - 1
    }
    let col = cols[ci]
    // Upgrade an older single-mode Theme in place: name it "Light" and add "Dark".
    if (col.modes.length < 2) {
      const first = col.modes[0] ?? { id: newModeId(), name: 'Light' }
      const dark: VarMode = { id: newModeId(), name: 'Dark' }
      col = { ...col, modes: [{ ...first, name: 'Light' }, dark] }
    }
    const lightId = col.modes[0].id
    const darkId = col.modes[1].id
    const vars = [...col.variables]
    // Upsert a variable by name+type: always refresh the Light value; only seed the
    // Dark value when it's missing so user edits to Dark survive regenerations. The
    // id is stable so existing bindings keep resolving.
    const upsert = (name: string, type: 'color' | 'number', light: string | number, dark: string | number, scopes?: VarScope[]): string => {
      const idx = vars.findIndex((x) => x.name === name && x.type === type)
      if (idx >= 0) {
        const cur = vars[idx]
        const values = { ...cur.values, [lightId]: light }
        if (values[darkId] === undefined) values[darkId] = dark
        vars[idx] = { ...cur, values }
        return cur.id
      }
      const v = makeVariable(type, name, col.modes)
      v.values = { ...v.values, [lightId]: light, [darkId]: dark }
      if (scopes) v.scopes = scopes
      vars.push(v)
      return v.id
    }
    const roleVarId = new Map<string, string>()
    for (const { name, hex } of roles) roleVarId.set(name, upsert(name, 'color', hex, darkByName.get(name) ?? hex, ['fillColor', 'strokeColor', 'textColor', 'effectColor']))
    const radius = new Map<number, string>()
    for (const t of nums.radius) radius.set(t.value, upsert(t.name, 'number', t.value, t.value, ['cornerRadius']))
    const fontSize = new Map<number, string>()
    for (const t of nums.fontSize) fontSize.set(t.value, upsert(t.name, 'number', t.value, t.value, ['typography']))
    cols[ci] = { ...col, variables: vars }
    collectionsRef.current = cols
    setCollections(cols)
    return { roleVarId, nums: { radius, fontSize } }
  }, [])
  const assistantCreate = useCallback((rawSpecs: ObjectSpec[], opts?: { accent?: string }): void => {
    const ab = artboardsRef.current.find((a) => a.id === activeAbRef.current) ?? artboardsRef.current[0]
    if (!ab || !rawSpecs.length) return
    pushHistory()
    // Expand any named UI-kit components into their polished primitive trees first,
    // using the active design system's tokens (on-brand / dark mode when set).
    const kit = assistantKitRef.current
    const specs = expandComponents(rawSpecs, kit)
    const built = specs.map((s) => buildObject(s, ab.x, ab.y))
    // Resolve grouping: the AI parents children by a sibling's `ref` (or by an
    // existing layer name); remap those to the real generated ids so frames
    // actually contain their children instead of everything landing flat.
    const refToId = new Map<string, string>()
    specs.forEach((s, i) => { if (s.ref) refToId.set(s.ref.toLowerCase(), built[i].id) })
    const existing = new Map(objectsRef.current.map((o) => [o.name.toLowerCase(), o.id]))
    built.forEach((b, i) => {
      const p = specs[i].parent
      if (typeof p === 'string' && p.trim()) {
        const id = refToId.get(p.toLowerCase()) ?? existing.get(p.toLowerCase())
        b.parent = id && id !== b.id ? id : undefined
      }
    })
    // DS components are emitted as a root frame/shape followed by children. Parent
    // children to that root so inserted components behave like a Figma instance.
    if (built.length > 1 && built[0].componentName) {
      for (let i = 1; i < built.length; i++) built[i] = { ...built[i], parent: built[0].id }
    }
    // Deterministic QA gate (ALWAYS runs on every generated/inserted object set):
    // on-grid geometry, tidy radius/type, readable contrast, no container outlines,
    // and a non-grey primary action. The accent comes from the active design system,
    // else the kit default.
    const accent = kit.accent
    const linted = lintObjects(built, { artboardBg: ab.bg, accent })
    // Populate the Variables tab from the palette this generation used, and bind
    // every generated object's colour fields to those tokens so the design is
    // driven by a real design system (editing a token recolours the canvas).
    const ekit: Kit = opts?.accent
      ? { ...kit, accent: vibrantAccent(opts.accent) }
      : kit
    const roleVarIdResult = ensureTheme(ekit, linted)
    const maps = buildFieldMaps(ekit, roleVarIdResult.roleVarId)
    const bound = roleVarIdResult.roleVarId.size
      ? linted.map((b) => bindObjectToTokens(b, maps, roleVarIdResult.nums))
      : linted
    setObjects((os) => [...os, ...bound])
    setSelIds(bound.length > 1 && bound[0].componentName ? [bound[0].id] : bound.map((b) => b.id))
  }, [pushHistory, ensureTheme])
  const assistantArtboard = useCallback((w: number, h: number, name?: string): void => {
    // Reuse the active artboard if it's empty (e.g. the fresh board created for this
    // generation) — resize + rename it in place instead of stacking a duplicate.
    const active = artboardsRef.current.find((a) => a.id === activeAbRef.current)
    const activeEmpty = active && !objectsRef.current.some((o) => o.x + o.w > active.x && o.x < active.x + active.w && o.y + o.h > active.y && o.y < active.y + active.h)
    if (active && activeEmpty) {
      pushHistory()
      patchAb(active.id, { w: Math.max(120, w), h: Math.max(120, h), ...(name ? { name } : {}) })
      setAbSelected(true)
      setTimeout(fit, 30)
      return
    }
    pushHistory()
    const existing = artboardsRef.current
    const x = existing.length ? Math.max(...existing.map((a) => a.x + a.w)) + 80 : 0
    const id = newArtboardId()
    const ab: Artboard = { id, name: name || `Artboard ${existing.length + 1}`, x, y: 0, w: Math.max(120, w), h: Math.max(120, h), bg: '#ffffff' }
    artboardsRef.current = [...existing, ab]
    setArtboards((a) => [...a, ab])
    activeAbRef.current = id
    setActiveAb(id); setSelIds([]); setAbSelected(true)
    setTimeout(fit, 30)
  }, [pushHistory])
  // Let the assistant name the artboard after the app/screen it built (only overwrites
  // a default/placeholder name, never the user's own).
  const renameActiveArtboard = useCallback((name: string): void => {
    const nm = (name || '').trim()
    if (!nm) return
    const id = activeAbRef.current
    const ab = artboardsRef.current.find((a) => a.id === id)
    if (!ab) return
    if (/^(artboard \d+|untitled.*|phone|desktop|tablet|screen|frame|new design|option \d+)$/i.test(ab.name.trim())) patchAb(id, { name: nm })
  }, [])
  const insertDsComponent = useCallback((name: CanvasComponentName): void => {
    if (!activeDs) return
    assistantCreate(componentToObjects(activeDs, name, 80, 80))
    setStatus(`Inserted ${name} from ${activeDs.name}`)
  }, [activeDs, assistantCreate])
  const resolveTarget = useCallback((target: string | undefined): string | undefined => {
    const objs = objectsRef.current
    let id: string | undefined
    if (target && target !== 'selected' && target !== 'last') {
      id = objs.find((o) => o.name.toLowerCase() === target.toLowerCase())?.id ?? objs.find((o) => o.name.toLowerCase().includes(target.toLowerCase()))?.id
    }
    if (!id && (target === 'selected' || !target) && selRef.current.length) id = selRef.current[0]
    if (!id) id = objs[objs.length - 1]?.id
    return id
  }, [])
  const assistantAnimate = useCallback((target: string | undefined, motion: LayerMotion): void => {
    const id = resolveTarget(target)
    if (!id) return
    pushHistory()
    patch(id, { motion })
    setSelIds([id])
    setMotionDur(motion.duration)
    setTimelineOpen(true)
  }, [pushHistory, resolveTarget])
  const assistantEdit = useCallback((target: string, patchSpec: Partial<ObjectSpec>): void => {
    const id = resolveTarget(target)
    if (!id) return
    const p = sanitizeObjectPatch(patchSpec)
    const o = objectsRef.current.find((x) => x.id === id)
    const ab = (o ? artboardAt(artboardsRef.current, o.x + o.w / 2, o.y + o.h / 2) : null) ?? artboardsRef.current.find((a) => a.id === activeAbRef.current)
    // x/y come in artboard-local — add the object's artboard offset
    if (p.x !== undefined || p.y !== undefined) {
      if (ab) { if (p.x !== undefined) p.x = ab.x + p.x; if (p.y !== undefined) p.y = ab.y + p.y }
    }
    pushHistory()
    patch(id, p)
    // The QA gate runs on the AI EDIT path too (not just create): lock every other
    // object and lint only the edited one, so it gets the same grid/contrast/icon/
    // placement guarantees. Idempotent for already-clean objects.
    setObjects((os) => lintObjects(os, { artboardBg: ab?.bg, accent: assistantKitRef.current.accent, locked: (oid) => oid !== id }))
    setSelIds([id])
  }, [pushHistory, resolveTarget])
  const assistantDelete = useCallback((target: string): void => {
    const id = resolveTarget(target)
    if (!id) return
    pushHistory()
    setObjects((os) => os.filter((o) => o.id !== id))
    setSelIds((s) => s.filter((x) => x !== id))
  }, [pushHistory, resolveTarget])

  const doAlign = (mode: AlignMode): void => {
    const ids = selRef.current
    // single object: align within its artboard (Figma-style align-to-frame)
    if (ids.length === 1) {
      const o = objectsRef.current.find((x) => x.id === ids[0])
      if (!o) return
      const ab = artboardAt(artboardsRef.current, o.x + o.w / 2, o.y + o.h / 2) ?? artboardsRef.current.find((a) => a.id === activeAbRef.current)
      if (!ab) return
      pushHistory()
      let nx = o.x, ny = o.y
      if (mode === 'left') nx = ab.x
      else if (mode === 'center-h') nx = ab.x + (ab.w - o.w) / 2
      else if (mode === 'right') nx = ab.x + ab.w - o.w
      else if (mode === 'top') ny = ab.y
      else if (mode === 'middle-v') ny = ab.y + (ab.h - o.h) / 2
      else if (mode === 'bottom') ny = ab.y + ab.h - o.h
      setObjects((os) => os.map((x) => (x.id === o.id ? { ...x, x: Math.round(nx), y: Math.round(ny) } : x)))
      return
    }
    if (ids.length < 2) return
    pushHistory()
    const boxes = objectsRef.current.filter((o) => ids.includes(o.id)).map(boxOf)
    const aligned = alignBoxes(boxes, mode)
    const map = new Map(ids.map((id, i) => [id, aligned[i]]))
    setObjects((os) => os.map((o) => (map.has(o.id) ? { ...o, x: Math.round(map.get(o.id)!.x), y: Math.round(map.get(o.id)!.y) } : o)))
  }
  const doDistribute = (axis: 'h' | 'v'): void => {
    const ids = selRef.current
    if (ids.length < 3) return
    pushHistory()
    const picked = objectsRef.current.filter((o) => ids.includes(o.id))
    const boxes = picked.map(boxOf)
    const out = distributeBoxes(boxes, axis)
    const map = new Map(picked.map((o, i) => [o.id, out[i]]))
    setObjects((os) => os.map((o) => (map.has(o.id) ? { ...o, x: Math.round(map.get(o.id)!.x), y: Math.round(map.get(o.id)!.y) } : o)))
  }

  /** Figma's "Resize to fill": grow each selected layer to its parent frame's
   * content box, or to the artboard it sits on when it has no parent frame. */
  const doResizeToFill = (): void => {
    const ids = selRef.current
    if (!ids.length) return
    const all = objectsRef.current
    const targets = new Map<string, Box>()
    for (const id of ids) {
      const o = all.find((x) => x.id === id)
      if (!o) continue
      const parent = o.parent ? all.find((p) => p.id === o.parent) : null
      if (parent) {
        const padX = parent.layoutPadX ?? parent.layoutPadding ?? 0
        const padY = parent.layoutPadY ?? parent.layoutPadding ?? 0
        targets.set(id, { x: parent.x + padX, y: parent.y + padY, w: Math.max(1, parent.w - padX * 2), h: Math.max(1, parent.h - padY * 2) })
        continue
      }
      const ab = artboardAt(artboardsRef.current, o.x + o.w / 2, o.y + o.h / 2) ?? artboardsRef.current.find((a) => a.id === activeAbRef.current)
      if (ab) targets.set(id, { x: ab.x, y: ab.y, w: ab.w, h: ab.h })
    }
    if (!targets.size) return
    pushHistory()
    setObjects((os) => os.map((o) => {
      const t = targets.get(o.id)
      if (!t) return o
      return { ...o, x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.w), h: Math.round(t.h), widthMode: 'fixed', heightMode: 'fixed' }
    }))
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    const isField = (el: EventTarget | null): boolean => {
      const n = el as HTMLElement | null
      return !!n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable)
    }
    const down = (e: KeyboardEvent): void => {
      if (e.key === ' ' && !timelineOpenRef.current) { spaceRef.current = true }
      if (isField(e.target)) return
      const meta = e.metaKey || e.ctrlKey
      const k = e.key.toLowerCase()
      // Layout menu shortcuts: distribute (^⌥V / ^⌥H) and resize to fill (⌥⇧⌘F).
      // Option-key combos change e.key on macOS, so match the physical key.
      if (e.ctrlKey && e.altKey && !e.metaKey && (e.code === 'KeyV' || e.code === 'KeyH')) { e.preventDefault(); doDistribute(e.code === 'KeyV' ? 'v' : 'h'); return }
      if (e.metaKey && e.altKey && e.shiftKey && e.code === 'KeyF') { e.preventDefault(); doResizeToFill(); return }
      if (meta && e.shiftKey && e.code === 'KeyE' && selRef.current.length) { e.preventDefault(); exportSelection('png', 1); return }
      // Context menu shortcuts. Option combos change e.key on macOS, so match the physical key.
      if (meta && e.shiftKey && e.code === 'KeyC') { e.preventDefault(); copyAsPng(); return }
      if (e.altKey && !meta && !e.shiftKey && e.code === 'KeyT' && selRef.current.length) { e.preventDefault(); copyAsTailwind(); return }
      if (e.altKey && !meta && !e.shiftKey && e.code === 'KeyR' && selRef.current.length) { e.preventDefault(); copyAsReactCss(); return }
      if (meta && e.altKey && e.code === 'KeyC') { e.preventDefault(); copyStyles(); return }
      if (meta && e.altKey && e.code === 'KeyV') { e.preventDefault(); pasteStyles(); return }
      if (meta && e.shiftKey && e.code === 'KeyV') { e.preventDefault(); pasteOnTop(); return }
      if (meta && e.shiftKey && e.code === 'KeyR') { e.preventDefault(); pasteToReplace(); return }
      if (meta && e.shiftKey && e.code === 'KeyH') { e.preventDefault(); { const ids = selRef.current; const o = objectsRef.current.find((x) => x.id === ids[0]); const v = !(o?.visible ?? true); ids.forEach((id) => patch(id, { visible: v })) } return }
      if (meta && e.shiftKey && e.code === 'KeyL') { e.preventDefault(); { const ids = selRef.current; const o = objectsRef.current.find((x) => x.id === ids[0]); const l = !(o?.locked ?? false); ids.forEach((id) => patch(id, { locked: l })) } return }
      if (meta && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (meta && k === 'y') { e.preventDefault(); redo(); return }
      if (meta && k === 'd') { e.preventDefault(); duplicate(); return }
      if (meta && k === 'g') { e.preventDefault(); groupSelection('none'); return }
      if (meta && k === 'c') { e.preventDefault(); copy(); return }
      if (meta && k === 'v') {
        e.preventDefault()
        const tApi = (window as { terminal42?: { canvas?: { readClipboardHTML?: () => Promise<string> } } }).terminal42
        const read = tApi?.canvas?.readClipboardHTML
        if (read) void read().then((html) => { if (!handleFigmaPasteRef.current(html ?? '')) paste() }).catch(() => paste())
        else paste()
        return
      }
      if (meta && k === 'a') { e.preventDefault(); setSelIds(objectsRef.current.filter((o) => !o.locked).map((o) => o.id)); return }
      if (meta && e.key === ']') { e.preventDefault(); arrange(e.shiftKey ? 'front' : 'forward'); return }
      if (meta && e.key === '[') { e.preventDefault(); arrange(e.shiftKey ? 'back' : 'backward'); return }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        // A selected timeline keyframe takes priority: delete the keyframe, not the layer.
        if (timelineKeyframeSel.current) { timelineKeyframeSel.current.delete(); return }
        if (selRef.current.length) removeSel()
        else if (abSelectedRef.current && artboardsRef.current.length) {
          pushHistory()
          const id = activeAbRef.current
          const remaining = artboardsRef.current.filter((a) => a.id !== id)
          setArtboards(remaining)
          setActiveAb(remaining[0]?.id ?? '')
          if (!remaining.length) setAbSelected(false)
        }
        return
      }
      if (e.key === 'Escape') { if (selRef.current.length === 1 && objectsRef.current.find((x) => x.id === selRef.current[0])?.parent) { selectParent(); return } setSelIds([]); setAbSelected(false); setEditingId(null); setLayerMenu(null); setCanvasMenu(null); setTool('select'); return }
      if (e.key === 'Enter' && !meta && selRef.current.length && !editingRef.current) { const ids = selRef.current; if (objectsRef.current.some((o) => o.parent && ids.includes(o.parent))) { e.preventDefault(); selectChildren(); return } }
      if (!meta && !e.altKey && e.key === ']') { e.preventDefault(); arrange('front'); return }
      if (!meta && !e.altKey && e.key === '[') { e.preventDefault(); arrange('back'); return }
      if (e.key === 'F2' && selRef.current.length === 1) { e.preventDefault(); const o = objectsRef.current.find((x) => x.id === selRef.current[0]); if (o) startRename(o); return }
      if (e.shiftKey && k === 'k') { e.preventDefault(); setAutoKey((v) => !v); return }
      if (e.shiftKey && k === 'a') { e.preventDefault(); wrapInFlex(); return }
      if (e.shiftKey && k === 'f' && selRef.current.length > 1) { e.preventDefault(); groupSelection('none'); return }
      if (!meta && k === 'v') setTool('select')
      else if (!meta && k === 'b') setTool('frame')
      else if (!meta && k === 'a') setTool('frame')
      else if (!meta && k === 'f') setTool('frame')
      else if (!meta && k === 'r') setTool('rect')
      else if (!meta && k === 'o') setTool('ellipse')
      else if (!meta && k === 'l') setTool('line')
      else if (!meta && k === 'p') setTool('polygon')
      else if (!meta && k === 's') setTool('star')
      else if (!meta && k === 't') setTool('text')
      else if (!meta && k === 'i') setTool('image')
      else if (!meta && k === 'n') setTool('pencil')
      else if (!meta && k === 'h') setTool('hand')
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && selRef.current.length) {
        e.preventDefault()
        pushHistory()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        setObjects((os) => os.map((o) => (selRef.current.includes(o.id) ? { ...o, x: o.x + dx, y: o.y + dy } : o)))
      }
    }
    const up = (e: KeyboardEvent): void => { if (e.key === ' ') spaceRef.current = false }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo, pushHistory])

  // ── Pan + zoom: plain trackpad/wheel pans; Cmd/Ctrl or pinch zooms at cursor ──
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const s = scaleRef.current
      if (e.ctrlKey || e.metaKey) {
        const a = toArt(e.clientX, e.clientY)
        const next = clamp(+(s * Math.pow(1.0028, -e.deltaY)).toFixed(3), 0.02, 4)
        setPan((p) => ({ x: p.x + a.x * (s - next), y: p.y + a.y * (s - next) }))
        setScale(next)
      } else {
        setPan((p) => ({ x: p.x - e.deltaX * 1.4, y: p.y - e.deltaY * 1.4 }))
      }
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [toArt])
  const fit = (): void => {
    const s = stageRef.current
    if (!s) return
    const pad = 80
    const z = Math.min((s.clientWidth - pad) / Math.max(1, world.w), (s.clientHeight - pad) / Math.max(1, world.h))
    setScale(clamp(+z.toFixed(3), 0.02, 2))
    setPan({ x: 0, y: 0 })
  }
  useLayoutEffect(() => { fit() }, []) // eslint-disable-line

  // ── Google fonts: load the families actually in use ──────────────────────────
  useEffect(() => {
    const href = googleFontsHref(objects.filter((o) => o.type === 'text').map((o) => o.fontFamily))
    if (!href) return
    const id = 't42-freeform-fonts'
    let link = document.getElementById(id) as HTMLLinkElement | null
    if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link) }
    if (link.href !== href) link.href = href
  }, [objects])

  // ── Image upload ─────────────────────────────────────────────────────────────
  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      const img = new Image()
      img.onload = () => {
        pushHistory()
        const ab = activeArtboard
        if (!ab) { setStatus('Add an artboard first'); setTimeout(() => setStatus(''), 2000); return }
        const maxW = Math.min(560, ab.w * 0.6)
        const ratio = img.naturalHeight / img.naturalWidth || 0.66
        const w = Math.round(maxW)
        const h = Math.round(maxW * ratio)
        const o = { ...makeObject('image', Math.round(ab.x + (ab.w - w) / 2), Math.round(ab.y + (ab.h - h) / 2)), w, h, src }
        setObjects((os) => [...os, o])
        setSelIds([o.id]); setTool('select')
      }
      img.src = src
    }
    reader.readAsDataURL(file)
  }

  // ── Export (the active artboard, objects translated to its local space) ───────
  const localObjects = (ab: Artboard): FObj[] =>
    objects
      .filter((o) => artboardAt([ab], o.x + o.w / 2, o.y + o.h / 2))
      .map((o) => ({ ...o, x: o.x - ab.x, y: o.y - ab.y }))

  const exportHtml = async (): Promise<void> => {
    const ab = activeArtboard
    if (!ab) { setStatus('Add an artboard first'); setTimeout(() => setStatus(''), 2000); return }
    setStatus(`Saving ${ab.name}…`)
    const html = composeArtboardHtml(title ? `${title} · ${ab.name}` : ab.name, { w: ab.w, h: ab.h, bg: ab.bg }, localObjects(ab))
    const res = await window.terminal42.designs.writeHtml(designId, html)
    setStatus(res?.ok ? `Saved ${res.latest?.fileName ?? ''}` : 'Save failed')
    setTimeout(() => setStatus(''), 2500)
  }

  const downloadBlob = (data: string | Blob, filename: string, type = 'text/plain'): void => {
    const blob = typeof data === 'string' ? new Blob([data], { type }) : data
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  const exportArtboard = (format: 'html' | 'svg' | 'png'): void => {
    const ab = activeArtboard
    if (!ab) { setStatus('Add an artboard first'); setTimeout(() => setStatus(''), 2000); return }
    const local = localObjects(ab)
    const name = (ab.name || 'artboard').replace(/\s+/g, '-').toLowerCase()
    const spec = { w: ab.w, h: ab.h, bg: ab.bg }
    if (format === 'html') {
      downloadBlob(composeArtboardHtml(ab.name, spec, local), `${name}.html`, 'text/html')
      setStatus(`Exported ${name}.html`)
    } else {
      const svg = composeArtboardSvg(spec, local)
      if (format === 'svg') {
        downloadBlob(svg, `${name}.svg`, 'image/svg+xml')
        setStatus(`Exported ${name}.svg`)
      } else {
        setStatus('Rendering PNG…')
        const img = new Image()
        img.onload = () => {
          const c = document.createElement('canvas')
          c.width = ab.w
          c.height = ab.h
          const ctx = c.getContext('2d')
          if (!ctx) { setStatus('PNG export failed'); return }
          ctx.drawImage(img, 0, 0, ab.w, ab.h)
          c.toBlob((b) => { if (b) { downloadBlob(b, `${name}.png`, 'image/png'); setStatus(`Exported ${name}.png`) } else setStatus('PNG export failed') }, 'image/png')
        }
        img.onerror = () => setStatus('PNG export failed')
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      }
    }
    setTimeout(() => setStatus(''), 2500)
  }

  /** Export just the selected layers (and anything nested inside them), cropped
   * to their bounding box, on a transparent ground. PNG can be scaled up. */
  const exportSelection = (format: 'png' | 'svg', scale = 1): void => {
    const ids = selRef.current
    if (!ids.length) return
    const all = objectsRef.current
    const wanted = new Set(ids)
    let grew = true
    while (grew) {
      grew = false
      for (const o of all) {
        if (o.parent && wanted.has(o.parent) && !wanted.has(o.id)) { wanted.add(o.id); grew = true }
      }
    }
    const picked = all.filter((o) => wanted.has(o.id) && o.visible)
    if (!picked.length) return
    const minX = Math.min(...picked.map((o) => o.x))
    const minY = Math.min(...picked.map((o) => o.y))
    const w = Math.max(1, Math.round(Math.max(...picked.map((o) => o.x + o.w)) - minX))
    const h = Math.max(1, Math.round(Math.max(...picked.map((o) => o.y + o.h)) - minY))
    const local = picked.map((o) => ({ ...o, x: o.x - minX, y: o.y - minY }))
    const first = all.find((o) => o.id === ids[0])
    const name = (first?.name || 'layer').replace(/\s+/g, '-').toLowerCase()
    const svg = composeArtboardSvg({ w, h, bg: 'transparent' }, local)
    if (format === 'svg') {
      downloadBlob(svg, `${name}.svg`, 'image/svg+xml')
      setStatus(`Exported ${name}.svg`)
      setTimeout(() => setStatus(''), 2500)
      return
    }
    setStatus('Rendering PNG…')
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = Math.round(w * scale)
      c.height = Math.round(h * scale)
      const ctx = c.getContext('2d')
      if (!ctx) { setStatus('PNG export failed'); return }
      ctx.drawImage(img, 0, 0, c.width, c.height)
      c.toBlob((b) => {
        if (b) { downloadBlob(b, `${name}${scale > 1 ? `@${scale}x` : ''}.png`, 'image/png'); setStatus(`Exported ${name}.png`) } else setStatus('PNG export failed')
        setTimeout(() => setStatus(''), 2500)
      }, 'image/png')
    }
    img.onerror = () => { setStatus('PNG export failed'); setTimeout(() => setStatus(''), 2500) }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  }

  // ── Export the animation as a video (MP4 where the browser supports it, else WebM)
  const exportVideo = async (): Promise<void> => {
    const ab = activeArtboard
    if (!ab) { setStatus('Add an artboard first'); setTimeout(() => setStatus(''), 2000); return }
    const local = localObjects(ab)
    if (!local.some((o) => motionHasKeys(o.motion))) { setStatus('Nothing animated to record'); setTimeout(() => setStatus(''), 2500); return }
    const name = (ab.name || 'artboard').replace(/\s+/g, '-').toLowerCase()
    const spec = { w: ab.w, h: ab.h, bg: ab.bg }
    const fps = 30
    const frames = Math.max(2, Math.min(450, Math.round((motionDur / 1000) * fps)))
    setStatus('Rendering frames…')
    const loadSvg = (svg: string): Promise<HTMLImageElement> => new Promise((res, rej) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = rej
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    })
    try {
      const imgs: HTMLImageElement[] = []
      for (let i = 0; i <= frames; i++) imgs.push(await loadSvg(frameSvg(spec, local, (i / frames) * motionDur)))
      const canvas = document.createElement('canvas')
      canvas.width = ab.w
      canvas.height = ab.h
      const ctx = canvas.getContext('2d')
      if (!ctx) { setStatus('Video export failed'); return }
      const mp4 = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')
      const mime = mp4 ? 'video/mp4' : MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
      const stream = canvas.captureStream(0)
      const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
      const done = new Promise<void>((res) => { rec.onstop = () => res() })
      setStatus('Recording…')
      rec.start()
      for (const im of imgs) {
        ctx.clearRect(0, 0, ab.w, ab.h)
        ctx.drawImage(im, 0, 0, ab.w, ab.h)
        track.requestFrame()
        await new Promise((r) => setTimeout(r, 1000 / fps))
      }
      rec.stop()
      await done
      const ext = mp4 ? 'mp4' : 'webm'
      downloadBlob(new Blob(chunks, { type: mime }), `${name}.${ext}`, mime)
      setStatus(`Exported ${name}.${ext}`)
    } catch {
      setStatus('Video export failed')
    }
    setTimeout(() => setStatus(''), 3000)
  }

  // ── Render helpers ───────────────────────────────────────────────────────────
  const inv = 1 / scale // counter-scale chrome so it stays a constant screen size
  const SELC = '#8a8f98' // muted grey for selection / artboard chrome (was accent green)
  const SELB = '#2f6fed' // Figma-style blue for the active selection box + handles
  // Curved "rotate" cursor shown when hovering just outside a selection corner.
  const ROTATE_CURSOR = `url("data:image/svg+xml;utf8,${encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><g fill='none' stroke='#ffffff' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'><path d='M7 8.5a6 6 0 1 1-1 4.2'/><path d='M7 4.2v4.6h4.6'/></g><g fill='none' stroke='#111111' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M7 8.5a6 6 0 1 1-1 4.2'/><path d='M7 4.2v4.6h4.6'/></g></svg>"
  )}") 12 12, grab`
  // Drag a vertical divider to resize a side pane.
  const startColDrag = (e: React.MouseEvent, getStart: () => number, apply: (start: number, dx: number) => void): void => {
    e.preventDefault()
    const startX = e.clientX
    const start = getStart()
    const onMove = (ev: MouseEvent): void => apply(start, ev.clientX - startX)
    const onUp = (): void => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const toolBtn = (id: Tool, hint: string): JSX.Element => (
    <Tooltip label={hint} side="bottom">
      <button
        type="button"
        onClick={() => setTool(id)}
        aria-label={hint}
        className={['grid h-7 w-7 place-items-center rounded-md transition-colors', tool === id ? 'bg-action text-action-text' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'].join(' ')}
      >{TOOL_ICONS[id]}</button>
    </Tooltip>
  )
  const shapeTools: Tool[] = ['rect', 'line', 'arrow', 'ellipse', 'polygon', 'star', 'image']
  const activeShape = shapeTools.includes(tool) ? tool : 'rect'
  const shapeLabel: Record<Tool, string> = {
    select: 'Select', frame: 'Frame', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', arrow: 'Arrow', polygon: 'Polygon', star: 'Star', text: 'Text', image: 'Image/video…', pencil: 'Pencil', hand: 'Hand'
  }
  const shapeShortcut: Partial<Record<Tool, string>> = { rect: 'R', line: 'L', arrow: '⇧L', ellipse: 'O', image: '⇧⌘K' }
  const shapeDropdown = (): JSX.Element => (
    <div className="relative">
      <Tooltip label="Shapes" side="bottom">
        <button type="button" onClick={() => setShapeMenuOpen((o) => !o)} className={['flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors', shapeTools.includes(tool) ? 'bg-action text-action-text' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'].join(' ')}>
          {TOOL_ICONS[activeShape]}
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
        </button>
      </Tooltip>
      {shapeMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setShapeMenuOpen(false)} role="presentation" />
          <div className="t42-menu absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-2xl bg-raised py-2 shadow-overlay">
            {shapeTools.map((id) => (
              <button key={id} type="button" onClick={() => { setTool(id); setShapeMenuOpen(false) }} className="flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] text-white/90 hover:bg-white/10">
                <span className="grid w-4 place-items-center">{tool === id ? '✓' : ''}</span>
                <span className="grid h-5 w-5 place-items-center">{TOOL_ICONS[id]}</span>
                <span className="min-w-0 flex-1">{shapeLabel[id]}</span>
                {shapeShortcut[id] && <span className="text-white/50">{shapeShortcut[id]}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
  const toolCursor = (t: Tool): React.CSSProperties['cursor'] => {
    if (t === 'select') return 'default'
    if (t === 'hand') return 'grab'
    if (t === 'text') return 'text'
    if (t === 'pencil') {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4zM14.5 5.5l3 3"/><path fill="none" stroke="black" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4zM14.5 5.5l3 3"/></svg>`
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 3 21, crosshair`
    }
    if (t === 'image') return 'copy'
    return 'crosshair'
  }

  const renderObject = (o: FObj): JSX.Element | null => {
    if (!effectivelyVisible(o)) return null
    const clip = shapeClipPath(o)
    const clipped = !!clip || o.type === 'arrow'
    const filterStr = [staticFilter(o, clipped), effectsFilter(o), effectsTextureFilterCss(o)].filter(Boolean).join(' ')
    const backdrop = [backdropFilterCss(o), effectsBackdrop(o)].filter(Boolean).join(' ')
    const boxShadow = clipped ? undefined : [staticBoxShadow(o), effectsBoxShadow(o)].filter(Boolean).join(', ') || undefined
    const overlays = effectsOverlays(o)
    const common: React.CSSProperties = {
      position: 'absolute', left: o.x, top: o.y, width: o.w, height: o.h,
      opacity: o.opacity, transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined,
      transformOrigin: transformOriginCss(o),
      boxShadow, filter: filterStr || undefined,
      backdropFilter: backdrop || undefined, WebkitBackdropFilter: backdrop || undefined,
      mixBlendMode: o.blendMode as React.CSSProperties['mixBlendMode'],
      overflow: effectsClipsShape(o) ? 'hidden' : undefined,
      pointerEvents: tool === 'select' && !o.locked ? 'auto' : 'none',
      cursor: tool === 'select' ? 'move' : toolCursor(tool),
    }
    const overlayEls = overlays.length ? overlays.map((ov) => (
      <span key={ov.key} aria-hidden style={{
        position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
        background: ov.background, backgroundRepeat: ov.backgroundRepeat, backgroundSize: ov.backgroundSize,
        boxShadow: ov.boxShadow, opacity: ov.opacity, mixBlendMode: ov.blend as React.CSSProperties['mixBlendMode'],
      }} />
    )) : null
    const texEls = null
    const shaderEls = (o.effects ?? []).filter((e) => !e.hidden && e.type === 'shader' && e.shaderId).map((e) => (
      <ShaderLayer key={`${e.id}-${Math.round(o.w / 8)}x${Math.round(o.h / 8)}`} shaderId={e.shaderId} params={e.shaderParams} colors={e.shaderColors} image={o.fillImage ?? o.src} />
    ))
    const fxEls = (overlayEls || shaderEls.length || texEls) ? <>{overlayEls}{shaderEls}{texEls}</> : null
    const strokeRich = o.strokeEnabled && o.strokeWidth > 0 && !o.strokeHidden && paintIsRich(o, STROKE_PAINT)
    const borderRich = !!o.borderEnabled && !o.borderHidden && (o.borderWidth ?? 0) > 0 && paintIsRich(o, BORDER_PAINT)
    const outline: React.CSSProperties = o.strokeEnabled && o.strokeWidth > 0 && !o.strokeHidden && !strokeRich
      ? { outline: `${o.strokeWidth}px ${o.strokeStyle === 'dashed' ? 'dashed' : o.strokeStyle === 'dotted' ? 'dotted' : 'solid'} ${o.stroke}`, outlineOffset: o.strokeOffset ?? 0 }
      : {}
    if (o.borderEnabled && !o.borderHidden && (o.borderWidth ?? 0) > 0 && !borderRich) {
      const bc = rgbaFrom(o.borderColor ?? '#000000', o.borderOpacity ?? 1)
      const bv = `${o.borderWidth ?? 1}px ${o.borderStyle ?? 'solid'} ${bc}`
      const sides = o.borderSides ?? 'all'
      if (sides === 'all') outline.border = bv
      else if (sides === 'top') outline.borderTop = bv
      else if (sides === 'right') outline.borderRight = bv
      else if (sides === 'bottom') outline.borderBottom = bv
      else if (sides === 'left') outline.borderLeft = bv
    }
    const strokeOverlays = (strokeRich || borderRich) ? (
      <>
        {borderRich && <StrokePaintOverlay o={o} cfg={BORDER_PAINT} kind="border" />}
        {strokeRich && <StrokePaintOverlay o={o} cfg={STROKE_PAINT} kind="outline" />}
      </>
    ) : null
    const boxKids = (fxEls || strokeOverlays) ? <>{fxEls}{strokeOverlays}</> : null
    if (o.type === 'text') {
      const f = fontByLabel(o.fontFamily)
      const grad = o.fillMode === 'gradient'
      const paint: React.CSSProperties = o.fillHidden
        ? { color: 'transparent' }
        : grad
          ? { color: 'transparent', backgroundImage: objectFillCss(o), WebkitBackgroundClip: 'text', backgroundClip: 'text' }
          : { color: objectTextColorCss(o) }
      return (
        <div key={o.id} id={o.id} onPointerDown={(e) => onObjDown(e, o)} onDoubleClick={() => { setSelIds([o.id]); setEditingId(o.id) }}
          style={{ ...common, ...paint, fontSize: o.fontSize, fontWeight: o.fontWeight, fontStyle: o.italic ? 'italic' : 'normal', textDecoration: o.underline ? 'underline' : 'none', textAlign: o.align, lineHeight: o.lineHeight, letterSpacing: o.letterSpacing, fontFamily: f.stack, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>
          {editingId === o.id ? '' : o.text}
        </div>
      )
    }
    if (o.type === 'image') {
      if (boxKids) {
        return (
          <div key={o.id} id={o.id} onPointerDown={(e) => onObjDown(e, o)} style={{ ...common, borderRadius: o.radius, ...outline, background: o.src ? `url("${o.src}") center / cover no-repeat` : o.fill }}>
            {boxKids}
          </div>
        )
      }
      return o.src ? (
        <img key={o.id} id={o.id} src={o.src} alt={o.name} draggable={false} onPointerDown={(e) => onObjDown(e, o)} style={{ ...common, borderRadius: o.radius, ...outline, objectFit: 'cover' }} />
      ) : (
        <div key={o.id} id={o.id} onPointerDown={(e) => onObjDown(e, o)} style={{ ...common, borderRadius: o.radius, ...outline, background: o.fill, display: 'grid', placeItems: 'center', color: '#9ca3af', fontSize: 12 }}>Image</div>
      )
    }
    if (o.type === 'line') {
      return <div key={o.id} id={o.id} onPointerDown={(e) => onObjDown(e, o)} style={{ ...common, background: paintCssOf(o, STROKE_PAINT), borderRadius: o.strokeWidth }} />
    }
    if (o.type === 'path') {
      const defId = `${o.id}-stroke-paint`
      const ref = o.strokeEnabled ? svgPaintRef(o, STROKE_PAINT, defId) : 'transparent'
      return (
        <div key={o.id} id={o.id} onPointerDown={(e) => onObjDown(e, o)} style={{ ...common }}>
          <svg width={o.w} height={o.h} viewBox={o.pathViewBox || '0 0 1 1'} preserveAspectRatio={o.pathViewBox ? 'xMidYMid meet' : 'none'} style={{ overflow: 'visible', display: 'block' }}>
            {o.strokeEnabled && paintIsRich(o, STROKE_PAINT) && <defs><SvgPaintDef id={defId} o={o} cfg={STROKE_PAINT} /></defs>}
            <path d={o.path || ''} fill="none" stroke={ref} strokeWidth={Math.max(0.5, o.strokeWidth)} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )
    }
    if (o.type === 'arrow') {
      const head = Math.max(6, o.strokeWidth * 3)
      const cy = o.h / 2
      const defId = `${o.id}-stroke-paint`
      const ref = svgPaintRef(o, STROKE_PAINT, defId)
      return (
        <svg key={o.id} id={o.id} onPointerDown={(e) => onObjDown(e, o)} width={o.w} height={o.h} style={{ ...common, overflow: 'visible' }}>
          {paintIsRich(o, STROKE_PAINT) && <defs><SvgPaintDef id={defId} o={o} cfg={STROKE_PAINT} /></defs>}
          <line x1={0} y1={cy} x2={o.w - head} y2={cy} stroke={ref} strokeWidth={o.strokeWidth} />
          <polygon points={`${o.w - head},${cy - head} ${o.w},${cy} ${o.w - head},${cy + head}`} fill={ref} />
        </svg>
      )
    }
    const fillShown = o.fillEnabled && !o.fillHidden
    if (clip) {
      return (
        <div key={o.id} id={o.id} onPointerDown={(e) => onObjDown(e, o)} style={{ ...common, background: fillShown ? objectFillCss(o) : 'transparent', clipPath: clip }}>
          {boxKids}
        </div>
      )
    }
    // frame / rect / ellipse
    return (
      <div key={o.id} id={o.id} onPointerDown={(e) => onObjDown(e, o)}
        style={{ ...common, background: fillShown ? objectFillCss(o) : undefined, borderRadius: o.type === 'ellipse' ? '50%' : o.radius, ...outline }}>
        {boxKids}
      </div>
    )
  }

  // selection overlay for a single object (rotates with it; handles stay screen-constant).
  // Figma-style: thin blue box, 4 corner squares to scale, invisible edge strips to
  // resize one side, and a rotate zone just outside each corner (curved-arrow cursor).
  const singleOverlay = (o: FObj): JSX.Element => {
    const hs = 8 * inv          // corner square (screen-constant)
    const rz = 20 * inv         // rotate hit-zone around each corner
    const er = 7 * inv          // edge resize strip thickness
    const corners: { h: Handle; cx: number; cy: number; cursor: string }[] = [
      { h: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
      { h: 'ne', cx: o.w, cy: 0, cursor: 'nesw-resize' },
      { h: 'se', cx: o.w, cy: o.h, cursor: 'nwse-resize' },
      { h: 'sw', cx: 0, cy: o.h, cursor: 'nesw-resize' },
    ]
    const edges: { h: Handle; style: React.CSSProperties }[] = [
      { h: 'n', style: { left: hs, top: -er / 2, width: Math.max(0, o.w - hs * 2), height: er, cursor: 'ns-resize' } },
      { h: 's', style: { left: hs, top: o.h - er / 2, width: Math.max(0, o.w - hs * 2), height: er, cursor: 'ns-resize' } },
      { h: 'w', style: { left: -er / 2, top: hs, width: er, height: Math.max(0, o.h - hs * 2), cursor: 'ew-resize' } },
      { h: 'e', style: { left: o.w - er / 2, top: hs, width: er, height: Math.max(0, o.h - hs * 2), cursor: 'ew-resize' } },
    ]
    return (
      <div key={`ov-${o.id}`} style={{ position: 'absolute', left: o.x, top: o.y, width: o.w, height: o.h, transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined, transformOrigin: transformOriginCss(o), pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, outline: `${1 * inv}px ${o.type === 'frame' ? 'dashed' : 'solid'} ${SELB}`, outlineOffset: 0 }} />
        {/* rotate zones — just outside each corner (behind the scale squares) */}
        {corners.map((c) => (
          <span key={`rot-${c.h}`} onPointerDown={(e) => onRotateDown(e, o)} style={{ position: 'absolute', left: c.cx - rz / 2, top: c.cy - rz / 2, width: rz, height: rz, cursor: ROTATE_CURSOR, pointerEvents: 'auto', zIndex: 1 }} />
        ))}
        {/* invisible edge strips — resize one side */}
        {edges.map((ed) => (
          <span key={`edge-${ed.h}`} onPointerDown={(e) => onHandleDown(e, o, ed.h)} style={{ position: 'absolute', pointerEvents: 'auto', zIndex: 2, ...ed.style }} />
        ))}
        {/* corner squares — scale */}
        {corners.map((c) => (
          <span key={c.h} onPointerDown={(e) => onHandleDown(e, o, c.h)} style={{ position: 'absolute', left: c.cx - hs / 2, top: c.cy - hs / 2, width: hs, height: hs, background: '#ffffff', border: `${1.25 * inv}px solid ${SELB}`, borderRadius: 1.5 * inv, boxShadow: `0 ${0.5 * inv}px ${1.5 * inv}px rgba(0,0,0,0.25)`, pointerEvents: 'auto', cursor: c.cursor, zIndex: 3 }} />
        ))}
      </div>
    )
  }

  const editObj = editingId ? objects.find((o) => o.id === editingId && o.type === 'text') : null

  // resize-handle overlay for the active artboard (when nothing else is selected)
  const artboardOverlay = (a: Artboard): JSX.Element => {
    const hs = 8 * inv
    const er = 7 * inv
    const corners: { h: Handle; cx: number; cy: number; cursor: string }[] = [
      { h: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
      { h: 'ne', cx: a.w, cy: 0, cursor: 'nesw-resize' },
      { h: 'se', cx: a.w, cy: a.h, cursor: 'nwse-resize' },
      { h: 'sw', cx: 0, cy: a.h, cursor: 'nesw-resize' },
    ]
    const edges: { h: Handle; style: React.CSSProperties }[] = [
      { h: 'n', style: { left: hs, top: -er / 2, width: Math.max(0, a.w - hs * 2), height: er, cursor: 'ns-resize' } },
      { h: 's', style: { left: hs, top: a.h - er / 2, width: Math.max(0, a.w - hs * 2), height: er, cursor: 'ns-resize' } },
      { h: 'w', style: { left: -er / 2, top: hs, width: er, height: Math.max(0, a.h - hs * 2), cursor: 'ew-resize' } },
      { h: 'e', style: { left: a.w - er / 2, top: hs, width: er, height: Math.max(0, a.h - hs * 2), cursor: 'ew-resize' } },
    ]
    return (
      <div key={`abov-${a.id}`} style={{ position: 'absolute', left: a.x, top: a.y, width: a.w, height: a.h, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, outline: `${1 * inv}px solid ${SELB}` }} />
        {edges.map((ed) => (
          <span key={`edge-${ed.h}`} onPointerDown={(e) => onAbHandleDown(e, a, ed.h)} style={{ position: 'absolute', pointerEvents: 'auto', zIndex: 2, ...ed.style }} />
        ))}
        {corners.map((c) => (
          <span key={c.h} onPointerDown={(e) => onAbHandleDown(e, a, c.h)} style={{ position: 'absolute', left: c.cx - hs / 2, top: c.cy - hs / 2, width: hs, height: hs, background: '#ffffff', border: `${1.25 * inv}px solid ${SELB}`, borderRadius: 1.5 * inv, boxShadow: `0 ${0.5 * inv}px ${1.5 * inv}px rgba(0,0,0,0.25)`, pointerEvents: 'auto', cursor: c.cursor, zIndex: 3 }} />
        ))}
      </div>
    )
  }

  // selection overlay for a multi-selection: dashed blue box + 4 corner handles
  // (scale the group) + rotate zones just outside each corner (rotate the group).
  const groupOverlay = (b: Box): JSX.Element => {
    const hs = 8 * inv
    const rz = 20 * inv
    const corners: { h: Handle; cx: number; cy: number; cursor: string }[] = [
      { h: 'nw', cx: 0, cy: 0, cursor: 'nwse-resize' },
      { h: 'ne', cx: b.w, cy: 0, cursor: 'nesw-resize' },
      { h: 'se', cx: b.w, cy: b.h, cursor: 'nwse-resize' },
      { h: 'sw', cx: 0, cy: b.h, cursor: 'nesw-resize' },
    ]
    return (
      <div key="group-ov" style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, outline: `${1 * inv}px dashed ${SELB}`, outlineOffset: 0 }} />
        {corners.map((c) => (
          <span key={`grot-${c.h}`} onPointerDown={onGroupRotateDown} style={{ position: 'absolute', left: c.cx - rz / 2, top: c.cy - rz / 2, width: rz, height: rz, cursor: ROTATE_CURSOR, pointerEvents: 'auto', zIndex: 1 }} />
        ))}
        {corners.map((c) => (
          <span key={c.h} onPointerDown={(e) => onGroupHandleDown(e, c.h)} style={{ position: 'absolute', left: c.cx - hs / 2, top: c.cy - hs / 2, width: hs, height: hs, background: '#ffffff', border: `${1.25 * inv}px solid ${SELB}`, borderRadius: 1.5 * inv, boxShadow: `0 ${0.5 * inv}px ${1.5 * inv}px rgba(0,0,0,0.25)`, pointerEvents: 'auto', cursor: c.cursor, zIndex: 3 }} />
        ))}
      </div>
    )
  }

  return (
    <EditContext.Provider value={editCtx}>
    <VarBindContext.Provider value={varCtx}>
    <div className="flex h-full w-full flex-col gap-1.5 bg-bg p-1.5">
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 rounded-panel bg-raised px-3 py-2">
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary">← Designs</button>
        {renamingTitle && onRename ? (
          <input
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { const v = titleDraft.trim(); if (v) onRename(v); setRenamingTitle(false) } if (e.key === 'Escape') setRenamingTitle(false) }}
            onBlur={() => { const v = titleDraft.trim(); if (v && v !== title) onRename(v); setRenamingTitle(false) }}
            className="max-w-[200px] rounded bg-elevated px-1.5 py-0.5 text-[12.5px] font-medium text-text-primary focus:outline-none"
          />
        ) : (
          <button type="button" onClick={() => { if (onRename) { setTitleDraft(title || 'Form'); setRenamingTitle(true) } }} title={onRename ? 'Click to rename' : undefined} className="max-w-[200px] truncate rounded px-1 py-0.5 text-[12.5px] font-medium text-text-primary hover:bg-elevated">{title || 'Form'}</button>
        )}
        <div className="mx-1.5" />
        <div className="flex items-center gap-0.5 rounded-md bg-elevated/60 p-0.5">
          {toolBtn('select', 'Select / move (V)')}
          {toolBtn('hand', 'Pan (H / hold space)')}
          <div className="mx-1" />
          {toolBtn('frame', 'Frame (F): drag on the canvas for a new artboard, drag inside one to nest a frame')}
          {shapeDropdown()}
          {toolBtn('pencil', 'Pencil: draw freehand (N)')}
          {toolBtn('text', 'Text (T)')}
        </div>
        <div className="mx-1.5" />
        <Tooltip label="Undo (⌘Z)" side="bottom"><button type="button" onClick={undo} disabled={!canUndo} aria-label="Undo" className="grid h-7 w-7 place-items-center rounded text-text-secondary enabled:hover:bg-elevated enabled:hover:text-text-primary disabled:opacity-30">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>
        </button></Tooltip>
        <Tooltip label="Redo (⌘⇧Z)" side="bottom"><button type="button" onClick={redo} disabled={!canRedo} aria-label="Redo" className="grid h-7 w-7 place-items-center rounded text-text-secondary enabled:hover:bg-elevated enabled:hover:text-text-primary disabled:opacity-30">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h1" /></svg>
        </button></Tooltip>
        <div className="mx-1.5" />
        <Tooltip label="Toggle the animation timeline" side="bottom"><button type="button" onClick={() => setTimelineOpen((v) => !v)} className={['flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px]', timelineOpen ? 'bg-action text-action-text' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'].join(' ')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7h18M3 12h18M3 17h18" /><circle cx="8" cy="7" r="1.6" fill="currentColor" /><circle cx="15" cy="12" r="1.6" fill="currentColor" /><circle cx="10" cy="17" r="1.6" fill="currentColor" /></svg>
          Animation
        </button></Tooltip>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip label="Zoom out" side="bottom"><button type="button" onClick={() => setScale((s) => clamp(+(s - 0.1).toFixed(2), 0.1, 4))} className="grid h-6 w-6 place-items-center rounded text-text-secondary hover:bg-elevated">−</button></Tooltip>
          <Tooltip label="Fit to screen" side="bottom"><button type="button" onClick={fit} className="min-w-[44px] rounded px-1 text-center text-[11px] text-text-secondary hover:bg-elevated">{Math.round(scale * 100)}%</button></Tooltip>
          <Tooltip label="Zoom in" side="bottom"><button type="button" onClick={() => setScale((s) => clamp(+(s + 0.1).toFixed(2), 0.1, 4))} className="grid h-6 w-6 place-items-center rounded text-text-secondary hover:bg-elevated">+</button></Tooltip>
          {status && <span className="ml-2 text-[11px] text-text-muted">{status}</span>}
          {savedTick > 0 && !status && (
            <span className="ml-2 flex items-center gap-1 text-[11px] text-text-muted" title="Your work is auto-saved on this device">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 4.5" /></svg>
              Saved
            </span>
          )}
          <Tooltip label="Save the active artboard as an HTML design" side="bottom"><button type="button" onClick={() => void exportHtml()} className="ml-2 rounded-md bg-action px-2.5 py-1 text-[12px] font-medium text-action-text hover:opacity-90">Save to design</button></Tooltip>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-1.5 overflow-hidden">
        {/* Left pane: tabbed Layers / Assistant */}
        <aside className="flex shrink-0 flex-col overflow-hidden rounded-panel bg-surface" style={{ width: leftW }}>
          <div className="flex shrink-0 items-center gap-0.5 px-1.5 py-1.5">
            {([
              ['layers', 'Layers', <IcoTabLayers key="l" />],
              ['assistant', 'Assistant', <IcoTabAssistant key="a" />],
              ['system', 'System', <IcoTabSystem key="s" />],
              ['variables', 'Variables', <IcoTabVariables key="v" />],
            ] as const).map(([id, label, icon]) => (
              <LeftTabButton key={id} label={label} icon={icon} active={leftTab === id} showLabel={leftW >= 372} onSelect={() => { if (id === 'variables') openVariables(); else setLeftTab(id) }} />
            ))}
          </div>
          <div className="min-h-0 flex-1" style={{ display: leftTab === 'assistant' ? 'flex' : 'none' }}>
            <CanvasAssistant getContext={assistantContext} onCreate={assistantCreate} onAnimate={assistantAnimate} onEdit={assistantEdit} onDelete={assistantDelete} onArtboard={assistantArtboard} onRenameArtboard={renameActiveArtboard} onBusyChange={setAiBusy} model={null} onClose={() => setLeftTab('layers')} embedded kit={assistantKit} />
          </div>
          {leftTab === 'variables' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 gap-0.5 px-1.5 pt-2">
                {(['variables', 'styles'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setVarTabMode(m)} className={['flex-1 rounded px-2 py-1 text-[12px] font-medium transition-colors', varTabMode === m ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-elevated'].join(' ')}>{m === 'variables' ? 'Variables' : 'Styles'}</button>
                ))}
              </div>
              {varTabMode === 'variables' ? (
                <>
                <div className="shrink-0 px-1.5 pt-2">
                  <TokensPicker
                    label=""
                    showThemes={false}
                    tokensId={tokensBinding?.id ?? null}
                    themeId={tokensBinding?.themeId ?? null}
                    onChange={(id, themeId) => {
                      setTokensBinding(id ? { id, themeId } : null)
                      void window.terminal42.designs.setTokens(designId, id, themeId)
                    }}
                  />
                </div>
                <VariablesNav
                  collections={collections}
                  activeColId={varCol?.id ?? ''}
                  setActiveColId={setVarColId}
                  groupFilter={varGroupFilter}
                  setGroupFilter={setVarGroupFilter}
                  addCollection={addCollection}
                  removeCollection={removeCollection}
                  patchCollection={patchCollection}
                />
                </>
              ) : (
                <StylesNav styles={styles} typeFilter={styleTypeFilter} setTypeFilter={setStyleTypeFilter} />
              )}
            </div>
          )}
          {leftTab === 'system' && (
            <div className="flex-1 overflow-y-auto pb-2">
              <div className={`${PANEL_HEADER_ROW} ${PANEL_HEADER_TEXT}`}>Active design system</div>
              <div className="px-3 pt-1">
              {designSystems.length ? (
                <>
                  <select value={activeDs?.id ?? ''} onChange={(e) => setActiveDsId(e.target.value)} className="mb-3 w-full rounded t42-field px-2 py-1.5 text-[12px] text-text-primary">
                    {designSystems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div className={`mb-2 ${PANEL_HEADER_TEXT}`}>Insert component</div>
                  <div className="space-y-2">
                    {CANVAS_DS_COMPONENTS.map((c) => (
                      <button key={c.name} type="button" onClick={() => insertDsComponent(c.name)} title={`Insert ${c.name}`} className="block w-full overflow-hidden rounded-lg bg-elevated/40 text-left transition-colors hover: hover:bg-elevated">
                        {activeDs && <DsComponentPreview s={activeDs} name={c.name} />}
                        <span className="block px-2.5 py-1.5 text-[12px] font-medium text-text-primary">{c.name}</span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-text-muted">The assistant also uses this system when creating UI.</p>
                </>
              ) : (
                <p className="text-[12px] leading-relaxed text-text-muted">Create a design system first, then insert its components here.</p>
              )}
              </div>
            </div>
          )}
          {leftTab === 'layers' && (
          <div ref={layersScrollRef} className="flex-1 overflow-y-auto pb-2">
            {/* Pages */}
            <div className={`flex items-center justify-between ${PANEL_HEADER_ROW}`}>
              <span className={PANEL_HEADER_TEXT}>Pages</span>
              <button type="button" onClick={addPage} title="Add page" className="text-text-muted hover:text-text-primary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            <div className="px-1.5 pb-1">
              {pages.map((p) => {
                const isRen = renamingPageId === p.id
                const active = activePage === p.id
                return (
                  <div key={p.id}
                    onPointerDown={() => { if (!isRen) switchPage(p.id) }}
                    className={['group flex w-full cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px]', active ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-elevated'].join(' ')}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-text-muted"><path d="M4 1.5h5l3 3V14a.5.5 0 0 1-.5.5h-7A.5.5 0 0 1 4 14V2a.5.5 0 0 1 0-.5z" /><path d="M9 1.5V4.5h3" /></svg>
                    {isRen ? (
                      <input autoFocus value={pageRenameVal} onChange={(e) => setPageRenameVal(e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter') { renamePage(p.id, pageRenameVal); setRenamingPageId(null) } if (e.key === 'Escape') setRenamingPageId(null) }}
                        onBlur={() => { renamePage(p.id, pageRenameVal); setRenamingPageId(null) }}
                        className="min-w-0 flex-1 rounded bg-bg px-1 py-0.5 text-[12px] text-text-primary focus:outline-none" />
                    ) : (
                      <span className="flex-1 truncate" onDoubleClick={(e) => { e.stopPropagation(); setRenamingPageId(p.id); setPageRenameVal(p.name) }}>{p.name}</span>
                    )}
                    {active && <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-secondary"><path d="M3.5 8.5l3 3 6-7" /></svg>}
                    {pages.length > 1 && <Tooltip label="Delete page" side="left"><button type="button" onPointerDown={(e) => { e.stopPropagation(); removePage(p.id) }} className="text-text-muted opacity-0 hover:text-error group-hover:opacity-100">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
                    </button></Tooltip>}
                  </div>
                )
              })}
            </div>
            <div className="mx-3" />
            {/* Objects */}
            <div className={`flex items-center justify-between ${PANEL_HEADER_ROW}`}>
              <span className={PANEL_HEADER_TEXT}>Layers</span>
              <button type="button" onClick={() => setTool('frame')} title="Add a frame: drag on the canvas (F)" className="text-text-muted hover:text-text-primary">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </div>
            <div className="px-1.5">
              {objects.length === 0 && <div className="px-2 py-1 text-[11.5px] text-text-muted">No layers yet</div>}
              {(() => {
                const childIds = new Set(objects.map((x) => x.parent).filter((p): p is string => !!p))
                const byId = new Map(objects.map((x) => [x.id, x]))
                const depthOf = (o: FObj): number => {
                  let d = 0, cur = o.parent ? byId.get(o.parent) : undefined, guard = 0
                  while (cur && guard++ < 8) { d++; cur = cur.parent ? byId.get(cur.parent) : undefined }
                  return d
                }
                const roots = objects.filter((o) => !o.parent)
                const inAb = (o: FObj, ab: Artboard): boolean => {
                  const cx = o.x + o.w / 2, cy = o.y + o.h / 2
                  return cx >= ab.x && cx <= ab.x + ab.w && cy >= ab.y && cy <= ab.y + ab.h
                }
                type Row = { ab: Artboard } | { o: FObj; base: number }
                const rows: Row[] = []
                const collectObj = (o: FObj, base: number): void => { rows.push({ o, base }); if (collapsedLayers.has(o.id)) return; for (const ch of objects.filter((x) => x.parent === o.id)) collectObj(ch, base) }
                const claimed = new Set<string>()
                for (const ab of artboards) {
                  rows.push({ ab })
                  if (collapsedLayers.has(ab.id)) { roots.forEach((r) => { if (inAb(r, ab)) claimed.add(r.id) }); continue }
                  for (const root of roots.slice().reverse()) if (inAb(root, ab)) { claimed.add(root.id); collectObj(root, 1) }
                }
                for (const root of roots.slice().reverse()) if (!claimed.has(root.id)) collectObj(root, 0)
                return rows.map((row) => {
                  if ('ab' in row) {
                    const ab = row.ab
                    return (
                      <div key={`ab-${ab.id}`} onPointerDown={() => { if (renamingAbId !== ab.id) { setActiveAb(ab.id); setAbSelected(true); setSelIds([]) } }} className={['group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px]', activeAb === ab.id && abSelected ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-elevated'].join(' ')}>
                        <button type="button" title={collapsedLayers.has(ab.id) ? 'Expand' : 'Collapse'} onPointerDown={(e) => { e.stopPropagation(); setCollapsedLayers((s) => { const n = new Set(s); if (n.has(ab.id)) n.delete(ab.id); else n.add(ab.id); return n }) }} className="grid h-4 w-3 shrink-0 place-items-center text-text-muted hover:text-text-primary">
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsedLayers.has(ab.id) ? 'none' : 'rotate(90deg)' }}><path d="M4 2l4 4-4 4" /></svg>
                        </button>
                        <span className="grid h-4 w-4 shrink-0 place-items-center text-text-muted"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M7 3v18M17 3v18M3 7h18M3 17h18" /></svg></span>
                        {renamingAbId === ab.id ? (
                          <input autoFocus value={abRenameVal} onChange={(e) => setAbRenameVal(e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { if (e.key === 'Enter') { const v = abRenameVal.trim(); if (v) patchAb(ab.id, { name: v }); setRenamingAbId(null) } if (e.key === 'Escape') setRenamingAbId(null) }}
                            onBlur={() => { const v = abRenameVal.trim(); if (v) patchAb(ab.id, { name: v }); setRenamingAbId(null) }}
                            className="min-w-0 flex-1 rounded bg-bg px-1 py-0.5 text-[12px] text-text-primary focus:outline-none" />
                        ) : (
                          <span className="flex-1 truncate font-medium" onDoubleClick={(e) => { e.stopPropagation(); setRenamingAbId(ab.id); setAbRenameVal(ab.name) }}>{ab.name}</span>
                        )}
                        <span className="ml-auto text-[10px] text-text-muted group-hover:hidden">{ab.w}×{ab.h}</span>
                        <Tooltip label="Delete artboard" side="left"><button type="button" onPointerDown={(e) => { e.stopPropagation(); removeArtboard(ab.id) }} className="ml-auto hidden text-text-muted hover:text-error group-hover:block">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
                        </button></Tooltip>
                      </div>
                    )
                  }
                  const o = row.o
                  const isRenaming = renamingId === o.id
                  const hasChildren = childIds.has(o.id)
                  const kind = layerKind(o, hasChildren)
                  const depth = row.base + depthOf(o)
                  return (
                    <div key={o.id}
                      data-layer-id={o.id}
                      draggable={!isRenaming}
                      onDragStart={(e) => { dragLayerRef.current = o.id; e.dataTransfer.effectAllowed = 'move' }}
                      onDragOver={(e) => { e.preventDefault(); if (dragOverId !== o.id) setDragOverId(o.id) }}
                      onDragLeave={() => setDragOverId((d) => (d === o.id ? null : d))}
                      onDrop={(e) => { e.preventDefault(); if (dragLayerRef.current) reorderLayer(dragLayerRef.current, o.id); setDragOverId(null); dragLayerRef.current = null }}
                      onDragEnd={() => { setDragOverId(null); dragLayerRef.current = null }}
                      onPointerDown={(e) => { if (!isRenaming) selectOne(o.id, e.shiftKey) }}
                      onContextMenu={(e) => { e.preventDefault(); if (!selIds.includes(o.id)) setSelIds([o.id]); setLayerMenu({ id: o.id, x: Math.min(e.clientX, window.innerWidth - 184), y: Math.min(e.clientY, window.innerHeight - 320) }) }}
                      className={['group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px]', selIds.includes(o.id) ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-elevated', dragOverId === o.id ? '' : ''].join(' ')}>
                      <span className="grid h-4 w-3 shrink-0 place-items-center text-text-muted" style={{ marginLeft: depth * 14 }}>
                        {hasChildren ? (
                          <button type="button" title={collapsedLayers.has(o.id) ? 'Expand' : 'Collapse'} onPointerDown={(e) => { e.stopPropagation(); setCollapsedLayers((s) => { const n = new Set(s); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n }) }} className="grid h-4 w-3 place-items-center text-text-muted hover:text-text-primary">
                            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsedLayers.has(o.id) ? 'none' : 'rotate(90deg)' }}><path d="M4 2l4 4-4 4" /></svg>
                          </button>
                        ) : null}
                      </span>
                      <span title={kind.label} className="grid h-4 w-4 shrink-0 place-items-center text-text-muted">{kind.icon}</span>
                      {isRenaming ? (
                        <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
                          onPointerDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                          onBlur={commitRename}
                          className="min-w-0 flex-1 rounded bg-bg px-1 py-0.5 text-[12px] text-text-primary focus:outline-none" />
                      ) : (
                        <span className="flex-1 truncate" onDoubleClick={(e) => { e.stopPropagation(); startRename(o) }}>{o.name}</span>
                      )}
                      <div className="ml-auto flex shrink-0 items-center gap-1">
                        <Tooltip label={o.visible ? 'Hide layer' : 'Show layer'} side="left"><span onPointerDown={(e) => { e.stopPropagation(); patch(o.id, { visible: !o.visible }) }} className={['hover:text-text-primary', o.visible ? 'text-text-muted opacity-0 group-hover:opacity-100' : 'text-text-secondary'].join(' ')}><Eye on={o.visible} /></span></Tooltip>
                        <Tooltip label={o.locked ? 'Unlock layer' : 'Lock layer'} side="left"><span onPointerDown={(e) => { e.stopPropagation(); patch(o.id, { locked: !o.locked }) }} className={['hover:text-text-primary', o.locked ? 'text-text-secondary' : 'text-text-muted opacity-0 group-hover:opacity-100'].join(' ')}><Lock on={o.locked} /></span></Tooltip>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
          )}
        </aside>
        <div onMouseDown={(e) => startColDrag(e, () => leftW, (s, dx) => setLeftW(clamp(s + dx, 190, 460)))} title="Drag to resize" className="group w-1 shrink-0 cursor-col-resize bg-transparent">
          <div className="h-full w-px bg-transparent group-hover:bg-accent" />
        </div>

        {/* Stage */}
        <div ref={stageRef} onPointerDown={onArtDown} onPointerMove={onStageHover} onPointerLeave={() => setHoverId(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            const under = layersUnder(e.clientX, e.clientY)
            const top = under.find((o) => !o.locked)
            if (top && !selRef.current.includes(top.id)) setSelIds([top.id])
            setCanvasMenu({ x: Math.min(e.clientX, window.innerWidth - 240), y: Math.max(8, Math.min(e.clientY, window.innerHeight - 616)), under })
          }}
          className="t42-stage relative flex flex-1 items-center justify-center overflow-hidden rounded-panel" style={{ cursor: spaceRef.current ? 'grab' : toolCursor(tool) }}>
          {aiBusy && (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-raised/90 px-3 py-1.5 text-[12px] text-text-secondary shadow-overlay">
              <BoxesThinking />
              <span>Assistant is working…</span>
            </div>
          )}
          <div
            ref={sceneRef}
            style={{ position: 'relative', width: Math.max(1, world.w), height: Math.max(1, world.h), transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: '0 0' }}
          >
            {/* artboards */}
            {artboards.map((ab) => (
              <div key={ab.id}>
                {renamingAbId === ab.id ? (
                  <input
                    autoFocus
                    value={abRenameVal}
                    onChange={(e) => setAbRenameVal(e.target.value)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => { if (e.key === 'Enter') { const v = abRenameVal.trim(); if (v) { pushHistory(); patchAb(ab.id, { name: v }) } setRenamingAbId(null) } if (e.key === 'Escape') setRenamingAbId(null) }}
                    onBlur={() => { const v = abRenameVal.trim(); if (v) { pushHistory(); patchAb(ab.id, { name: v }) } setRenamingAbId(null) }}
                    style={{ position: 'absolute', left: ab.x, top: ab.y - 24 * inv, fontSize: 13 * inv, lineHeight: 1, padding: `${2 * inv}px ${5 * inv}px`, width: 180 * inv, background: '#16161a', color: '#f5f5f5', border: `${1 * inv}px solid ${SELC}`, borderRadius: 4 * inv, outline: 'none' }}
                  />
                ) : (
                  <button
                    type="button"
                    title="Drag to move · double-click to rename"
                    onPointerDown={(e) => onAbLabelDown(e, ab)}
                    onDoubleClick={(e) => { e.stopPropagation(); setRenamingAbId(ab.id); setAbRenameVal(ab.name) }}
                    style={{ position: 'absolute', left: ab.x, top: ab.y - 22 * inv, fontSize: 13 * inv, lineHeight: 1, color: activeAb === ab.id && abSelected ? SELB : '#9ca3af', background: 'transparent', padding: 0, whiteSpace: 'nowrap', cursor: 'grab' }}
                  >{ab.name} · {ab.w}×{ab.h}</button>
                )}
                <div style={{ position: 'absolute', left: ab.x, top: ab.y, width: ab.w, height: ab.h, background: ab.bg, boxShadow: '0 1px 3px rgba(0,0,0,0.4)', outline: activeAb === ab.id && abSelected ? `${1 * inv}px solid #2f6fed` : 'none', outlineOffset: `${1 * inv}px` }} />
              </div>
            ))}
            {/* objects (world coords, above artboards) */}
            {renderObjects.map(renderObject)}
            {/* texture (edge-roughening) SVG filter defs, referenced by objects' CSS filter */}
            {(() => {
              const defs = objects.filter((o) => o.visible).flatMap((o) => effectsTextureFilters(o))
              if (!defs.length) return null
              return (
                <svg width="0" height="0" aria-hidden style={{ position: 'absolute' }}>
                  <defs>
                    {defs.map((f) => (
                      <filter key={f.id} id={f.id} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
                        <feTurbulence type="fractalNoise" baseFrequency={`${f.fx} ${f.fy}`} numOctaves={f.octaves} seed={f.seed} stitchTiles="stitch" result="t" />
                        <feDisplacementMap in="SourceGraphic" in2="t" scale={f.scale} xChannelSelector="R" yChannelSelector="G" />
                      </filter>
                    ))}
                  </defs>
                </svg>
              )
            })()}
            {/* AI shimmer — scoped to the active artboard, not the whole canvas */}
            {aiBusy && (() => {
              const ab = artboards.find((a) => a.id === activeAb) ?? artboards[0]
              if (!ab) return null
              return <div className="t42-canvas-shimmer" style={{ left: ab.x, top: ab.y, right: 'auto', bottom: 'auto', width: ab.w, height: ab.h, borderRadius: 2 * inv }} />
            })()}
            {/* live freehand pencil preview */}
            {drawing && drawing.length > 1 && (
              <svg style={{ position: 'absolute', left: 0, top: 0, width: world.w, height: world.h, overflow: 'visible', pointerEvents: 'none' }}>
                <path d={'M' + drawing.map((p) => `${p.x},${p.y}`).join(' L')} fill="none" stroke="#111827" strokeWidth={2 * inv} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {/* motion path for the selected animated object */}
            {tool === 'select' && !editingId && motionPath && motionPath.length > 0 && (
              <svg style={{ position: 'absolute', left: 0, top: 0, width: world.w, height: world.h, pointerEvents: 'none', overflow: 'visible' }}>
                <polyline points={motionPath.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="rgb(var(--accent,34 197 94))" strokeWidth={1.5 * inv} strokeDasharray={`${5 * inv} ${4 * inv}`} />
                {motionPath.map((p) => (
                  <circle
                    key={p.t}
                    cx={p.x} cy={p.y} r={5 * inv}
                    fill="#ffffff" stroke="#0b0b0c" strokeWidth={1.5 * inv}
                    style={{ pointerEvents: 'auto', cursor: 'grab' }}
                    onPointerDown={(e) => { e.stopPropagation(); pushHistory(); dragRef.current = { mode: 'mpath', id: sel!.id, t: p.t } }}
                  >
                    <title>{`Drag to move the position keyframe at ${(p.t / 1000).toFixed(2)}s`}</title>
                  </circle>
                ))}
              </svg>
            )}
            {/* snap guides */}
            {guides.map((g, i) => (
              <div key={i} style={g.axis === 'x'
                ? { position: 'absolute', left: g.pos, top: g.start, width: Math.max(1, inv), height: g.end - g.start, background: '#ec4899', pointerEvents: 'none' }
                : { position: 'absolute', top: g.pos, left: g.start, height: Math.max(1, inv), width: g.end - g.start, background: '#ec4899', pointerEvents: 'none' }} />
            ))}
            {/* marquee */}
            {marquee && <div style={{ position: 'absolute', left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, border: `${inv}px solid ${SELB}`, background: 'rgba(47,111,237,0.10)', pointerEvents: 'none' }} />}
            {/* hover preview — solid blue for a shape, dashed blue for a frame/group */}
            {tool === 'select' && !editingId && !dragRef.current && hoverId && !selIds.includes(hoverId) && (() => {
              const ho = objById.get(hoverId)
              if (!ho || !ho.visible) return null
              const isGroup = ho.type === 'frame'
              return <div style={{ position: 'absolute', left: ho.x, top: ho.y, width: ho.w, height: ho.h, outline: `${1.5 * inv}px ${isGroup ? 'dashed' : 'solid'} #2f6fed`, outlineOffset: 0, borderRadius: ho.radius ? ho.radius : undefined, pointerEvents: 'none' }} />
            })()}
            {/* selection overlays */}
            {tool === 'select' && !editingId && selObjs.length === 0 && abSelected && activeArtboard && artboardOverlay(activeArtboard)}
            {tool === 'select' && !editingId && sel && singleOverlay(sel)}
            {tool === 'select' && !editingId && selObjs.length > 1 && selBounds && groupOverlay(selBounds)}
            {/* sizing badge (W × H + Fill/Hug) under the selection, Figma-style */}
            {tool === 'select' && !editingId && (sel || (selObjs.length > 1 && selBounds)) && (() => {
              const b = sel ? boxOf(sel) : selBounds!
              const label = sel ? sizeLabel(sel) : `${Math.round(selBounds!.w)} × ${Math.round(selBounds!.h)}`
              return (
                <div style={{ position: 'absolute', left: b.x + b.w / 2, top: b.y + b.h + 7 * inv, transform: 'translateX(-50%)', background: '#2f6fed', color: '#ffffff', fontSize: 11 * inv, lineHeight: 1, padding: `${3 * inv}px ${7 * inv}px`, borderRadius: 4 * inv, whiteSpace: 'nowrap', fontWeight: 600, pointerEvents: 'none' }}>{label}</div>
              )
            })()}
            {/* inline text editor */}
            {editObj && (
              <textarea
                ref={editRef}
                autoFocus
                value={editObj.text}
                onChange={(e) => patch(editObj.id, { text: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) } }}
                style={{ position: 'absolute', left: editObj.x, top: editObj.y, width: editObj.w, height: editObj.h, color: editObj.color, fontSize: editObj.fontSize, fontWeight: editObj.fontWeight, fontStyle: editObj.italic ? 'italic' : 'normal', textAlign: editObj.align, lineHeight: editObj.lineHeight, letterSpacing: editObj.letterSpacing, fontFamily: fontByLabel(editObj.fontFamily).stack, background: 'transparent', border: 'none', outline: `${1.5 * inv}px solid ${SELC}`, resize: 'none', padding: 0, margin: 0, overflow: 'hidden' }}
              />
            )}
          </div>
          {leftTab === 'variables' && varTabMode === 'variables' && (
            <VariablesTable
              collections={collections}
              col={varCol}
              query={varQuery}
              setQuery={setVarQuery}
              groupFilter={varGroupFilter}
              setGroupFilter={setVarGroupFilter}
              addMode={addMode}
              removeMode={removeMode}
              setActiveMode={setActiveMode}
              moveMode={moveMode}
              duplicateMode={duplicateMode}
              addVariable={addVariable}
              removeVariable={removeVariable}
              duplicateVariable={duplicateVariable}
              copyVariable={copyVariable}
              pasteVariable={pasteVariable}
              setVariableGroup={setVariableGroup}
              varClip={varClip}
              setVarValue={setVarValue}
              patchCollection={patchCollection}
              addCollection={addCollection}
              exportTokens={exportTokens}
              importTokens={importTokens}
              libraries={libraries}
              publishToLibrary={publishToLibrary}
              addLibraryToFile={addLibraryToFile}
              removeLibrary={removeLibrary}
            />
          )}
          {leftTab === 'variables' && varTabMode === 'styles' && (
            <StylesPanel
              styles={styles}
              collections={collections}
              typeFilter={styleTypeFilter}
              selCount={selIds.length}
              libraries={libraries}
              publishToLibrary={publishToLibrary}
              addLibraryToFile={addLibraryToFile}
              removeLibrary={removeLibrary}
              addColorStyle={addColorStyle}
              addTextStyle={addTextStyle}
              addEffectStyle={addEffectStyle}
              updateColorStyle={updateColorStyle}
              updateTextStyle={updateTextStyle}
              renameStyle={renameStyle}
              removeStyle={removeStyle}
              applyStyleToSel={applyStyleToSel}
              openPicker={openPicker}
            />
          )}
        </div>

        {/* Inspector */}
        {leftTab !== 'variables' && (
        <div onMouseDown={(e) => startColDrag(e, () => rightW, (s, dx) => setRightW(clamp(s - dx, 210, 480)))} title="Drag to resize" className="group w-1 shrink-0 cursor-col-resize bg-transparent">
          <div className="h-full w-px bg-transparent group-hover:bg-accent" />
        </div>
        )}
        {leftTab !== 'variables' && (
        <div className="flex shrink-0 flex-col bg-surface" style={{ width: rightW }}>
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-elevated/60 p-0.5 mx-1.5 mt-1.5" role="tablist" aria-label="Panel">
            {(['design', 'theme'] as const).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={rightTab === id} onClick={() => setRightTab(id)}
                className={['flex-1 rounded-md py-1 text-[12.5px] capitalize transition-colors', rightTab === id ? 'bg-raised text-text-primary' : 'text-text-secondary hover:text-text-primary'].join(' ')}>
                {id}
              </button>
            ))}
          </div>
          {rightTab === 'theme' ? (
            <ThemePanel
              studio={tokenStudio}
              themeId={tokenStudio?.activeTheme ?? null}
              onCreate={(k) => void createToken(k)}
              onStarter={() => void applyStarterTheme()}
            />
          ) : (
          <div className="flex min-h-0 flex-1">
        <Inspector
          width={rightW}
          tool={tool}
          abSelected={abSelected}
          selObjs={selObjs}
          sel={sel}
          patch={patch}
          patchObj={patchObj}
          gradOpenMode={gradOpts?.cfg.mode ?? null}
          onToggleGradOpts={(rect, cfg) => setGradOpts(rect && cfg ? { anchor: rect, cfg } : null)}
          onOpenEffect={(id, anchor) => setEffectPopover({ id, anchor })}
          activeEffectId={effectPopover?.id ?? null}
          pushHistory={pushHistory}
          removeSel={removeSel}
          arrange={arrange}
          groupSelection={groupSelection}
          wrapInFlex={wrapInFlex}
          doAlign={doAlign}
          doDistribute={doDistribute}
          doResizeToFill={doResizeToFill}
          artboards={artboards}
          activeAb={activeAb}
          setActiveAb={setActiveAb}
          patchAb={patchAb}
          addArtboard={addArtboard}
          removeArtboard={removeArtboard}
          onExport={(f) => { if (f === 'video') void exportVideo(); else exportArtboard(f) }}
          onExportSelection={exportSelection}
          isKeyed={isKeyed}
          toggleKey={toggleKey}
          autoRecord={autoRecord}
          motionDur={motionDur}
          playhead={playhead}
          recordKey={recordKey}
          resetTransform={resetTransform}
          allObjects={objects}
          onReplaceColor={replaceColorInObjects}
          timelineOpen={timelineOpen}
          autoKey={autoKey}
        />
          </div>
          )}
        </div>
        )}
      </div>

      {timelineOpen && (
        <TimelinePanel
          objects={objects}
          selIds={selIds}
          onSelect={(id) => setSelIds([id])}
          setMotion={(id, m: LayerMotion) => patch(id, { motion: m })}
          getDoc={() => document}
          onClose={() => setTimelineOpen(false)}
          time={playhead}
          setTime={setPlayhead}
          duration={motionDur}
          setDuration={setMotionDur}
          autoKey={autoKey}
          setAutoKey={setAutoKey}
          onExportVideo={() => void exportVideo()}
        />
      )}

      {/* Layer right-click menu */}
      {layerMenu && (() => {
        const lo = objects.find((o) => o.id === layerMenu.id)
        if (!lo) return null
        const Item = ({ onClick, children, danger, shortcut }: { onClick: () => void; children: React.ReactNode; danger?: boolean; shortcut?: string }): JSX.Element => (
          <button type="button" onClick={() => { onClick(); setLayerMenu(null) }} className={['flex w-full items-center justify-between gap-4 px-2.5 py-1.5 text-left text-[12px]', danger ? 'text-text-secondary hover:bg-elevated hover:text-error' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'].join(' ')}>
            <span>{children}</span>{shortcut && <span className="text-[10.5px] text-text-muted">{shortcut}</span>}
          </button>
        )
        return (
          <>
            <div className="fixed inset-0 z-[60]" onPointerDown={() => setLayerMenu(null)} onContextMenu={(e) => { e.preventDefault(); setLayerMenu(null) }} />
            <div className="t42-menu fixed z-[61] w-44 rounded-md bg-raised py-1 shadow-overlay" style={{ left: layerMenu.x, top: layerMenu.y }}>
              <Item onClick={() => startRename(lo)}>Rename</Item>
              <Item onClick={() => duplicateId(lo.id)} shortcut="⌘D">Duplicate</Item>
              <Item onClick={() => copyId(lo.id)} shortcut="⌘C">Copy</Item>
              <Item onClick={() => paste()} shortcut="⌘V">Paste</Item>
              <div className="my-1" />
              <Item onClick={() => moveLayer(lo.id, 'up')} shortcut="⌘]">Bring forward</Item>
              <Item onClick={() => moveLayer(lo.id, 'down')} shortcut="⌘[">Send backward</Item>
              <Item onClick={() => moveLayer(lo.id, 'top')}>Bring to front</Item>
              <Item onClick={() => moveLayer(lo.id, 'bottom')}>Send to back</Item>
              <div className="my-1" />
              <Item onClick={() => patch(lo.id, { visible: !lo.visible })}>{lo.visible ? 'Hide' : 'Show'}</Item>
              <Item onClick={() => patch(lo.id, { locked: !lo.locked })}>{lo.locked ? 'Unlock' : 'Lock'}</Item>
              <div className="my-1" />
              <Item onClick={() => deleteId(lo.id)} danger shortcut="⌫">Delete</Item>
            </div>
          </>
        )
      })()}

      {canvasMenu && (() => {
        const one = selIds.length === 1 ? objects.find((o) => o.id === selIds[0]) : null
        const any = selIds.length > 0
        const close = (): void => { setCanvasMenu(null); setSubMenu(null) }
        const Item = ({ onClick, children, shortcut, disabled }: { onClick: () => void; children: React.ReactNode; shortcut?: string; disabled?: boolean }): JSX.Element => (
          <button type="button" disabled={disabled} onMouseEnter={() => setSubMenu(null)} onClick={() => { onClick(); close() }}
            className={['flex w-full items-center justify-between gap-4 px-2.5 py-1.5 text-left text-[12px]', disabled ? 'cursor-default text-text-muted opacity-50' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'].join(' ')}>
            <span>{children}</span>{shortcut && <span className="text-[10.5px] text-text-muted">{shortcut}</span>}
          </button>
        )
        const Sub = ({ name, children, disabled }: { name: 'layer' | 'copyas'; children: React.ReactNode; disabled?: boolean }): JSX.Element => (
          <button type="button" disabled={disabled} onMouseEnter={(ev) => !disabled && setSubMenu({ name, y: ev.currentTarget.getBoundingClientRect().top })}
            className={['flex w-full items-center justify-between gap-4 px-2.5 py-1.5 text-left text-[12px]', disabled ? 'cursor-default text-text-muted opacity-50' : 'text-text-secondary hover:bg-elevated hover:text-text-primary'].join(' ')}>
            <span>{children}</span><span className="text-[10.5px] text-text-muted">›</span>
          </button>
        )
        const subStyle = { left: canvasMenu.x + 194, top: Math.max(8, Math.min(subMenu?.y ?? 0, window.innerHeight - 200)) }
        return (
          <>
            <div className="fixed inset-0 z-[60]" onPointerDown={close} onContextMenu={(e) => { e.preventDefault(); close() }} />
            <div className="t42-menu fixed z-[61] w-48 overflow-auto rounded-md bg-raised py-1 shadow-overlay" style={{ left: canvasMenu.x, top: canvasMenu.y, maxHeight: 'calc(100vh - 16px)' }} onMouseLeave={() => setSubMenu(null)}>
              <Sub name="layer" disabled={canvasMenu.under.length === 0}>Select layer…</Sub>
              <Item onClick={selectParent} shortcut="Escape" disabled={!one?.parent}>Select parent</Item>
              <Item onClick={selectChildren} shortcut="Enter" disabled={!objects.some((o) => o.parent && selIds.includes(o.parent))}>Select children</Item>
              <div className="my-1" />
              <Item onClick={copy} shortcut="⌘C" disabled={!any}>Copy</Item>
              <Item onClick={copyLink} disabled={!one}>Copy link</Item>
              <Sub name="copyas" disabled={!one}>Copy as…</Sub>
              <Item onClick={paste} shortcut="⌘V" disabled={!clipRef.current.length}>Paste</Item>
              <Item onClick={pasteOnTop} shortcut="⇧⌘V" disabled={!clipRef.current.length}>Paste on top</Item>
              <Item onClick={pasteToReplace} shortcut="⇧⌘R" disabled={!clipRef.current.length || !any}>Paste to replace</Item>
              <Item onClick={duplicate} shortcut="⌘D" disabled={!any}>Duplicate</Item>
              <div className="my-1" />
              <Item onClick={copyStyles} shortcut="⌥⌘C" disabled={!one}>Copy styles</Item>
              <Item onClick={pasteStyles} shortcut="⌥⌘V" disabled={!styleClipRef.current || !any}>Paste styles</Item>
              <div className="my-1" />
              <Item onClick={() => groupSelection('none')} shortcut="⇧F" disabled={selIds.length < 2}>Frame selection</Item>
              <Item onClick={wrapInFlex} shortcut="⇧A" disabled={selIds.length < 2}>Wrap in flex</Item>
              <div className="my-1" />
              <Item onClick={() => arrange('front')} shortcut="]" disabled={!any}>Bring to front</Item>
              <Item onClick={() => arrange('back')} shortcut="[" disabled={!any}>Send to back</Item>
              <div className="my-1" />
              <Item onClick={() => { const v = !(one?.visible ?? true); selIds.forEach((id) => patch(id, { visible: v })) }} shortcut="⇧⌘H" disabled={!any}>{one && !one.visible ? 'Show' : 'Hide'}</Item>
              <Item onClick={() => { const l = !(one?.locked ?? false); selIds.forEach((id) => patch(id, { locked: l })) }} shortcut="⇧⌘L" disabled={!any}>{one?.locked ? 'Unlock' : 'Lock'}</Item>
            </div>
            {subMenu?.name === 'layer' && (
              <div className="t42-menu fixed z-[62] max-h-72 w-44 overflow-auto rounded-md bg-raised py-1 shadow-overlay" style={subStyle} onMouseEnter={() => setSubMenu(subMenu)}>
                {canvasMenu.under.map((o) => (
                  <button key={o.id} type="button" onClick={() => { setSelIds([o.id]); close() }} className="block w-full truncate px-2.5 py-1.5 text-left text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary">{o.name}</button>
                ))}
              </div>
            )}
            {subMenu?.name === 'copyas' && (
              <div className="t42-menu fixed z-[62] w-48 rounded-md bg-raised py-1 shadow-overlay" style={subStyle} onMouseEnter={() => setSubMenu(subMenu)}>
                <Item onClick={copyAsPng} shortcut="⇧⌘C">Copy as PNG</Item>
                <Item onClick={copyAsTailwind} shortcut="⌥T">Copy as Tailwind</Item>
                <Item onClick={copyAsReactCss} shortcut="⌥R">Copy as React CSS</Item>
              </div>
            )}
          </>
        )
      })()}

      {pickerReq && <ColorPicker req={{ ...pickerReq, tokenSwatches }} />}
      {gradOpts && sel && (sel[gradOpts.cfg.mode] === 'gradient') && (
        <GradientOptions sel={sel} cfg={gradOpts.cfg} patch={patch} patchObj={patchObj} pushHistory={pushHistory} anchor={gradOpts.anchor} onClose={() => setGradOpts(null)} />
      )}
      {effectPopover && sel && (() => {
        const fx = (sel.effects ?? []).find((e) => e.id === effectPopover.id)
        if (!fx) return null
        return <EffectPopover effect={fx} sel={sel} patchObj={patchObj} pushHistory={pushHistory} anchor={effectPopover.anchor} onClose={() => setEffectPopover(null)} onBrowseShader={(anchor) => setShaderGallery({ effectId: effectPopover.id, anchor })} />
      })()}
      {shaderGallery && sel && (
        <ShaderGallery effectId={shaderGallery.effectId} sel={sel} patchObj={patchObj} pushHistory={pushHistory} anchor={shaderGallery.anchor} onClose={() => setShaderGallery(null)} />
      )}
    </div>
    </VarBindContext.Provider>
    </EditContext.Provider>
  )
}

// ── Variables (design tokens) ──────────────────────────────────────────────────
/** Rhombus token glyph used for the variable affordance (filled when bound). */
const IcoVar = ({ filled }: { filled?: boolean }): JSX.Element => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
    <path d="M8 1.8 14.2 8 8 14.2 1.8 8Z" />
  </svg>
)
const IcoClose = (): JSX.Element => <svg width="11" height="11" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M4 4l8 8M12 4l-8 8" /></svg>
const IcoMore = (): JSX.Element => <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden><circle cx="4" cy="8" r="1.35" /><circle cx="8" cy="8" r="1.35" /><circle cx="12" cy="8" r="1.35" /></svg>

// ── Left-panel tab icons (monochrome, no accent / boxes behind them) ──
const IcoTabLayers = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    <path d="M8 1.9 14.4 5 8 8.1 1.6 5 8 1.9Z" /><path d="M2.4 7.8 8 10.6 13.6 7.8" /><path d="M2.4 10.6 8 13.4 13.6 10.6" />
  </svg>
)
const IcoTabAssistant = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4z" />
  </svg>
)
const IcoTabSystem = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="2" width="5" height="5" rx="1" /><rect x="9" y="2" width="5" height="5" rx="1" /><rect x="2" y="9" width="5" height="5" rx="1" /><rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
)
const IcoTabVariables = (): JSX.Element => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    <path d="M5.4 2.2C3.2 3.5 2 5.6 2 8s1.2 4.5 3.4 5.8M10.6 2.2C12.8 3.5 14 5.6 14 8s-1.2 4.5-3.4 5.8" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
  </svg>
)

/** Left-panel tab: icon-first, revealing its label only when the panel is wide
 * enough. In icon-only mode a hover tooltip names the tab. */
function LeftTabButton({ label, icon, active, showLabel, onSelect }: {
  label: string
  icon: JSX.Element
  active: boolean
  showLabel: boolean
  onSelect: () => void
}): JSX.Element {
  const btn = (
    <button type="button" onClick={onSelect} aria-label={label} aria-pressed={active}
      className={['flex flex-1 items-center justify-center gap-1.5 rounded px-1 py-1.5 text-[11px] font-medium', active ? 'bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary'].join(' ')}>
      {icon}
      {showLabel && <span className="whitespace-nowrap">{label}</span>}
    </button>
  )
  return showLabel ? btn : <Tooltip label={label} side="bottom" className="flex flex-1">{btn}</Tooltip>
}

/** A two-state switch for boolean variables (no accent, no emoji). */
function BoolToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <button type="button" onClick={() => onChange(!value)} title={value ? 'True' : 'False'} aria-pressed={value}
      className={['relative h-5 w-9 shrink-0 rounded-full transition-colors', value ? 'bg-text-muted/70' : 'bg-elevated'].join(' ')}>
      <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-text-primary transition-all', value ? 'left-[18px]' : 'left-0.5'].join(' ')} />
    </button>
  )
}

/** Inspector affordance: bind one object field to a variable of the matching type. */
function VarBindButton({ field, boundVarId }: { field: BindField; boundVarId?: string }): JSX.Element | null {
  const { collections, bindFieldToVar, unbindField } = useContext(VarBindContext)
  const [open, setOpen] = useState(false)
  const opts = variablesForField(collections, field)
  if (!opts.length && !boundVarId) return null
  const items: MenuItem[] = [
    ...opts.map(({ collection, variable }) => ({
      label: collections.length > 1 ? `${collection.name} / ${variable.name}` : variable.name,
      active: variable.id === boundVarId,
      onClick: () => bindFieldToVar(field, variable.id),
    })),
    ...(boundVarId ? [{ label: 'Detach variable', onClick: () => unbindField(field) }] : []),
  ]
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} title={`Bind ${FIELD_LABEL[field]} to a variable`}
        className={['grid h-6 w-6 place-items-center rounded hover:bg-elevated hover:text-text-primary', boundVarId ? 'text-text-primary' : 'text-text-muted'].join(' ')}>
        <IcoVar filled={!!boundVarId} />
      </button>
      <Menu open={open} onClose={() => setOpen(false)} items={items} width={210} />
    </div>
  )
}

/** Inspector selector: pin a collection to a specific mode on the selected frame,
 * or leave it on Auto (inherit the document / parent-frame default). */
function ModeSelect({ collection, currentModeId, onPick }: { collection: VariableCollection; currentModeId?: string; onPick: (modeId: string | null) => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const defaultMode = collection.modes.find((m) => m.id === collection.activeMode) ?? collection.modes[0]
  const cur = currentModeId ? collection.modes.find((m) => m.id === currentModeId) : null
  const autoLabel = `Auto · ${defaultMode?.name ?? 'Default'}`
  const items: MenuItem[] = [
    { label: autoLabel, active: !cur, onClick: () => onPick(null) },
    ...collection.modes.map((m) => ({ label: m.name, active: currentModeId === m.id, onClick: () => onPick(m.id) })),
  ]
  return (
    <div className="grid grid-cols-[70px_1fr] items-center gap-2">
      <span className="truncate text-[12px] text-text-muted" title={collection.name}>{collection.name}</span>
      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-1 rounded-lg bg-elevated px-2.5 py-1.5 text-[12px] text-text-primary">
          <span className="min-w-0 truncate">{cur ? cur.name : autoLabel}</span><IcoChevron />
        </button>
        <Menu open={open} onClose={() => setOpen(false)} items={items} width={180} />
      </div>
    </div>
  )
}

/** Inspector row shown in place of a field's editor when it is bound to a variable. */
function BoundChip({ field, varId }: { field: BindField; varId: string }): JSX.Element {
  const { collections, unbindField } = useContext(VarBindContext)
  const name = variableLabel(collections, varId) ?? 'Missing variable'
  const type = fieldVarType(field)
  const resolved = resolveVarValue(collections, varId)
  return (
    <div className="flex items-center gap-2 rounded-md bg-elevated px-2 py-1.5">
      {type === 'color' && <span className="h-4 w-4 shrink-0 rounded-[4px]" style={{ background: typeof resolved === 'string' ? resolved : 'transparent' }} />}
      <span className="grid h-4 w-4 shrink-0 place-items-center text-text-muted"><IcoVar filled /></span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-text-primary" title={name}>{name}</span>
      {type !== 'color' && resolved != null && <span className="shrink-0 text-[12px] tabular-nums text-text-muted">{String(resolved)}</span>}
      <button type="button" onClick={() => unbindField(field)} title="Detach variable" className="grid h-5 w-5 shrink-0 place-items-center rounded text-text-muted hover:bg-bg/60 hover:text-text-primary"><IcoClose /></button>
    </div>
  )
}

/** Inline-editable text that commits on blur / Enter. */
function InlineName({ value, onCommit, className }: { value: string; onCommit: (v: string) => void; className?: string }): JSX.Element {
  return (
    <input
      key={value}
      defaultValue={value}
      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== value) onCommit(v) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { (e.target as HTMLInputElement).value = value; (e.target as HTMLInputElement).blur() } }}
      className={className ?? 'min-w-0 flex-1 bg-transparent text-[12px] text-text-primary focus:outline-none'}
    />
  )
}

/** Edits one variable's value for the collection's active mode (literal or alias). */
function VarValueEditor({ collections, col, v, modeId, setVarValue }: { collections: VariableCollection[]; col: VariableCollection; v: Variable; modeId: string; setVarValue: (colId: string, varId: string, modeId: string, value: VarValue) => void }): JSX.Element {
  const [aliasOpen, setAliasOpen] = useState(false)
  const raw = v.values[modeId]
  const aliased = isAlias(raw)
  const aliasTargets = variablesOfType(collections, v.type).filter((o) => o.variable.id !== v.id)
  const set = (val: VarValue): void => setVarValue(col.id, v.id, modeId, val)
  const aliasItems: MenuItem[] = [
    ...aliasTargets.map(({ collection, variable }) => ({
      label: collections.length > 1 ? `${collection.name} / ${variable.name}` : variable.name,
      active: aliased && (raw as { alias: string }).alias === variable.id,
      onClick: () => set({ alias: variable.id }),
    })),
    ...(aliased ? [{ label: 'Custom value', onClick: () => set(resolveVarValue(collections, (raw as { alias: string }).alias) ?? defaultValueFor(v.type)) }] : []),
  ]
  if (aliased) {
    const name = variableLabel(collections, (raw as { alias: string }).alias) ?? 'Missing'
    const resolved = resolveVarValue(collections, (raw as { alias: string }).alias)
    return (
      <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-md bg-elevated px-2 py-1.5">
        {v.type === 'color' && <span className="h-4 w-4 shrink-0 rounded-[4px]" style={{ background: typeof resolved === 'string' ? resolved : 'transparent' }} />}
        <span className="grid h-3.5 w-3.5 shrink-0 place-items-center text-text-muted"><IcoVar filled /></span>
        <button type="button" onClick={() => setAliasOpen((o) => !o)} className="min-w-0 flex-1 truncate text-left text-[12px] text-text-primary" title={name}>{name}</button>
        <Menu open={aliasOpen} onClose={() => setAliasOpen(false)} items={aliasItems} width={200} />
      </div>
    )
  }
  const aliasBtn = aliasTargets.length ? (
    <div className="relative">
      <button type="button" onClick={() => setAliasOpen((o) => !o)} title="Alias to another variable" className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"><IcoVar /></button>
      <Menu open={aliasOpen} onClose={() => setAliasOpen(false)} items={aliasItems} width={200} />
    </div>
  ) : null
  if (v.type === 'color') {
    const hex = typeof raw === 'string' ? raw : '#000000'
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md bg-elevated px-2 py-1.5">
          <ColorWell value={hex} onChange={(c) => set(c)} />
          <input value={hex.replace('#', '').toUpperCase()} onChange={(e) => set(e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)} className="min-w-0 flex-1 bg-transparent text-[12px] text-text-primary focus:outline-none" />
        </div>
        {aliasBtn}
      </div>
    )
  }
  if (v.type === 'number') {
    const n = typeof raw === 'number' ? raw : 0
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <NumberField value={n} onChange={(val) => set(val)} precision={2} fieldClassName="rounded-md bg-elevated px-2 py-1.5" />
        {aliasBtn}
      </div>
    )
  }
  if (v.type === 'boolean') {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
        <BoolToggle value={raw === true} onChange={(b) => set(b)} />
        {aliasBtn}
      </div>
    )
  }
  // string
  const s = typeof raw === 'string' ? raw : ''
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <input value={s} onChange={(e) => set(e.target.value)} placeholder="value" className="min-w-0 flex-1 rounded-md t42-field px-2 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted" />
      {aliasBtn}
    </div>
  )
}

// Small type glyphs for the variables table (no boxes/emoji — plain marks).
function VarTypeIcon({ type }: { type: VarType }): JSX.Element {
  if (type === 'color') return <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden><circle cx="8" cy="8" r="5.4" /><path d="M8 2.6a5.4 5.4 0 0 0 0 10.8z" fill="currentColor" stroke="none" /></svg>
  if (type === 'number') return <span className="text-[12px] font-medium leading-none">#</span>
  if (type === 'boolean') return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden><rect x="1.5" y="4.5" width="13" height="7" rx="3.5" /><circle cx="11" cy="8" r="2.2" fill="currentColor" stroke="none" /></svg>
  return <span className="text-[12px] font-medium leading-none">T</span>
}

const IcoSearch = (): JSX.Element => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5 14 14" /></svg>
const IcoEdit = (): JSX.Element => <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9.5 3.2 12.8 6.5M3 13l.6-2.4 6.4-6.4a1.2 1.2 0 0 1 1.7 0l.7.7a1.2 1.2 0 0 1 0 1.7l-6.4 6.4L3 13z" /></svg>
const IcoCheck = (): JSX.Element => <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></svg>

/** Variable name cell: shows the leaf segment, click to rename the full path. */
function VarNameCell({ name, onCommit }: { name: string; onCommit: (v: string) => void }): JSX.Element {
  const [editing, setEditing] = useState(false)
  const { leaf } = splitVarName(name)
  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={name}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => { const v = e.target.value.trim(); setEditing(false); if (v && v !== name) onCommit(v) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { (e.target as HTMLInputElement).value = name; (e.target as HTMLInputElement).blur() } }}
        className="min-w-0 flex-1 rounded bg-elevated px-1 py-0.5 text-[12px] text-text-primary focus:outline-none"
      />
    )
  }
  return <button type="button" onClick={() => setEditing(true)} title={name} className="min-w-0 flex-1 truncate text-left text-[12px] text-text-primary">{leaf}</button>
}

// ── Styles panel (colour / text / effect) ─────────────────────────────────────
const STYLE_TYPES: { id: StyleType; label: string }[] = [
  { id: 'color', label: 'Color' },
  { id: 'text', label: 'Text' },
  { id: 'effect', label: 'Effect' },
]

function styleCount(lib: StyleLibrary, t: StyleType): number {
  return t === 'color' ? lib.colors.length : t === 'text' ? lib.text.length : lib.effects.length
}

/** Left-panel navigation for styles: the three style types with counts. */
function StylesNav({ styles, typeFilter, setTypeFilter }: { styles: StyleLibrary; typeFilter: StyleType; setTypeFilter: (t: StyleType) => void }): JSX.Element {
  return (
    <div className="flex-1 overflow-y-auto pb-2">
      <div className={`${PANEL_HEADER_ROW} ${PANEL_HEADER_TEXT}`}>Styles</div>
      <div className="px-1.5 pb-1">
        {STYLE_TYPES.map((t) => (
          <button key={t.id} type="button" onClick={() => setTypeFilter(t.id)} className={['flex w-full items-center justify-between gap-1 rounded px-2 py-1.5 text-left text-[12px]', t.id === typeFilter ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-elevated'].join(' ')}>
            <span>{t.label}</span><span className="text-[10.5px] tabular-nums text-text-muted">{styleCount(styles, t.id)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

interface LibraryControlsProps {
  libraries: PublishedLibrary[]
  publishToLibrary: () => void
  addLibraryToFile: (id: string) => void
  removeLibrary: (id: string) => void
  canPublish: boolean
}

/** Publish the file's variables + styles as a shared library, and pull published
 * libraries from other files into this one. Shared by the Variables + Styles views. */
function LibraryControls({ libraries, publishToLibrary, addLibraryToFile, removeLibrary, canPublish }: LibraryControlsProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const items: MenuItem[] = libraries.length
    ? libraries.flatMap((l) => {
        const a = totalAssets(l)
        return [
          { label: `Add ${l.name} · ${a.vars + a.styles} assets`, onClick: () => addLibraryToFile(l.id) },
          { label: `Remove ${l.name}`, onClick: () => removeLibrary(l.id) },
        ]
      })
    : [{ label: 'No published libraries', onClick: () => {} }]
  return (
    <>
      <button type="button" onClick={publishToLibrary} disabled={!canPublish} title="Publish this file's variables and styles as a shared library" className="rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40">Publish</button>
      <div className="relative">
        <button type="button" onClick={() => setOpen((v) => !v)} title="Add variables and styles from a published library" className="rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary">Libraries</button>
        <Menu open={open} onClose={() => setOpen(false)} items={items} width={240} />
      </div>
    </>
  )
}

interface StylesPanelProps {
  styles: StyleLibrary
  collections: VariableCollection[]
  typeFilter: StyleType
  selCount: number
  libraries: PublishedLibrary[]
  publishToLibrary: () => void
  addLibraryToFile: (id: string) => void
  removeLibrary: (id: string) => void
  addColorStyle: () => void
  addTextStyle: () => void
  addEffectStyle: () => void
  updateColorStyle: (id: string, patch: Partial<ColorStyle>) => void
  updateTextStyle: (id: string, patch: Partial<TextStyle>) => void
  renameStyle: (type: StyleType, id: string, name: string) => void
  removeStyle: (type: StyleType, id: string) => void
  applyStyleToSel: (type: StyleType, id: string) => void
  openPicker: OpenPicker
}

/** Main-stage editor for document styles: create from selection, list, edit, apply. */
function StylesPanel(props: StylesPanelProps): JSX.Element {
  const { styles, collections, typeFilter, selCount, libraries, publishToLibrary, addLibraryToFile, removeLibrary, addColorStyle, addTextStyle, addEffectStyle, updateColorStyle, updateTextStyle, renameStyle, removeStyle, applyStyleToSel, openPicker } = props
  const t = typeFilter
  const label = STYLE_TYPES.find((x) => x.id === t)?.label ?? 'Styles'
  const add = t === 'color' ? addColorStyle : t === 'text' ? addTextStyle : addEffectStyle
  const list: { id: string; name: string }[] = t === 'color' ? styles.colors : t === 'text' ? styles.text : styles.effects
  const canPublish = !!collections.length || (styles.colors.length + styles.text.length + styles.effects.length) > 0
  const colorVars = collections.flatMap((c) => c.variables.filter((v) => v.type === 'color').map((v) => ({
    id: v.id, name: collections.length > 1 ? `${c.name} / ${v.name}` : v.name,
    hex: (() => { const r = resolveVarValue(collections, v.id); return typeof r === 'string' ? r : '#000000' })(),
  })))
  return (
    <div className="absolute inset-0 z-40 flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-1 px-4 py-2.5" style={{ minHeight: 44 }}>
        <h2 className="text-[13px] font-medium text-text-primary">{label} styles</h2>
        <div className="flex-1" />
        <LibraryControls libraries={libraries} publishToLibrary={publishToLibrary} addLibraryToFile={addLibraryToFile} removeLibrary={removeLibrary} canPublish={canPublish} />
        <button type="button" onClick={add} className="rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary" title={selCount ? `Create ${label.toLowerCase()} style from the selection` : `Create a ${label.toLowerCase()} style`}>{selCount ? `New from selection` : `New ${label.toLowerCase()} style`}</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {list.length === 0 && (
          <p className="px-1 pt-2 text-[12px] leading-relaxed text-text-muted">No {label.toLowerCase()} styles yet. Select an object and choose New from selection, or add one and edit its values.</p>
        )}
        {t === 'color' && styles.colors.map((s) => {
          const hex = resolveColorStyle(styles, collections, s.id) ?? s.color
          return (
            <div key={s.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-elevated/50">
              <button type="button" title="Edit colour" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openPicker({ value: hex, opacity: 1, anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, colorVars, onChange: (h) => updateColorStyle(s.id, { color: h, colorVar: undefined }), onBindVar: (id) => updateColorStyle(s.id, { colorVar: id }) }) }} className="h-6 w-6 shrink-0 rounded" style={{ background: hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.12)' }} />
              <div className="min-w-0 flex-1">
                <InlineName value={s.name} onCommit={(v) => renameStyle('color', s.id, v)} />
                <div className="text-[10.5px] tabular-nums text-text-muted">{s.colorVar ? (colorVars.find((cv) => cv.id === s.colorVar)?.name ?? 'variable') : hex.toUpperCase()}</div>
              </div>
              <button type="button" onClick={() => applyStyleToSel('color', s.id)} disabled={!selCount} className="shrink-0 rounded px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40" title="Apply to selection">Apply</button>
              <button type="button" onClick={() => removeStyle('color', s.id)} className="hidden h-5 w-5 shrink-0 place-items-center rounded text-text-muted hover:text-text-primary group-hover:grid" title="Delete style"><IcoClose /></button>
            </div>
          )
        })}
        {t === 'text' && styles.text.map((s) => (
          <div key={s.id} className="group rounded-md px-1 py-2 hover:bg-elevated/50">
            <div className="flex items-center gap-2.5">
              <div className="min-w-0 flex-1">
                <InlineName value={s.name} onCommit={(v) => renameStyle('text', s.id, v)} />
                <div className="truncate text-[10.5px] text-text-muted" style={{ fontFamily: fontByLabel(s.fontFamily).stack }}>{s.fontFamily} · {s.fontSize}px · {WEIGHTS.find((w) => w.value === s.fontWeight)?.label ?? s.fontWeight}</div>
              </div>
              <button type="button" onClick={() => applyStyleToSel('text', s.id)} disabled={!selCount} className="shrink-0 rounded px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40" title="Apply to selection">Apply</button>
              <button type="button" onClick={() => removeStyle('text', s.id)} className="hidden h-5 w-5 shrink-0 place-items-center rounded text-text-muted hover:text-text-primary group-hover:grid" title="Delete style"><IcoClose /></button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select value={s.fontFamily} onChange={(e) => updateTextStyle(s.id, { fontFamily: e.target.value })} className="rounded t42-field px-1.5 py-1 text-[11px] text-text-primary">
                {FONTS.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
              </select>
              <select value={s.fontWeight} onChange={(e) => updateTextStyle(s.id, { fontWeight: Number(e.target.value) })} className="rounded t42-field px-1.5 py-1 text-[11px] text-text-primary">
                {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              <label className="flex items-center gap-1 text-[11px] text-text-muted">size<input type="number" value={s.fontSize} min={1} onChange={(e) => updateTextStyle(s.id, { fontSize: Number(e.target.value) || s.fontSize })} className="w-12 rounded t42-field px-1.5 py-1 text-[11px] tabular-nums text-text-primary" /></label>
              <label className="flex items-center gap-1 text-[11px] text-text-muted">line<input type="number" step="0.1" value={s.lineHeight} min={0} onChange={(e) => updateTextStyle(s.id, { lineHeight: Number(e.target.value) || s.lineHeight })} className="w-12 rounded t42-field px-1.5 py-1 text-[11px] tabular-nums text-text-primary" /></label>
            </div>
          </div>
        ))}
        {t === 'effect' && styles.effects.map((s) => (
          <div key={s.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-elevated/50">
            <div className="min-w-0 flex-1">
              <InlineName value={s.name} onCommit={(v) => renameStyle('effect', s.id, v)} />
              <div className="truncate text-[10.5px] text-text-muted">{s.effects.length ? s.effects.map((e) => EFFECT_LABEL[e.type]).join(', ') : 'No effects'}</div>
            </div>
            <button type="button" onClick={() => applyStyleToSel('effect', s.id)} disabled={!selCount} className="shrink-0 rounded px-2 py-1 text-[11px] text-text-secondary hover:bg-elevated hover:text-text-primary disabled:opacity-40" title="Apply to selection">Apply</button>
            <button type="button" onClick={() => removeStyle('effect', s.id)} className="hidden h-5 w-5 shrink-0 place-items-center rounded text-text-muted hover:text-text-primary group-hover:grid" title="Delete style"><IcoClose /></button>
          </div>
        ))}
      </div>
    </div>
  )
}

interface VariablesNavProps {
  collections: VariableCollection[]
  activeColId: string
  setActiveColId: (id: string) => void
  groupFilter: string | null
  setGroupFilter: (g: string | null) => void
  addCollection: () => void
  removeCollection: (id: string) => void
  patchCollection: (id: string, fn: (c: VariableCollection) => VariableCollection) => void
}

/** Left-panel navigation for variables: collections and their "/"-path groups.
 * Lives under the side-panel tabs; the table renders in the main stage area. */
function VariablesNav(props: VariablesNavProps): JSX.Element {
  const { collections, activeColId, setActiveColId, groupFilter, setGroupFilter, addCollection, removeCollection, patchCollection } = props
  const [renameColId, setRenameColId] = useState<string | null>(null)
  const col = collections.find((c) => c.id === activeColId) ?? collections[0]
  const groups = col ? variableGroups(col.variables) : []
  return (
    <div className="flex-1 overflow-y-auto pb-2">
      <div className={`flex items-center justify-between ${PANEL_HEADER_ROW}`}>
        <span className={PANEL_HEADER_TEXT}>Collections</span>
        <button type="button" onClick={addCollection} title="New collection" className="text-text-muted hover:text-text-primary"><IcoPlus /></button>
      </div>
      <div className="px-1.5 pb-1">
        {collections.length === 0 && <div className="px-2 py-1.5 text-[12px] text-text-muted">No collections yet.</div>}
        {collections.map((c) => (
          <div key={c.id} className={['group flex items-center gap-1 rounded px-2 py-1.5', c.id === col?.id ? 'bg-white/10' : 'hover:bg-elevated'].join(' ')}>
            {renameColId === c.id
              ? <InlineName value={c.name} onCommit={(v) => { patchCollection(c.id, (x) => ({ ...x, name: v })); setRenameColId(null) }} className="min-w-0 flex-1 bg-transparent text-[12px] text-text-primary focus:outline-none" />
              : <button type="button" onClick={() => setActiveColId(c.id)} onDoubleClick={() => setRenameColId(c.id)} title="Click to open; double-click to rename" className="min-w-0 flex-1 truncate text-left text-[12px] text-text-primary">{c.name}</button>}
            <span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">{c.variables.length}</span>
            {collections.length > 1 && <button type="button" onClick={() => removeCollection(c.id)} title="Delete collection" className="hidden h-4 w-4 shrink-0 place-items-center rounded text-text-muted hover:text-text-primary group-hover:grid"><IcoClose /></button>}
          </div>
        ))}
      </div>
      {groups.length > 0 && (
        <>
          <div className="mx-3" />
          <div className={`${PANEL_HEADER_ROW} ${PANEL_HEADER_TEXT}`}>Groups</div>
          <div className="px-1.5 pb-3">
            <button type="button" onClick={() => setGroupFilter(null)} className={['flex w-full items-center justify-between gap-1 rounded px-2 py-1 text-left text-[12px]', groupFilter === null ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-elevated'].join(' ')}>
              <span>All</span><span className="text-[10.5px] tabular-nums text-text-muted">{col?.variables.length ?? 0}</span>
            </button>
            {groups.map((g) => (
              <button key={g.path} type="button" onClick={() => setGroupFilter(g.path)} style={{ paddingLeft: 8 + g.depth * 12 }} className={['flex w-full items-center justify-between gap-1 rounded py-1 pr-2 text-left text-[12px]', groupFilter === g.path ? 'bg-white/10 text-text-primary' : 'text-text-secondary hover:bg-elevated'].join(' ')}>
                <span className="min-w-0 truncate">{g.path.split('/').pop()}</span><span className="shrink-0 text-[10.5px] tabular-nums text-text-muted">{g.count}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

interface VariablesTableProps {
  collections: VariableCollection[]
  col: VariableCollection | undefined
  query: string
  setQuery: (q: string) => void
  groupFilter: string | null
  setGroupFilter: (g: string | null) => void
  addMode: (colId: string) => void
  removeMode: (colId: string, modeId: string) => void
  setActiveMode: (colId: string, modeId: string) => void
  moveMode: (colId: string, modeId: string, dir: -1 | 1) => void
  duplicateMode: (colId: string, modeId: string) => void
  addVariable: (colId: string, type: VarType) => void
  removeVariable: (colId: string, varId: string) => void
  duplicateVariable: (colId: string, varId: string) => void
  copyVariable: (colId: string, varId: string) => void
  pasteVariable: (colId: string) => void
  setVariableGroup: (colId: string, varId: string, groupPath: string) => void
  varClip: VarClip | null
  setVarValue: (colId: string, varId: string, modeId: string, value: VarValue) => void
  patchCollection: (id: string, fn: (c: VariableCollection) => VariableCollection) => void
  addCollection: () => void
  exportTokens: () => void
  importTokens: () => void
  libraries: PublishedLibrary[]
  publishToLibrary: () => void
  addLibraryToFile: (id: string) => void
  removeLibrary: (id: string) => void
}

/** The variables spreadsheet, shown in the main stage area while the Variables
 * tab is active: rows (grouped by "/" path) against one column per mode. */
function VariablesTable(props: VariablesTableProps): JSX.Element {
  const { collections, col, query, setQuery, groupFilter, addMode, removeMode, setActiveMode, moveMode, duplicateMode, addVariable, removeVariable, duplicateVariable, copyVariable, pasteVariable, setVariableGroup, varClip, setVarValue, patchCollection, addCollection, exportTokens, importTokens, libraries, publishToLibrary, addLibraryToFile, removeLibrary } = props
  const [renameModeId, setRenameModeId] = useState<string | null>(null)
  const [modeMenuId, setModeMenuId] = useState<string | null>(null)
  const [rowMenuId, setRowMenuId] = useState<string | null>(null)
  const [dragVarId, setDragVarId] = useState<string | null>(null)
  const [dropGroup, setDropGroup] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editVarId, setEditVarId] = useState<string | null>(null)
  const editVar = col?.variables.find((v) => v.id === editVarId) ?? null

  const addItems: MenuItem[] = (['color', 'number', 'string', 'boolean'] as VarType[]).map((t) => ({
    label: t === 'color' ? 'Color' : t === 'number' ? 'Number' : t === 'string' ? 'Text' : 'Boolean',
    onClick: () => { if (col) addVariable(col.id, t) },
  }))

  const q = query.trim().toLowerCase()
  const visible = col ? groupedVariables(col.variables).filter((gv) => {
    if (q && !gv.variable.name.toLowerCase().includes(q)) return false
    if (groupFilter) { const p = gv.group.join('/'); if (p !== groupFilter && !p.startsWith(`${groupFilter}/`)) return false }
    return true
  }) : []
  const gridCols = col ? `minmax(220px,1.2fr) ${col.modes.map(() => 'minmax(180px,1fr)').join(' ')} 44px` : ''
  let prevGroup = '\u0000'

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-surface">
      <div className="flex shrink-0 items-center gap-3 px-4" style={{ height: 44 }}>
        <span className="truncate text-[12px] font-semibold text-text-primary">{col?.name ?? 'Variables'}</span>
        <div className="flex-1" />
        <LibraryControls libraries={libraries} publishToLibrary={publishToLibrary} addLibraryToFile={addLibraryToFile} removeLibrary={removeLibrary} canPublish={!!collections.length} />
        <button type="button" onClick={importTokens} title="Import design tokens (DTCG / W3C JSON)" className="rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary">Import</button>
        <button type="button" onClick={exportTokens} title="Export design tokens (DTCG / W3C JSON)" className="rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary">Export</button>
        <div className="flex items-center gap-1.5 rounded-md bg-elevated px-2 py-1.5 text-text-muted">
          <IcoSearch />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search variables" className="w-48 bg-transparent text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none" />
        </div>
      </div>

      {col ? (
        <>
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="min-w-max">
              <div className="sticky top-0 z-10 grid items-center bg-surface" style={{ gridTemplateColumns: gridCols }}>
                <div className="px-3 py-2.5 text-[11px] font-medium text-text-muted">Name</div>
                {col.modes.map((m) => (
                  <div key={m.id} className={['group flex items-center gap-1 px-3 py-2.5', m.id === col.activeMode ? 'bg-white/[0.05]' : ''].join(' ')}>
                    {renameModeId === m.id
                      ? <InlineName value={m.name} onCommit={(v) => { patchCollection(col.id, (c) => ({ ...c, modes: c.modes.map((x) => (x.id === m.id ? { ...x, name: v } : x)) })); setRenameModeId(null) }} className="w-full min-w-0 bg-transparent text-[11px] font-medium text-text-primary focus:outline-none" />
                      : <button type="button" onClick={() => setActiveMode(col.id, m.id)} onDoubleClick={() => setRenameModeId(m.id)} title="Click to apply this mode on the canvas; double-click to rename" className={['flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-[11px] font-medium', m.id === col.activeMode ? 'text-text-primary' : 'text-text-secondary'].join(' ')}>
                          {m.id === col.activeMode && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-text-primary" />}{m.name}
                        </button>}
                    {col.modes.length > 1 && (() => {
                      const i = col.modes.findIndex((x) => x.id === m.id)
                      const items: MenuItem[] = [
                        { label: 'Set as default', active: m.id === col.activeMode, onClick: () => setActiveMode(col.id, m.id) },
                        { label: 'Rename', onClick: () => setRenameModeId(m.id) },
                        { label: 'Duplicate', onClick: () => duplicateMode(col.id, m.id) },
                        ...(i > 0 ? [{ label: 'Move left', onClick: () => moveMode(col.id, m.id, -1) }] : []),
                        ...(i < col.modes.length - 1 ? [{ label: 'Move right', onClick: () => moveMode(col.id, m.id, 1) }] : []),
                        { label: 'Delete', onClick: () => removeMode(col.id, m.id) },
                      ]
                      return (
                        <div className="relative">
                          <button type="button" onClick={() => setModeMenuId((v) => (v === m.id ? null : m.id))} title="Mode options" className={['hidden h-5 w-5 place-items-center rounded text-text-muted hover:text-text-primary group-hover:grid', modeMenuId === m.id ? '!grid' : ''].join(' ')}><IcoMore /></button>
                          <Menu open={modeMenuId === m.id} onClose={() => setModeMenuId(null)} items={items} align="right" width={150} />
                        </div>
                      )
                    })()}
                  </div>
                ))}
                <button type="button" onClick={() => addMode(col.id)} title="Add mode" className="grid place-items-center self-stretch text-text-muted hover:text-text-primary"><IcoPlus /></button>
              </div>

              {visible.length === 0 && <div className="px-3 py-6 text-[12px] text-text-muted">{col.variables.length ? 'No variables match your search.' : 'No variables yet. Create one below.'}</div>}
              {visible.map((gv) => {
                const rawGroup = gv.group.join('/')
                const gp = gv.group.join(' / ')
                const header = gp && gp !== prevGroup ? gp : null
                prevGroup = gp
                const rowItems: MenuItem[] = [
                  { label: 'Duplicate', onClick: () => duplicateVariable(col.id, gv.variable.id) },
                  { label: 'Copy', onClick: () => copyVariable(col.id, gv.variable.id) },
                  { label: 'Delete', onClick: () => removeVariable(col.id, gv.variable.id) },
                ]
                return (
                  <Fragment key={gv.variable.id}>
                    {header !== null && (
                      <div
                        onDragOver={(e) => { if (dragVarId) { e.preventDefault(); setDropGroup(rawGroup) } }}
                        onDragLeave={() => setDropGroup((g) => (g === rawGroup ? null : g))}
                        onDrop={(e) => { e.preventDefault(); if (dragVarId) setVariableGroup(col.id, dragVarId, rawGroup); setDragVarId(null); setDropGroup(null) }}
                        className={['px-3 py-1.5 text-[11px] font-semibold text-text-secondary', dropGroup === rawGroup ? 'bg-[#2f6fed]/15' : 'bg-bg/30'].join(' ')}
                      >{header}</div>
                    )}
                    <div
                      onDragOver={(e) => { if (dragVarId && dragVarId !== gv.variable.id) { e.preventDefault(); setDropGroup(rawGroup) } }}
                      onDrop={(e) => { if (dragVarId && dragVarId !== gv.variable.id) { e.preventDefault(); setVariableGroup(col.id, dragVarId, rawGroup) } setDragVarId(null); setDropGroup(null) }}
                      className={['group grid items-stretch hover:bg-white/[0.02]', dragVarId === gv.variable.id ? 'opacity-50' : ''].join(' ')}
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      <div className="flex min-w-0 items-center gap-2 px-3 py-1.5">
                        <span
                          draggable
                          onDragStart={(e) => { setDragVarId(gv.variable.id); e.dataTransfer.effectAllowed = 'move' }}
                          onDragEnd={() => { setDragVarId(null); setDropGroup(null) }}
                          title="Drag to move into a group"
                          className="grid h-4 w-4 shrink-0 cursor-grab place-items-center text-text-muted active:cursor-grabbing"
                        ><VarTypeIcon type={gv.variable.type} /></span>
                        <VarNameCell name={gv.variable.name} onCommit={(nv) => patchCollection(col.id, (c) => ({ ...c, variables: c.variables.map((x) => (x.id === gv.variable.id ? { ...x, name: nv } : x)) }))} />
                        <div className="relative ml-auto shrink-0">
                          <button type="button" onClick={() => setRowMenuId((v) => (v === gv.variable.id ? null : gv.variable.id))} title="Variable options" className={['hidden h-5 w-5 place-items-center rounded text-text-muted hover:text-text-primary group-hover:grid', rowMenuId === gv.variable.id ? '!grid' : ''].join(' ')}><IcoMore /></button>
                          <Menu open={rowMenuId === gv.variable.id} onClose={() => setRowMenuId(null)} items={rowItems} align="right" width={140} />
                        </div>
                      </div>
                      {col.modes.map((m) => (
                        <div key={m.id} className={['flex items-center px-2 py-1.5', m.id === col.activeMode ? 'bg-white/[0.03]' : ''].join(' ')}>
                          <VarValueEditor collections={collections} col={col} v={gv.variable} modeId={m.id} setVarValue={setVarValue} />
                        </div>
                      ))}
                      <div className="flex items-center justify-center">
                        <button type="button" onClick={() => setEditVarId(gv.variable.id)} title="Edit variable" className="hidden h-6 w-6 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary group-hover:grid"><IcoEdit /></button>
                      </div>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          </div>
          <div className="relative flex items-center gap-1 px-3 py-2">
            <button type="button" onClick={() => setAddOpen((o) => !o)} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary"><IcoPlus /> Create variable</button>
            {varClip && <button type="button" onClick={() => pasteVariable(col.id)} title={`Paste ${varClip.name}`} className="rounded-md px-2 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary">Paste variable</button>}
            <Menu open={addOpen} onClose={() => setAddOpen(false)} items={addItems} align="left" width={150} />
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="max-w-xs text-[12px] leading-relaxed text-text-secondary">Variables hold reusable values like colours, numbers and text, with modes such as light and dark. Bind them to layer properties from the inspector.</p>
          <button type="button" onClick={addCollection} className="rounded-md bg-elevated px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-elevated/70">Create collection</button>
        </div>
      )}
      {col && editVar && <VarEditModal col={col} variable={editVar} onClose={() => setEditVarId(null)} patchCollection={patchCollection} />}
    </div>
  )
}

/** Focused editor for a single variable: name, description and per-platform code
 * syntax used for developer handoff. Opened from the edit icon on a table row. */
function VarEditModal({ col, variable, onClose, patchCollection }: { col: VariableCollection; variable: Variable; onClose: () => void; patchCollection: (id: string, fn: (c: VariableCollection) => VariableCollection) => void }): JSX.Element {
  const [name, setName] = useState(variable.name)
  const [description, setDescription] = useState(variable.description ?? '')
  const [web, setWeb] = useState(variable.codeSyntax?.web ?? '')
  const [android, setAndroid] = useState(variable.codeSyntax?.android ?? '')
  const [ios, setIos] = useState(variable.codeSyntax?.ios ?? '')
  const [scopes, setScopes] = useState<VarScope[]>(variable.scopes ?? [])
  const scopeOptions = scopesForType(variable.type)
  const allScopes = scopes.length === 0
  const toggleScope = (s: VarScope): void =>
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const commit = useCallback((): void => {
    const cs = { web: web.trim() || undefined, android: android.trim() || undefined, ios: ios.trim() || undefined }
    const hasCs = cs.web || cs.android || cs.ios
    patchCollection(col.id, (c) => ({
      ...c,
      variables: c.variables.map((v) => (v.id === variable.id
        ? { ...v, name: name.trim() || v.name, description: description.trim() || undefined, codeSyntax: hasCs ? cs : undefined, scopes: scopes.length ? scopes : undefined }
        : v)),
    }))
    onClose()
  }, [web, android, ios, name, description, scopes, patchCollection, col.id, variable.id, onClose])

  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const inputCls = 'w-full rounded-md bg-elevated px-2.5 py-1.5 text-[12px] text-text-primary placeholder:text-text-muted focus:outline-none'

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40" onPointerDown={onClose}>
      <div className="w-[380px] rounded-lg bg-raised p-4 shadow-overlay" onPointerDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-4 w-4 place-items-center text-text-muted"><VarTypeIcon type={variable.type} /></span>
          <span className="text-[13px] font-semibold text-text-primary">Edit variable</span>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className={`mb-1 block ${PANEL_HEADER_TEXT}`}>Name</span>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className={`mb-1 block ${PANEL_HEADER_TEXT}`}>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Explain how this variable should be used" className={`${inputCls} resize-none leading-relaxed`} />
          </label>
          <div>
            <span className={`mb-1.5 block ${PANEL_HEADER_TEXT}`}>Code syntax</span>
            <div className="space-y-1.5">
              {([['Web', web, setWeb, '--radius-sm'], ['iOS', ios, setIos, 'radiusSm'], ['Android', android, setAndroid, 'radius_sm']] as const).map(([lbl, val, setV, ph]) => (
                <div key={lbl} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11px] text-text-muted">{lbl}</span>
                  <input value={val} onChange={(e) => setV(e.target.value)} placeholder={ph} className={`${inputCls} font-mono`} />
                </div>
              ))}
            </div>
          </div>
          {scopeOptions.length > 0 && (
            <div>
              <span className={`mb-1.5 block ${PANEL_HEADER_TEXT}`}>Scope</span>
              <p className="mb-2 text-[11px] leading-relaxed text-text-muted">Choose where this variable can be applied. Leave all off to allow every {variable.type} property.</p>
              <div className="space-y-0.5">
                <button type="button" onClick={() => setScopes([])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-elevated">
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-sm ${allScopes ? 'text-text-primary' : 'text-transparent'}`}><IcoCheck /></span>
                  <span className="text-[12px] text-text-primary">All properties</span>
                </button>
                {scopeOptions.map((s) => {
                  const on = scopes.includes(s)
                  return (
                    <button key={s} type="button" onClick={() => toggleScope(s)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-elevated">
                      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-sm ${on ? 'text-text-primary' : 'text-transparent'}`}><IcoCheck /></span>
                      <span className="text-[12px] text-text-primary">{SCOPE_LABEL[s]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-[12px] text-text-secondary hover:bg-elevated hover:text-text-primary">Cancel</button>
          <button type="button" onClick={commit} className="rounded-md bg-elevated px-3 py-1.5 text-[12px] font-medium text-text-primary hover:bg-elevated/70">Save changes</button>
        </div>
      </div>
    </div>
  )
}

// ── Inspector (right panel) ────────────────────────────────────────────────────
const ARTBOARD_PRESETS: { group: string; items: { name: string; w: number; h: number }[] }[] = [
  { group: 'Phone', items: [
    { name: 'iPhone 16', w: 393, h: 852 },
    { name: 'iPhone 16 Pro Max', w: 440, h: 956 },
    { name: 'Android', w: 360, h: 800 },
  ] },
  { group: 'Tablet', items: [
    { name: 'iPad mini', w: 744, h: 1133 },
    { name: 'iPad Pro 11"', w: 834, h: 1194 },
  ] },
  { group: 'Desktop', items: [
    { name: 'Desktop', w: 1440, h: 1024 },
    { name: 'Wireframe', w: 1280, h: 800 },
  ] },
  { group: 'Social', items: [
    { name: 'Post', w: 1080, h: 1080 },
    { name: 'Story', w: 1080, h: 1920 },
  ] },
  { group: 'Watch', items: [
    { name: 'Watch 45mm', w: 198, h: 242 },
  ] },
]

function ArtboardGlyph({ w, h }: { w: number; h: number }): JSX.Element {
  const gh = 15
  const gw = Math.max(8, Math.min(20, (gh * w) / h))
  return (
    <span className="grid w-5 shrink-0 place-items-center text-text-muted">
      <svg width={gw} height={gh} viewBox={`0 0 ${gw} ${gh}`} fill="none"><rect x="0.6" y="0.6" width={gw - 1.2} height={gh - 1.2} rx="1.5" stroke="currentColor" strokeWidth="1.2" /></svg>
    </span>
  )
}

/** Normalize a colour string to "#RRGGBB" (uppercase), or null if not a hex colour. */
function normHex(c?: string): string | null {
  if (!c) return null
  let h = c.trim().toUpperCase()
  if (h.startsWith('#')) h = h.slice(1)
  if (!/^([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/.test(h)) return null
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('')
  return '#' + h.slice(0, 6)
}

/** Every descendant (recursively) of `rootId` within `all`. */
function descendantsOf(all: FObj[], rootId: string): FObj[] {
  const out: FObj[] = []
  const stack = [rootId]
  const seen = new Set<string>([rootId])
  while (stack.length) {
    const id = stack.pop() as string
    for (const o of all) if (o.parent === id && !seen.has(o.id)) { seen.add(o.id); out.push(o); stack.push(o.id) }
  }
  return out
}

/** Objects whose centre falls inside an artboard's bounds. */
function objectsInArtboard(all: FObj[], ab: { x: number; y: number; w: number; h: number }): FObj[] {
  return all.filter((o) => {
    const cx = o.x + o.w / 2; const cy = o.y + o.h / 2
    return cx >= ab.x && cx <= ab.x + ab.w && cy >= ab.y && cy <= ab.y + ab.h
  })
}

/** Tally the distinct solid colours (fills, strokes, text, gradient stops) used. */
function collectSelectionColors(objs: FObj[]): { hex: string; count: number }[] {
  const map = new Map<string, number>()
  const add = (c?: string): void => { const h = normHex(c); if (h) map.set(h, (map.get(h) ?? 0) + 1) }
  for (const o of objs) {
    if (o.type === 'text') add(o.color)
    else if (o.fillEnabled && (o.fillMode ?? 'solid') === 'solid') add(o.fill)
    if (o.fillMode === 'gradient') (o.gradientStops ?? []).forEach((s) => add(s.color))
    if (o.strokeEnabled && (o.strokeMode ?? 'solid') === 'solid') add(o.stroke)
  }
  return [...map.entries()].map(([hex, count]) => ({ hex, count })).sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex))
}

/** A Selection-colors row: swatch (opens the app's floating ColorPicker) + hex + count.
 * Picking a colour replaces that colour everywhere it's used in the selection. */
function SelColorRow({ hex, count, ids, onReplaceColor }: { hex: string; count: number; ids: string[]; onReplaceColor: (ids: string[], oldHex: string, newHex: string) => void }): JSX.Element {
  const { openPicker } = useContext(EditContext)
  const ref = useRef<HTMLButtonElement>(null)
  const open = (): void => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return
    const st = { from: hex }
    openPicker({ value: hex, opacity: 1, showAlpha: false, anchor: { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, onChange: (nv: string) => { onReplaceColor(ids, st.from, nv); st.from = nv } })
  }
  return (
    <div className="flex items-center gap-2.5 rounded px-1 py-1 hover:bg-elevated">
      <button ref={ref} type="button" onClick={open} className="h-5 w-5 shrink-0 overflow-hidden rounded-[5px]" style={{ background: hex }} aria-label={`Edit colour ${hex}`} />
      <span className="min-w-0 flex-1 font-mono text-[11.5px] uppercase text-text-secondary">{hex.replace('#', '')}</span>
      <span className="text-[11px] tabular-nums text-text-muted">{count}</span>
    </div>
  )
}

function Inspector({ width, tool, abSelected, selObjs, sel, patch, patchObj, gradOpenMode, onToggleGradOpts, onOpenEffect, activeEffectId, pushHistory, removeSel, arrange, groupSelection, wrapInFlex, doAlign, doDistribute, doResizeToFill, artboards, activeAb, setActiveAb, patchAb, addArtboard, removeArtboard, onExport, onExportSelection, isKeyed, toggleKey, autoRecord, motionDur, playhead, recordKey, resetTransform, allObjects, onReplaceColor, timelineOpen , autoKey }: {
  width: number
  tool: Tool
  abSelected: boolean
  selObjs: FObj[]
  sel: FObj | null
  patch: (id: string, p: Partial<FObj>) => void
  patchObj: (id: string, fn: (o: FObj) => Partial<FObj>) => void
  onReplaceColor: (ids: string[], oldHex: string, newHex: string) => void
  gradOpenMode: string | null
  onToggleGradOpts: (anchor: DOMRect | null, cfg: PaintCfg | null) => void
  onOpenEffect: (id: string, anchor: DOMRect) => void
  activeEffectId: string | null
  pushHistory: () => void
  removeSel: () => void
  arrange: (dir: 'front' | 'back' | 'forward' | 'backward') => void
  groupSelection: (mode?: 'none' | 'horizontal' | 'vertical') => void
  wrapInFlex: () => void
  doAlign: (m: AlignMode) => void
  doDistribute: (a: 'h' | 'v') => void
  doResizeToFill: () => void
  artboards: Artboard[]
  activeAb: string
  setActiveAb: (id: string) => void
  patchAb: (id: string, p: Partial<Artboard>) => void
  addArtboard: (w: number, h: number, label: string) => void
  removeArtboard: (id: string) => void
  onExport: (format: 'html' | 'svg' | 'png' | 'video') => void
  onExportSelection: (format: 'png' | 'svg', scale?: number) => void
  isKeyed: (o: FObj, prop: PropName) => boolean
  toggleKey: (o: FObj, prop: PropName, value: number) => void
  autoRecord: (o: FObj, prop: PropName, value: number) => void
  motionDur: number
  playhead: number
  recordKey: (o: FObj, prop: PropName, value: number) => void
  resetTransform: (o: FObj) => void
  allObjects: FObj[]
  timelineOpen: boolean
  autoKey: boolean
}): JSX.Element {
  const multi = selObjs.length > 1
  const varBind = useContext(VarBindContext)
  const hasVars = varBind.collections.length > 0
  const [exportScale, setExportScale] = useState(1)
  const [exportFormat, setExportFormat] = useState<'png' | 'svg'>('png')
  // Legacy shadow/blur fields settle into the effects array once per selection, so
  // the Shadow, Inner shadow and Filters sections all read one list.
  const selId = sel?.id
  useEffect(() => {
    if (!sel) return
    const p = migrateEffects(sel)
    if (p) patch(sel.id, p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId])
  const varCounts = useMemo(() => ({ cols: varBind.collections.length, vars: varBind.collections.reduce((n, c) => n + c.variables.length, 0) }), [varBind.collections])
  const active = artboards.find((a) => a.id === activeAb) ?? artboards[0]
  // Selection colors: every distinct colour used by the current selection (or the
  // active artboard's content), with usage counts — editing one replaces it everywhere.
  const colorScan = useMemo<{ ids: string[]; colors: { hex: string; count: number }[] }>(() => {
    let objs: FObj[] = []
    if (sel) objs = [sel, ...descendantsOf(allObjects, sel.id)]
    else if (multi) {
      const seen = new Set<string>()
      for (const o of selObjs) for (const d of [o, ...descendantsOf(allObjects, o.id)]) if (!seen.has(d.id)) { seen.add(d.id); objs.push(d) }
    } else if (abSelected && active) objs = objectsInArtboard(allObjects, active)
    return { ids: objs.map((o) => o.id), colors: collectSelectionColors(objs) }
  }, [sel, multi, selObjs, abSelected, active, allObjects])
  // Stable identities so re-renders don't remount inputs/dropdowns (which would
  // close an open <select> or drop focus mid-edit).
  const Section = useMemo(() => function Section({ title, children, defaultOpen = true, right }: { title: string; children: React.ReactNode; defaultOpen?: boolean; right?: React.ReactNode }): JSX.Element {
    const [open, setOpen] = useState(defaultOpen)
    // Auto-open when the section gains content (e.g. an effect is added). Manual
    // collapse still sticks because defaultOpen stays constant between adds.
    useEffect(() => { setOpen(defaultOpen) }, [defaultOpen])
    return (
      <div className="">
        <div className="flex w-full items-center justify-between px-3 py-2.5 hover:bg-elevated/40">
          <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center justify-between text-left">
            <span className={PANEL_HEADER_TEXT}>{title}</span>
            {!right && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={['text-text-muted transition-transform', open ? 'rotate-90' : ''].join(' ')}><path d="M4 2l4 4-4 4" /></svg>}
          </button>
          {right && <div className="ml-2 flex shrink-0 items-center gap-1 text-text-muted">{right}</div>}
        </div>
        {open && <div className="space-y-2 px-3 pb-3">{children}</div>}
      </div>
    )
  }, [])
  const Num = useMemo(() => function Num({ label, value, on, min, max, step, precision, dragStep, kf }: { label: string; value: number; on: (v: number) => void; min?: number; max?: number; step?: number; precision?: number; dragStep?: number; kf?: { keyed: boolean; toggle: () => void } }): JSX.Element {
    return <NumberField icon={<span className="w-2.5 text-center text-[10.5px]">{label}</span>} value={value} onChange={on} min={min} max={max} step={step} precision={precision} dragStep={dragStep} kf={kf} fieldClassName="rounded-lg bg-elevated px-2 py-1.5" />
  }, [])
  // W/H field that doubles as a Fixed / Fit / Fill sizing control for auto-layout.
  const SizeField = useMemo(() => function SizeField({ label, value, mode, modes, onValue, onMode }: { label: string; value: number; mode: 'fixed' | 'fit' | 'fill'; modes: ('fixed' | 'fit' | 'fill')[]; onValue: (v: number) => void; onMode: (m: 'fixed' | 'fit' | 'fill') => void }): JSX.Element {
    const labelFor: Record<string, string> = { fixed: 'Fixed', fit: 'Fit', fill: 'Fill' }
    return (
      <div className="flex items-center rounded-lg bg-elevated py-0.5">
        <span className="w-2.5 pl-2 text-center text-[10.5px] text-text-muted">{label}</span>
        {mode === 'fixed'
          ? <NumberField value={value} onChange={(v) => onValue(v)} min={1} fieldClassName="px-1 py-1" inputWidth="w-9" />
          : <span className="flex-1 px-1 py-1 text-[12px] text-text-primary">{labelFor[mode]}</span>}
        <select value={mode} onChange={(e) => onMode(e.target.value as 'fixed' | 'fit' | 'fill')} title="Sizing"
          className="shrink-0 appearance-none rounded bg-transparent py-1 pl-0.5 pr-1 text-[11px] text-text-muted focus:outline-none">
          {modes.map((m) => <option key={m} value={m}>{labelFor[m]}</option>)}
        </select>
      </div>
    )
  }, [])
  const Swatch = useMemo(() => function Swatch({ label, color, on, tip }: { label: string; color: string; on: (v: string) => void; tip?: string }): JSX.Element {
    return (
      <div className="flex items-center justify-between gap-2">
        <Tooltip label={tip ?? ''} side="left"><span className="text-[12px] text-text-muted">{label}</span></Tooltip>
        <div className="flex items-center gap-1">
          <input type="text" value={color} onFocus={pushHistory} onChange={(e) => on(e.target.value)} className="w-[80px] rounded t42-field px-1.5 py-1 text-[11.5px] text-text-primary" />
          <ColorWell value={color} onChange={on} />
        </div>
      </div>
    )
  }, [pushHistory])
  const Toggle = useMemo(() => function Toggle({ on, set, children, tip }: { on: boolean; set: () => void; children: React.ReactNode; tip?: string }): JSX.Element {
    return (
      <Tooltip label={tip ?? ''} side="top"><button type="button" onClick={() => { pushHistory(); set() }} className={['rounded px-2 py-1 text-[11.5px]', on ? 'bg-action text-action-text' : 'bg-elevated text-text-secondary hover:text-text-primary'].join(' ')}>{children}</button></Tooltip>
    )
  }, [pushHistory])
  const Slider = useMemo(() => function Slider({ label, value, min, max, step = 1, on, kf, tip }: { label: string; value: number; min: number; max: number; step?: number; on: (v: number) => void; kf?: { keyed: boolean; toggle: () => void }; tip?: string }): JSX.Element {
    const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
    return (
      <div className="flex items-center gap-2">
        <Tooltip label={tip ?? ''} side="left" className="inline-flex w-[58px] shrink-0"><span className="text-[12px] text-text-muted">{label}</span></Tooltip>
        <input type="range" min={min} max={max} step={step} value={value} onPointerDown={pushHistory} onChange={(e) => on(parseFloat(e.target.value))} className="t42-range min-w-0 flex-1" style={{ background: `linear-gradient(to right, rgb(var(--accent)) ${pct}%, rgb(var(--border-strong)) ${pct}%)` }} />
        <input type="number" min={min} max={max} step={step} value={value} onFocus={pushHistory} onChange={(e) => on(parseFloat(e.target.value) || 0)} className="w-12 shrink-0 rounded t42-field px-1 py-0.5 text-[11.5px] text-text-primary" />
        {kf && (
          <Tooltip label={`${kf.keyed ? 'Remove' : 'Add'} keyframe at playhead`} side="left"><button type="button" onClick={kf.toggle} className="grid h-4 w-4 shrink-0 place-items-center">
            <span className="block h-2 w-2 rotate-45 rounded-[1px]" style={{ background: kf.keyed ? 'rgb(var(--accent,34 197 94))' : 'transparent', border: `1px solid ${kf.keyed ? 'rgb(var(--accent,34 197 94))' : '#6b7280'}` }} />
          </button></Tooltip>
        )}
      </div>
    )
  }, [pushHistory])

  const selColorsBlock = colorScan.colors.length > 0 ? (
    <Section title="Selection colors" defaultOpen={false}>
      <div className="space-y-0.5">
        {colorScan.colors.map((c) => (
          <SelColorRow key={c.hex} hex={c.hex} count={c.count} ids={colorScan.ids} onReplaceColor={onReplaceColor} />
        ))}
      </div>
    </Section>
  ) : null

  if (!sel && !multi && !abSelected && tool === 'frame') {
    return (
      <aside className="shrink-0 overflow-y-auto rounded-panel bg-surface overflow-x-hidden" style={{ width, minWidth: width, maxWidth: width }}>
        <div className="px-4 py-4">
          <div className="text-[15px] font-semibold text-text-primary">New frame</div>
        </div>
        <div className="space-y-4 px-3 pb-6">
          {ARTBOARD_PRESETS.map((g) => (
            <div key={g.group} className="space-y-0.5">
              <div className="px-1.5 pb-0.5 text-[11px] font-medium text-text-muted">{g.group}</div>
              {g.items.map((it) => (
                <button key={it.name} type="button" onClick={() => addArtboard(it.w, it.h, it.name)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12.5px] text-text-secondary hover:bg-elevated hover:text-text-primary">
                  <span className="flex items-center gap-2.5">
                    <ArtboardGlyph w={it.w} h={it.h} />
                    {it.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-text-muted">{it.w} × {it.h}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>
    )
  }

  if (!sel && !multi && !abSelected) {
    return (
      <aside className="shrink-0 overflow-y-auto rounded-panel bg-surface overflow-x-hidden" style={{ width, minWidth: width, maxWidth: width }}>
        <div className="px-4 py-5">
          <div className="text-[15px] font-semibold text-text-primary">Page</div>
          <p className="mt-1 text-[12px] text-text-muted">Select a layer to edit it.</p>
        </div>
        <Section title="Page">
          <Swatch label="Background" color={active?.bg ?? '#ffffff'} on={(v) => active && patchAb(active.id, { bg: v })} />
        </Section>
        <Section title="Variables" right={<button type="button" onClick={() => varBind.openVariables()} title="Open variables" className="grid h-5 w-5 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"><IcoTabVariables /></button>}>
          {hasVars ? (
            <button type="button" onClick={() => varBind.openVariables()} className="flex w-full items-center justify-between rounded-lg bg-elevated px-2.5 py-2 text-left hover:bg-elevated/70">
              <span className="text-[12px] text-text-primary">{varCounts.vars} {varCounts.vars === 1 ? 'variable' : 'variables'}</span>
              <span className="text-[11px] text-text-muted">{varCounts.cols} {varCounts.cols === 1 ? 'collection' : 'collections'}</span>
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[12px] leading-relaxed text-text-muted">Reusable colours, numbers and text with modes like light and dark.</p>
              <button type="button" onClick={() => varBind.openVariables()} className="w-full rounded-lg bg-elevated px-2.5 py-2 text-[12px] font-medium text-text-primary hover:bg-elevated/70">Create variable</button>
            </div>
          )}
        </Section>
        <Section title="Export" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <Tooltip label="Choose a format to export the active artboard" side="left" className="inline-flex w-[58px] shrink-0"><span className="text-[12px] text-text-muted">Format</span></Tooltip>
            <select
              defaultValue=""
              onChange={(e) => { const v = e.target.value as 'png' | 'svg' | 'html' | 'video'; if (v) onExport(v); e.target.value = '' }}
              className="min-w-0 flex-1 rounded bg-elevated px-1.5 py-1.5 text-[12px] text-text-primary focus:outline-none"
            >
              <option value="">Export as…</option>
              <option value="png">PNG image</option>
              <option value="svg">SVG vector</option>
              <option value="html">HTML</option>
              <option value="video">Video</option>
            </select>
          </div>
        </Section>
      </aside>
    )
  }

  if (!sel) {
    return (
      <aside className="shrink-0 overflow-y-auto rounded-panel bg-surface overflow-x-hidden" style={{ width, minWidth: width, maxWidth: width }}>
        {multi ? (
          <>
            <Section title="Align" right={
              <HeaderMenu
                icon={<IcoMore />}
                title="Layout options"
                width={228}
                items={[
                  { label: 'Distribute vertically', hint: '^⌥V', disabled: selObjs.length < 3, onClick: () => doDistribute('v') },
                  { label: 'Distribute horizontally', hint: '^⌥H', disabled: selObjs.length < 3, onClick: () => doDistribute('h') },
                  { label: 'Resize to fill', hint: '⌥⇧⌘F', sep: true, onClick: doResizeToFill }
                ]}
              />
            }>
              <div className="flex items-center gap-0.5">
                {([
                  ['left', 'Align left', 'M3 2v12M6 5h7v2H6zM6 9h4v2H6z'],
                  ['center-h', 'Align horizontal centers', 'M8 2v12M5 5h6v2H5zM6 9h4v2H6z'],
                  ['right', 'Align right', 'M13 2v12M3 5h7v2H3zM6 9h4v2H6z'],
                  ['top', 'Align top', 'M2 3h12M5 6h2v7H5zM9 6h2v4H9z'],
                  ['middle-v', 'Align vertical centers', 'M2 8h12M5 5h2v6H5zM9 6h2v4H9z'],
                  ['bottom', 'Align bottom', 'M2 13h12M5 3h2v7H5zM9 6h2v4H9z']
                ] as [AlignMode, string, string][]).map(([m, tip, d], i) => (
                  <Tooltip key={m} label={tip} side="top">
                    <button type="button" onClick={() => doAlign(m)} className={['grid h-7 w-7 place-items-center rounded text-text-secondary hover:bg-elevated hover:text-text-primary', i === 3 ? 'ml-1' : ''].join(' ')}>
                      <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d={d} /></svg>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </Section>
            <Section title="Arrange" defaultOpen={false}>
              <div className="grid grid-cols-2 gap-1">
                <button type="button" onClick={() => arrange('front')} className="rounded bg-elevated px-1.5 py-1 text-[11px] text-text-secondary hover:text-text-primary">To front</button>
                <button type="button" onClick={() => arrange('back')} className="rounded bg-elevated px-1.5 py-1 text-[11px] text-text-secondary hover:text-text-primary">To back</button>
              </div>
              <button type="button" onClick={removeSel} className="w-full rounded bg-elevated px-1.5 py-1 text-[11px] text-text-secondary hover:text-error">Delete {selObjs.length} layers</button>
            </Section>
            <Section title="Group">
              <div className="space-y-1">
                <Tooltip label="Wrap the selection in a plain frame" side="left" className="block w-full">
                  <button type="button" onClick={() => groupSelection('none')} className="flex w-full items-center gap-2 rounded bg-elevated px-2 py-1.5 text-[11.5px] text-text-secondary hover:text-text-primary">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 2H3.5A1.5 1.5 0 0 0 2 3.5v2M10.5 2h2A1.5 1.5 0 0 1 14 3.5v2M5.5 14h-2A1.5 1.5 0 0 1 2 12.5v-2M10.5 14h2a1.5 1.5 0 0 0 1.5-1.5v-2" /></svg>
                    Group
                  </button>
                </Tooltip>
                <Tooltip label="Auto-layout: arrange the items side by side" side="left" className="block w-full">
                  <button type="button" onClick={() => groupSelection('horizontal')} className="flex w-full items-center gap-2 rounded bg-elevated px-2 py-1.5 text-[11.5px] text-text-secondary hover:text-text-primary">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="4" width="4.5" height="8" rx="1" /><rect x="9.5" y="4" width="4.5" height="8" rx="1" /></svg>
                    Horizontal flow
                  </button>
                </Tooltip>
                <Tooltip label="Auto-layout: stack the items top to bottom" side="left" className="block w-full">
                  <button type="button" onClick={() => groupSelection('vertical')} className="flex w-full items-center gap-2 rounded bg-elevated px-2 py-1.5 text-[11.5px] text-text-secondary hover:text-text-primary">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="2" width="8" height="4.5" rx="1" /><rect x="4" y="9.5" width="8" height="4.5" rx="1" /></svg>
                    Vertical flow
                  </button>
                </Tooltip>
              </div>
            </Section>
            {selColorsBlock}
          </>
        ) : (
          <>
            <Section title="Artboards" defaultOpen={false}>
              <div className="space-y-1">
                {artboards.map((a) => (
                  <div key={a.id} className={['flex items-center gap-1 rounded px-1.5 py-1', activeAb === a.id ? 'bg-white/10' : 'hover:bg-elevated'].join(' ')}>
                    <button type="button" onClick={() => setActiveAb(a.id)} className="flex-1 truncate text-left text-[12px] text-text-primary">{a.name}</button>
                    <span className="text-[10px] text-text-muted">{a.w}×{a.h}</span>
                    <button type="button" onClick={() => removeArtboard(a.id)} title="Delete artboard" className="text-[11px] text-text-muted hover:text-error">✕</button>
                  </div>
                ))}
              </div>
              <select
                defaultValue=""
                onChange={(e) => {
                  const [w, h, label] = e.target.value.split('|')
                  if (w) addArtboard(parseInt(w), parseInt(h), label)
                  e.target.value = ''
                }}
                className="w-full rounded bg-elevated px-1.5 py-1.5 text-[12px] text-text-primary focus:outline-none"
              >
                <option value="">+ Add artboard…</option>
                {ARTBOARD_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.items.map((p) => <option key={p.label} value={`${p.w}|${p.h}|${p.label}`}>{p.label} · {p.w}×{p.h}</option>)}
                  </optgroup>
                ))}
              </select>
            </Section>
            {active && abSelected && (
              <Section title="Page">
                <input type="text" value={active.name} onFocus={pushHistory} onChange={(e) => patchAb(active.id, { name: e.target.value })} className="w-full rounded t42-field px-1.5 py-1 text-text-primary" />
                <div className="grid grid-cols-2 gap-1.5">
                  <Num label="X" value={active.x} on={(v) => patchAb(active.id, { x: Math.round(v) })} />
                  <Num label="Y" value={active.y} on={(v) => patchAb(active.id, { y: Math.round(v) })} />
                  <Num label="W" value={active.w} min={50} on={(v) => patchAb(active.id, { w: v })} />
                  <Num label="H" value={active.h} min={50} on={(v) => patchAb(active.id, { h: v })} />
                </div>
                <button type="button" onClick={() => patchAb(active.id, { w: active.h, h: active.w })} className="w-full rounded bg-elevated px-1.5 py-1 text-[11px] text-text-secondary hover:text-text-primary">Rotate orientation</button>
                <Swatch label="Background" color={active.bg} on={(v) => patchAb(active.id, { bg: v })} />
                <button type="button" onClick={() => removeArtboard(active.id)} className="w-full rounded bg-elevated px-1.5 py-1.5 text-[11px] text-text-secondary hover:text-error">Delete artboard</button>
              </Section>
            )}
            <Section title="Export" defaultOpen={false}>
              <div className="flex items-center gap-2">
                <Tooltip label="Choose a format to export the active artboard" side="left" className="inline-flex w-[58px] shrink-0"><span className="text-[12px] text-text-muted">Format</span></Tooltip>
                <select
                  defaultValue=""
                  onChange={(e) => { const v = e.target.value as 'png' | 'svg' | 'html' | 'video'; if (v) onExport(v); e.target.value = '' }}
                  className="min-w-0 flex-1 rounded bg-elevated px-1.5 py-1.5 text-[12px] text-text-primary focus:outline-none"
                >
                  <option value="">Export as…</option>
                  <option value="png">PNG image</option>
                  <option value="svg">SVG vector</option>
                  <option value="html">HTML (live animation)</option>
                  <option value="video">Video (MP4/WebM)</option>
                </select>
              </div>
            </Section>
            {selColorsBlock}
          </>
        )}
      </aside>
    )
  }

  const hasFill = sel.type === 'rect' || sel.type === 'ellipse' || sel.type === 'frame' || sel.type === 'polygon' || sel.type === 'star'
  const isLine = sel.type === 'line' || sel.type === 'arrow' || sel.type === 'path'
  const hasBorder = sel.type === 'rect' || sel.type === 'ellipse' || sel.type === 'frame' || sel.type === 'image'
  return (
    <aside className="shrink-0 overflow-y-auto rounded-panel bg-surface text-[12px] overflow-x-hidden" style={{ width, minWidth: width, maxWidth: width }}>
      {sel.componentName && (
        <Section title="Component">
          <div className="space-y-1 text-[11.5px]">
            <div className="flex justify-between gap-2"><span className="text-text-muted">Name</span><span className="truncate text-text-primary">{sel.componentName}</span></div>
            {sel.componentVariant && <div className="flex justify-between gap-2"><span className="text-text-muted">Variant</span><span className="truncate text-text-primary">{sel.componentVariant}</span></div>}
            {sel.componentSource && <div className="flex justify-between gap-2"><span className="text-text-muted">Source</span><span className="truncate text-text-secondary">{sel.componentSource}</span></div>}
          </div>
        </Section>
      )}

      <Section title="Layout" right={
        <HeaderMenu
          icon={<IcoMore />}
          title="Layout options"
          width={228}
          items={[
            { label: 'Distribute vertically', hint: '^⌥V', disabled: selObjs.length < 3, onClick: () => doDistribute('v') },
            { label: 'Distribute horizontally', hint: '^⌥H', disabled: selObjs.length < 3, onClick: () => doDistribute('h') },
            { label: 'Resize to fill', hint: '⌥⇧⌘F', sep: true, onClick: doResizeToFill }
          ]}
        />
      }>
        {(() => {
          const offX = sampleTrack(sel.motion?.tracks.x, playhead, 0)
          const offY = sampleTrack(sel.motion?.tracks.y, playhead, 0)
          const scaleVal = sampleTrack(sel.motion?.tracks.scale, playhead, 1)
          const keyHere = (prop: PropName): boolean => !!sel.motion?.tracks[prop]?.some((k) => Math.abs(k.t - playhead) < 1)
          const kfFor = (prop: PropName, val: number): { keyed: boolean; toggle: () => void } | undefined =>
            timelineOpen ? { keyed: keyHere(prop), toggle: () => { pushHistory(); toggleKey(sel, prop, val) } } : undefined
          return (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5">
                  {([
                    ['left', 'Align left', 'M3 2v12M6 5h7v2H6zM6 9h4v2H6z'],
                    ['center-h', 'Align horizontal centers', 'M8 2v12M5 5h6v2H5zM6 9h4v2H6z'],
                    ['right', 'Align right', 'M13 2v12M3 5h7v2H3zM6 9h4v2H6z'],
                    ['top', 'Align top', 'M2 3h12M5 6h2v7H5zM9 6h2v4H9z'],
                    ['middle-v', 'Align vertical centers', 'M2 8h12M5 5h2v6H5zM9 6h2v4H9z'],
                    ['bottom', 'Align bottom', 'M2 13h12M5 3h2v7H5zM9 6h2v4H9z']
                  ] as [AlignMode, string, string][]).map(([m, tip, d], i) => (
                    <Tooltip key={m} label={tip} side="top">
                      <button type="button" onClick={() => doAlign(m)} className={['grid h-6 w-6 place-items-center rounded text-text-secondary hover:bg-elevated hover:text-text-primary', i === 3 ? 'ml-1' : ''].join(' ')}>
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d={d} /></svg>
                      </button>
                    </Tooltip>
                  ))}
                </div>
                <button type="button" onClick={() => resetTransform(sel)} className="rounded px-1.5 py-0.5 text-[10.5px] text-text-secondary hover:text-text-primary" title="Reset rotation, opacity & scale and clear transform animation">Reset</button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Num label="X" value={sel.x} on={(v) => patch(sel.id, { x: v })} kf={kfFor('x', offX)} />
                <Num label="Y" value={sel.y} on={(v) => patch(sel.id, { y: v })} kf={kfFor('y', offY)} />
                {(() => {
                  const selIsFlex = sel.type === 'frame' && !!sel.layoutMode && sel.layoutMode !== 'none'
                  const parent = sel.parent ? allObjects.find((o) => o.id === sel.parent) : null
                  const inFlex = !!parent && !!parent.layoutMode && parent.layoutMode !== 'none'
                  const modes: ('fixed' | 'fit' | 'fill')[] | null = selIsFlex ? ['fixed', 'fit', 'fill'] : inFlex ? ['fixed', 'fill'] : null
                  if (!modes) return <><Num label="W" value={sel.w} min={1} on={(v) => patch(sel.id, { w: v })} /><Num label="H" value={sel.h} min={1} on={(v) => patch(sel.id, { h: v })} /></>
                  return (
                    <>
                      <SizeField label="W" value={sel.w} mode={sel.widthMode ?? 'fixed'} modes={modes} onValue={(v) => patch(sel.id, { w: v, widthMode: 'fixed' })} onMode={(m) => patch(sel.id, { widthMode: m })} />
                      <SizeField label="H" value={sel.h} mode={sel.heightMode ?? 'fixed'} modes={modes} onValue={(v) => patch(sel.id, { h: v, heightMode: 'fixed' })} onMode={(m) => patch(sel.id, { heightMode: m })} />
                    </>
                  )
                })()}
                <Num label="∠" value={sel.rotation} on={(v) => { patch(sel.id, { rotation: v }); autoRecord(sel, 'rotate', v) }} kf={kfFor('rotate', sel.rotation)} />
                <NumberField icon={<span className="shrink-0 text-[10.5px]">⤢</span>} suffix="%" value={Math.round(scaleVal * 100)} min={0} onChange={(v) => recordKey(sel, 'scale', v / 100)} kf={kfFor('scale', scaleVal)} fieldClassName="rounded-lg bg-elevated px-2 py-1.5" />
                <NumberField icon={<span className="w-2.5 shrink-0 text-[10.5px]">%</span>} value={Math.round(sel.opacity * 100)} min={0} max={100} onChange={(v) => { patch(sel.id, { opacity: v / 100 }); autoRecord(sel, 'opacity', v / 100) }} kf={kfFor('opacity', sel.opacity)} fieldClassName="rounded-lg bg-elevated px-2 py-1.5" />
              </div>
              {(() => {
                const boundVis = sel.bindings?.visible
                const hasBoolVars = varBind.collections.some((c) => c.variables.some((v) => v.type === 'boolean'))
                if (!boundVis && !hasBoolVars) return null
                return (
                  <div className="grid grid-cols-[70px_1fr_auto] items-center gap-2">
                    <span className="text-[12px] text-text-muted">Visible</span>
                    {boundVis
                      ? <BoundChip field="visible" varId={boundVis} />
                      : <button type="button" onClick={() => { pushHistory(); patch(sel.id, { visible: !sel.visible }) }} className="flex items-center justify-between rounded-lg bg-elevated px-2.5 py-1.5 text-[12px] text-text-primary">{sel.visible ? 'Shown' : 'Hidden'}</button>}
                    <VarBindButton field="visible" boundVarId={boundVis} />
                  </div>
                )
              })()}
            </>
          )
        })()}
        {sel.type !== 'frame' && (
          <button type="button" onClick={() => wrapInFlex()} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded bg-elevated py-1.5 text-[11px] text-text-secondary hover:text-text-primary" title="Add flow — wrap the selection in an auto-layout (flow) frame (⇧A)">
            Add flow <span className="text-text-muted">⇧A</span>
          </button>
        )}
      </Section>

      {(() => {
        const isContainer = sel.type === 'frame' || allObjects.some((o) => o.parent === sel.id)
        const multiMode = varBind.collections.filter((c) => c.modes.length > 1)
        if (!isContainer || !multiMode.length) return null
        return (
          <Section title="Modes">
            <div className="flex flex-col gap-1.5">
              {multiMode.map((c) => (
                <ModeSelect key={c.id} collection={c} currentModeId={sel.varModes?.[c.id]} onPick={(m) => varBind.setVarMode(c.id, m)} />
              ))}
            </div>
          </Section>
        )
      })()}

      {sel.type === 'frame' && (() => {
        const mode = (sel.layoutMode ?? 'none') as 'none' | 'horizontal' | 'vertical' | 'grid'
        const active = mode !== 'none'
        const dir: 'horizontal' | 'vertical' = mode === 'vertical' ? 'vertical' : 'horizontal'
        const isAuto = sel.layoutJustify === 'space-between'
        const curAlign = sel.layoutAlign ?? 'start'
        const curJustify = sel.layoutJustify ?? 'start'
        const padX = sel.layoutPadX ?? sel.layoutPadding ?? 16
        const padY = sel.layoutPadY ?? sel.layoutPadding ?? 16
        const childCount = allObjects.filter((o) => o.parent === sel.id).length
        const derivedCols = Math.max(1, Math.ceil(Math.sqrt(Math.max(1, childCount))))
        const flow = (m: 'none' | 'horizontal' | 'vertical' | 'grid'): void => {
          pushHistory()
          if (m === 'none') { patch(sel.id, { layoutMode: 'none' }); return }
          patch(sel.id, {
            layoutMode: m,
            layoutGap: sel.layoutGap ?? 12,
            layoutPadX: sel.layoutPadX ?? sel.layoutPadding ?? 16,
            layoutPadY: sel.layoutPadY ?? sel.layoutPadding ?? 16,
            widthMode: sel.widthMode ?? 'fit',
            heightMode: sel.heightMode ?? 'fit',
          })
        }
        const flowBtn = (m: 'none' | 'horizontal' | 'vertical' | 'grid', label: string, icon: JSX.Element): JSX.Element => (
          <Tooltip label={label} side="top">
            <button type="button" onClick={() => flow(m)} aria-label={label} aria-pressed={mode === m}
              className={['grid h-8 place-items-center rounded-md transition-colors', mode === m ? 'bg-border-strong text-text-primary' : 'text-text-muted hover:text-text-primary'].join(' ')}>
              {icon}
            </button>
          </Tooltip>
        )
        return (
        <Section title="Flow" right={active ? (
          <Tooltip label="Remove flow (auto layout)" side="left">
            <button type="button" onClick={() => flow('none')} aria-label="Remove flow" className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3.5 8h9" /></svg>
            </button>
          </Tooltip>
        ) : undefined}>
          <div className="space-y-3.5">
            {/* Flow modes: free form / vertical / horizontal / grid + wrap */}
            <div className="flex items-stretch gap-1.5">
              <div className="grid flex-1 grid-cols-4 gap-1 rounded-lg bg-bg/40 p-1">
                {flowBtn('none', 'Free form',
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2.4" y="2.8" width="3.3" height="3.3" rx="1" /><rect x="9.6" y="3.4" width="3.3" height="3.3" rx="1" /><rect x="3.4" y="9.2" width="3.3" height="3.3" rx="1" /><rect x="9.2" y="9.6" width="3" height="3" rx="1" /></svg>)}
                {flowBtn('vertical', 'Vertical',
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2.5" width="5.2" height="3.2" rx="1" fill="currentColor" stroke="none" /><rect x="4" y="7" width="5.2" height="3.2" rx="1" fill="currentColor" stroke="none" /><path d="M12.4 3v8M12.4 11l-1.3-1.4M12.4 11l1.3-1.4" /></svg>)}
                {flowBtn('horizontal', 'Horizontal',
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="4" width="3.2" height="5.2" rx="1" fill="currentColor" stroke="none" /><rect x="7" y="4" width="3.2" height="5.2" rx="1" fill="currentColor" stroke="none" /><path d="M3 12.4h8M11 12.4l-1.4-1.3M11 12.4l-1.4 1.3" /></svg>)}
                {flowBtn('grid', 'Grid',
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="2.6" y="2.6" width="4.6" height="4.6" rx="1" /><rect x="8.8" y="2.6" width="4.6" height="4.6" rx="1" /><rect x="2.6" y="8.8" width="4.6" height="4.6" rx="1" /><rect x="8.8" y="8.8" width="4.6" height="4.6" rx="1" /></svg>)}
              </div>
              {(mode === 'horizontal' || mode === 'vertical') && (
                <Tooltip label={sel.layoutWrap ? 'Wrapping on' : 'Wrap'} side="top">
                  <button type="button" onClick={() => {
                    pushHistory()
                    const on = !sel.layoutWrap
                    const p: Partial<FObj> = { layoutWrap: on }
                    if (on) {
                      if (mode === 'vertical' && (sel.heightMode ?? 'fixed') === 'fit') p.heightMode = 'fixed'
                      if (mode === 'horizontal' && (sel.widthMode ?? 'fixed') === 'fit') p.widthMode = 'fixed'
                    }
                    patch(sel.id, p)
                  }} aria-label="Wrap" aria-pressed={!!sel.layoutWrap}
                    className={['grid h-full w-9 shrink-0 place-items-center rounded-lg', sel.layoutWrap ? 'bg-border-strong text-text-primary' : 'bg-elevated text-text-muted hover:text-text-primary'].join(' ')}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5h8.5a2.5 2.5 0 0 1 0 5H5m0 0l1.8-1.8M5 9.5l1.8 1.8" /></svg>
                  </button>
                </Tooltip>
              )}
            </div>

            {active && (<>
              {/* Resizing */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-text-muted">Resizing</div>
                <div className="grid grid-cols-2 gap-2">
                  <SizeField label="W" value={sel.w} mode={sel.widthMode ?? 'fixed'} modes={['fixed', 'fit', 'fill']} onValue={(v) => patch(sel.id, { w: v, widthMode: 'fixed' })} onMode={(m) => patch(sel.id, { widthMode: m })} />
                  <SizeField label="H" value={sel.h} mode={sel.heightMode ?? 'fixed'} modes={['fixed', 'fit', 'fill']} onValue={(v) => patch(sel.id, { h: v, heightMode: 'fixed' })} onMode={(m) => patch(sel.id, { heightMode: m })} />
                </div>
              </div>

              {mode === 'grid' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-text-muted">Columns</div>
                    <NumberField icon={<span className="shrink-0 text-[11px] text-text-muted" title="Grid columns">▦</span>} value={sel.layoutCols ?? derivedCols} min={1} max={12} onChange={(v) => patch(sel.id, { layoutCols: v })} fieldClassName="h-9 rounded-lg bg-elevated px-2" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-text-muted">Gap</div>
                    <NumberField icon={<span className="shrink-0 text-[11px] text-text-muted" title="Gap between items">⇿</span>} value={sel.layoutGap ?? 12} min={0} onChange={(v) => patch(sel.id, { layoutGap: v })} fieldClassName="h-9 rounded-lg bg-elevated px-2" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-text-muted">Alignment</div>
                    <div className="grid grid-cols-3 grid-rows-3 gap-px rounded-lg bg-bg/40 p-1.5" style={{ height: 74 }}>
                      {([0, 1, 2] as const).flatMap((r) => ([0, 1, 2] as const).map((c) => {
                        const a = (['start', 'center', 'end'] as const)[r]
                        const j = (['start', 'center', 'end'] as const)[c]
                        const activeCell = !isAuto && curAlign === a && curJustify === j
                        return (
                          <button key={`${r}-${c}`} type="button" onClick={() => { pushHistory(); patch(sel.id, { layoutAlign: a, layoutJustify: j }) }}
                            className={['group grid place-items-center rounded', activeCell ? 'bg-border-strong' : 'hover:bg-elevated'].join(' ')}>
                            {activeCell
                              ? <span style={{ display: 'flex', flexDirection: dir === 'horizontal' ? 'row' : 'column', gap: 1.5 }}>
                                {[0, 1, 2].map((i) => <span key={i} style={{ background: '#2f6fed', borderRadius: 1, width: dir === 'horizontal' ? 2 : 9, height: dir === 'horizontal' ? 9 : 2 }} />)}
                              </span>
                              : <span className="rounded-full bg-text-muted/40 group-hover:bg-text-muted" style={{ width: 3, height: 3 }} />}
                          </button>
                        )
                      }))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-medium text-text-muted">Gap</div>
                    <div className="flex gap-1">
                      {isAuto
                        ? <div className="flex h-9 flex-1 items-center rounded-lg bg-elevated px-3 text-[12px] text-text-muted">Auto</div>
                        : <NumberField icon={<span className="shrink-0 text-[11px] text-text-muted" title="Gap between items">⇿</span>} value={sel.layoutGap ?? 12} min={0} onChange={(v) => patch(sel.id, { layoutGap: v })} fieldClassName="h-9 rounded-lg bg-elevated px-2" />}
                      <Tooltip label="Space between" side="top">
                        <button type="button" onClick={() => { pushHistory(); patch(sel.id, { layoutJustify: isAuto ? 'start' : 'space-between' }) }} aria-label="Space between" aria-pressed={isAuto} className={['grid h-9 w-9 shrink-0 place-items-center rounded-lg', isAuto ? 'bg-border-strong text-text-primary' : 'bg-elevated text-text-muted hover:text-text-primary'].join(' ')}>
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 4v8M14 4v8M6 8h4M6 8l2-2M6 8l2 2M10 8l-2-2M10 8l-2 2" /></svg>
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
              )}

              {/* Padding */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-text-muted">Padding</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumberField icon={<span className="shrink-0 text-[11px] text-text-muted" title="Horizontal padding">⇤⇥</span>} value={padX} min={0} onChange={(v) => patch(sel.id, { layoutPadX: v })} fieldClassName="h-9 rounded-lg bg-elevated px-2" />
                  <NumberField icon={<span className="shrink-0 text-[11px] text-text-muted" title="Vertical padding">⤒⤓</span>} value={padY} min={0} onChange={(v) => patch(sel.id, { layoutPadY: v })} fieldClassName="h-9 rounded-lg bg-elevated px-2" />
                </div>
              </div>

              {/* Clip content */}
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-text-secondary">
                <input type="checkbox" checked={!!sel.clipContent} onChange={(e) => { pushHistory(); patch(sel.id, { clipContent: e.target.checked }) }} className="accent-current" />
                Clip content
              </label>
            </>)}
          </div>
        </Section>
        )
      })()}

      {sel.type === 'text' && (
        <Section title="Typography">
          {(() => {
            const boundText = sel.bindings?.text
            return (
              <div className="grid grid-cols-[70px_1fr_auto] items-start gap-2">
                <span className="pt-2 text-[12px] text-text-muted">Text</span>
                {boundText
                  ? <BoundChip field="text" varId={boundText} />
                  : <textarea value={sel.text} onFocus={pushHistory} onChange={(e) => patch(sel.id, { text: e.target.value })} rows={2} className="w-full resize-none rounded-xl t42-field px-3 py-2 text-[13px] text-text-primary" />}
                <div className="pt-1"><VarBindButton field="text" boundVarId={boundText} /></div>
              </div>
            )
          })()}
          {(() => {
            const boundFont = sel.bindings?.fontFamily
            return (
              <div className="grid grid-cols-[70px_1fr_auto] items-center gap-2">
                <span className="text-[12px] text-text-muted">Font</span>
                {boundFont
                  ? <BoundChip field="fontFamily" varId={boundFont} />
                  : <select value={sel.fontFamily} onChange={(e) => { pushHistory(); patch(sel.id, { fontFamily: e.target.value }) }} className="w-full rounded-lg t42-field px-3 py-1.5 text-[13px] font-medium text-text-primary">
                      {FONTS.map((f) => <option key={f.label} value={f.label}>{f.label}</option>)}
                    </select>}
                <VarBindButton field="fontFamily" boundVarId={boundFont} />
              </div>
            )
          })()}
          <label className="grid grid-cols-[70px_1fr] items-center gap-2">
            <span className="text-[12px] text-text-muted">Weight</span>
            <select value={sel.fontWeight} onChange={(e) => { pushHistory(); patch(sel.id, { fontWeight: parseInt(e.target.value) }) }} className="w-full rounded-lg t42-field px-3 py-1.5 text-[13px] font-medium text-text-primary">
              {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2">
            <span className="text-[12px] text-text-muted">Color</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-elevated px-2.5 py-1.5">
                <ColorWell value={sel.color} onChange={(v) => patch(sel.id, { color: v })} />
                <input value={sel.color.replace('#', '').toUpperCase()} onFocus={pushHistory} onChange={(e) => patch(sel.id, { color: e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}` })} className="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary focus:outline-none" />
              </div>
              <div className="flex items-center rounded-lg bg-elevated px-3 py-1.5">
                <input value={Math.round((sel.opacity ?? 1) * 100)} onFocus={pushHistory} onChange={(e) => { const n = parseInt(e.target.value); if (!isNaN(n)) patch(sel.id, { opacity: Math.max(0, Math.min(1, n / 100)) }) }} className="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary focus:outline-none" />
                <span className="text-[12px] text-text-muted">%</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2">
            <span className="text-[12px] text-text-muted">Size</span>
            <div className="grid grid-cols-2 gap-2">
              <Num label="" value={sel.fontSize} min={1} on={(v) => patch(sel.id, { fontSize: v })} />
              <div className="flex items-center justify-center rounded-lg bg-elevated py-1.5 text-[13px] text-text-muted">Px</div>
            </div>
          </div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2">
            <span className="text-[12px] text-text-muted">Letter</span>
            <div className="grid grid-cols-2 gap-2">
              <Num label="" value={sel.letterSpacing} on={(v) => patch(sel.id, { letterSpacing: v })} />
              <div className="flex items-center justify-center rounded-lg bg-elevated py-1.5 text-[13px] text-text-muted">Px</div>
            </div>
          </div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2">
            <span className="text-[12px] text-text-muted">Line</span>
            <div className="grid grid-cols-2 gap-2">
              <Num label="" value={Number(sel.lineHeight.toFixed(2))} min={0.5} max={3} step={0.05} precision={2} dragStep={0.02} on={(v) => patch(sel.id, { lineHeight: v })} />
              <div className="flex items-center justify-center rounded-lg bg-elevated py-1.5 text-[13px] text-text-muted">Em</div>
            </div>
          </div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2">
            <span className="text-[12px] text-text-muted">Align</span>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-elevated p-1">
              {(['left', 'center', 'right'] as TextAlign[]).map((a) => (
                <button key={a} type="button" onClick={() => { pushHistory(); patch(sel.id, { align: a }) }} className={['rounded-lg px-2 py-1.5 text-[12px]', sel.align === a ? 'bg-bg text-text-primary' : 'text-text-muted hover:text-text-primary'].join(' ')}>{a === 'left' ? 'Left' : a === 'center' ? 'Center' : 'Right'}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[70px_1fr] items-center gap-2">
            <span className="text-[12px] text-text-muted">Style</span>
            <div className="flex gap-1">
              <Toggle on={sel.italic} set={() => patch(sel.id, { italic: !sel.italic })}>Italic</Toggle>
              <Toggle on={sel.underline} set={() => patch(sel.id, { underline: !sel.underline })}>Underline</Toggle>
            </div>
          </div>
        </Section>
      )}

      {sel.type === 'polygon' && (
        <Section title="Polygon" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <Tooltip label="Number of sides" side="left" className="inline-flex w-[58px] shrink-0"><span className="text-[12px] text-text-muted">Sides</span></Tooltip>
            <select value={sel.sides ?? 3} onChange={(e) => { pushHistory(); patch(sel.id, { sides: parseInt(e.target.value) }) }} className="min-w-0 flex-1 rounded t42-field px-1.5 py-1 text-[12px] text-text-primary">
              {[3, 4, 5, 6, 7, 8, 10, 12].map((n) => <option key={n} value={n}>{n} sides</option>)}
            </select>
          </div>
        </Section>
      )}

      {sel.type === 'star' && (
        <Section title="Star" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <Tooltip label="Number of star points" side="left" className="inline-flex w-[58px] shrink-0"><span className="text-[12px] text-text-muted">Points</span></Tooltip>
            <select value={sel.points ?? 5} onChange={(e) => { pushHistory(); patch(sel.id, { points: parseInt(e.target.value) }) }} className="min-w-0 flex-1 rounded t42-field px-1.5 py-1 text-[12px] text-text-primary">
              {[3, 4, 5, 6, 7, 8, 10, 12].map((n) => <option key={n} value={n}>{n} points</option>)}
            </select>
          </div>
          <Slider label="Depth" tip="How deep the points cut toward the centre" value={Math.round((sel.innerRatio ?? 0.45) * 100)} min={10} max={90} on={(v) => patch(sel.id, { innerRatio: v / 100 })} />
        </Section>
      )}

      {(sel.type === 'rect' || sel.type === 'frame' || sel.type === 'image') && (() => {
        const boundRadius = sel.bindings?.radius
        return (
          <Section title="Radius" defaultOpen={!!boundRadius} right={(hasVars || boundRadius) ? <VarBindButton field="radius" boundVarId={boundRadius} /> : undefined}>
            {boundRadius
              ? <BoundChip field="radius" varId={boundRadius} />
              : <Slider label="Radius" tip="Round the corners" value={sel.radius} min={0} max={120} on={(v) => patch(sel.id, { radius: Math.round(v) })} />}
          </Section>
        )
      })()}

      <Section title="Blending" right={
        <IconBtn onClick={() => { pushHistory(); patch(sel.id, { visible: !sel.visible }) }} title={sel.visible ? 'Hide layer' : 'Show layer'}><Eye on={sel.visible} /></IconBtn>
      }>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField
            icon={<IcoOpacity />}
            suffix="%"
            title="Opacity"
            value={Math.round(sel.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) => { patch(sel.id, { opacity: v / 100 }); autoRecord(sel, 'opacity', v / 100) }}
            fieldClassName="rounded-lg bg-elevated px-2 py-1.5"
          />
          <label className="flex min-w-0 items-center gap-1.5 rounded-lg bg-elevated px-2 py-1.5">
            <span className="shrink-0 text-text-muted"><IcoDroplet /></span>
            <span className="sr-only">Blend mode</span>
            <select
              value={sel.blendMode ?? 'normal'}
              onChange={(e) => { pushHistory(); patch(sel.id, { blendMode: e.target.value }) }}
              className="min-w-0 flex-1 appearance-none bg-transparent text-[12px] text-text-primary focus:outline-none"
            >
              {BLEND_MODES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </label>
        </div>
      </Section>

      {(hasFill || sel.type === 'text') && (() => {
        const textFill = sel.type === 'text'
        const present = textFill ? true : sel.fillEnabled
        const boundFill = sel.bindings?.fill
        const addFill = (): void => { pushHistory(); patch(sel.id, textFill ? { fillHidden: false } : { fillEnabled: true, fillHidden: false, fillMode: sel.fillMode ?? 'solid' }) }
        return (
          <Section title="Fill" defaultOpen right={
            <>
              <VarBindButton field="fill" boundVarId={boundFill} />
              {!boundFill && <button type="button" onClick={addFill} title="Add fill" className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"><IcoPlus /></button>}
            </>
          }>
            {boundFill
              ? <BoundChip field="fill" varId={boundFill} />
              : present
                ? <FillEditor sel={sel} patch={patch} patchObj={patchObj} pushHistory={pushHistory} gradOptsOpen={gradOpenMode === 'fillMode'} onToggleGradOpts={onToggleGradOpts} />
                : <button type="button" onClick={addFill} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-elevated/60 px-2 py-2 text-[12px] text-text-secondary hover:text-text-primary"><IcoPlus /> Add fill</button>}
          </Section>
        )
      })()}

      {hasBorder && !isLine && (() => {
        const present = sel.strokeEnabled
        const addOutline = (): void => { pushHistory(); patch(sel.id, { strokeEnabled: true, strokeHidden: false, strokeWidth: sel.strokeWidth || 1 }) }
        return (
          <Section title="Outline" defaultOpen={present} right={
            present
              ? <HeaderMenu items={(['solid', 'dashed', 'dotted'] as const).map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), active: (sel.strokeStyle ?? 'solid') === s, onClick: () => { pushHistory(); patch(sel.id, { strokeStyle: s }) } }))} />
              : <button type="button" onClick={addOutline} title="Add outline" className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"><IcoPlus /></button>
          }>
            {present
              ? <OutlineEditor sel={sel} patch={patch} patchObj={patchObj} pushHistory={pushHistory} gradOptsOpen={gradOpenMode === 'strokeMode'} onToggleGradOpts={onToggleGradOpts} />
              : <button type="button" onClick={addOutline} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-elevated/60 px-2 py-2 text-[12px] text-text-secondary hover:text-text-primary"><IcoPlus /> Add outline</button>}
          </Section>
        )
      })()}

      {isLine && (
        <Section title="Stroke" defaultOpen>
          <NumIcon icon={<IcoWeight />} title="Thickness" value={sel.strokeWidth} min={1} on={(v) => patch(sel.id, sel.type === 'line' ? { strokeWidth: v, h: v } : { strokeWidth: v })} />
          <PaintBody sel={sel} cfg={STROKE_PAINT} patch={patch} patchObj={patchObj} pushHistory={pushHistory} gradOptsOpen={gradOpenMode === 'strokeMode'} onToggleGradOpts={onToggleGradOpts} />
        </Section>
      )}

      {hasBorder && !isLine && (() => {
        const present = !!sel.borderEnabled
        const addBorder = (): void => { pushHistory(); patch(sel.id, { borderEnabled: true, borderHidden: false, borderWidth: sel.borderWidth || 1 }) }
        return (
          <Section title="Border" defaultOpen={present} right={
            present
              ? <HeaderMenu items={(['solid', 'dashed', 'dotted'] as const).map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), active: (sel.borderStyle ?? 'solid') === s, onClick: () => { pushHistory(); patch(sel.id, { borderStyle: s }) } }))} />
              : <button type="button" onClick={addBorder} title="Add border" className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"><IcoPlus /></button>
          }>
            {present
              ? <BorderEditor sel={sel} patch={patch} patchObj={patchObj} pushHistory={pushHistory} gradOptsOpen={gradOpenMode === 'borderMode'} onToggleGradOpts={onToggleGradOpts} />
              : <button type="button" onClick={addBorder} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-elevated/60 px-2 py-2 text-[12px] text-text-secondary hover:text-text-primary"><IcoPlus /> Add border</button>}
          </Section>
        )
      })()}



      {(() => {
        const list = sel.effects ?? []
        const addEffect = (type: EffectType, anchor: DOMRect): void => {
          const e = makeEffect(type)
          pushHistory()
          patch(sel.id, { effects: [...(sel.effects ?? []), e] })
          onOpenEffect(e.id!, anchor)
        }
        const addFixed = (type: EffectType) => (ev: React.MouseEvent<HTMLButtonElement>): void => addEffect(type, ev.currentTarget.getBoundingClientRect())
        const FILTER_TYPES: EffectType[] = ['layer-blur', 'background-blur', 'noise', 'texture', 'glass', 'shader']
        const groups: { title: string; types: EffectType[] }[] = [
          { title: 'Shadow', types: ['drop-shadow'] },
          { title: 'Inner shadow', types: ['inner-shadow'] },
          { title: 'Filters', types: FILTER_TYPES }
        ]
        return (
          <>
            {groups.map((g) => {
              const mine = list.filter((e) => g.types.includes(e.type))
              const single = g.types.length === 1
              return (
                <Section key={g.title} title={g.title} defaultOpen={mine.length > 0} right={
                  single
                    ? <button type="button" onClick={addFixed(g.types[0])} title={`Add ${g.title.toLowerCase()}`} className="grid h-6 w-6 place-items-center rounded text-text-muted hover:bg-elevated hover:text-text-primary"><IcoPlus /></button>
                    : <EffectAddMenu onAdd={addEffect} variant="plus" types={g.types} label="Add filter" />
                }>
                  {mine.length > 0
                    ? <EffectsEditor sel={sel} patch={patch} pushHistory={pushHistory} onOpenEffect={onOpenEffect} activeId={activeEffectId} only={g.types} />
                    : single
                      ? <button type="button" onClick={addFixed(g.types[0])} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-elevated/60 px-2 py-2 text-[12px] text-text-secondary hover:text-text-primary"><IcoPlus /> Add {g.title.toLowerCase()}</button>
                      : <EffectAddMenu onAdd={addEffect} variant="wide" types={g.types} label="Add filter" />}
                </Section>
              )
            })}
          </>
        )
      })()}

      {(() => {
        const scales = [1, 2, 3, 4]
        return (
          <Section title="Export" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-1.5">
              <label className="flex min-w-0 items-center gap-1.5 rounded-lg bg-elevated px-2 py-1.5">
                <span className="sr-only">Export scale</span>
                <select value={exportScale} onChange={(e) => setExportScale(parseInt(e.target.value))} className="min-w-0 flex-1 appearance-none bg-transparent text-[12px] text-text-primary focus:outline-none">
                  {scales.map((s) => <option key={s} value={s}>{s}x</option>)}
                </select>
              </label>
              <label className="flex min-w-0 items-center gap-1.5 rounded-lg bg-elevated px-2 py-1.5">
                <span className="sr-only">Export format</span>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'png' | 'svg')} className="min-w-0 flex-1 appearance-none bg-transparent text-[12px] text-text-primary focus:outline-none">
                  <option value="png">PNG</option>
                  <option value="svg">SVG</option>
                </select>
              </label>
            </div>
            <button type="button" onClick={() => onExportSelection(exportFormat, exportScale)} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-elevated/60 px-2 py-2 text-[12px] text-text-secondary hover:text-text-primary">
              Export <span className="text-text-muted">⇧⌘E</span>
            </button>
          </Section>
        )
      })()}

      {timelineOpen && (
        <Section title="Animations">
          <AnimationsPanel obj={sel} duration={motionDur} patch={patch} pushHistory={pushHistory} />
        </Section>
      )}
      {selColorsBlock}
    </aside>
  )
}
