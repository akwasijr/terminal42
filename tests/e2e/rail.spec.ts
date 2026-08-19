import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { resolve } from 'path'
import { existsSync } from 'fs'

// Covers the icon rail that replaced the wide sidebar: every primary
// destination is reachable, the Projects flyout is transient, and Form and
// Design are genuinely separate lists (the split that removed the confusion
// between freeform forms and web/app experiences).

const mainEntry = resolve(__dirname, '../../out/main/index.js')

test.describe('sidebar rail', () => {
  test.skip(!existsSync(mainEntry), 'run `npm run build` before the e2e rail test')

  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [mainEntry],
      env: { ...process.env, NODE_ENV: 'production' }
    })
    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.locator('#t42-boot-splash')).toHaveCount(0, { timeout: 15_000 })
  })

  test.afterAll(async () => {
    await app?.close()
  })

  test('exposes every primary destination as a rail slot', async () => {
    const rail = page.getByRole('navigation', { name: 'Primary' })
    await expect(rail).toBeVisible()
    for (const label of ['Chat', 'Terminal', 'Form', 'Design', 'Settings']) {
      await expect(rail.getByTitle(label, { exact: true })).toBeVisible()
    }
    // Projects carries the active project name in its tooltip when one is open.
    await expect(rail.getByTitle(/^Projects/)).toBeVisible()
  })

  test('labels only the active slot', async () => {
    const rail = page.getByRole('navigation', { name: 'Primary' })
    await rail.getByTitle('Design', { exact: true }).click()
    await expect(rail.getByTitle('Design', { exact: true })).toHaveAttribute('aria-current', 'page')
    // The inactive Chat slot stays icon-only.
    await expect(rail.getByTitle('Chat', { exact: true })).not.toHaveAttribute('aria-current', 'page')
  })

  test('Projects opens a transient flyout that Escape dismisses', async () => {
    const rail = page.getByRole('navigation', { name: 'Primary' })
    const flyout = page.locator('[data-projects-flyout]')

    await expect(flyout).toHaveCount(0)
    await rail.getByTitle(/^Projects/).click()
    await expect(flyout).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(flyout).toHaveCount(0)
  })

  test('Form and Design are separate lists', async () => {
    const rail = page.getByRole('navigation', { name: 'Primary' })

    await rail.getByTitle('Form', { exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All forms')
    // Form scope must not offer the web/app-only destinations.
    await expect(page.getByRole('button', { name: 'Design systems' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /New form/ })).toBeVisible()

    await rail.getByTitle('Design', { exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All designs')
    await expect(page.getByRole('button', { name: 'Design systems' })).toBeVisible()
    await expect(page.getByRole('button', { name: /New design/ })).toBeVisible()
  })
})
