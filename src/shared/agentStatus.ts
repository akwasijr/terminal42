// Lightweight ANSI stripper + Copilot session status classifier used by the
// Activity / agent view. Keeps the renderer free of any new IPC: status is
// derived from the existing pty.scrollback tail.

const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Z0-9]/g
const CTRL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '').replace(CTRL_RE, '')
}

export type AgentStatus = 'waiting' | 'working' | 'idle'

export function classifyStatus(rawScrollback: string): AgentStatus {
  if (!rawScrollback) return 'idle'
  const tail = stripAnsi(rawScrollback).split(/\r?\n/).slice(-40).join('\n')

  // Approval prompts the Copilot CLI shows: "Approve [Y/n]", "(y)es / (n)o",
  // "Continue?", numbered choice lists ending with "?", folder trust prompt.
  const waitingPatterns: RegExp[] = [
    /Approve.*\[?(?:y\/n|Y\/n|y\/N)\]?/i,
    /\(y\)es.*\(n\)o/i,
    /Continue\??\s*$/im,
    /Press Enter to continue/i,
    /Confirm folder trust/i,
    /\bAllow this command\??/i,
    /Do you want to/i,
    /\?\s*$/m,
    /\(\d+\)\s+\w[^\n]*\n.*?\(\d+\)\s+\w/s,  // numbered choice menu
  ]
  for (const re of waitingPatterns) {
    if (re.test(tail)) return 'waiting'
  }

  // Working: tool call lines / spinners / progress indicators in the last
  // few lines. Copilot prints lines like "● tool_name(args)" while running.
  const lastLines = tail.split('\n').slice(-6).join('\n')
  if (/●\s|⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/.test(lastLines)) return 'working'
  if (/Running |Executing |Calling tool|Reading |Writing |Editing /i.test(lastLines)) return 'working'

  // Bare prompt ready for input → idle
  return 'idle'
}

export function lastAssistantLine(rawScrollback: string, fallback?: string): string {
  if (!rawScrollback) return fallback ?? ''
  const lines = stripAnsi(rawScrollback)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[>$#%]\s*$/.test(l))
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    if (l.startsWith('●') || l.startsWith('⠋') || l.startsWith('⠙')) continue
    if (l.length < 4) continue
    return l.length > 200 ? l.slice(0, 197) + '…' : l
  }
  return fallback ?? ''
}

export function tailLines(rawScrollback: string, n = 28): string {
  if (!rawScrollback) return ''
  const lines = stripAnsi(rawScrollback).split(/\r?\n/)
  return lines.slice(-n).join('\n')
}
