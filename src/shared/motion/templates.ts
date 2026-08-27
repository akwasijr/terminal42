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
      effects: { ...doc.visual.effects, ...patch.effects }
    },
    frame: { ...doc.frame, ...patch.frame, gridVisible: patch.frame?.gridVisible ?? false },
    export: { ...doc.export, ...patch.export }
  }
}

export const MOTION_TEMPLATES: readonly MotionTemplate[] = [
  {
    id: 'title-carousel',
    name: 'Title carousel',
    note: 'A slow turn on warm paper, with the title set over it.',
    images: ['dune', 'lantern', 'ember', 'quarry', 'orchard', 'moss'],
    swatch: ['#e8d5b7', '#4a2f1a'],
    build: (images) =>
      base('carousel', images, {
        params: {
          cards: 12, cardScale: 1.15, rows: 1, radius: 5.2, speed: 0.22,
          bend: 18, type: 'continuous', spinAxis: 'y'
        },
        doc: {
          pose: { tiltX: 8, tiltY: 0, tiltZ: 0 },
          keys: {
            // The turn is even, so the piece needs its shape from somewhere
            // else: the camera leans a degree or two either side of centre,
            // which is enough to stop the loop reading as a machine.
            'pose:tiltX': ride([[0, 6], [0.5, 11]]),
            'text:t2:tracking': ride([[0, 3.4], [0.5, 5.2]])
          }
        },
        card: { aspect: '4:5', corner: 14, gradientOpacity: 22 },
        frame: { background: '#efe6d6', corners: 14 },
        effects: {
          vignette: 12,
          saturation: 104,
          grain: 8,
          dropShadow: cast({ angle: 18, distance: 16, blur: 26, density: 30, colour: '#4a2f1a' }),
          edgeShade: edgeShade({ mode: 'light', colour: '#efe6d6', edges: reach({ left: 22, right: 22 }), falloff: 'soft', softness: 70 })
        },
        text: [
          text({ id: 't1', text: 'Late summer', size: 10.5, weight: 700, y: 22, colour: '#2a1c10', font: 'Fraunces', tracking: -2 }),
          text({ id: 't2', text: 'a film in six frames', size: 2.4, weight: 500, y: 32, colour: '#7a6244', tracking: 4 }),
          text({ id: 't3', text: 'Terminal 42', size: 2, weight: 500, y: 93, colour: '#a08c6d', font: 'JetBrains Mono', tracking: 6, from: 0.55, to: 0.98, fade: 0.12 })
        ]
      })
  },
  {
    id: 'poster-ring',
    name: 'Poster ring',
    note: 'A ring seen edge on, behind glass, for a portrait poster.',
    images: ['tide', 'harbour', 'slate', 'drift'],
    swatch: ['#bfe3f2', '#0e2a3a'],
    build: (images) =>
      base('ring', images, {
        params: {
          cards: 14, rings: 2, cardScale: 0.95, radius: 3, ringGap: 1.7,
          arc: 360, speed: 0.3, sizeFalloff: 0.35, faceCentre: true
        },
        doc: {
          pose: { tiltX: 44, tiltY: 0, tiltZ: 0 },
          transform: { positionX: 0, positionY: -0.5, scale: 1.05 },
          keys: { 'param:radius': ride([[0, 3.2], [0.5, 3.9]]) }
        },
        card: { aspect: '1:1', corner: 18, gradientOpacity: 24 },
        frame: { aspect: '4:5', background: '#07202c', corners: 16 },
        effects: {
          vignette: 34,
          saturation: 116,
          contrast: 104,
          tint: '#0aa3c2',
          tintAmount: 8,
          glass: glass({ width: 16, refraction: 55, curve: 2.4 }),
          edgeShade: edgeShade({ mode: 'dark', colour: '#02121a', edges: reach({ bottom: 46 }), falloff: 'soft', softness: 70 })
        },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Harbour', size: 13, weight: 700, y: 20, colour: '#eaf6fb', font: 'Space Grotesk', tracking: -3 }),
          text({ id: 't2', text: 'Nine to five,\nevery tide', size: 3.4, weight: 400, y: 79, colour: '#a6cdde', lineHeight: 1.35 }),
          text({ id: 't3', text: 'North quay, 06:40', size: 1.9, weight: 400, y: 93, colour: '#5d8ba1', font: 'JetBrains Mono', tracking: 4 })
        ]
      })
  },
  {
    id: 'story-feed',
    name: 'Story feed',
    note: 'A vertical scroll sized for a phone, captioned as it goes.',
    images: ['bloom', 'signal', 'ember', 'orchard', 'dune'],
    swatch: ['#f6d3e2', '#3a1024'],
    build: (images) =>
      base('feed', images, {
        params: {
          cards: 14, columns: 1, cardScale: 2.8, gap: 1.25, edgeFalloff: 0.75,
          mode: 'continuous', direction: 'forward'
        },
        doc: {
          pose: { tiltX: 0, tiltY: 0, tiltZ: 0 },
          displacement: move({ wave: { depth: 1.1, frequency: 1.4, speed: 1, style: 'wave', direction: 'vertical' } })
        },
        card: { aspect: '4:5', corner: 18, gradient: false },
        frame: { aspect: '9:16', background: '#2a0c1c', corners: 18 },
        effects: {
          grain: 12,
          contrast: 104,
          saturation: 108,
          edgeBlur: edgeBlur({ edges: reach({ top: 26, bottom: 26 }), amount: 34, falloff: 'soft', softness: 62 }),
          edgeShade: edgeShade({ mode: 'dark', colour: '#2a0c1c', edges: reach({ top: 30, bottom: 34 }), falloff: 'soft', softness: 65 })
        },
        export: { durationSec: 9, resolution: 1080 },
        // Three captions rather than one heading: the piece is a scroll, so
        // the words should move through it too, one at a time.
        text: [
          text({ id: 't1', text: 'This week', size: 4, weight: 700, y: 7, colour: '#fbe9f1', tracking: -1 }),
          text({ id: 't2', text: 'Everything we shot on Monday', size: 3, weight: 500, y: 90, colour: '#f4c7db', from: 0.02, to: 0.32, fade: 0.06 }),
          text({ id: 't3', text: 'Half of it in the rain', size: 3, weight: 500, y: 90, colour: '#f4c7db', from: 0.34, to: 0.64, fade: 0.06 }),
          text({ id: 't4', text: 'None of it planned', size: 3, weight: 500, y: 90, colour: '#f4c7db', from: 0.66, to: 0.96, fade: 0.06 })
        ]
      })
  },
  {
    id: 'contact-sheet',
    name: 'Contact sheet',
    note: 'A drifting grid on a light table, marked up in pencil.',
    images: ['slate', 'quarry', 'harbour', 'drift', 'moss', 'tide'],
    swatch: ['#d8dbe0', '#1b1f24'],
    build: (images) =>
      base('grid', images, {
        params: {
          columns: 5, rows: 4, cardScale: 0.8, gapX: 2.4, gapY: 2, 
          driftX: 1, driftY: 0, curve: 0.1, depth: 0.5, lean: 0
        },
        doc: { pose: { tiltX: 4, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:3', corner: 4, gradient: false, backOpacity: 12 },
        frame: { background: '#e7e5e0', corners: 10 },
        effects: {
          saturation: 62,
          contrast: 108,
          grain: 16,
          dropShadow: cast({ angle: 0, distance: 8, blur: 14, density: 22, colour: '#1b1f24' }),
          edgeShade: edgeShade({ mode: 'light', colour: '#e7e5e0', edges: all(18), falloff: 'soft', softness: 75 })
        },
        text: [
          text({ id: 't1', text: 'Roll 04', size: 2.6, weight: 500, x: 6, y: 8, align: 'left', colour: '#2c3037', font: 'JetBrains Mono' }),
          text({ id: 't2', text: '24 exposures on Ilford HP5', size: 2, weight: 400, x: 6, y: 93, align: 'left', colour: '#6d737c', font: 'JetBrains Mono' }),
          text({ id: 't3', text: 'keep 9, 14, 21', size: 2, weight: 400, x: 94, y: 93, align: 'right', colour: '#a33b2a', font: 'JetBrains Mono', from: 0.4, to: 0.95, fade: 0.1 })
        ]
      })
  },
  {
    id: 'launch-wall',
    name: 'Launch wall',
    note: 'A wall of cards flipping behind a headline, in ink and amber.',
    images: ['signal', 'ember', 'lantern', 'dune'],
    swatch: ['#ffd166', '#101f4a'],
    build: (images) =>
      base('flip', images, {
        params: {
          columns: 5, rows: 3, cardScale: 0.95, gapX: 1.4, gapY: 1.8, axis: 'y',
          flips: 2, stagger: 0.55, hold: 0.8, transition: 0.7, depth: 0.4
        },
        doc: {
          pose: { tiltX: 6, tiltY: 0, tiltZ: 0 },
          // Lifted, so the bottom row clears the band the words sit in.
          transform: { positionX: 0, positionY: 0.8, scale: 0.9 },
          keys: {
            // The wall flips in steps, so the grade pulses with it rather than
            // sitting still while everything else moves.
            'fx:tintAmount': ride([[0, 6], [0.5, 20]]),
            'text:t1:size': ride([[0, 8.6], [0.5, 9.2]])
          }
        },
        card: { aspect: '1:1', corner: 8, gradientOpacity: 26 },
        frame: { background: '#101f4a', corners: 12 },
        effects: {
          vignette: 26,
          contrast: 106,
          saturation: 112,
          tint: '#ffb020',
          tintAmount: 10,
          dropShadow: cast({ angle: 12, distance: 14, blur: 30, density: 40, colour: '#05091c' }),
          edgeShade: edgeShade({ mode: 'dark', colour: '#05091c', edges: reach({ top: 18, bottom: 48 }), falloff: 'soft', softness: 62 })
        },
        export: { durationSec: 6 },
        text: [
          text({ id: 't0', text: 'Release notes', size: 2, weight: 500, y: 70, colour: '#8fa3d8', font: 'JetBrains Mono', tracking: 8 }),
          text({ id: 't1', text: 'Now shipping', size: 8.6, weight: 700, y: 80, colour: '#ffd166', font: 'Space Grotesk', tracking: -3 }),
          text({ id: 't2', text: 'Version two, today', size: 2.8, weight: 400, y: 88, colour: '#c8d3f0' }),
          text({ id: 't3', text: 'terminal42.app', size: 2, weight: 500, y: 95, colour: '#7f92c8', from: 0.5, to: 0.98, fade: 0.12 })
        ]
      })
  },
  {
    id: 'deep-field',
    name: 'Deep field',
    note: 'Cards flying past the camera, focus pulling as they come.',
    images: ['drift', 'slate', 'tide', 'harbour'],
    swatch: ['#dcd9f2', '#1f1a3d'],
    build: (images) =>
      base('space', images, {
        params: { cards: 70, cardScale: 0.42, spread: 9.5, depthRange: 28, speed: 2, direction: 'forward' },
        doc: {
          pose: { tiltX: 0, tiltY: 0, tiltZ: 0 },
          keys: { 'fx:blur': ride([[0, 1], [0.5, 5]], EASE.breath) }
        },
        card: { aspect: '4:5', corner: 12, gradientOpacity: 40 },
        frame: { background: '#0a0722', corners: 12 },
        effects: {
          blur: 1,
          vignette: 46,
          saturation: 122,
          tint: '#6a5cff',
          tintAmount: 12,
          glass: glass({ width: 10, refraction: 40, curve: 3 }),
          dropShadow: cast({ angle: 0, distance: 0, blur: 40, density: 30, colour: '#000018' })
        },
        imageOrder: 'scatter',
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Everything,\nall at once', size: 6.4, weight: 600, y: 78, colour: '#e4e0ff', lineHeight: 1.15 }),
          text({ id: 't2', text: 'an archive of 4,200 frames', size: 2.2, weight: 400, y: 92, colour: '#8b83c9', tracking: 3 })
        ]
      })
  },
  {
    id: 'quiet-slider',
    name: 'Quiet slider',
    note: 'One card at a time on off-white, held long enough to read.',
    images: ['moss', 'orchard', 'quarry', 'dune'],
    swatch: ['#d6e6c3', '#2b3524'],
    build: (images) =>
      base('slider', images, {
        params: {
          cards: 6, cardScale: 4, gap: 3.4, stagger: 0.2, depth: 1.6,
          mode: 'stepped', stepSize: 1, hold: 1.6, transition: 1.2, drift: 4
        },
        doc: {
          pose: { tiltX: 6, tiltY: 0, tiltZ: 0 },
          easing: EASE.snap,
          transform: { positionX: 0, positionY: 0, scale: 1.5 }
        },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 14 },
        frame: { background: '#f0eee6', corners: 12 },
        effects: {
          saturation: 96,
          contrast: 102,
          grain: 6,
          dropShadow: cast({ angle: 8, distance: 18, blur: 34, density: 26, colour: '#2b3524' }),
          edgeShade: edgeShade({ mode: 'light', colour: '#f0eee6', edges: reach({ left: 26, right: 26 }), falloff: 'soft', softness: 78 })
        },
        export: { durationSec: 8 },
        text: [
          text({ id: 't1', text: 'Field notes', size: 3.6, weight: 400, x: 8, y: 10, align: 'left', colour: '#2b3524', font: 'Lora' }),
          text({ id: 't2', text: 'Kent, late April', size: 2.1, weight: 400, x: 8, y: 15, align: 'left', colour: '#7b8470', font: 'JetBrains Mono', tracking: 3 }),
          text({ id: 't3', text: 'Four days of walking, one roll of film', size: 2.3, weight: 400, x: 8, y: 92, align: 'left', colour: '#5c6553', font: 'Lora', italic: true })
        ]
      })
  },
  {
    id: 'editorial-column',
    name: 'Editorial column',
    note: 'A helix rising beside a serif title, on ivory.',
    images: ['bloom', 'ember', 'lantern', 'signal'],
    swatch: ['#f6f1e7', '#3f1d05'],
    build: (images) =>
      base('column', images, {
        params: {
          cards: 20, cardScale: 0.7, radius: 2.6, pitch: 0.85, twist: 2.5,
          taper: 0.9, speed: 1, lean: 8, facing: 'camera'
        },
        doc: {
          pose: { tiltX: 14, tiltY: 0, tiltZ: 0 },
          transform: { positionX: 2.4, positionY: 0, scale: 1 },
          keys: { 'param:lean': ride([[0, 4], [0.5, 12]]) }
        },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 18 },
        frame: { aspect: '4:5', background: '#f6f1e7', corners: 14 },
        effects: {
          saturation: 100,
          grain: 7,
          dropShadow: cast({ angle: 22, distance: 14, blur: 30, density: 24, colour: '#3f1d05' }),
          edgeShade: edgeShade({ mode: 'light', colour: '#f6f1e7', edges: reach({ top: 20, bottom: 20 }), falloff: 'soft', softness: 72 })
        },
        text: [
          text({ id: 't0', text: 'Issue eleven', size: 2, weight: 500, x: 8, y: 10, align: 'left', colour: '#a1794b', font: 'JetBrains Mono', tracking: 8 }),
          text({ id: 't1', text: 'The long\nway round', size: 8, weight: 400, x: 8, y: 40, align: 'left', colour: '#2a1608', font: 'Playfair Display', lineHeight: 1.02 }),
          text({ id: 't2', text: 'Six photographers on the roads they keep\ncoming back to.', size: 2.3, weight: 400, x: 8, y: 60, align: 'left', colour: '#6b5238', font: 'Lora', lineHeight: 1.5 }),
          text({ id: 't3', text: 'Words by Ama Yeboah', size: 1.9, weight: 400, x: 8, y: 91, align: 'left', colour: '#9c8467', font: 'JetBrains Mono' })
        ]
      })
  },
  {
    id: 'globe-brand',
    name: 'Globe',
    note: 'A sphere of cards turning under a wordmark that opens out.',
    images: ['tide', 'harbour', 'drift', 'slate', 'moss'],
    swatch: ['#cfe0e6', '#062028'],
    build: (images) =>
      base('global', images, {
        params: {
          cards: 40, cardScale: 0.82, radius: 4.2, band: 1, speed: 0.36,
          swell: 0.4, scaleFalloff: 0.5, facing: 'camera'
        },
        doc: {
          pose: { tiltX: 10, tiltY: 0, tiltZ: 0 },
          keys: {
            'text:t1:tracking': ride([[0, -1], [0.5, 6]], EASE.breath),
            'text:t1:opacity': ride([[0, 100], [0.5, 82]])
          }
        },
        card: { aspect: '1:1', corner: 16, gradientOpacity: 30 },
        frame: { background: '#062028', corners: 12 },
        effects: {
          vignette: 38,
          saturation: 112,
          tint: '#1fd0c0',
          tintAmount: 9,
          glass: glass({ width: 14, refraction: 50, curve: 2 }),
          dropShadow: cast({ angle: 0, distance: 6, blur: 44, density: 34, colour: '#00080c' })
        },
        imageOrder: 'scatter',
        text: [
          text({ id: 't1', text: 'Everywhere', size: 7, weight: 700, y: 49, colour: '#e6f2f6', font: 'Space Grotesk' }),
          text({ id: 't2', text: 'thirty-one cities, one afternoon', size: 2.1, weight: 400, y: 58, colour: '#79a5b0', tracking: 4 })
        ]
      })
  },
  {
    id: 'ribbon-banner',
    name: 'Ribbon banner',
    note: 'A wide wave in warm light, sized for a site header.',
    images: ['ember', 'signal', 'lantern', 'bloom'],
    swatch: ['#ffd0a6', '#3d0f0a'],
    build: (images) =>
      base('ribbon', images, {
        params: {
          cards: 22, cardScale: 0.72, length: 17, amplitude: 2.4,
          wavelength: 2, twist: 40, depth: 2.2, speed: 1
        },
        doc: {
          pose: { tiltX: 16, tiltY: 0, tiltZ: 0 },
          displacement: move({ wave: { depth: 1.6, frequency: 2, speed: 1, style: 'wave', direction: 'horizontal' } })
        },
        card: { aspect: '4:5', corner: 12, gradientOpacity: 26 },
        frame: { background: '#2a0b08', corners: 12 },
        effects: {
          vignette: 30,
          saturation: 118,
          tint: '#ff7a2f',
          tintAmount: 14,
          edgeBlur: edgeBlur({ edges: reach({ left: 30, right: 30 }), amount: 30, falloff: 'soft', softness: 60, over: 'component' }),
          dropShadow: cast({ angle: 30, distance: 12, blur: 32, density: 36, colour: '#1a0402' })
        },
        text: [
          text({ id: 't1', text: 'Warm front', size: 7.4, weight: 700, y: 12, colour: '#ffe3c8', font: 'Space Grotesk', tracking: -2 }),
          text({ id: 't2', text: 'A season of work, opening 14 June', size: 2.3, weight: 400, y: 88, colour: '#d29b76', tracking: 3 })
        ]
      })
  },
  {
    id: 'drop-reveal',
    name: 'Drop reveal',
    note: 'Cards fall in and settle, and the title lands after them.',
    images: ['quarry', 'dune', 'slate', 'orchard'],
    swatch: ['#e3ded6', '#2e281f'],
    previewPhase: 0.85,
    build: (images) => {
      const doc = base('card-drop', images, {
        params: {
          cards: 10, cardScale: 1.7, spread: 4.6, dropHeight: 9,
          squash: 0.35, spin: 22, stagger: 0.6, drops: 1
        },
        doc: { pose: { tiltX: 18, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 20 },
        frame: { background: '#1c2117', corners: 12 },
        effects: {
          vignette: 22,
          saturation: 104,
          dropShadow: cast({ angle: 0, distance: 22, blur: 26, density: 52, colour: '#050703' }),
          edgeShade: edgeShade({ mode: 'dark', colour: '#050703', edges: reach({ bottom: 40 }), falloff: 'soft', softness: 68 })
        },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Deal me in', size: 7, weight: 700, y: 84, colour: '#eee7db', font: 'Space Grotesk', from: 0.42, to: 0.99, fade: 0.1 }),
          text({ id: 't2', text: 'twelve cards, one hand', size: 2.2, weight: 400, y: 92, colour: '#9aa38c', tracking: 4, from: 0.52, to: 0.99, fade: 0.08 })
        ]
      })
      return {
        ...doc,
        animation: {
          ...doc.animation,
          componentIn: { ...doc.animation.componentIn, enabled: true, shape: 'drop', duration: 1, stagger: 0.06 }
        }
      }
    }
  },
  {
    id: 'shuffle-cut',
    name: 'Shuffle',
    note: 'A deck cut and restacked, close in and lit from one side.',
    images: ['ember', 'drift', 'bloom'],
    swatch: ['#f6d3e2', '#241a33'],
    build: (images) =>
      base('card-shuffle', images, {
        params: {
          images: '3', cardScale: 3.8, stagger: 0.35, depth: 1.4,
          mode: 'stepped', stepSize: 1, hold: 0.7, transition: 0.9, drift: 14
        },
        doc: { pose: { tiltX: 10, tiltY: 0, tiltZ: 0 }, easing: EASE.settle },
        card: { aspect: '4:5', corner: 14, gradientOpacity: 18 },
        frame: { aspect: '1:1', background: '#241a33', corners: 16 },
        effects: {
          vignette: 30,
          saturation: 108,
          tint: '#b07bff',
          tintAmount: 10,
          dropShadow: cast({ angle: 42, distance: 20, blur: 30, density: 48, colour: '#0d0715' }),
          glass: glass({ width: 8, refraction: 32, curve: 2.6 })
        },
        text: [
          text({ id: 't1', text: 'Pick one', size: 4.4, weight: 600, y: 88, colour: '#efe7ff' }),
          text({ id: 't2', text: 'you already know which', size: 2, weight: 400, y: 94, colour: '#9a8bc0', italic: true, from: 0.35, to: 0.95, fade: 0.1 })
        ]
      })
  },
  {
    id: 'repeater-pattern',
    name: 'Pattern',
    note: 'A dense field of one picture, rippling from the middle.',
    images: ['signal'],
    swatch: ['#8ef0d8', '#04241f'],
    build: (images) =>
      base('image-repeater', images, {
        params: {
          columns: 11, rows: 7, gap: 1.1, cardScale: 0.5,
          waveAmp: 0.9, waveSpeed: 2, waveAxis: 'depth'
        },
        doc: {
          pose: { tiltX: 24, tiltY: 0, tiltZ: 0 },
          displacement: move({ wave: { depth: 2.4, frequency: 3, speed: 1, style: 'ripple', direction: 'horizontal' } }),
          keys: { 'fx:vignette': ride([[0, 34], [0.5, 52]]) }
        },
        card: { aspect: '1:1', corner: 24, gradient: false },
        frame: { background: '#04241f', corners: 12 },
        effects: {
          vignette: 34,
          saturation: 130,
          contrast: 106,
          tint: '#00e0b0',
          tintAmount: 16,
          edgeBlur: edgeBlur({ edges: all(28), amount: 26, falloff: 'soft', softness: 70 })
        },
        text: [
          text({ id: 't1', text: 'Signal', size: 7.5, weight: 700, y: 46, colour: '#eafff8', font: 'JetBrains Mono', tracking: 10 }),
          text({ id: 't2', text: 'ninety-six of the same picture', size: 2.4, weight: 400, y: 57, colour: '#8fd8c4', font: 'JetBrains Mono', tracking: 4 })
        ]
      })
  },
  {
    id: 'gallery-plate',
    name: 'Gallery plate',
    note: 'A turntable seen from above, on sand.',
    images: ['moss', 'orchard', 'quarry', 'dune', 'harbour'],
    swatch: ['#e9e2d2', '#3c4423'],
    build: (images) =>
      base('plate', images, {
        params: {
          cards: 12, rings: 2, cardScale: 1.5, radius: 3.2, ringGap: 1.6,
          speed: 0.28, tip: 62, lift: 0.4, scatter: 0.2, heading: 'radial'
        },
        doc: {
          pose: { tiltX: 6, tiltY: 0, tiltZ: 0 },
          keys: { 'param:lift': ride([[0, 0.2], [0.5, 0.7]]) }
        },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 16 },
        frame: { background: '#e9e2d2', corners: 12 },
        effects: {
          saturation: 98,
          grain: 8,
          dropShadow: cast({ angle: 0, distance: 12, blur: 24, density: 30, colour: '#3c4423' }),
          edgeShade: edgeShade({ mode: 'light', colour: '#e9e2d2', edges: all(16), falloff: 'soft', softness: 76 })
        },
        text: [
          text({ id: 't1', text: 'On show', size: 3.4, weight: 500, y: 8, colour: '#3c4423', tracking: 8 }),
          text({ id: 't2', text: 'Room two, until Sunday', size: 2.1, weight: 400, y: 92, colour: '#7a815f', font: 'Lora', italic: true })
        ]
      })
  },
  {
    id: 'parallax-scene',
    name: 'Parallax',
    note: 'Layers passing at different speeds through a soft edge.',
    images: ['harbour', 'tide', 'slate', 'drift'],
    swatch: ['#bfe3f2', '#12222e'],
    build: (images) =>
      base('parallax', images, {
        params: { layers: 4, perLayer: 7, cardScale: 1, speedSpread: 3, depthSpread: 3, span: 18 },
        doc: {
          pose: { tiltX: 4, tiltY: 0, tiltZ: 0 },
          keys: { 'text:t1:x': ride([[0, 42], [0.5, 58]], EASE.breath) }
        },
        card: { aspect: '4:3', corner: 8, gradientOpacity: 26 },
        frame: { background: '#12222e', corners: 12 },
        effects: {
          vignette: 28,
          saturation: 108,
          tint: '#3aa0d8',
          tintAmount: 10,
          edgeBlur: edgeBlur({ edges: reach({ left: 34, right: 34 }), amount: 36, falloff: 'soft', softness: 58 }),
          dropShadow: cast({ angle: 0, distance: 10, blur: 30, density: 30, colour: '#04101a' })
        },
        imageOrder: 'scatter',
        text: [
          text({ id: 't1', text: 'Passing through', size: 5.2, weight: 600, y: 13, colour: '#dcecf3' }),
          text({ id: 't2', text: 'four layers, four speeds', size: 2.1, weight: 400, y: 90, colour: '#6f97ab', tracking: 4 })
        ]
      })
  },
  {
    id: 'elevator-list',
    name: 'Elevator',
    note: 'A steady climb beside credits that change as it rises.',
    images: ['slate', 'quarry', 'drift', 'moss'],
    swatch: ['#d8dbe0', '#16181c'],
    build: (images) =>
      base('elevator', images, {
        params: { cards: 12, cardScale: 1.8, gap: 1.5, offsetX: 1.2, tilt: 12, depth: 1.4, speed: 1 },
        doc: {
          pose: { tiltX: 8, tiltY: 0, tiltZ: 0 },
          transform: { positionX: -1.8, positionY: 0, scale: 1 }
        },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 20 },
        frame: { background: '#16181c', corners: 12 },
        effects: {
          vignette: 24,
          saturation: 92,
          dropShadow: cast({ angle: 20, distance: 14, blur: 26, density: 34, colour: '#000000' }),
          edgeShade: edgeShade({ mode: 'dark', colour: '#000000', edges: reach({ right: 20 }), falloff: 'soft', softness: 72 })
        },
        export: { durationSec: 9 },
        text: [
          text({ id: 't0', text: 'With thanks to', size: 2, weight: 500, x: 62, y: 34, align: 'left', colour: '#6e747d', font: 'JetBrains Mono', tracking: 6 }),
          text({ id: 't1', text: 'Everyone who\nshowed up', size: 4.4, weight: 600, x: 62, y: 46, align: 'left', colour: '#e7eaef', lineHeight: 1.2, from: 0.02, to: 0.34, fade: 0.06 }),
          text({ id: 't2', text: 'Everyone who\nstayed late', size: 4.4, weight: 600, x: 62, y: 46, align: 'left', colour: '#e7eaef', lineHeight: 1.2, from: 0.36, to: 0.66, fade: 0.06 }),
          text({ id: 't3', text: 'Everyone who\nsaid it first', size: 4.4, weight: 600, x: 62, y: 46, align: 'left', colour: '#e7eaef', lineHeight: 1.2, from: 0.68, to: 0.98, fade: 0.06 }),
          text({ id: 't4', text: 'Terminal 42, 2026', size: 1.9, weight: 400, x: 62, y: 88, align: 'left', colour: '#585e67', font: 'JetBrains Mono' })
        ]
      })
  },
  {
    id: 'cubic-box',
    name: 'Cubic',
    note: 'A box of cards that breathes as it turns, in oxblood.',
    images: ['ember', 'signal', 'bloom', 'lantern', 'dune', 'orchard'],
    swatch: ['#ffd0a6', '#3a0f16'],
    build: (images) =>
      base('cubic', images, {
        params: { perFace: 2, size: 3.2, cardScale: 0.75, spread: 1.7, speed: 0.34, explode: 0.6, breathe: 0.8 },
        doc: {
          pose: { tiltX: 16, tiltY: 0, tiltZ: 0 },
          keys: { 'param:explode': ride([[0, 0.35], [0.5, 1.3]]) }
        },
        card: { aspect: '1:1', corner: 8, gradientOpacity: 24 },
        frame: { aspect: '1:1', background: '#3a0f16', corners: 16 },
        effects: {
          vignette: 34,
          saturation: 114,
          tint: '#ff5a3c',
          tintAmount: 10,
          dropShadow: cast({ angle: 30, distance: 16, blur: 34, density: 42, colour: '#16060a' }),
          glass: glass({ width: 10, refraction: 38, curve: 2.2 })
        },
        text: [
          text({ id: 't1', text: 'Six sides', size: 4.8, weight: 700, y: 47, colour: '#ffdcc8', font: 'Space Grotesk' }),
          text({ id: 't2', text: 'none of them the front', size: 2.1, weight: 400, y: 55, colour: '#c08272', italic: true })
        ]
      })
  },
  {
    id: 'spin-fan',
    name: 'Fan',
    note: 'A hand of cards that opens and closes.',
    images: ['bloom', 'ember', 'signal', 'lantern', 'dune'],
    swatch: ['#f6d3e2', '#2c1020'],
    previewPhase: 0.5,
    build: (images) =>
      base('spin', images, {
        params: {
          cards: 11, cardScale: 1, spread: 180, reach: 2.6, pivot: 0.5,
          speed: 0.15, depth: 0.4, taper: 1, breathe: 0, lean: 0
        },
        doc: {
          pose: { tiltX: 12, tiltY: 0, tiltZ: 0 },
          // The one thing the arrangement cannot do on its own: the fan is a
          // shape, not a movement, so opening and closing it is a keyed track.
          keys: {
            'param:spread': ride([[0, 110], [0.5, 260]], EASE.snap),
            'text:t1:y': ride([[0, 17], [0.5, 14]], EASE.snap)
          }
        },
        card: { aspect: '4:5', corner: 12, gradientOpacity: 20 },
        frame: { background: '#2c1020', corners: 12 },
        effects: {
          vignette: 28,
          saturation: 110,
          tint: '#ff4d8d',
          tintAmount: 9,
          dropShadow: cast({ angle: 0, distance: 18, blur: 28, density: 44, colour: '#12040a' })
        },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Your hand', size: 5.8, weight: 700, y: 17, colour: '#ffdfea', font: 'Space Grotesk', tracking: -2 }),
          text({ id: 't2', text: 'eleven cards, face up', size: 2.1, weight: 400, y: 90, colour: '#bb8098', tracking: 4 })
        ]
      })
  },
  {
    id: 'breathing-ring',
    name: 'Breathing ring',
    note: 'A ring that opens out and draws back in, once a loop.',
    images: ['moss', 'tide', 'drift', 'harbour'],
    swatch: ['#d6e6c3', '#0a1f1a'],
    build: (images) =>
      base('ring', images, {
        params: {
          cards: 24, rings: 1, cardScale: 0.6, radius: 3.2, ringGap: 1.2,
          arc: 360, speed: 0.24, spiral: 0, sizeFalloff: 0.2, faceCentre: true
        },
        doc: {
          pose: { tiltX: 34, tiltY: 0, tiltZ: 0 },
          keys: {
            'param:radius': ride([[0, 2.2], [0.5, 5.4]]),
            'pose:tiltX': ride([[0, 28], [0.5, 46]]),
            'fx:vignette': ride([[0, 30], [0.5, 48]]),
            'text:t1:opacity': ride([[0, 100], [0.5, 55]])
          }
        },
        card: { aspect: '1:1', corner: 50, gradientOpacity: 22 },
        frame: { aspect: '1:1', background: '#0a1f1a', corners: 16 },
        effects: {
          vignette: 30,
          saturation: 112,
          tint: '#2fd6a0',
          tintAmount: 10,
          glass: glass({ width: 12, refraction: 46, curve: 2 })
        },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'In and out', size: 4.2, weight: 500, y: 88, colour: '#c6dcd2', tracking: 6 }),
          text({ id: 't2', text: 'four seconds each way', size: 1.9, weight: 400, y: 94, colour: '#5e8878', font: 'JetBrains Mono' })
        ]
      })
  },
  {
    id: 'mono-grid',
    name: 'Mono grid',
    note: 'Black on white, square, and almost still.',
    images: ['slate', 'quarry', 'harbour', 'drift'],
    swatch: ['#f2f2f2', '#111111'],
    build: (images) =>
      base('grid', images, {
        params: {
          columns: 4, rows: 4, cardScale: 0.92, gapX: 1.2, gapY: 1.2,
          driftX: 0, driftY: 1, curve: 0, depth: 0, lean: 0
        },
        doc: {
          pose: { tiltX: 0, tiltY: 0, tiltZ: 0 },
          keys: { 'fx:contrast': ride([[0, 112], [0.5, 128]]) }
        },
        card: { aspect: '1:1', corner: 0, gradient: false },
        frame: { aspect: '1:1', background: '#f2f2f2', corners: 0 },
        effects: {
          saturation: 0,
          contrast: 112,
          grain: 14,
          dropShadow: cast({ angle: 0, distance: 6, blur: 12, density: 18, colour: '#111111' })
        },
        text: [
          text({ id: 't1', text: 'Sixteen', size: 2.6, weight: 500, x: 6, y: 6, align: 'left', colour: '#111111', font: 'JetBrains Mono', tracking: 10 }),
          text({ id: 't2', text: 'one subject, sixteen times', size: 2, weight: 400, x: 94, y: 95, align: 'right', colour: '#7a7a7a', font: 'JetBrains Mono' })
        ]
      })
  }
] as const

export function templateById(id: string): MotionTemplate | null {
  return MOTION_TEMPLATES.find((t) => t.id === id) ?? null
}
