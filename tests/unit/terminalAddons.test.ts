import type { Terminal } from '@xterm/xterm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPerformanceAddons } from '../../src/renderer/src/lib/terminalAddons'

interface Disposable {
  dispose(): void
}

interface AddonLike extends Disposable {
  activate?(terminal: unknown): void
}

const addonState = vi.hoisted(() => ({
  webglActivateThrows: false,
  webglDisposed: 0,
  unicodeDisposed: 0,
  serializeDisposed: 0,
  webglListeners: new Set<() => void>()
}))

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: class {
    readonly onContextLoss = (listener: () => void): Disposable => {
      addonState.webglListeners.add(listener)
      return {
        dispose: () => {
          addonState.webglListeners.delete(listener)
        }
      }
    }

    activate(): void {
      if (addonState.webglActivateThrows) {
        throw new Error('WebGL unavailable')
      }
    }

    dispose(): void {
      addonState.webglDisposed += 1
    }
  }
}))

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: class {
    activate(): void {}

    dispose(): void {
      addonState.unicodeDisposed += 1
    }
  }
}))

vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: class {
    activate(): void {}

    serialize(): string {
      return 'plain text'
    }

    serializeAsHTML(): string {
      return '<pre>plain text</pre>'
    }

    dispose(): void {
      addonState.serializeDisposed += 1
    }
  }
}))

class MockTerminal {
  readonly unicode = { activeVersion: '6' }
  readonly loadedAddons: string[] = []

  loadAddon(addon: AddonLike): void {
    addon.activate?.(this)
    this.loadedAddons.push(addon.constructor.name)
  }
}

function createTerminal(): MockTerminal {
  return new MockTerminal()
}

function asTerminal(term: MockTerminal): Terminal {
  return term as unknown as Terminal
}

function emitContextLoss(): void {
  for (const listener of Array.from(addonState.webglListeners)) {
    listener()
  }
}

describe('loadPerformanceAddons', () => {
  beforeEach(() => {
    addonState.webglActivateThrows = false
    addonState.webglDisposed = 0
    addonState.unicodeDisposed = 0
    addonState.serializeDisposed = 0
    addonState.webglListeners.clear()
  })

  it('loads Unicode 11, serialize, and WebGL when the renderer activates', () => {
    const terminal = createTerminal()
    const handle = loadPerformanceAddons(asTerminal(terminal))

    expect(handle.renderer).toBe('webgl')
    expect(terminal.unicode.activeVersion).toBe('11')
    expect(handle.serialize()?.serialize()).toBe('plain text')
    expect(addonState.webglListeners.size).toBe(1)
  })

  it('falls back to the DOM renderer when WebGL activation throws', () => {
    addonState.webglActivateThrows = true
    const terminal = createTerminal()

    const handle = loadPerformanceAddons(asTerminal(terminal))

    expect(handle.renderer).toBe('dom')
    expect(terminal.unicode.activeVersion).toBe('11')
    expect(handle.serialize()?.serializeAsHTML()).toBe('<pre>plain text</pre>')
    expect(addonState.webglDisposed).toBe(1)
    expect(addonState.webglListeners.size).toBe(0)
  })

  it('falls back to the DOM renderer and tears down WebGL on context loss', () => {
    const handle = loadPerformanceAddons(asTerminal(createTerminal()))

    emitContextLoss()

    expect(handle.renderer).toBe('dom')
    expect(addonState.webglDisposed).toBe(1)
    expect(addonState.webglListeners.size).toBe(0)
  })

  it('removes the context-loss listener and disposes loaded addons once', () => {
    const handle = loadPerformanceAddons(asTerminal(createTerminal()))

    handle.dispose()
    emitContextLoss()
    handle.dispose()

    expect(handle.renderer).toBe('dom')
    expect(handle.serialize()).toBeNull()
    expect(addonState.webglDisposed).toBe(1)
    expect(addonState.serializeDisposed).toBe(1)
    expect(addonState.unicodeDisposed).toBe(1)
    expect(addonState.webglListeners.size).toBe(0)
  })
})
