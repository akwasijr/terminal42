// Shape checks for the auto-saved canvas document, kept out of the component so
// they can be tested on their own.

export type StoredDoc = {
  pages?: { id: string; name: string }[]
  activePage?: string
  perPage?: Record<string, { objects?: unknown[]; artboards?: unknown[] }>
  objects?: unknown[]
  artboards?: unknown[]
}

/** True when a document carries no artboards and no objects on any page. */
export function docIsEmpty(doc: StoredDoc | null | undefined): boolean {
  if (!doc) return true
  const pages = doc.perPage ? Object.values(doc.perPage) : []
  if (pages.length) {
    return pages.every((p) => !(p?.objects?.length ?? 0) && !(p?.artboards?.length ?? 0))
  }
  return !(doc.objects?.length ?? 0) && !(doc.artboards?.length ?? 0)
}

/** The stored document at `key`, or null when there is nothing readable there. */
export function readDoc(key: string): StoredDoc | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as StoredDoc) : null
  } catch {
    return null
  }
}
