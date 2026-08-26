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

/** Component types named in the design but not built yet. */
export const SOON_COMPONENTS = ['Grid', 'Flip', 'Global', 'Cubic', 'Column', 'Plate', 'Spin'] as const

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
}

export type TextLayer = {
  id: string
  text: string
  size: number
  colour: string
  x: number
  y: number
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
