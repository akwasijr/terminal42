import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'path'
import { existsSync } from 'fs'

// Smoke test: launch the packaged main process against the built renderer and
// assert the app boots to an interactive window (boot splash dismissed, React
// mounted). Requires `npm run build` first — out/main/index.js must exist.

const mainEntry = resolve(__dirname, '../../out/main/index.js')

test.describe('app boot', () => {
  test.skip(!existsSync(mainEntry), 'run `npm run build` before the e2e smoke test')

  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [mainEntry],
      env: { ...process.env, NODE_ENV: 'production' }
    })
    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await app?.close()
  })

  test('opens a window with the right title', async () => {
    expect(await page.title()).toBe('Terminal42')
  })

  test('mounts React into #root', async () => {
    const root = page.locator('#root')
    await expect(root).toBeAttached()
    // App renders real content into #root within a reasonable boot window.
    await expect(async () => {
      const html = await root.innerHTML()
      expect(html.trim().length).toBeGreaterThan(0)
    }).toPass({ timeout: 15_000 })
  })

  test('dismisses the boot splash', async () => {
    // The boot splash must be removed (or faded) so it never traps the user
    // on the loader screen. Allow time for the min-duration + safety net.
    await expect(page.locator('#t42-boot-splash')).toHaveCount(0, { timeout: 15_000 })
  })
})
