import type { IDisposable, ITerminalAddon, Terminal } from '@xterm/xterm'
import { SerializeAddon } from '@xterm/addon-serialize'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebglAddon } from '@xterm/addon-webgl'

export type TerminalRenderer = 'webgl' | 'canvas' | 'dom'

export interface AddonHandle {
  readonly renderer: TerminalRenderer
  serialize(): SerializeAddon | null
  dispose(): void
}

function disposeQuietly(disposable: IDisposable | null | undefined): void {
  try {
    disposable?.dispose()
  } catch {}
}

function loadAddonQuietly(term: Terminal, addon: ITerminalAddon): boolean {
  try {
    term.loadAddon(addon)
    return true
  } catch {
    disposeQuietly(addon)
    return false
  }
}

export function loadPerformanceAddons(term: Terminal): AddonHandle {
  const disposables: IDisposable[] = []
  let renderer: TerminalRenderer = 'dom'
  let serializeAddon: SerializeAddon | null = null
  let disposed = false

  try {
    const unicodeAddon = new Unicode11Addon()
    if (loadAddonQuietly(term, unicodeAddon)) {
      disposables.push(unicodeAddon)
      try {
        term.unicode.activeVersion = '11'
      } catch {}
    }
  } catch {}

  try {
    const addon = new SerializeAddon()
    if (loadAddonQuietly(term, addon)) {
      serializeAddon = addon
      disposables.push(addon)
    }
  } catch {}

  try {
    const webglAddon = new WebglAddon()
    let contextLossDisposable: IDisposable | null = null
    let webglDisposed = false
    const disposeWebgl = (): void => {
      disposeQuietly(contextLossDisposable)
      contextLossDisposable = null
      if (webglDisposed) return
      webglDisposed = true
      disposeQuietly(webglAddon)
    }

    contextLossDisposable = webglAddon.onContextLoss(() => {
      renderer = 'dom'
      disposeWebgl()
    })

    try {
      term.loadAddon(webglAddon)
      renderer = 'webgl'
      disposables.push({
        dispose: disposeWebgl
      })
    } catch {
      disposeWebgl()
    }
  } catch {}

  return {
    get renderer(): TerminalRenderer {
      return renderer
    },
    serialize(): SerializeAddon | null {
      return serializeAddon
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      for (const disposable of disposables.splice(0).reverse()) {
        disposeQuietly(disposable)
      }
      serializeAddon = null
      renderer = 'dom'
    }
  }
}
