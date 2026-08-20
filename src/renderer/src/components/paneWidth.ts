// How a side pane claims horizontal space.
//
// The workspace has two arrangements. With no pane open the chat fills the
// window. With a pane open the roles swap: the chat becomes a fixed narrow
// column and the pane takes everything left over, so the page being previewed
// is the thing you actually look at.
//
// Rather than thread a mode flag through every pane, a width of 0 or less
// means "fill the remaining space". Panes stay dumb: they render the style
// they are handed.

export const PANE_MIN_WIDTH = 320

export type PaneWidthStyle =
  | { width: string; minWidth: string; flex?: undefined }
  | { flex: string; minWidth: string; width?: undefined }

export function paneWidthStyle(width: number, minWidth = PANE_MIN_WIDTH): PaneWidthStyle {
  // Non-finite values come from corrupted localStorage; treat them as fill
  // rather than letting `NaNpx` collapse the pane to nothing.
  if (!Number.isFinite(width) || width <= 0) {
    return { flex: '1 1 0%', minWidth: `${minWidth}px` }
  }
  return { width: `${Math.round(width)}px`, minWidth: `${minWidth}px` }
}

/**
 * The chat column's width when a pane is open. Clamped so the composer stays
 * usable at the low end and the chat can never crowd out the preview.
 */
export const CHAT_MIN_WIDTH = 300
export const CHAT_MAX_WIDTH = 620
export const CHAT_DEFAULT_WIDTH = 400

export function clampChatWidth(width: number): number {
  if (!Number.isFinite(width)) return CHAT_DEFAULT_WIDTH
  return Math.max(CHAT_MIN_WIDTH, Math.min(CHAT_MAX_WIDTH, Math.round(width)))
}
