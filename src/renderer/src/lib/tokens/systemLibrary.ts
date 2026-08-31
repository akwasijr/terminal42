// Every design system stands on a token library.
//
// The two used to be made separately and joined by hand, through a button on
// the system screen labelled "make a token library". Almost nobody pressed
// it, so almost every system had colours that agreed with no library, could
// not be exported, could not be bound to a form, and could not be handed to a
// chat turn. The link was optional, so it did not happen.
//
// Now it is not optional. Making a system makes its library in the same
// breath, and the id is kept, so from then on there is one answer to "what is
// our blue" instead of two that used to match.

import { studioFromDesignSystem } from './fromDesignSystem'
import { applyStudioToSystem } from './toDesignSystem'
import { tokenLibrariesChanged } from './useTokenLibraries'
import type { TokenStudio } from '../../../../shared/tokens/types'
import type { DesignSystem } from '../designSystem'

/**
 * The system, guaranteed to have a library behind it.
 *
 * If it already has one, nothing happens — a second library would be a second
 * answer, which is the problem this exists to end. If it does not, one is
 * built from what the system already decided and linked.
 *
 * Returns the system unchanged if the library could not be written, because a
 * system with no colours is worse than a system with an unlinked copy of them.
 */
export async function ensureTokenLibrary(ds: DesignSystem): Promise<DesignSystem> {
  if (ds.tokensId) return ds
  try {
    const studio = studioFromDesignSystem(ds)
    const row = await window.terminal42.tokens.create(ds.name, studio)
    await window.terminal42.tokens.save(row.id, { ...studio, id: row.id })
    tokenLibrariesChanged()
    return { ...ds, tokensId: row.id, tokensThemeId: studio.activeTheme ?? undefined }
  } catch {
    return ds
  }
}

/**
 * The system with its values re-read from its library.
 *
 * Called when a system is opened, so that editing a colour in the library is
 * enough — nobody has to remember to go and change it in the system too, and
 * there is no state in which the two disagree and both look deliberate.
 */
export async function refreshFromLibrary(ds: DesignSystem): Promise<DesignSystem> {
  if (!ds.tokensId) return ds
  try {
    const row = await window.terminal42.tokens.get(ds.tokensId)
    if (!row) return ds
    return applyStudioToSystem(ds, row.studio as TokenStudio, ds.tokensThemeId ?? null)
  } catch {
    return ds
  }
}
