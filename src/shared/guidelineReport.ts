import { GUIDELINE_GROUPS, guideline, type Guideline, type GuidelineGroup } from './guidelines'
import type { Finding } from './guidelineScan'

// Arranging findings into something that can be read in a few seconds.
//
// A flat list of thirty-eight problems is a wall, and a wall gets closed. The
// same thirty-eight under nine headings, each with a count, is a glance: most
// of it is one group, and that is the thing to fix first.

export type ReportRow = {
  guideline: Guideline
  finding: Finding
}

export type ReportSection = {
  group: GuidelineGroup
  rows: ReportRow[]
  /** Every occurrence in the group, which is what the heading shows. */
  total: number
}

/**
 * Findings under their groups, busiest group first, and within a group the
 * finding with the most occurrences first. Unknown ids are dropped rather
 * than shown as a bare id: a report is only useful if every line means
 * something.
 */
export function buildReport(findings: Finding[]): ReportSection[] {
  const byGroup = new Map<string, ReportRow[]>()

  for (const finding of findings) {
    const g = guideline(finding.id)
    if (!g) continue
    const rows = byGroup.get(g.group) ?? []
    rows.push({ guideline: g, finding })
    byGroup.set(g.group, rows)
  }

  const sections: ReportSection[] = []
  for (const group of GUIDELINE_GROUPS) {
    const rows = byGroup.get(group.id)
    if (!rows || rows.length === 0) continue
    rows.sort((a, b) => b.finding.count - a.finding.count
      || a.guideline.label.localeCompare(b.guideline.label))
    sections.push({ group, rows, total: rows.reduce((n, r) => n + r.finding.count, 0) })
  }

  return sections.sort((a, b) => b.total - a.total || b.rows.length - a.rows.length)
}

/** How the count reads on a row: a number, or nothing where it is a yes or no. */
export function countLabel(finding: Finding): string {
  return finding.count > 1 ? String(finding.count) : ''
}

/**
 * What the check found, in one line. Said as a count of things to change
 * rather than a score, because a score invites arguing with the number
 * instead of reading the list.
 */
export function reportSummary(sections: ReportSection[], projectName: string): string {
  const rules = sections.reduce((n, s) => n + s.rows.length, 0)
  if (rules === 0) return `${projectName} follows all of them.`
  const groups = sections.length
  return `${rules} to change in ${projectName}, across ${groups} ${groups === 1 ? 'area' : 'areas'}.`
}

/**
 * The instruction for the second run. Only the rules still ticked go in, and
 * each one carries what it is and what to do, so the agent is not asked to
 * rediscover what the check already knows.
 *
 * What the run is asked to do depends on what it was given. An ordinary page
 * is edited in place. A mount point — the `<div id="root">` of a React or Vue
 * project — has no design on it to correct, so the page is rebuilt from the
 * components and stylesheets that were copied in beside it. Asking a run to
 * edit a shell is how the preview comes back a white rectangle.
 */
export function applyPrompt(
  sections: ReportSection[],
  accepted: Set<string>,
  source: { shell?: boolean; files?: string[] } = {}
): string {
  const lines: string[] = []
  for (const section of sections) {
    const rows = section.rows.filter((r) => accepted.has(r.guideline.id))
    if (rows.length === 0) continue
    lines.push(`${section.group.label}:`)
    for (const row of rows) {
      const where = row.finding.count > 1 ? ` (${row.finding.count} places)` : ''
      lines.push(`- ${row.guideline.label}${where}. ${row.guideline.fix}`)
    }
  }
  if (lines.length === 0) return ''

  const files = source.files ?? []
  const head = source.shell
    ? [
        'v001.html is only the mount point of this project, so there is nothing on it',
        'to correct. Rebuild it as one self-contained page that shows the project\'s',
        'real design: read the components and stylesheets in ./source/, reproduce the',
        'layout, the copy and the styling they describe, inline the CSS in a <style>',
        'tag, and use no build step, no framework and no external requests. Then make',
        'sure the page you have written follows the points below.'
      ]
    : [
        'Apply these design guideline fixes to v001.html. Change only what they ask for,',
        'keep the content and the layout as they are, and do not add anything new.'
      ]

  const where = files.length > 0
    ? ['', `The project's source is in ./source/ (${files.length} ${files.length === 1 ? 'file' : 'files'}), for reference.`]
    : []

  return [...head, ...where, '', ...lines].join('\n')
}
