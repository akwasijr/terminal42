// What a Motion document is.
//
// Motion is generative: you never place a card. You say "ten cards, radius
// 4.5, spinning on Y at 0.35" and the arrangement falls out of the numbers.
// So a document is almost entirely parameters, and the interesting design
// question is how those parameters are shaped.
//
// They split into two halves:
//
//   - `component` — which generator is running and its own settings. Every
//     component type has a different set (a Slider has Gap and Hold, a
//     Carousel has Radius and Bend), so these are held as a loose bag keyed
//     by the component id and described by a schema at runtime.
//   - everything else — pose, card tilt, displacement, transform, easing,
//     card look, frame, export. These mean the same thing whatever component
//     is running, so they are typed properly and shared.
//
// Keeping the shared half out of the component bag is what stops each new
// component type from having to re-declare tilt and easing, and what lets the
// frame and the exporter work without knowing which generator produced the
// cards.

// Type-only, so this is erased at build time and the pair of files do not
// form a runtime cycle even though each names a type from the other.
import type { Keyframes } from './keyframes'

export type ComponentId =
  | 'carousel'
  | 'ring'
  | 'slider'
  | 'card-shuffle'
  | 'card-drop'
  | 'image-repeater'
  | 'space'
  | 'elevator'
  | 'ribbon'
  | 'parallax'
  | 'feed'
  | 'grid'
  | 'flip'
  | 'global'
  | 'cubic'
  | 'column'
  | 'plate'
  | 'spin'

/**
 * Component types named in the design but not built yet.
 *
 * Empty now that all eighteen exist. Kept rather than deleted because the
 * drawer's "Soon" section is how a named-but-unbuilt arrangement gets shown,
 * and the next one to be named will want it back.
 */
export const SOON_COMPONENTS: readonly string[] = []

export type ParamValue = number | string | boolean

/**
 * How one component parameter is presented and constrained.
 *
 * The schema is data rather than JSX so the same description can drive the
 * control, the preset thumbnails and the value clamping on load. A document
 * saved with a value that a later version narrowed gets clamped instead of
 * rendering a broken scene.
 */
export type ParamSpec =
  | {
      kind: 'slider'
      key: string
      label: string
      min: number
      max: number
      step: number
      default: number
      /** Shown instead of the number at the minimum, e.g. "none" or "off". */
      zeroLabel?: string
      /** Appended to the displayed number, e.g. "°", "×", "s", "%". */
      unit?: string
      /** Decimal places in the readout. Integers use 0. */
      precision?: number
    }
  | { kind: 'toggle'; key: string; label: string; default: boolean }
  | {
      kind: 'segmented'
      key: string
      label: string
      options: Array<{ value: string; label: string }>
      default: string
    }

export type Pose = { tiltX: number; tiltY: number; tiltZ: number }

export type CardTilt = { tiltX: number; tiltY: number; tiltZ: number; stagger: boolean }

export type Displacement = {
  displaceZ: number
  displaceY: number
  speed: number
  offset: number
  freeOrbit: number
  panX: number
  panZ: number
  panSpeed: number
}

export type Transform = { positionX: number; positionY: number; scale: number }

/** A cubic-bezier control pair, in the same order CSS writes them. */
export type Easing = { x1: number; y1: number; x2: number; y2: number }

export type CardAspect = '1:1' | '4:6' | '4:5' | '9:16' | '4:3' | '16:9'

export type CardStyle = {
  aspect: CardAspect
  /** Corner radius as a percentage of the card's short side. */
  corner: number
  gradient: boolean
  gradientOpacity: number
  gradientSide: 'front' | 'back' | 'both'
  backOpacity: number
}

export type FrameAspect = '16:9' | '4:5' | '9:16' | '1:1' | '4:3'

export type FrameStyle = {
  aspect: FrameAspect
  /** Frame corner radius in px; 0 is square. */
  corners: number
  background: string
  gridVisible: boolean
  gridColumns: number
  gridRows: number
  gridColour: string
  /** Whether the grid is drawn in exports as well as on screen. */
  gridInExport: boolean
  /** Space between the frame's edge and the piece inside it, in percent. */
  gap: number
}

/**
 * Words laid over the frame.
 *
 * Everything here that carries a measurement is a fraction of the frame rather
 * than a pixel count, which is what lets a piece composed on screen export at
 * 4K without the type sliding or changing weight. Size is a percentage of the
 * frame's height; tracking is a percentage of the type's own size, so it
 * scales with the letters instead of drifting apart as the frame grows.
 *
 * The typographic fields are optional on purpose. A piece saved before they
 * existed has none of them, and must still open and look exactly as it did,
 * so every one of them resolves through `resolvedText` rather than being
 * written into old documents by a migration.
 */
export type TextLayer = {
  id: string
  text: string
  /** Type size as a percentage of the frame's height. */
  size: number
  colour: string
  x: number
  y: number
  /** A family name from the renderer's font list; falls back if unknown. */
  font?: string
  /** 400–800, matching the weights the families are loaded with. */
  weight?: number
  italic?: boolean
  underline?: boolean
  align?: TextAlign
  /** Line spacing in ems, applied only when the text has more than one line. */
  lineHeight?: number
  /** Letter spacing as a percentage of the type size. */
  tracking?: number
  /** 0–100. Separate from the colour so a layer can fade without a new hex. */
  opacity?: number
  /** Whether the words are drawn in capitals. */
  caps?: boolean
}

export type TextAlign = 'left' | 'center' | 'right'

/** What a text layer means when it says nothing. */
export const TEXT_DEFAULTS = {
  font: 'DM Sans',
  weight: 600,
  italic: false,
  underline: false,
  align: 'center' as TextAlign,
  lineHeight: 1.2,
  tracking: 0,
  opacity: 100,
  caps: false
} as const

/** A text layer with every typographic field settled, for drawing. */
export type ResolvedText = TextLayer & Required<Omit<TextLayer, 'id' | 'text' | 'size' | 'colour' | 'x' | 'y'>>

export function resolvedText(layer: TextLayer): ResolvedText {
  return {
    ...layer,
    font: layer.font ?? TEXT_DEFAULTS.font,
    weight: layer.weight ?? TEXT_DEFAULTS.weight,
    italic: layer.italic ?? TEXT_DEFAULTS.italic,
    underline: layer.underline ?? TEXT_DEFAULTS.underline,
    align: layer.align ?? TEXT_DEFAULTS.align,
    lineHeight: layer.lineHeight ?? TEXT_DEFAULTS.lineHeight,
    tracking: layer.tracking ?? TEXT_DEFAULTS.tracking,
    opacity: layer.opacity ?? TEXT_DEFAULTS.opacity,
    caps: layer.caps ?? TEXT_DEFAULTS.caps
  }
}

/**
 * A mark sitting flat over the frame.
 *
 * A logo is a picture rather than words, but it is placed the same way a text
 * layer is — as a fraction of the frame, so it lands in the same spot at every
 * export size.
 */
export type LogoLayer = {
  id: string
  imageId: string
  /** Width as a percentage of the frame's width; height follows the picture. */
  size: number
  opacity: number
  x: number
  y: number
}

/**
 * Treatments applied to the finished frame rather than to any one card.
 *
 * These are drawn in the same 2D pass as the backdrop and the overlay, which
 * is what makes an export match the screen without the effects having to know
 * anything about the renderer.
 */
export type EffectsState = {
  /** Softens the whole frame, in pixels at 1080p. */
  blur: number
  /** Film grain strength, 0 for none. */
  grain: number
  /** How dark the corners go, 0 for none. */
  vignette: number
  /** A soft shadow inside the frame edge, 0 for none. */
  shadow: number
  /** Colour grade, all neutral at their defaults. */
  brightness: number
  contrast: number
  saturation: number
  /** A colour laid over the frame, at `tintAmount` strength. */
  tint: string
  tintAmount: number
}

export type ImageRef = {
  id: string
  /** Absolute path on disk, or a data URL for pasted images. */
  src: string
  name: string
}

/**
 * One card, moved by hand.
 *
 * Held as an offset from wherever the pattern puts the card rather than as an
 * absolute position, because the pattern is still live underneath: turn the
 * radius up and a nudged card travels out with its neighbours instead of
 * being left stranded in the middle of the scene. Rotation adds, scale
 * multiplies, and an empty override is indistinguishable from no override,
 * which is what makes Reset a delete.
 */
export type CardOverride = {
  dx: number
  dy: number
  dz: number
  drotX: number
  drotY: number
  drotZ: number
  scale: number
  /** An image dropped straight onto this card, overruling the running order. */
  imageId?: string
}

export type VisualState = {
  card: CardStyle
  images: ImageRef[]
  /** How images are handed to cards. */
  imageOrder: 'in-order' | 'scatter'
  text: TextLayer[]
  logos: LogoLayer[]
  effects: EffectsState
}

/**
 * How a group of things arrives on screen, or leaves.
 *
 * Entrance and exit are deliberately *not* the same kind of thing as a
 * component's own animation. A component loops: it is a pure function of
 * phase that closes at both ends, and it runs for as long as you are looking
 * at it. An entrance happens once, has a beginning and an end, and does not
 * have to close. Keeping them apart is what lets Play mean "show me the
 * entrance again" while the piece carries on turning underneath.
 */
export type EntranceShape =
  | 'fade'
  | 'rise'
  | 'drop'
  | 'scale'
  | 'fly-in'
  | 'unfold'
  | 'spiral'

export type EntranceSpec = {
  enabled: boolean
  shape: EntranceShape
  /** Seconds the whole move takes, before stagger is added. */
  duration: number
  /** Seconds between the first card starting and the last one starting. */
  stagger: number
  easing: Easing
}

/**
 * The four switches the export panel offers, held as full specs so the shape
 * of an entrance can be edited rather than only turned on and off.
 */
export type AnimationState = {
  componentIn: EntranceSpec
  componentOut: EntranceSpec
  textIn: EntranceSpec
  textOut: EntranceSpec
  /** Seconds between replays when Play is left looping. */
  replayEvery: number
}

export type VideoFormat = 'mp4' | 'webm' | 'gif'

export type ExportState = {
  resolution: 720 | 1080 | 1440 | 2160 | 4320
  format: VideoFormat
  fps: 24 | 30 | 60
  durationSec: number
  seamlessLoop: boolean
  gridBehindComponent: boolean
  stillFormat: 'png' | 'jpeg'
  stillScale: 1 | 2 | 3 | 4
  transparentBackground: boolean
}

export type MotionDoc = {
  version: 1
  componentId: ComponentId
  /** Component settings, keyed by component id so switching type keeps both. */
  params: Partial<Record<ComponentId, Record<string, ParamValue>>>
  componentEnabled: boolean
  animationEnabled: boolean
  pose: Pose
  cardTilt: CardTilt
  displacement: Displacement
  transform: Transform
  easing: Easing
  /**
   * Cards the user has moved by hand, keyed by card index.
   *
   * Keyed by index rather than by identity because cards have no identity —
   * they are positions in a generated pattern, and card 7 is whichever card
   * the pattern puts seventh. Turn the count down and the overrides above the
   * new count simply stop applying; turn it back up and they return.
   */
  overrides: Record<string, CardOverride>
  animation: AnimationState
  visual: VisualState
  frame: FrameStyle
  export: ExportState
  /**
   * Values that change across the loop, by target.
   *
   * Optional because every piece made before keyframes existed has none, and
   * an absent map means "nothing moves but the component", which is exactly
   * what those pieces did.
   */
  keys?: Keyframes
}

/**
 * Where a single card is, this instant.
 *
 * Radians and scene units throughout: the engine hands these straight to
 * three.js, so a component that thought in degrees would silently be sixty
 * times too far around.
 */
export type CardPlacement = {
  x: number
  y: number
  z: number
  rotX: number
  rotY: number
  rotZ: number
  scale: number
  /** 0 hides the card entirely; used by generators that fade cards in and out. */
  opacity: number
  /** Curvature applied across the card face, in radians. 0 is flat. */
  bend: number
  bendAxis: 'vertical' | 'horizontal'
}

/**
 * A component type: the whole of what makes one kind of motion.
 *
 * `layout` is a pure function of loop phase, which is the rule the entire
 * feature rests on. Phase runs 0 → 1 and must produce the same placement at
 * both ends, so that:
 *
 *   - the animation loops with no visible seam,
 *   - the scrubber and the renderer agree without a shared clock,
 *   - and export can render frame k at phase k/frames rather than recording
 *     in real time, which is what makes an exported loop exact rather than
 *     nearly right.
 *
 * Anything that cannot close the loop (a one-shot entrance, say) belongs in
 * the entrance animation layer, not here.
 */
export type MotionComponent = {
  id: ComponentId
  label: string
  /** How many cards this generator draws, given its params. */
  cardCount: (params: Record<string, ParamValue>) => number
  schema: ParamSpec[]
  layout: (phase: number, index: number, count: number, params: Record<string, ParamValue>) => CardPlacement
}
