// Shared between the empty state (which dispatches) and the composer (which
// listens), so neither has to import the other's component module.
//
// It lives here rather than in ChatEmptyStateFull.tsx because a .tsx file that
// exports non-components loses Vite Fast Refresh: editing it forces a full
// reload and throws away app state.

/** Fired to drop text into a session's composer without sending it. */
export const COMPOSER_FILL_EVENT = 't42:composer-fill'

export type ComposerFillDetail = {
  sessionId: string
  text: string
  /**
   * A phrase inside `text` to leave selected rather than putting the caret at
   * the end. A starter that ends "The chore is: one I will describe." is not
   * sendable as written, and a caret after the full stop hides that.
   */
  select?: string
}
