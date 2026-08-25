// The component registry.
//
// One lookup table, so the drawer, the parameter panel, the preset thumbnails
// and the exporter all discover components the same way. Adding a twelfth
// arrangement means writing one file and adding one line here; nothing else in
// the app needs to learn about it.

import type { ComponentId, MotionComponent } from './types'
import { SOON_COMPONENTS } from './types'
import { carousel } from './components/carousel'
import { ring } from './components/ring'
import { slider } from './components/slider'
import { cardShuffle } from './components/cardShuffle'
import { cardDrop } from './components/cardDrop'
import { imageRepeater } from './components/imageRepeater'
import { space } from './components/space'
import { elevator } from './components/elevator'
import { ribbon } from './components/ribbon'
import { parallax } from './components/parallax'
import { feed } from './components/feed'

export const MOTION_COMPONENTS: MotionComponent[] = [
  carousel, ring, slider, cardShuffle, cardDrop,
  imageRepeater, space, elevator, ribbon, parallax, feed
]

const byId = new Map<ComponentId, MotionComponent>(MOTION_COMPONENTS.map((c) => [c.id, c]))

/**
 * Look a component up, falling back to the carousel.
 *
 * A document naming a component that no longer exists should open showing
 * something, not a blank frame with no way back — the user can then pick a
 * different arrangement instead of losing the piece.
 */
export function componentFor(id: ComponentId | string): MotionComponent {
  return byId.get(id as ComponentId) ?? carousel
}

export function hasComponent(id: string): boolean {
  return byId.has(id as ComponentId)
}

export { SOON_COMPONENTS }
