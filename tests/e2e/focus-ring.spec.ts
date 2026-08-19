import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'path'
import { existsSync } from 'fs'

// The borderless restyle expresses field focus as a ring rather than a border
// colour change. A field with no background of its own is painted by the row
// or shell wrapping it, so the wrapper must carry that ring — otherwise the
// ring draws a hard rectangle inside an already-rounded container, which is
// what made the chat composer look like a box inside a box.

const mainEntry = resolve(__dirname, '../../out/main/index.js')

const RING = /rgba?\([^)]+\) 0px 0px 0px 2px/

test.describe('field focus ring', () => {
  test.skip(!existsSync(mainEntry), 'run `npm run build` before the e2e focus-ring test')

  let app: ElectronApplication
  let page: Page
  let shadows: Record<string, string>

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [mainEntry],
      env: { ...process.env, NODE_ENV: 'production' }
    })
    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#t42-boot-splash')).toHaveCount(0, { timeout: 15_000 })

    // Probe the real cascade with the three field shapes the app uses: the
    // composer (transparent textarea in a rounded shell), a toolbar well
    // (transparent input in a filled row), and a standalone field.
    shadows = await page.evaluate(() => {
      const host = document.createElement('div')
      host.style.cssText = 'position:fixed;left:-9999px;top:0;width:640px'
      host.innerHTML = `
        <div id="p-shell" class="rounded-2xl bg-surface px-3.5 pt-3 pb-2">
          <textarea id="p-bare" class="block w-full resize-none bg-transparent" rows="1"></textarea>
        </div>
        <div id="p-well" class="flex items-center rounded-md bg-elevated px-2 py-1.5">
          <input id="p-nested" class="w-48 bg-transparent" />
        </div>
        <input id="p-solo" class="w-full rounded-md bg-sunken px-3 py-2" />`
      document.body.appendChild(host)

      const shadow = (id: string): string => getComputedStyle(document.getElementById(id)!).boxShadow
      const focus = (id: string): void => (document.getElementById(id) as HTMLElement).focus()
      const out: Record<string, string> = {}

      focus('p-bare')
      out.bareField = shadow('p-bare')
      out.composerShell = shadow('p-shell')

      focus('p-nested')
      out.nestedField = shadow('p-nested')
      out.well = shadow('p-well')

      focus('p-solo')
      out.soloField = shadow('p-solo')

      host.remove()
      return out
    })
  })

  test.afterAll(async () => {
    await app?.close()
  })

  test('a field that paints its own background rings itself', () => {
    expect(shadows.soloField).toMatch(RING)
  })

  test('a transparent field never rings itself', () => {
    expect(shadows.bareField).toBe('none')
    expect(shadows.nestedField).toBe('none')
  })

  test('the wrapper of a transparent field carries the ring', () => {
    expect(shadows.composerShell).toMatch(RING)
    expect(shadows.well).toMatch(RING)
  })
})
