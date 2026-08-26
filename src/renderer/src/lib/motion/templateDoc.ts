// Turning a template into a real document.
//
// A template names its pictures rather than carrying them, because the
// starter set is drawn from an id and storing the pixels would put megabytes
// in the source for something most people replace on day one. So using a
// template has one side effect: the pictures it names are drawn and written
// to disk, once, and the document is built around the files that come back.
//
// Done here rather than in `shared/` because drawing needs a canvas and
// writing needs the main process, neither of which a shared module has.

import type { ImageRef, MotionDoc } from '../../../../shared/motion/types'
import type { MotionTemplate } from '../../../../shared/motion/templates'
import { IMAGE_BANK, bankImageBase64 } from './bank'

function labelFor(bankId: string): string {
  return IMAGE_BANK.find((b) => b.id === bankId)?.label ?? bankId
}

/**
 * Build the template's document, storing the pictures it asks for.
 *
 * A picture that fails to store is left out rather than aborting: a piece
 * with five of its six pictures is still a piece, and the cards it was
 * meant for fall back to the ones that did arrive. Losing the whole
 * template because one write failed would be the worse trade.
 */
export async function buildTemplateDoc(template: MotionTemplate): Promise<MotionDoc> {
  const images: ImageRef[] = []
  for (const bankId of template.images) {
    const label = labelFor(bankId)
    const base64 = bankImageBase64(bankId)
    if (!base64) continue
    const res = await window.terminal42.motion.storeImage(label, base64)
    if (!res.ok) continue
    images.push({ id: res.image.id, src: res.image.path, name: label })
  }
  return template.build(images)
}
