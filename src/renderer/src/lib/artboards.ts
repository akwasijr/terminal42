import { type Box } from './freeformGeom'

// An artboard is an export surface placed on the infinite canvas (world coords).
export interface Artboard {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  bg: string
}

export interface ArtboardPreset {
  label: string
  w: number
  h: number
}

export interface PresetGroup {
  group: string
  items: ArtboardPreset[]
}

// Categorised presets so the user has plenty of options when adding an artboard.
export const ARTBOARD_GROUPS: PresetGroup[] = [
  {
    group: 'Desktop',
    items: [
      { label: 'Desktop', w: 1440, h: 1024 },
      { label: 'Laptop', w: 1280, h: 800 },
      { label: 'Wide', w: 1920, h: 1080 },
    ],
  },
  {
    group: 'Mobile',
    items: [
      { label: 'iPhone', w: 390, h: 844 },
      { label: 'iPhone Pro Max', w: 430, h: 932 },
      { label: 'Android', w: 360, h: 800 },
    ],
  },
  {
    group: 'Tablet',
    items: [
      { label: 'iPad', w: 834, h: 1112 },
      { label: 'iPad Pro', w: 1024, h: 1366 },
    ],
  },
  {
    group: 'Social',
    items: [
      { label: 'Square post', w: 1080, h: 1080 },
      { label: 'Story', w: 1080, h: 1920 },
      { label: 'OG image', w: 1200, h: 630 },
      { label: 'Wide banner', w: 1500, h: 500 },
    ],
  },
  {
    group: 'Print',
    items: [
      { label: 'A4', w: 794, h: 1123 },
      { label: 'Letter', w: 816, h: 1056 },
      { label: 'Poster', w: 1587, h: 2245 },
    ],
  },
]

let abc = 0
export function newArtboardId(): string {
  return `ab${Date.now().toString(36)}${(abc++).toString(36)}`
}

export function abBox(a: Artboard): Box {
  return { x: a.x, y: a.y, w: a.w, h: a.h }
}

/** World bounding box covering all artboards (origin clamped to 0,0). */
export function worldBounds(artboards: Artboard[]): { w: number; h: number } {
  if (artboards.length === 0) return { w: 1280, h: 800 }
  const maxX = Math.max(...artboards.map((a) => a.x + a.w))
  const maxY = Math.max(...artboards.map((a) => a.y + a.h))
  return { w: maxX, h: maxY }
}

/** The artboard whose rect contains a world point, if any. */
export function artboardAt(artboards: Artboard[], x: number, y: number): Artboard | null {
  // topmost (last) wins
  for (let i = artboards.length - 1; i >= 0; i--) {
    const a = artboards[i]
    if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return a
  }
  return null
}

/** The artboard whose rect contains a box's center, if any. */
export function ownerArtboard(artboards: Artboard[], box: Box): Artboard | null {
  return artboardAt(artboards, box.x + box.w / 2, box.y + box.h / 2)
}

/** Position a new artboard to the right of the rightmost one, vertically aligned. */
export function placeNewArtboard(artboards: Artboard[], w: number, h: number, name: string): Artboard {
  const gap = 120
  const x = artboards.length ? Math.max(...artboards.map((a) => a.x + a.w)) + gap : 0
  const y = artboards.length ? Math.min(...artboards.map((a) => a.y)) : 0
  return { id: newArtboardId(), name, x, y, w, h, bg: '#ffffff' }
}
