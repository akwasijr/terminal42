// What a drawing tool is, and how to name it.
//
// Kept out of the toolbar component so that editing the toolbar does not
// throw away the stage's state on every hot reload -- a file that exports a
// component and a plain function reloads as neither.

import { SHAPE_LABELS, type ShapeKind } from '../../../../shared/motion/types'

/** The pointer, the two layer makers, and any one of the shapes. */
export type MotionTool = 'select' | 'text' | 'picture' | { shape: ShapeKind }

export function isShapeTool(t: MotionTool): t is { shape: ShapeKind } {
  return typeof t === 'object'
}

/** A shape is called by its own name -- "Ellipse", not "Shape". */
export function toolLabel(t: MotionTool): string {
  if (t === 'select') return 'Select'
  if (t === 'text') return 'Text'
  if (t === 'picture') return 'Picture'
  return SHAPE_LABELS[t.shape]
}
