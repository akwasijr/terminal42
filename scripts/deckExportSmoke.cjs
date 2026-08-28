// What Playwright cannot tell us about a deck export.
//
// The page scripts are covered by tests/unit/deckChassis.browser.test.ts, and
// the sheet builder by tests/unit/deckCapture.test.ts. Neither runs Electron,
// and Electron is where the export actually happens — which is how a hidden
// BrowserWindow shipped for a while quietly clamped to the size of whatever
// display it would have appeared on, so a "1920x1080" deck came out at
// 1512x855 and every slide was the wrong shape.
//
// Run with: npm run smoke:deck
//
// Passes when: the deck is recognised, every slide is captured, the captures
// are all different from one another, they are the size that was asked for,
// and the assembled PDF has one page per slide.

const { app, BrowserWindow } = require('electron')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const { join } = require('node:path')

const {
  EXPORT_PREP_JS, SLIDE_COUNT_JS, showSlideJs, IS_CHASSIS_JS,
  DECK_CAPTURE_SIZE, buildSlidePdfHtml
} = require(join(os.tmpdir(), 't42-deckCapture.cjs'))

const HTML = join(os.tmpdir(), 't42-deck-smoke.html')
const fails = []
const check = (ok, what) => {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}`)
  if (!ok) fails.push(what)
}

app.disableHardwareAcceleration()

app.whenReady().then(async () => {
  // Stand up a normal window first: that is the state the real app is always
  // in when an export runs, and an offscreen surface behaves differently
  // depending on what else has been created.
  const main = new BrowserWindow({ show: false, width: 1200, height: 800 })
  await main.loadURL('data:text/html,<title>host</title>')

  const win = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: DECK_CAPTURE_SIZE.width,
    height: DECK_CAPTURE_SIZE.height,
    webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  const wc = win.webContents
  await win.loadFile(HTML)
  await new Promise((r) => setTimeout(r, 350))

  check(await wc.executeJavaScript(IS_CHASSIS_JS) === true, 'recognised as a chassis deck')

  // The one thing only Electron can tell us. A hidden window is bound by the
  // display it would have appeared on; an offscreen surface is not. The
  // capture size cannot reveal a shortfall — it is reported in device pixels,
  // and a downscaled 16:9 page is still roughly 16:9 — but the page knows.
  const vp = await wc.executeJavaScript('({w:innerWidth,h:innerHeight})')
  check(
    vp.w === DECK_CAPTURE_SIZE.width && vp.h === DECK_CAPTURE_SIZE.height,
    `rendered at the size asked for (${DECK_CAPTURE_SIZE.width}x${DECK_CAPTURE_SIZE.height}) — got ${vp.w}x${vp.h}`
  )
  await wc.executeJavaScript(EXPORT_PREP_JS)
  const count = Number(await wc.executeJavaScript(SLIDE_COUNT_JS)) || 0
  check(count === 10, `found every slide (10) — saw ${count}`)

  const shots = []
  let sized = true
  for (let i = 0; i < count; i++) {
    await wc.executeJavaScript(showSlideJs(i))
    await new Promise((r) => setTimeout(r, 120))
    const img = await wc.capturePage()
    const s = img.getSize()
    // Captured at the device's pixel ratio, so compare the shape, not the count.
    if (Math.abs(s.width / s.height - DECK_CAPTURE_SIZE.width / DECK_CAPTURE_SIZE.height) > 0.005) {
      sized = false
      console.log(`       slide ${i} came out ${s.width}x${s.height}`)
    }
    shots.push(img.toPNG())
  }
  check(shots.length === count, `captured all ${count} slides`)
  check(sized, 'every capture kept the deck\'s aspect ratio')

  const hashes = new Set(shots.map((b) => createHash('sha1').update(b).digest('hex')))
  // The old exporter scrolled the window, which does nothing to a scroll
  // container, so this is the assertion that would have caught it.
  check(hashes.size === count, `every slide is a different picture — ${hashes.size} of ${count}`)

  const doc = buildSlidePdfHtml(shots.map((b) => `data:image/png;base64,${b.toString('base64')}`), DECK_CAPTURE_SIZE)
  const tmp = join(os.tmpdir(), `t42-deck-print-${Date.now()}.html`)
  fs.writeFileSync(tmp, doc, 'utf8')
  const w2 = new BrowserWindow({ show: false, width: 1200, height: 800, webPreferences: { sandbox: true } })
  await w2.loadFile(tmp)
  await new Promise((r) => setTimeout(r, 500))
  const pdf = await w2.webContents.printToPDF({
    printBackground: true,
    pageSize: { width: DECK_CAPTURE_SIZE.width / 96, height: DECK_CAPTURE_SIZE.height / 96 },
    margins: { top: 0, bottom: 0, left: 0, right: 0 }
  })
  fs.unlinkSync(tmp)
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length
  check(pages === count, `PDF has one page per slide — ${pages} of ${count}`)

  console.log(fails.length ? `\n${fails.length} failed` : '\nall good')
  app.exit(fails.length ? 1 : 0)
}).catch((e) => {
  console.error('smoke test threw:', e)
  app.exit(1)
})
