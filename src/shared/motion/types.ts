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

/**
 * A travelling wave laid over the arrangement.
 *
 * Wave reads the card's position along one axis, so the displacement sweeps
 * across the piece; ripple reads its distance from the middle, so it spreads
 * outwards from there. They are the same maths with a different input, but
 * they look nothing alike, which is why both are here.
 */
export type WaveStyle = 'wave' | 'ripple'

/** Which axis a wave sweeps along. Ignored by ripple, which has no direction. */
export type WaveDirection = 'horizontal' | 'vertical'

export type Wave = {
  /** How far a card is pushed towards or away from the camera, in scene units. */
  depth: number
  /** How many crests fit across the arrangement. */
  frequency: number
  /** Whole passes per loop, so the wave is where it started when the loop ends. */
  speed: number
  style: WaveStyle
  direction: WaveDirection
}

export type Displacement = {
  displaceZ: number
  displaceY: number
  speed: number
  offset: number
  freeOrbit: number
  panX: number
  panZ: number
  panSpeed: number
  wave: Wave
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
  /**
   * An outline drawn inside the card's own edge.
   *
   * Inside rather than around it, because the card is a plane in a scene: a
   * stroke that straddled the edge would be half in front of the card and half
   * in mid-air, and would thicken and thin as the card turned. Width is a
   * percentage of the short side so it survives a change of card shape and a
   * change of export size.
   */
  borderWidth: number
  borderColour: string
  borderOpacity: number
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
  /**
   * When in the loop this layer is on screen, as fractions of it.
   *
   * Absent means the whole loop, which is what every layer written before
   * this existed meant. `from` above `to` wraps through the seam, so a layer
   * can span the end of the loop without being split into two.
   */
  from?: number
  to?: number
  /** How long the layer takes to fade in and out, as a fraction of the loop. */
  fade?: number
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

/**
 * A text layer with every typographic field settled, for drawing.
 *
 * Timing is left alone. Absent bounds mean the whole loop, and filling them
 * in with numbers would turn "always" into a window that merely happens to
 * cover everything — a difference that matters the moment the loop is
 * measured against something else.
 */
export type ResolvedText =
  TextLayer &
  Required<Omit<TextLayer, 'id' | 'text' | 'size' | 'colour' | 'x' | 'y' | 'from' | 'to' | 'fade'>>

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
  /** When in the loop this layer is on screen. See TextLayer.from. */
  from?: number
  to?: number
  fade?: number
}

/**
 * The frame rates worth offering.
 *
 * The film rate, the two broadcast rates and their doubled versions. Anything
 * else is either a rate no delivery spec asks for or one this app cannot hit,
 * and a free number here would mostly produce files that judder somewhere.
 */
export const FRAME_RATES = [24, 25, 30, 50, 60] as const
export type FrameRate = (typeof FRAME_RATES)[number]

/** How far a treatment reaches in from each edge, as a percentage of the frame. */
export type EdgeAmounts = { top: number; bottom: number; left: number; right: number }

/**
 * The shape of the ramp from an edge to the middle.
 *
 * Linear is an even ramp, which reads as a deliberate band. Soft eases at
 * both ends, so the treatment fades out without a visible line where it
 * stops. They are genuinely different looks rather than two strengths of
 * the same one, which is why this is a choice and not another slider.
 */
export type EdgeFalloff = 'linear' | 'soft'

/** Whether a treatment touches only the cards or the whole picture. */
export type EffectScope = 'component' | 'everything'

/**
 * A shadow cast by the component, as a light would.
 *
 * Distinct from `EffectsState.shadow`, which darkens the inside of the frame
 * edge and belongs to the frame rather than to anything in it. This one is
 * the component's own silhouette, offset and blurred, so it moves with the
 * cards and tells you where they are in space.
 */
export type DropShadowFx = {
  enabled: boolean
  /** Degrees clockwise from straight down, which is where a light overhead puts it. */
  angle: number
  /** Offset as a percentage of the frame's short side, so it survives a resize. */
  distance: number
  /** Softness as a percentage of the short side. */
  blur: number
  /** How solid the shadow is, 0 to 100. */
  density: number
  colour: string
}

/** Blur that reaches in from the frame's edges rather than covering everything. */
export type EdgeBlurFx = {
  enabled: boolean
  falloff: EdgeFalloff
  edges: EdgeAmounts
  /** Blur strength, as a percentage of the frame's short side. */
  amount: number
  /** How gradually the blur gives way to the sharp picture. */
  softness: number
  over: EffectScope
}

/** A wash of colour reaching in from the frame's edges. */
export type EdgeShadeFx = {
  enabled: boolean
  /**
   * Dark and Light are the two answers people actually want, and each picks
   * its own colour. The colour is kept alongside rather than replacing them
   * so switching back and forth does not lose the shade you chose.
   */
  mode: 'dark' | 'light'
  colour: string
  falloff: EdgeFalloff
  edges: EdgeAmounts
  softness: number
  over: EffectScope
}

/**
 * A band along the frame's edges that bends the picture behind it, the way
 * the thick edge of a sheet of glass does.
 */
export type GlassFx = {
  enabled: boolean
  /** All edges at one width, or each edge set on its own. */
  edges: 'all' | 'per-edge'
  per: EdgeAmounts
  /** Band width as a percentage of the frame's short side. */
  width: number
  /** How far the picture is pulled through the band. */
  refraction: number
  /** How sharply the bend accelerates towards the edge. */
  curve: number
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
  /**
   * The four treatments that need to know where the cards are, or what is
   * already drawn underneath them.
   *
   * Held as objects rather than another dozen flat fields because each is a
   * switch with its own settings: off is the only state most pieces are in,
   * and a piece should be able to say that once instead of nine times.
   */
  dropShadow: DropShadowFx
  edgeBlur: EdgeBlurFx
  edgeShade: EdgeShadeFx
  glass: GlassFx
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
  fps: FrameRate
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
