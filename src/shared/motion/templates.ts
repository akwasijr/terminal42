// Whole pieces you can start from.
//
// These are not the per-component presets. A preset moves one arrangement's
// own sliders and leaves everything else alone, which is useful once you are
// already inside a piece and know what you are looking at. A template is the
// whole document: an arrangement, a palette, pictures on the cards, type set
// in a real family at a real size, effects, frame and timing. It exists to
// answer the first question a blank canvas cannot, which is what a finished
// piece is supposed to look like.
//
// Because that is the job, a template has to be *finished*. A dark rectangle
// with one word centred on it is not a starting point, it is the blank canvas
// with a caption. So every template here sets a ground colour it chose, type
// with a hierarchy rather than a single line, at least one of the treatments
// that give a frame depth, and — where the arrangement alone would be static —
// something keyed so the piece has a shape over its loop.
//
// Every template is a plain function of its pictures, so the same template
// always produces the same document. Nothing here reads the clock or the
// random number generator: a template is a starting point that two people
// should be able to compare notes on.
//
// Pictures are named by starter-set id rather than carried as data. The bank
// draws them, so a template costs a few hundred bytes instead of a megabyte,
// and the renderer resolves the ids to real files when the template is used.

import type {
  Displacement,
  DropShadowFx,
  EdgeAmounts,
  EdgeBlurFx,
  EdgeShadeFx,
  Easing,
  GlassFx,
  ImageRef,
  MotionDoc,
  PictureLayer,
  ShapeLayer,
  TextLayer,
  Wave
} from './types'
import type { Track } from './keyframes'
import { defaultEffects, emptyDoc } from './defaults'

export type MotionTemplate = {
  id: string
  /** Shown on the card. Sentence case, like the rest of the app. */
  name: string
  /** One line on what it is for. */
  note: string
  /** Starter-set picture ids, in the order the cards receive them. */
  images: readonly string[]
  /**
   * Two colours the home tile draws the arrangement with, near and far.
   *
   * Held separately from the document because the tile draws a flat outline
   * rather than the real scene, and the card colours it would otherwise have
   * to guess at are inside picture files it never loads.
   */
  swatch: readonly [string, string]
  /**
   * Where in the loop the gallery tile is drawn.
   *
   * Most pieces look like themselves at any instant, so most templates say
   * nothing. A few do not: a piece whose cards fall from above spends the
   * first half of its loop as a scatter of specks in the sky, and a tile
   * caught there tells you nothing about the piece that lands.
   */
  previewPhase?: number
  build: (images: ImageRef[]) => MotionDoc
}

/** A text layer with the fields most layers leave alone already settled. */
function text(layer: Partial<TextLayer> & Pick<TextLayer, 'id' | 'text'>): TextLayer {
  return {
    size: 7,
    colour: '#f4f4f2',
    x: 50,
    y: 50,
    font: 'DM Sans',
    weight: 500,
    align: 'center',
    lineHeight: 1.1,
    tracking: 0,
    opacity: 100,
    ...layer
  }
}

/** A block of colour with the fields most shapes leave alone already settled. */
function shape(layer: Partial<ShapeLayer> & Pick<ShapeLayer, 'id'>): ShapeLayer {
  return {
    kind: 'rect',
    width: 40, height: 30, x: 50, y: 50,
    rotation: 0, colour: '#d8d3c8', opacity: 100,
    ...layer
  }
}

/**
 * A picture placed against the frame.
 *
 * `imageId` is looked up by position rather than passed, because the gallery
 * builds every template with no pictures at all to draw its tiles. An absent
 * id is a placeholder, which is the honest thing to show when the photograph
 * has not been chosen yet.
 */
function picture(
  images: ImageRef[],
  index: number,
  layer: Partial<PictureLayer> & Pick<PictureLayer, 'id'>
): PictureLayer {
  const src = images[index]
  return {
    mask: 'rect',
    width: 40, height: 40, x: 50, y: 50,
    rotation: 0, opacity: 100, fit: 'cover',
    ...(src ? { imageId: src.id } : {}),
    ...layer
  }
}

/**
 * Curves worth naming.
 *
 * A keyed track with no easing is linear, which is right for a turntable and
 * wrong for anything that starts or stops. These four cover what the
 * templates want: a symmetrical breath, a move that arrives and settles, one
 * that gathers speed as it leaves, and a quick snap for type.
 */
const EASE: Record<'breath' | 'settle' | 'leave' | 'snap', Easing> = {
  breath: { x1: 0.45, y1: 0, x2: 0.55, y2: 1 },
  settle: { x1: 0.16, y1: 1, x2: 0.3, y2: 1 },
  leave: { x1: 0.7, y1: 0, x2: 0.84, y2: 0 },
  snap: { x1: 0.4, y1: 0, x2: 0.1, y2: 1 }
}

/**
 * A track from a list of times and values.
 *
 * Written this way because the interesting part of a keyed value is the shape
 * it makes, and a literal array of key objects buries that shape under ids
 * nobody chose and never reads.
 */
function ride(pairs: ReadonlyArray<readonly [number, number]>, easing: Easing = EASE.breath): Track {
  return { keys: pairs.map(([t, v], i) => ({ id: `k${i + 1}`, t, v, easing })) }
}

/** Edge reaches, with any edge left out meaning the treatment does not touch it. */
function reach(p: Partial<EdgeAmounts>): EdgeAmounts {
  return { top: 0, bottom: 0, left: 0, right: 0, ...p }
}

/** Every edge the same. */
function all(n: number): EdgeAmounts {
  return { top: n, bottom: n, left: n, right: n }
}

// The four grouped treatments are switches with settings, so a template that
// wants one has to say `enabled` and then repeat every field it is not
// changing. These four builders turn that into naming the treatment and the
// two or three numbers that make it the one you meant.

function cast(p: Partial<DropShadowFx>): DropShadowFx {
  return { ...defaultEffects().dropShadow, enabled: true, ...p }
}

function edgeBlur(p: Partial<EdgeBlurFx>): EdgeBlurFx {
  return { ...defaultEffects().edgeBlur, enabled: true, ...p }
}

function edgeShade(p: Partial<EdgeShadeFx>): EdgeShadeFx {
  return { ...defaultEffects().edgeShade, enabled: true, ...p }
}

function glass(p: Partial<GlassFx>): GlassFx {
  return { ...defaultEffects().glass, enabled: true, ...p }
}

/** Displacement, which templates only ever set two or three fields of. */
function move(p: Partial<Omit<Displacement, 'wave'>> & { wave?: Partial<Wave> }): Displacement {
  const base = emptyDoc('carousel').displacement
  return { ...base, ...p, wave: { ...base.wave, ...(p.wave ?? {}) } }
}

/**
 * Start a document, with the parts almost every template sets.
 *
 * Templates differ in their arrangement and their look, not in the plumbing,
 * so the plumbing is written once. Anything a template does not mention keeps
 * the value a new document would have had, which means a template stays valid
 * when a new field is added rather than freezing the day it was written.
 */
function base(
  componentId: MotionDoc['componentId'],
  images: ImageRef[],
  patch: {
    params?: Record<string, unknown>
    doc?: Partial<Omit<MotionDoc, 'visual' | 'frame' | 'export' | 'params' | 'componentId'>>
    card?: Partial<MotionDoc['visual']['card']>
    frame?: Partial<MotionDoc['frame']>
    effects?: Partial<MotionDoc['visual']['effects']>
    export?: Partial<MotionDoc['export']>
    text?: TextLayer[]
    shapes?: ShapeLayer[]
    pictures?: PictureLayer[]
    imageOrder?: MotionDoc['visual']['imageOrder']
  }
): MotionDoc {
  const doc = emptyDoc(componentId)
  return {
    ...doc,
    ...patch.doc,
    params: patch.params ? { [componentId]: patch.params as never } : doc.params,
    visual: {
      ...doc.visual,
      card: { ...doc.visual.card, ...patch.card },
      images,
      imageOrder: patch.imageOrder ?? doc.visual.imageOrder,
      text: patch.text ?? [],
      // Left absent rather than empty when a template has no scenery, so a
      // document says what it is instead of carrying two empty arrays.
      ...(patch.shapes ? { shapes: patch.shapes } : {}),
      ...(patch.pictures ? { pictures: patch.pictures } : {}),
      effects: { ...doc.visual.effects, ...patch.effects }
    },
    frame: { ...doc.frame, ...patch.frame, gridVisible: patch.frame?.gridVisible ?? false },
    export: { ...doc.export, ...patch.export }
  }
}

// The six visual languages, each in the two shapes a piece actually ships in.
//
// A template is a whole finished frame, so it is written the way a designer
// would describe one: a ground, a photograph, a headline with a hierarchy
// under it, and something that moves. The portrait and landscape versions of
// a language are separate entries rather than one entry with a switch,
// because a headline that reads well stacked in a 9:16 does not simply
// rewrap in a 16:9 -- it wants a different size, a different corner of the
// frame, and often a different crop of the picture. Pretending otherwise is
// how templates end up looking like a phone screenshot stretched sideways.
//
// Everything a template puts on screen is a layer a person can then select,
// move, recolour and key: type is a text layer, panels are shapes, and
// photographs are picture layers. Nothing is baked into the background.

/** Ground colours, kept together so a language can be read at a glance. */
const INK = {
  navy: '#0A1222',
  navyLift: '#132038',
  paper: '#E9EEF7',
  bone: '#EDE9E1',
  olive: '#4A4A38',
  teal: '#2E6E7E',
  yellow: '#F2F06A',
  orange: '#F86B26',
  white: '#FFFFFF',
  black: '#141414',
  sky: '#CFE6F2'
}

export const MOTION_TEMPLATES: readonly MotionTemplate[] = [
  {
    id: 'signal-portrait',
    name: 'Signal — portrait',
    note: 'A dark product story: photograph full height, claim across the foot.',
    images: ['slate', 'harbour', 'drift', 'quarry'],
    swatch: [INK.navyLift, INK.navy],
    build: (images) =>
      base('slider', images, {
        params: {
          cards: 4, cardScale: 4, gap: 2.6, stagger: 0, depth: 0,
          spinX: 0, spinY: 0, spinZ: 0, axis: 'x', mode: 'step',
          stepSize: 1, direction: 'forward', hold: 2.1, transition: 0.9, drift: 4
        },
        doc: {
          transform: { ...emptyDoc('slider').transform, scale: 2.5 },
          keys: {
            // The photograph is still between steps, so the piece gets its
            // pulse from the type instead: the claim settles as each new
            // picture arrives rather than hanging there through the cut.
            'text:head:y': ride([[0, 73.5], [0.06, 72]], EASE.settle),
            'text:sub:opacity': ride([[0, 46], [0.1, 82]], EASE.settle)
          }
        },
        card: { aspect: '9:16', corner: 0, gradient: true, gradientOpacity: 46, gradientSide: 'front' },
        frame: { aspect: '9:16', background: INK.navy, corners: 0 },
        effects: {
          edgeShade: edgeShade({ mode: 'dark', colour: INK.navy, edges: reach({ bottom: 46, top: 22 }), falloff: 'soft', softness: 70 })
        },
        export: { durationSec: 12, fps: 30 },
        text: [
          text({ id: 'brand', text: 'Aivon', size: 2.4, colour: INK.white, x: 8, y: 5.5, align: 'left', weight: 600 }),
          text({ id: 'url', text: 'aivon.com', size: 1.6, colour: '#8FA4C2', x: 92, y: 5.6, align: 'right', weight: 400 }),
          text({
            id: 'head', text: 'Fewer meetings.\nFaster answers.',
            size: 6.4, colour: INK.white, x: 8, y: 73.5, align: 'left', weight: 700, lineHeight: 1.08
          }),
          text({
            id: 'sub', text: 'Aivon surfaces the answer before\nthe meeting was booked.',
            size: 2.3, colour: '#A8BAD4', x: 8, y: 84, align: 'left', weight: 400, lineHeight: 1.35, opacity: 82
          }),
          text({ id: 'foot', text: 'Aivon', size: 2.2, colour: INK.white, x: 8, y: 95, align: 'left', weight: 600 })
        ]
      })
  },
  {
    id: 'signal-landscape',
    name: 'Signal — landscape',
    note: 'The same dark story, opened out: picture right, claim held left.',
    images: ['harbour', 'slate', 'drift', 'quarry'],
    swatch: [INK.navyLift, INK.navy],
    build: (images) =>
      base('slider', images, {
        params: {
          cards: 4, cardScale: 4, gap: 4, stagger: 0, depth: 0,
          spinX: 0, spinY: 0, spinZ: 0, axis: 'x', mode: 'step',
          stepSize: 1, direction: 'forward', hold: 2.1, transition: 0.9, drift: 3
        },
        doc: {
          pose: { tiltX: 0, tiltY: 0, tiltZ: 0 },
          transform: { ...emptyDoc('slider').transform, positionX: 3.2, scale: 3 },
          keys: {
            'text:head:x': ride([[0, 7.5], [0.06, 6]], EASE.settle),
            'text:sub:opacity': ride([[0, 46], [0.1, 82]], EASE.settle)
          }
        },
        card: { aspect: '4:5', corner: 0, gradient: true, gradientOpacity: 40, gradientSide: 'front' },
        frame: { aspect: '16:9', background: INK.navy, corners: 0 },
        effects: {
          edgeShade: edgeShade({ mode: 'dark', colour: INK.navy, edges: reach({ left: 70 }), falloff: 'soft', softness: 92 })
        },
        export: { durationSec: 12, fps: 30 },
        text: [
          text({ id: 'brand', text: 'Aivon', size: 3.2, colour: INK.white, x: 6, y: 9, align: 'left', weight: 600 }),
          text({
            id: 'head', text: 'Fewer meetings.\nFaster answers.',
            size: 8.2, colour: INK.white, x: 6, y: 44, align: 'left', weight: 700, lineHeight: 1.06
          }),
          text({
            id: 'sub', text: 'Aivon surfaces the answer before the\nmeeting was ever booked.',
            size: 3, colour: '#A8BAD4', x: 6, y: 66, align: 'left', weight: 400, lineHeight: 1.35, opacity: 82
          }),
          text({ id: 'foot', text: 'aivon.com', size: 2.6, colour: '#8FA4C2', x: 6, y: 91, align: 'left', weight: 400 })
        ]
      })
  },
  {
    id: 'daybreak-portrait',
    name: 'Daybreak — portrait',
    note: 'Pale and quiet: the claim at the top, a soft panel doing the proving.',
    images: ['tide', 'drift'],
    swatch: ['#F6F9FE', INK.paper],
    build: (images) =>
      base('feed', images, {
        params: {
          cards: 4, columns: 1, cardScale: 1.9, gap: 1.5, edgeFalloff: 0.85,
          mode: 'continuous', direction: 'up', hold: 0.8, transition: 0.5
        },
        doc: {
          transform: { ...emptyDoc('feed').transform, positionY: -1.9 },
          keys: {
            // Cards are drawn in the scene and shapes on the ground behind it,
            // so the panel can only ever sit under the feed. It is sized to
            // hold the column rather than compete with it.
            'shape:panel:height': ride([[0, 47], [0.5, 48.4]], EASE.breath),
            'text:head:y': ride([[0, 13.2], [0.1, 12]], EASE.settle)
          }
        },
        card: { aspect: '4:5', corner: 10, gradient: false, gradientOpacity: 0 },
        frame: { aspect: '9:16', background: INK.paper, corners: 18 },
        effects: {
          dropShadow: cast({ density: 16, blur: 30, distance: 10, angle: 0 }),
          edgeBlur: edgeBlur({ amount: 16, edges: reach({ top: 18, bottom: 24 }), falloff: 'soft', softness: 62 })
        },
        export: { durationSec: 10, fps: 30 },
        shapes: [
          shape({ id: 'panel', kind: 'rect', width: 82, height: 47, x: 50, y: 66, colour: '#F7FAFE', corner: 6, opacity: 100 })
        ],
        pictures: [
          picture(images, 0, { id: 'thumb', mask: 'rect', width: 20, height: 11, x: 22, y: 50, corner: 10 })
        ],
        text: [
          text({
            id: 'head', text: 'Leads captured.\nPipeline updated.\nAutomatically.',
            size: 5.6, colour: '#16203A', x: 10, y: 12, align: 'left', weight: 700, lineHeight: 1.12
          }),
          text({
            id: 'sub', text: 'Aivon connects your tools and moves\nopportunities forward without manual input.',
            size: 2, colour: '#5A6A85', x: 10, y: 27, align: 'left', weight: 400, lineHeight: 1.4
          }),
          text({ id: 'foot', text: 'Aivon', size: 2.2, colour: '#16203A', x: 10, y: 94, align: 'left', weight: 600 })
        ]
      })
  },
  {
    id: 'daybreak-landscape',
    name: 'Daybreak — landscape',
    note: 'The pale layout turned wide: claim left, the panel proving it on the right.',
    images: ['tide', 'drift'],
    swatch: ['#F6F9FE', INK.paper],
    build: (images) =>
      base('feed', images, {
        params: {
          cards: 4, columns: 1, cardScale: 1.3, gap: 1.5, edgeFalloff: 0.85,
          mode: 'continuous', direction: 'up', hold: 0.8, transition: 0.5
        },
        doc: {
          transform: { ...emptyDoc('feed').transform, positionX: 3.6 },
          keys: {
            'shape:panel:width': ride([[0, 40], [0.5, 41.6]], EASE.breath),
            'text:head:x': ride([[0, 7], [0.1, 6]], EASE.settle)
          }
        },
        card: { aspect: '4:5', corner: 10, gradient: false, gradientOpacity: 0 },
        frame: { aspect: '16:9', background: INK.paper, corners: 14 },
        effects: {
          dropShadow: cast({ density: 16, blur: 30, distance: 10, angle: 0 }),
          edgeBlur: edgeBlur({ amount: 14, edges: reach({ top: 20, bottom: 20 }), falloff: 'soft', softness: 62 })
        },
        export: { durationSec: 10, fps: 30 },
        shapes: [
          shape({ id: 'panel', kind: 'rect', width: 40, height: 78, x: 76, y: 50, colour: '#F7FAFE', corner: 5, opacity: 100 })
        ],
        pictures: [
          picture(images, 0, { id: 'thumb', mask: 'ellipse', width: 5, height: 9, x: 8, y: 76 })
        ],
        text: [
          text({
            id: 'head', text: 'Leads captured.\nPipeline updated.\nAutomatically.',
            size: 6.8, colour: '#16203A', x: 6, y: 30, align: 'left', weight: 700, lineHeight: 1.1
          }),
          text({
            id: 'sub', text: 'Aivon connects your tools and moves opportunities\nforward without manual input.',
            size: 2.6, colour: '#5A6A85', x: 6, y: 50, align: 'left', weight: 400, lineHeight: 1.4
          }),
          text({ id: 'foot', text: 'Aivon', size: 2.8, colour: '#16203A', x: 6, y: 88, align: 'left', weight: 600 })
        ]
      })
  },
  {
    id: 'bloom-portrait',
    name: 'Bloom — portrait',
    note: 'Editorial and botanical: a tall serif over bone, one ghosted letterform behind.',
    images: ['bloom', 'orchard', 'moss'],
    swatch: ['#B9AE9A', '#6A6552'],
    build: (images) =>
      base('carousel', images, {
        params: {
          cards: 3, cardScale: 1.9, rows: 1, radius: 1.8, speed: 0.1,
          bend: 6, type: 'continuous', spinAxis: 'y'
        },
        doc: {
          transform: { ...emptyDoc('carousel').transform, positionY: -1.1 },
          keys: {
            // The ghosted mark turns very slowly behind everything, which is
            // the only movement in a frame that is otherwise a poster.
            'shape:ghost:rotation': ride([[0, -6], [0.5, 6]], EASE.breath),
            'text:kicker:tracking': ride([[0, 16], [0.5, 22]], EASE.breath)
          }
        },
        card: { aspect: '4:5', corner: 4, gradient: false, gradientOpacity: 0 },
        frame: { aspect: '9:16', background: INK.bone, corners: 20 },
        effects: {
          edgeBlur: edgeBlur({ amount: 18, edges: reach({ bottom: 12 }), falloff: 'soft', softness: 62 }),
          edgeShade: edgeShade({ mode: 'light', colour: INK.bone, edges: reach({ top: 30 }), falloff: 'soft', softness: 70 })
        },
        export: { durationSec: 14, fps: 30 },
        shapes: [
          shape({ id: 'ghost', kind: 'ellipse', width: 54, height: 54, x: 68, y: 40, colour: '#DFD9CD', opacity: 70 })
        ],
        text: [
          text({ id: 'kicker', text: 'Moontion present', size: 1.7, colour: INK.olive, x: 50, y: 8, align: 'center', weight: 500, caps: true, tracking: 16 }),
          text({
            id: 'head', text: 'Create\nyour beauty\nhere',
            size: 7.4, colour: INK.olive, x: 50, y: 25, align: 'center', weight: 700, lineHeight: 1.04, caps: true, font: 'Playfair Display'
          }),
          text({ id: 'foot', text: 'In every season', size: 1.7, colour: INK.olive, x: 50, y: 94, align: 'center', weight: 500, caps: true, tracking: 16 })
        ]
      })
  },
  {
    id: 'bloom-landscape',
    name: 'Bloom — landscape',
    note: 'The botanical setting laid on its side: serif left, the picture running off the right edge.',
    images: ['orchard', 'bloom', 'moss'],
    swatch: ['#B9AE9A', '#6A6552'],
    build: (images) =>
      base('carousel', images, {
        params: {
          cards: 3, cardScale: 3.4, rows: 1, radius: 1.4, speed: 0.1,
          bend: 5, type: 'continuous', spinAxis: 'y'
        },
        doc: {
          transform: { ...emptyDoc('carousel').transform, positionX: 4.8 },
          keys: {
            'shape:ghost:rotation': ride([[0, -5], [0.5, 5]], EASE.breath),
            'text:kicker:tracking': ride([[0, 16], [0.5, 22]], EASE.breath)
          }
        },
        card: { aspect: '4:5', corner: 4, gradient: false, gradientOpacity: 0 },
        frame: { aspect: '16:9', background: INK.teal, corners: 14 },
        effects: {
          edgeShade: edgeShade({ mode: 'dark', colour: INK.teal, edges: reach({ left: 44 }), falloff: 'soft', softness: 70 })
        },
        export: { durationSec: 14, fps: 30 },
        shapes: [
          shape({ id: 'ghost', kind: 'ellipse', width: 30, height: 52, x: 26, y: 46, colour: '#3B7E8E', opacity: 70 })
        ],
        text: [
          text({ id: 'kicker', text: 'Moontion present', size: 2.1, colour: '#E7EEEE', x: 6, y: 13, align: 'left', weight: 500, caps: true, tracking: 16 }),
          text({
            id: 'head', text: 'Beauty\nfresh\nflowers',
            size: 10, colour: '#F4F1E8', x: 6, y: 46, align: 'left', weight: 700, lineHeight: 1.02, caps: true, font: 'Playfair Display'
          }),
          text({ id: 'foot', text: 'In every season', size: 2.1, colour: '#E7EEEE', x: 6, y: 89, align: 'left', weight: 500, caps: true, tracking: 16 })
        ]
      })
  },
  {
    id: 'ribbon-portrait',
    name: 'Ribbon — portrait',
    note: 'A cause poster: the photograph full bleed, the line split top and bottom over it.',
    images: ['harbour', 'lantern'],
    swatch: ['#8A8578', '#3A3630'],
    build: (images) =>
      base('slider', images, {
        params: {
          cards: 2, cardScale: 4, gap: 2.6, stagger: 0, depth: 0,
          spinX: 0, spinY: 0, spinZ: 0, axis: 'x', mode: 'step',
          stepSize: 1, direction: 'forward', hold: 3.4, transition: 1.1, drift: 5
        },
        doc: {
          transform: { ...emptyDoc('slider').transform, scale: 1.3 },
          keys: {
            // The two halves of the line arrive from the edges they sit
            // against, so the sentence closes on the frame rather than
            // fading up in place.
            'text:top:y': ride([[0, 11], [0.12, 9]], EASE.settle),
            'text:bottom:y': ride([[0, 82], [0.12, 79]], EASE.settle)
          }
        },
        card: { aspect: '9:16', corner: 0, gradient: false, gradientOpacity: 0 },
        frame: { aspect: '9:16', background: '#111110', corners: 0 },
        effects: {
          edgeShade: edgeShade({ mode: 'dark', colour: '#111110', edges: all(14), falloff: 'soft', softness: 70 })
        },
        export: { durationSec: 11, fps: 30 },
        text: [
          text({ id: 'top', text: 'We all', size: 13, colour: INK.yellow, x: 8, y: 9, align: 'left', weight: 400, font: 'Playfair Display', lineHeight: 1 }),
          text({ id: 'brand', text: 'white ribbon', size: 1.6, colour: INK.yellow, x: 8, y: 31, align: 'left', weight: 500 }),
          text({ id: 'site', text: 'whiteribbon.com', size: 1.6, colour: '#E9E7C4', x: 50, y: 31, align: 'center', weight: 400, opacity: 78 }),
          text({ id: 'give', text: '/donate', size: 1.6, colour: '#E9E7C4', x: 92, y: 31, align: 'right', weight: 400, opacity: 78 }),
          text({ id: 'bottom', text: 'Play\na role', size: 13, colour: INK.yellow, x: 8, y: 79, align: 'left', weight: 400, font: 'Playfair Display', lineHeight: 0.98 })
        ]
      })
  },
  {
    id: 'ribbon-landscape',
    name: 'Ribbon — landscape',
    note: 'The cause poster widened: the line held left, the photograph carrying the rest.',
    images: ['lantern', 'harbour'],
    swatch: ['#8A8578', '#3A3630'],
    build: (images) =>
      base('slider', images, {
        params: {
          cards: 2, cardScale: 4, gap: 2.6, stagger: 0, depth: 0,
          spinX: 0, spinY: 0, spinZ: 0, axis: 'x', mode: 'step',
          stepSize: 1, direction: 'forward', hold: 3.4, transition: 1.1, drift: 4
        },
        doc: {
          transform: { ...emptyDoc('slider').transform, positionX: 3, scale: 2.4 },
          keys: {
            'text:top:x': ride([[0, 4], [0.12, 6]], EASE.settle),
            'text:bottom:x': ride([[0, 8], [0.16, 6]], EASE.settle)
          }
        },
        card: { aspect: '16:9', corner: 0, gradient: false, gradientOpacity: 0 },
        frame: { aspect: '16:9', background: '#111110', corners: 0 },
        effects: {
          edgeShade: edgeShade({ mode: 'dark', colour: '#111110', edges: reach({ left: 62, bottom: 18 }), falloff: 'soft', softness: 88 })
        },
        export: { durationSec: 11, fps: 30 },
        text: [
          text({ id: 'top', text: 'We all', size: 13, colour: INK.yellow, x: 6, y: 14, align: 'left', weight: 400, font: 'Playfair Display', lineHeight: 1 }),
          text({ id: 'bottom', text: 'play a role', size: 13, colour: INK.yellow, x: 6, y: 42, align: 'left', weight: 400, font: 'Playfair Display', lineHeight: 1 }),
          text({ id: 'brand', text: 'white ribbon', size: 2.2, colour: INK.yellow, x: 6, y: 88, align: 'left', weight: 500 }),
          text({ id: 'give', text: 'whiteribbon.com  /donate', size: 2.2, colour: '#E9E7C4', x: 94, y: 88, align: 'right', weight: 400, opacity: 78 })
        ]
      })
  },
  {
    id: 'habitts-landscape',
    name: 'Habitts — landscape',
    note: 'A course card: white on the left, a hot panel on the right with the portrait cut into it.',
    images: ['ember', 'signal', 'lantern'],
    swatch: ['#F3F0EA', '#C9C2B6'],
    build: (images) =>
      base('slider', images, {
        params: {
          cards: 2, cardScale: 3.4, gap: 1.7, stagger: 0, depth: 0,
          spinX: 0, spinY: 0, spinZ: 0, axis: 'x', mode: 'step',
          stepSize: 1, direction: 'forward', hold: 2.4, transition: 0.8, drift: 0
        },
        doc: {
          // The portrait is the card, so it can change between courses. It is
          // moved onto the panel rather than the panel drawn round it,
          // because the panel is a shape a person can drag and the camera is
          // not.
          transform: { positionX: 3.5, positionY: 0, scale: 1 },
          keys: {
            'shape:badge:opacity': ride([[0, 55], [0.14, 100]], EASE.snap),
            'text:head:x': ride([[0, 5], [0.08, 6]], EASE.settle)
          }
        },
        card: { aspect: '4:5', corner: 10, gradient: false, gradientOpacity: 0, backOpacity: 0 },
        frame: { aspect: '16:9', background: INK.white, corners: 10 },
        effects: {
          // The portrait sits on the panel rather than in it, so it casts.
          dropShadow: cast({ angle: 0, distance: 1.4, blur: 16, density: 14, colour: '#7A2E06' })
        },
        export: { durationSec: 9, fps: 30 },
        shapes: [
          shape({ id: 'panel', kind: 'rect', width: 52, height: 100, x: 74, y: 50, colour: INK.orange, corner: 0 }),
          shape({ id: 'badge', kind: 'pill', width: 11, height: 9, x: 11, y: 87, colour: INK.orange })
        ],
        text: [
          text({
            id: 'head', text: 'Oratoria para\nestudiantes:\nManuel Casaubón',
            size: 7.4, colour: INK.black, x: 6, y: 26, align: 'left', weight: 500, lineHeight: 1.16
          }),
          text({ id: 'badge-label', text: 'Nuevo', size: 2.4, colour: INK.white, x: 11, y: 87, align: 'center', weight: 600, caps: true }),
          text({ id: 'length', text: '3h 45m', size: 3.2, colour: '#4A4A4A', x: 20, y: 87, align: 'left', weight: 400 }),
          text({ id: 'brand', text: 'habitts', size: 5, colour: INK.black, x: 44, y: 87, align: 'right', weight: 700 })
        ]
      })
  },
  {
    id: 'habitts-portrait',
    name: 'Habitts — portrait',
    note: 'The course card stood up: the hot panel across the top, the words beneath it.',
    images: ['signal', 'ember', 'lantern'],
    swatch: ['#F3F0EA', '#C9C2B6'],
    build: (images) =>
      base('slider', images, {
        params: {
          cards: 2, cardScale: 3, gap: 1.7, stagger: 0, depth: 0,
          spinX: 0, spinY: 0, spinZ: 0, axis: 'x', mode: 'step',
          stepSize: 1, direction: 'forward', hold: 2.4, transition: 0.8, drift: 0
        },
        doc: {
          transform: { positionX: 0, positionY: 1.6, scale: 1 },
          keys: {
            'shape:badge:opacity': ride([[0, 55], [0.14, 100]], EASE.snap),
            'text:head:y': ride([[0, 59], [0.08, 58]], EASE.settle)
          }
        },
        card: { aspect: '4:5', corner: 10, gradient: false, gradientOpacity: 0, backOpacity: 0 },
        frame: { aspect: '9:16', background: INK.white, corners: 14 },
        effects: {
          dropShadow: cast({ angle: 0, distance: 1.4, blur: 16, density: 14, colour: '#7A2E06' })
        },
        export: { durationSec: 9, fps: 30 },
        shapes: [
          shape({ id: 'panel', kind: 'rect', width: 100, height: 46, x: 50, y: 23, colour: INK.orange, corner: 0 }),
          shape({ id: 'badge', kind: 'pill', width: 22, height: 4.6, x: 19, y: 92, colour: INK.orange })
        ],
        text: [
          text({
            id: 'head', text: 'Oratoria para\nestudiantes:\nManuel Casaubón',
            size: 5.8, colour: INK.black, x: 8, y: 58, align: 'left', weight: 500, lineHeight: 1.16
          }),
          text({ id: 'badge-label', text: 'Nuevo', size: 2, colour: INK.white, x: 19, y: 92, align: 'center', weight: 600, caps: true }),
          text({ id: 'length', text: '3h 45m', size: 2.4, colour: '#4A4A4A', x: 34, y: 92, align: 'left', weight: 400 }),
          text({ id: 'brand', text: 'habitts', size: 3.8, colour: INK.black, x: 92, y: 92, align: 'right', weight: 700 })
        ]
      })
  },
  {
    id: 'taste-portrait',
    name: 'Taste — portrait',
    note: 'A long claim set straight over the photograph, wordmark small at the foot.',
    images: ['dune', 'quarry', 'tide'],
    swatch: ['#6E93A6', '#22485C'],
    build: (images) =>
      base('parallax', images, {
        params: {
          layers: 2, perLayer: 6, cardScale: 3, speedSpread: 1.2,
          depthSpread: 0.5, span: 11, direction: 'left'
        },
        doc: {
          // The claim is set over the photograph, so the photograph has to be
          // the ground rather than a card floating on it.
          transform: { ...emptyDoc('parallax').transform, scale: 1.3 },
          keys: {
            'text:head:y': ride([[0, 23.4], [0.1, 22]], EASE.settle),
            'text:note:opacity': ride([[0, 34], [0.3, 70]], EASE.settle)
          }
        },
        card: { aspect: '9:16', corner: 0, gradient: true, gradientOpacity: 30, gradientSide: 'front' },
        frame: { aspect: '9:16', background: '#0E3346', corners: 0 },
        effects: {
          edgeShade: edgeShade({ mode: 'dark', colour: '#0E3346', edges: reach({ top: 52, bottom: 18 }), falloff: 'soft', softness: 70 })
        },
        export: { durationSec: 13, fps: 30 },
        text: [
          text({
            id: 'head',
            text: 'Wellness\nshouldn’t\nbe complicated.\nThat’s why we’ve\ncreated supplements\nthat do more.',
            size: 5.4, colour: INK.sky, x: 6, y: 22, align: 'left', weight: 600, lineHeight: 1.14
          }),
          text({
            id: 'note', text: 'Powerful nutrition meets modern\nsimplicity, crafted to make feeling\ngood second nature.',
            size: 1.8, colour: '#DCEAF2', x: 94, y: 87, align: 'right', weight: 400, lineHeight: 1.4, opacity: 70
          }),
          text({ id: 'brand', text: 'Taste Health.', size: 3, colour: INK.white, x: 6, y: 94, align: 'left', weight: 700 })
        ]
      })
  },
  {
    id: 'taste-landscape',
    name: 'Taste — landscape',
    note: 'The same claim, held to the left third so the photograph can breathe.',
    images: ['quarry', 'dune', 'tide'],
    swatch: ['#6E93A6', '#22485C'],
    build: (images) =>
      base('parallax', images, {
        params: {
          layers: 2, perLayer: 4, cardScale: 3, speedSpread: 1.2,
          depthSpread: 0.5, span: 11, direction: 'left'
        },
        doc: {
          transform: { ...emptyDoc('parallax').transform, positionX: 3.4, scale: 1.25 },
          keys: {
            'text:head:x': ride([[0, 7.4], [0.1, 6]], EASE.settle),
            'text:note:opacity': ride([[0, 34], [0.3, 70]], EASE.settle)
          }
        },
        card: { aspect: '4:5', corner: 0, gradient: true, gradientOpacity: 30, gradientSide: 'front' },
        frame: { aspect: '16:9', background: '#0E3346', corners: 0 },
        effects: {
          edgeShade: edgeShade({ mode: 'dark', colour: '#0E3346', edges: reach({ left: 62 }), falloff: 'soft', softness: 84 })
        },
        export: { durationSec: 13, fps: 30 },
        text: [
          text({
            id: 'head',
            text: 'Wellness shouldn’t\nbe complicated.',
            size: 8, colour: INK.sky, x: 6, y: 26, align: 'left', weight: 600, lineHeight: 1.1
          }),
          text({
            id: 'note', text: 'Powerful nutrition meets modern simplicity,\ncrafted to make feeling good second nature.',
            size: 2.4, colour: '#DCEAF2', x: 6, y: 56, align: 'left', weight: 400, lineHeight: 1.4, opacity: 70
          }),
          text({ id: 'brand', text: 'Taste Health.', size: 3.4, colour: INK.white, x: 6, y: 88, align: 'left', weight: 700 })
        ]
      })
  }
] as const

export function templateById(id: string): MotionTemplate | null {
  return MOTION_TEMPLATES.find((t) => t.id === id) ?? null
}
