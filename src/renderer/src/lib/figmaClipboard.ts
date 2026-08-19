// ── Figma clipboard import (decode spike) ────────────────────────────────────
// When you Cmd+C in Figma, the clipboard `text/html` carries two HTML comments:
//   <!--(figmeta)BASE64(/figmeta)-->  (small metadata)
//   <!--(figma)BASE64(/figma)-->      (the scene graph, "fig-kiwi" binary)
// The (figma) base64 decodes to a fig-kiwi container: an ASCII magic ("fig-kiwi")
// + uint32 version, then length-prefixed DEFLATE blocks. Block 0 is the Kiwi binary
// SCHEMA (embedded!), block 1 is the message (nodeChanges). Because the schema ships
// with the payload, the open-source `kiwi-schema` lib can decode it generically —
// no secret schema needed. This module just DECODES + summarises so we can see real
// Figma data before writing the node→FObj mapping.

import { decodeBinarySchema, compileSchema } from 'kiwi-schema'
import { inflate, inflateRaw } from 'pako'

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** Pull the base64 (figma) scene payload out of clipboard text/html. */
export function extractFigmaPayload(html: string): string | null {
  const m = html.match(/\(figma\)([A-Za-z0-9+/=\s]+?)\(\/figma\)/)
  return m ? m[1].replace(/\s+/g, '') : null
}

function inflateMaybe(bytes: Uint8Array): Uint8Array {
  try { return inflateRaw(bytes) } catch { /* zlib-wrapped fallback */ }
  return inflate(bytes)
}

interface Container { magic: string; version: number; blocks: Uint8Array[] }

/** Parse the fig-kiwi container into inflated blocks ([schema, message, ...blobs]). */
export function parseFigKiwi(bytes: Uint8Array): Container | null {
  if (bytes.length < 12) return null
  const magic = String.fromCharCode(...Array.from(bytes.slice(0, 8)))
  if (!magic.startsWith('fig-')) return null
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let off = 8
  const version = dv.getUint32(off, true); off += 4
  const blocks: Uint8Array[] = []
  while (off + 4 <= bytes.length) {
    const len = dv.getUint32(off, true); off += 4
    if (len === 0 || off + len > bytes.length) break
    const chunk = bytes.subarray(off, off + len); off += len
    try { blocks.push(inflateMaybe(chunk)) } catch { blocks.push(chunk) }
  }
  return { magic, version, blocks }
}

export interface FigmaDecode {
  ok: boolean
  error?: string
  version?: number
  /** every type name in the embedded schema (helps us discover field names) */
  schemaTypes?: string[]
  /** histogram of node types in the selection */
  nodeTypes?: Record<string, number>
  nodeCount?: number
  /** the full decoded message (large — for console/debug only) */
  message?: unknown
}

/** Decode a Figma clipboard `text/html` string into its scene message + a summary. */
export function decodeFigmaClipboard(html: string): FigmaDecode {
  try {
    const b64 = extractFigmaPayload(html)
    if (!b64) return { ok: false, error: 'no (figma) payload in clipboard HTML' }
    const container = parseFigKiwi(b64ToBytes(b64))
    if (!container || container.blocks.length < 2) return { ok: false, error: 'could not parse fig-kiwi container' }
    const schema = decodeBinarySchema(container.blocks[0])
    const compiled = compileSchema(schema) as Record<string, (b: Uint8Array) => unknown>
    const schemaTypes = (schema.definitions ?? []).map((d: { name: string }) => d.name)
    const decodeMessage = compiled.decodeMessage
    if (typeof decodeMessage !== 'function') return { ok: false, error: 'no decodeMessage in schema', schemaTypes }
    const message = decodeMessage(container.blocks[1]) as { nodeChanges?: Array<{ type?: string }> }
    const changes = Array.isArray(message?.nodeChanges) ? message.nodeChanges : []
    const nodeTypes: Record<string, number> = {}
    for (const n of changes) { const t = String(n?.type ?? 'UNKNOWN'); nodeTypes[t] = (nodeTypes[t] ?? 0) + 1 }
    return { ok: true, version: container.version, schemaTypes, nodeTypes, nodeCount: changes.length, message }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/** Is this clipboard HTML a Figma copy? */
export function isFigmaClipboard(html: string): boolean {
  return /\(figma\)[A-Za-z0-9+/=\s]+\(\/figma\)/.test(html)
}
