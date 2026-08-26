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
// Every template is a plain function of its pictures, so the same template
// always produces the same document. Nothing here reads the clock or the
// random number generator: a template is a starting point that two people
// should be able to compare notes on.
//
// Pictures are named by starter-set id rather than carried as data. The bank
// draws them, so a template costs a few hundred bytes instead of a megabyte,
// and the renderer resolves the ids to real files when the template is used.

import type { ImageRef, MotionDoc, TextLayer } from './types'
import { emptyDoc } from './defaults'

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
    weight: 600,
    align: 'center',
    lineHeight: 1.1,
    tracking: 0,
    opacity: 100,
    ...layer
  }
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
    note: 'A slow turn behind a centred title.',
    images: ['dune', 'lantern', 'ember', 'quarry', 'orchard', 'moss'],
    swatch: ['#e8d5b7', '#4a2f1a'],
    build: (images) =>
      base('carousel', images, {
        params: { cards: 12, cardScale: 1.15, rows: 1, radius: 5.2, speed: 0.22, bend: 18, type: 'continuous' },
        doc: { pose: { tiltX: 8, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 14, gradientOpacity: 34 },
        frame: { background: '#14100c', corners: 14 },
        effects: { vignette: 26, shadow: 22, saturation: 108 },
        text: [
          text({ id: 't1', text: 'Late summer', size: 9.5, weight: 700, y: 44, colour: '#f6ece0' }),
          text({ id: 't2', text: 'A film in six frames', size: 3, weight: 400, y: 55, colour: '#c9b79f', tracking: 4 })
        ]
      })
  },
  {
    id: 'poster-ring',
    name: 'Poster ring',
    note: 'A ring seen edge on, for a portrait poster.',
    images: ['tide', 'harbour', 'slate', 'drift'],
    swatch: ['#bfe3f2', '#0e2a3a'],
    build: (images) =>
      base('ring', images, {
        params: { cards: 18, rings: 2, cardScale: 0.62, radius: 3.4, ringGap: 1.4, arc: 360, speed: 0.3, sizeFalloff: 0.35 },
        doc: { pose: { tiltX: 62, tiltY: 0, tiltZ: 0 }, transform: { positionX: 0, positionY: -6, scale: 1.05 } },
        card: { aspect: '1:1', corner: 50, gradientOpacity: 24 },
        frame: { aspect: '4:5', background: '#07161e', corners: 16 },
        effects: { vignette: 40, blur: 2, saturation: 112 },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Harbour', size: 12, weight: 700, y: 22, colour: '#eaf6fb', tracking: -2 }),
          text({ id: 't2', text: 'Nine to five, every tide', size: 2.6, weight: 500, y: 82, colour: '#8fb6c7' })
        ]
      })
  },
  {
    id: 'story-feed',
    name: 'Story feed',
    note: 'A vertical scroll sized for a phone.',
    images: ['bloom', 'signal', 'ember', 'orchard', 'dune'],
    swatch: ['#f6d3e2', '#3a1024'],
    build: (images) =>
      base('feed', images, {
        params: { cards: 14, columns: 1, cardScale: 1.35, gap: 2.4, edgeFalloff: 0.75, mode: 'continuous', direction: 'forward' },
        doc: { pose: { tiltX: 0, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 8, gradient: false },
        frame: { aspect: '9:16', background: '#1a0a14', corners: 18 },
        effects: { grain: 14, contrast: 104 },
        export: { durationSec: 8, resolution: 1080 },
        text: [
          text({ id: 't1', text: 'This week', size: 4.2, weight: 700, x: 50, y: 8, colour: '#fbe9f1' })
        ]
      })
  },
  {
    id: 'contact-sheet',
    name: 'Contact sheet',
    note: 'A drifting grid, like frames on a light table.',
    images: ['slate', 'quarry', 'harbour', 'drift', 'moss', 'tide'],
    swatch: ['#d8dbe0', '#1b1f24'],
    build: (images) =>
      base('grid', images, {
        params: { columns: 6, rows: 4, cardScale: 0.85, gapX: 1.35, gapY: 1.7, driftX: 1, driftY: 0, curve: 0.18, depth: 0.6, lean: 0 },
        doc: { pose: { tiltX: 4, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:3', corner: 4, gradient: false, backOpacity: 12 },
        frame: { background: '#101113', corners: 10 },
        effects: { vignette: 18, saturation: 88, contrast: 106 },
        text: [
          text({ id: 't1', text: 'Roll 04', size: 2.8, weight: 500, x: 6, y: 92, align: 'left', colour: '#9aa0a8', font: 'JetBrains Mono' })
        ]
      })
  },
  {
    id: 'launch-wall',
    name: 'Launch wall',
    note: 'A flipping wall with a headline over it.',
    images: ['signal', 'ember', 'lantern', 'dune'],
    swatch: ['#fff0b8', '#3d2c00'],
    build: (images) =>
      base('flip', images, {
        params: { columns: 5, rows: 3, cardScale: 0.95, gapX: 1.4, gapY: 1.8, flips: 2, stagger: 0.55, hold: 0.8, transition: 0.7, depth: 0.4 },
        doc: { pose: { tiltX: 6, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '1:1', corner: 6, gradientOpacity: 28 },
        frame: { background: '#0d0b05', corners: 12 },
        effects: { vignette: 30, brightness: 96 },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Now shipping', size: 8, weight: 800, y: 48, colour: '#ffe89a', font: 'Space Grotesk', tracking: -2 }),
          text({ id: 't2', text: 'Version two, today', size: 2.8, weight: 400, y: 58, colour: '#c7b57a' })
        ]
      })
  },
  {
    id: 'deep-field',
    name: 'Deep field',
    note: 'Cards flying past the camera.',
    images: ['drift', 'slate', 'tide', 'harbour'],
    swatch: ['#dcd9f2', '#1f1a3d'],
    build: (images) =>
      base('space', images, {
        params: { cards: 70, cardScale: 0.42, spread: 9.5, depthRange: 28, speed: 2, direction: 'forward' },
        doc: { pose: { tiltX: 0, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 12, gradientOpacity: 40 },
        frame: { background: '#07061a', corners: 12 },
        effects: { blur: 3, vignette: 46, saturation: 118 },
        imageOrder: 'scatter',
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Everything, all at once', size: 4.6, weight: 600, y: 86, colour: '#cfc9f5' })
        ]
      })
  },
  {
    id: 'quiet-slider',
    name: 'Quiet slider',
    note: 'One card at a time, held long enough to read.',
    images: ['moss', 'orchard', 'quarry', 'dune'],
    swatch: ['#d6e6c3', '#1c2e14'],
    build: (images) =>
      base('slider', images, {
        params: { cards: 6, cardScale: 1.6, gap: 1.4, stagger: 0.2, depth: 1.6, stepSize: 1, hold: 1.6, transition: 1.2, drift: 4 },
        doc: { pose: { tiltX: 6, tiltY: 0, tiltZ: 0 }, easing: { x1: 0.4, y1: 0, x2: 0.1, y2: 1 } },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 22 },
        frame: { background: '#0f1410', corners: 12 },
        effects: { vignette: 22, shadow: 30 },
        export: { durationSec: 8 },
        text: [
          text({ id: 't1', text: 'Field notes', size: 3.4, weight: 500, x: 8, y: 10, align: 'left', colour: '#cfe0bd', font: 'Lora' })
        ]
      })
  },
  {
    id: 'editorial-column',
    name: 'Editorial column',
    note: 'A helix rising through a serif title.',
    images: ['bloom', 'ember', 'lantern', 'signal'],
    swatch: ['#ffe2c2', '#3f1d05'],
    build: (images) =>
      base('column', images, {
        params: { cards: 20, cardScale: 0.7, radius: 2.6, pitch: 0.85, twist: 2.5, taper: 0.9, speed: 1, lean: 8, facing: 'camera' },
        doc: { pose: { tiltX: 14, tiltY: 0, tiltZ: 0 }, transform: { positionX: 22, positionY: 0, scale: 1 } },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 26 },
        frame: { aspect: '4:5', background: '#150c04', corners: 14 },
        effects: { vignette: 28, saturation: 104 },
        text: [
          text({ id: 't1', text: 'The long\nway round', size: 7, weight: 400, x: 28, y: 42, align: 'left', colour: '#f8e6cf', font: 'Playfair Display', lineHeight: 1.05 }),
          text({ id: 't2', text: 'Issue eleven', size: 2.4, weight: 500, x: 28, y: 60, align: 'left', colour: '#b99a76', tracking: 6 })
        ]
      })
  },
  {
    id: 'globe-brand',
    name: 'Globe',
    note: 'A sphere of cards turning under a wordmark.',
    images: ['tide', 'harbour', 'drift', 'slate', 'moss'],
    swatch: ['#cfe0e6', '#13272d'],
    build: (images) =>
      base('global', images, {
        params: { cards: 44, cardScale: 0.5, radius: 4.2, band: 1, speed: 0.36, swell: 0.4, scaleFalloff: 0.5 },
        doc: { pose: { tiltX: 10, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '1:1', corner: 50, gradientOpacity: 30 },
        frame: { background: '#061014', corners: 12 },
        effects: { vignette: 38, blur: 1, saturation: 110 },
        imageOrder: 'scatter',
        text: [
          text({ id: 't1', text: 'Everywhere', size: 6.5, weight: 700, y: 50, colour: '#e6f2f6', tracking: -1 })
        ]
      })
  },
  {
    id: 'ribbon-banner',
    name: 'Ribbon banner',
    note: 'A wide wave, sized for a site header.',
    images: ['ember', 'signal', 'lantern', 'bloom'],
    swatch: ['#ffd0a6', '#3d0f0a'],
    build: (images) =>
      base('ribbon', images, {
        params: { cards: 22, cardScale: 0.72, length: 17, amplitude: 2.4, wavelength: 2, twist: 40, depth: 2.2, speed: 1 },
        doc: { pose: { tiltX: 16, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 12, gradientOpacity: 30 },
        frame: { background: '#160806', corners: 12 },
        effects: { vignette: 34, saturation: 114 },
        text: [
          text({ id: 't1', text: 'Warm front', size: 7, weight: 700, y: 20, colour: '#ffdcbb' })
        ]
      })
  },
  {
    id: 'drop-reveal',
    name: 'Drop reveal',
    note: 'Cards fall in and settle, with an entrance.',
    images: ['quarry', 'dune', 'slate', 'orchard'],
    swatch: ['#e3ded6', '#2e281f'],
    previewPhase: 0.85,
    build: (images) => {
      const doc = base('card-drop', images, {
        params: { cards: 12, cardScale: 1.05, spread: 6.5, dropHeight: 9, squash: 0.35, spin: 22, stagger: 0.6, drops: 1 },
        doc: { pose: { tiltX: 18, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 24 },
        frame: { background: '#12100c', corners: 12 },
        effects: { shadow: 44, vignette: 20 },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Deal me in', size: 6.5, weight: 700, y: 86, colour: '#eee7db' })
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
    note: 'A deck cut and restacked, close in.',
    images: ['ember', 'drift', 'bloom'],
    swatch: ['#f6d3e2', '#1f1a3d'],
    build: (images) =>
      base('card-shuffle', images, {
        params: { cardScale: 3.8, stagger: 0.35, depth: 1.4, stepSize: 1, hold: 0.7, transition: 0.9, drift: 14 },
        doc: { pose: { tiltX: 10, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 12, gradientOpacity: 20 },
        frame: { aspect: '1:1', background: '#0c0a12', corners: 16 },
        effects: { shadow: 38, vignette: 26 },
        text: [
          text({ id: 't1', text: 'Pick one', size: 4, weight: 500, y: 90, colour: '#d9d3ea' })
        ]
      })
  },
  {
    id: 'repeater-pattern',
    name: 'Pattern',
    note: 'A dense wave of one picture, for a backdrop.',
    images: ['signal'],
    swatch: ['#fff0b8', '#3d2c00'],
    build: (images) =>
      base('image-repeater', images, {
        params: { columns: 12, rows: 8, gap: 1, cardScale: 0.42, waveAmp: 0.9, waveSpeed: 2 },
        doc: { pose: { tiltX: 24, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '1:1', corner: 50, gradient: false },
        frame: { background: '#0f0c00', corners: 12 },
        effects: { vignette: 44, saturation: 96 },
        text: []
      })
  },
  {
    id: 'gallery-plate',
    name: 'Gallery plate',
    note: 'A turntable seen from above.',
    images: ['moss', 'orchard', 'quarry', 'dune', 'harbour'],
    swatch: ['#e9e3bd', '#2a3312'],
    build: (images) =>
      base('plate', images, {
        params: { cards: 16, rings: 2, cardScale: 0.8, radius: 4.2, ringGap: 1.8, speed: 0.28, tip: 62, lift: 0.4, scatter: 0.2 },
        doc: { pose: { tiltX: 6, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 22 },
        frame: { background: '#0e120a', corners: 12 },
        effects: { vignette: 30, shadow: 26 },
        text: [
          text({ id: 't1', text: 'On show', size: 3.6, weight: 500, x: 50, y: 91, colour: '#d5dcb4', tracking: 8 })
        ]
      })
  },
  {
    id: 'parallax-scene',
    name: 'Parallax',
    note: 'Layers passing at different speeds.',
    images: ['harbour', 'tide', 'slate', 'drift'],
    swatch: ['#bfe3f2', '#1b1f24'],
    build: (images) =>
      base('parallax', images, {
        params: { layers: 4, perLayer: 7, cardScale: 1, speedSpread: 3, depthSpread: 3, span: 18 },
        doc: { pose: { tiltX: 4, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:3', corner: 8, gradientOpacity: 30 },
        frame: { background: '#081014', corners: 12 },
        effects: { blur: 2, vignette: 32, saturation: 106 },
        imageOrder: 'scatter',
        text: [
          text({ id: 't1', text: 'Passing through', size: 5, weight: 600, y: 14, colour: '#dcecf3' })
        ]
      })
  },
  {
    id: 'elevator-list',
    name: 'Elevator',
    note: 'A steady climb, good for a credits roll.',
    images: ['slate', 'quarry', 'drift', 'moss'],
    swatch: ['#d8dbe0', '#2e281f'],
    build: (images) =>
      base('elevator', images, {
        params: { cards: 12, cardScale: 1.1, gap: 1.9, offsetX: 1.2, tilt: 12, depth: 1.4, speed: 1 },
        doc: { pose: { tiltX: 8, tiltY: 0, tiltZ: 0 }, transform: { positionX: -14, positionY: 0, scale: 1 } },
        card: { aspect: '4:5', corner: 10, gradientOpacity: 24 },
        frame: { background: '#0e0f11', corners: 12 },
        effects: { vignette: 24, shadow: 20 },
        text: [
          text({ id: 't1', text: 'With thanks to', size: 3.2, weight: 500, x: 68, y: 46, align: 'left', colour: '#b9bec6' }),
          text({ id: 't2', text: 'everyone who showed up', size: 3.2, weight: 500, x: 68, y: 53, align: 'left', colour: '#7e848c' })
        ]
      })
  },
  {
    id: 'cubic-box',
    name: 'Cubic',
    note: 'A box of cards that breathes as it turns.',
    images: ['ember', 'signal', 'bloom', 'lantern', 'dune', 'orchard'],
    swatch: ['#ffd0a6', '#3a1024'],
    build: (images) =>
      base('cubic', images, {
        params: { perFace: 2, size: 3.2, cardScale: 0.75, spread: 1.7, speed: 0.34, explode: 0.6, breathe: 0.8 },
        doc: { pose: { tiltX: 16, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '1:1', corner: 8, gradientOpacity: 28 },
        frame: { aspect: '1:1', background: '#120709', corners: 16 },
        effects: { vignette: 36, saturation: 112 },
        text: [
          text({ id: 't1', text: 'Six sides', size: 4.4, weight: 700, y: 88, colour: '#ffd9c2' })
        ]
      })
  },
  {
    id: 'spin-fan',
    name: 'Fan',
    note: 'A hand of cards that opens and closes.',
    images: ['bloom', 'ember', 'signal', 'lantern', 'dune'],
    swatch: ['#f6d3e2', '#3d2c00'],
    previewPhase: 0.5,
    build: (images) => {
      const doc = base('spin', images, {
        params: { cards: 11, cardScale: 1, spread: 180, reach: 2.6, pivot: 0.5, speed: 0.15, depth: 0.4, taper: 1, breathe: 0, lean: 0 },
        doc: { pose: { tiltX: 12, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '4:5', corner: 12, gradientOpacity: 24 },
        frame: { background: '#140a10', corners: 12 },
        effects: { shadow: 34, vignette: 26 },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'Your hand', size: 5.5, weight: 700, y: 18, colour: '#f7dfe9' })
        ]
      })
      // The one thing the arrangement cannot do on its own: the fan is a
      // shape, not a movement, so opening and closing it is a keyed track.
      return {
        ...doc,
        keys: {
          'param:spread': {
            keys: [
              { id: 'k1', t: 0, v: 110, easing: { x1: 0.4, y1: 0, x2: 0.2, y2: 1 } },
              { id: 'k2', t: 0.5, v: 260, easing: { x1: 0.4, y1: 0, x2: 0.2, y2: 1 } }
            ]
          }
        }
      }
    }
  },
  {
    id: 'breathing-ring',
    name: 'Breathing ring',
    note: 'A ring that opens out and draws back in.',
    images: ['moss', 'tide', 'drift', 'harbour'],
    swatch: ['#d6e6c3', '#0e2a3a'],
    build: (images) => {
      const doc = base('ring', images, {
        params: { cards: 24, rings: 1, cardScale: 0.6, radius: 3.2, ringGap: 1.2, arc: 360, speed: 0.24, spiral: 0, sizeFalloff: 0.2 },
        doc: { pose: { tiltX: 34, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '1:1', corner: 50, gradientOpacity: 26 },
        frame: { aspect: '1:1', background: '#08120f', corners: 16 },
        effects: { vignette: 40, blur: 1 },
        export: { durationSec: 6 },
        text: [
          text({ id: 't1', text: 'In and out', size: 4, weight: 500, y: 90, colour: '#c6dcd2', tracking: 6 })
        ]
      })
      return {
        ...doc,
        keys: {
          'param:radius': {
            keys: [
              { id: 'k1', t: 0, v: 2.2, easing: { x1: 0.45, y1: 0, x2: 0.55, y2: 1 } },
              { id: 'k2', t: 0.5, v: 5.4, easing: { x1: 0.45, y1: 0, x2: 0.55, y2: 1 } }
            ]
          },
          'pose:tiltX': {
            keys: [
              { id: 'k3', t: 0, v: 28, easing: { x1: 0.45, y1: 0, x2: 0.55, y2: 1 } },
              { id: 'k4', t: 0.5, v: 46, easing: { x1: 0.45, y1: 0, x2: 0.55, y2: 1 } }
            ]
          }
        }
      }
    }
  },
  {
    id: 'mono-grid',
    name: 'Mono grid',
    note: 'Black and white, square, no movement to speak of.',
    images: ['slate', 'quarry', 'harbour', 'drift'],
    swatch: ['#d8dbe0', '#1b1f24'],
    build: (images) =>
      base('grid', images, {
        params: { columns: 4, rows: 4, cardScale: 0.92, gapX: 1.2, gapY: 1.2, driftX: 0, driftY: 1, curve: 0, depth: 0, lean: 0 },
        doc: { pose: { tiltX: 0, tiltY: 0, tiltZ: 0 } },
        card: { aspect: '1:1', corner: 0, gradient: false },
        frame: { aspect: '1:1', background: '#0b0b0b', corners: 0 },
        effects: { saturation: 0, contrast: 118, grain: 18 },
        text: [
          text({ id: 't1', text: 'Sixteen', size: 2.6, weight: 400, x: 50, y: 95, colour: '#8a8a8a', font: 'JetBrains Mono', tracking: 10 })
        ]
      })
  }
] as const

export function templateById(id: string): MotionTemplate | null {
  return MOTION_TEMPLATES.find((t) => t.id === id) ?? null
}
