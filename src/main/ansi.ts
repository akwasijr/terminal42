// Minimal ANSI / control sequence stripper for log persistence.
// Not exhaustive: strips CSI, OSC, simple controls, BEL.
const CSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g
const OSC_RE = /\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g
const SGR_RESET_RE = /\x1b[()][A-Z0-9]/g
const CONTROL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

export function stripAnsi(input: string): string {
  return input
    .replace(OSC_RE, '')
    .replace(CSI_RE, '')
    .replace(SGR_RESET_RE, '')
    .replace(/\r(?!\n)/g, '\n')
    .replace(CONTROL_RE, '')
}
