// How Motion asks for a colour.
//
// Form edits colour with its own floating picker: a swatch you click, hex and
// opacity together, and the design system's colour variables one click away.
// Motion was using the browser's native colour input, which opens an OS
// dialog — a different shape, a different set of controls, and no access to
// the variables. Two ways to pick a colour in one app is one too many.
//
// It is a context rather than a prop because a swatch can sit three levels
// down inside a panel inside a section, and threading a callback through
// every one of those would mean every intermediate component knowing about
// colour picking in order to pass it on.

import { createContext, useContext } from 'react'
import type { PickerRequest } from '../ColorPicker'

/** Everything but `onClose`, which the host owns. */
export type OpenColorPicker = (req: Omit<PickerRequest, 'onClose'>) => void

const MotionPickerContext = createContext<OpenColorPicker | null>(null)

export const MotionPickerProvider = MotionPickerContext.Provider

/**
 * The host's picker, or null outside one.
 *
 * Null is a real answer rather than an error: a panel rendered in a test or a
 * story has no floating layer to put a picker in, and should still show its
 * colours.
 */
export function useColorPicker(): OpenColorPicker | null {
  return useContext(MotionPickerContext)
}
