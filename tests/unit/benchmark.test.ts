import { describe, it, expect } from 'vitest'
import { runBenchmark, formatScorecard, BENCHMARK_CASES } from '../../src/renderer/src/lib/benchmark'

describe('repeatable quality benchmark', () => {
  const res = runBenchmark()

  it('prints the cross-domain scorecard', () => {
    // Visible in test output — the "measure, don't vibe-check" artifact.
    console.log('\n' + formatScorecard(res) + '\n')
    expect(res.rows.length).toBe(BENCHMARK_CASES.length)
  })

  it('every clean case scores well across all domains (regression guard)', () => {
    for (const r of res.rows.filter((x) => x.kind === 'clean')) {
      expect.soft(r.after.total, `${r.id} total`).toBeGreaterThanOrEqual(0.7)
      expect.soft(r.after.overlaps, `${r.id} overlaps`).toBe(0)
      expect.soft(r.after.handIcons, `${r.id} hand-drawn icons`).toBe(0)
      expect.soft(r.after.orphans, `${r.id} orphans`).toBe(0)
    }
  })

  it('the gate lifts every adversarial case (model-independent repair)', () => {
    for (const r of res.rows.filter((x) => x.kind === 'adversarial')) {
      expect.soft(r.after.total, `${r.id} after > before`).toBeGreaterThan(r.before!.total)
    }
    expect(res.meanGateUplift).toBeGreaterThan(0)
  })

  it('the gate removes hand-drawn icons (icons → library, any domain)', () => {
    const r = res.rows.find((x) => x.id === 'adv-icons')!
    expect(r.before!.handIcons).toBeGreaterThan(0)
    expect(r.after.handIcons).toBe(0)
  })

  it('the gate strips container outlines and snaps to grid', () => {
    const r = res.rows.find((x) => x.id === 'adv-boxy')!
    expect(r.after.boxes).toBeLessThan(r.before!.boxes)
    expect(r.after.grid).toBeGreaterThan(r.before!.grid)
  })

  it('the gate recolours a grey primary into the accent', () => {
    const r = res.rows.find((x) => x.id === 'adv-grey')!
    expect(r.before!.accentArea).toBe(0)
    expect(r.after.accentArea).toBeGreaterThan(0)
  })

  it('the gate pulls a misplaced child back into its section (placement repair)', () => {
    const r = res.rows.find((x) => x.id === 'adv-misplaced')!
    expect(r.before!.orphans).toBeGreaterThan(0)
    expect(r.after.orphans).toBe(0)
  })

  it('a never-seen domain composes cleanly from generic atoms (zero new code)', () => {
    const r = res.rows.find((x) => x.id === 'clean-newdomain')!
    expect(r.after.total).toBeGreaterThanOrEqual(0.7)
    expect(r.after.overlaps).toBe(0)
    expect(r.after.orphans).toBe(0)
    expect(r.after.handIcons).toBe(0)
  })

  it('repairs sloppy component specs into real components (not bare boxes)', () => {
    const r = res.rows.find((x) => x.id === 'adv-sloppy')!
    // before: 2 unrecognised component frames (bare boxes); after: real statTile + accent button
    expect(r.after.total).toBeGreaterThan(r.before!.total)
    expect(r.after.textCount).toBeGreaterThan(r.before!.textCount)
    expect(r.after.accentArea).toBeGreaterThan(0)
  })
})
