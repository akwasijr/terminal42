// Harness performance benchmark: what does one more agent session cost us?
//
// jcode publishes a resource-efficiency table and, usefully for us, measured
// GitHub Copilot CLI in it (~158 MB extra per session, ~1.58 s to first
// input). That is the engine Terminal 42 drives, so those numbers are a floor
// we cannot beat -- but the per-session cost is what decides how many
// sessions the app can actually hold, so it is worth knowing ours.
//
// Method follows theirs where it can: repeated interactive PTY launches
// measuring time to first byte and time until typed text echoes back, plus
// the marginal memory each additional session adds once one is running.
//
// Honest caveat: this reports RSS, not PSS. macOS has no cheap PSS
// equivalent, so shared pages are counted once per process and these numbers
// read HIGHER than a PSS figure for the same workload. Compare runs of this
// script against each other, not directly against jcode's published table.
//
// Run with:  npm run bench
// Options:   --sessions=6  --launches=10  --command=copilot

const { app } = require('electron')
const { execFileSync } = require('node:child_process')

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=')[1] : fallback
}

const SESSIONS = Number(arg('sessions', 6))
const LAUNCHES = Number(arg('launches', 10))
const COMMAND = arg('command', process.env.SHELL || '/bin/zsh')

function rssKb(pid) {
  try {
    return Number(execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], { encoding: 'utf8' }).trim()) || 0
  } catch {
    return 0
  }
}

/** Every descendant of a pid, so a CLI that forks a runtime is counted whole. */
function descendants(pid) {
  try {
    const out = execFileSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' })
    const children = new Map()
    for (const line of out.trim().split('\n')) {
      const [p, pp] = line.trim().split(/\s+/).map(Number)
      if (!children.has(pp)) children.set(pp, [])
      children.get(pp).push(p)
    }
    const found = []
    const stack = [pid]
    while (stack.length) {
      const cur = stack.pop()
      found.push(cur)
      for (const c of children.get(cur) || []) stack.push(c)
    }
    return found
  } catch {
    return [pid]
  }
}

const treeRssKb = (pid) => descendants(pid).reduce((sum, p) => sum + rssKb(p), 0)

function median(xs) {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

const stats = (xs) => ({ median: median(xs), min: Math.min(...xs), max: Math.max(...xs) })
const fmtMs = (n) => `${n.toFixed(1)} ms`
const fmtMb = (kb) => `${(kb / 1024).toFixed(1)} MB`
const row = (cells, widths) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ')

/**
 * Kills by signal rather than proc.kill().
 *
 * node-pty's kill() crosses into native code and throws from a callback we
 * cannot catch if the child has already exited, which aborts the whole
 * process. A plain signal is just a syscall and fails harmlessly.
 */
function stop(proc) {
  try {
    if (proc && proc.pid) process.kill(proc.pid, 'SIGKILL')
  } catch {}
}

async function measureLaunchLatency(pty) {
  const firstByte = []
  const firstEcho = []

  for (let i = 0; i < LAUNCHES; i++) {
    const started = process.hrtime.bigint()
    const probe = `T42PROBE${i}`
    let sawByte = null
    let sawEcho = null

    const proc = pty.spawn(COMMAND, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: process.env.HOME,
      // A predictable prompt keeps the echo probe from being confused by a
      // heavily themed rc file.
      env: { ...process.env, PS1: '$ ', PROMPT: '$ ' }
    })

    await new Promise((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        stop(proc)
        resolve()
      }
      const timeout = setTimeout(done, 15000)
      let typed = false

      proc.onData((data) => {
        const now = Number(process.hrtime.bigint() - started) / 1e6
        if (sawByte === null) {
          sawByte = now
          // Type only once the shell has shown signs of life, as a person would.
          if (!typed) {
            typed = true
            setTimeout(() => {
              try {
                proc.write(probe)
              } catch {}
            }, 10)
          }
        }
        if (sawEcho === null && data.includes(probe)) {
          sawEcho = now
          done()
        }
      })
    })

    if (sawByte !== null) firstByte.push(sawByte)
    if (sawEcho !== null) firstEcho.push(sawEcho)
  }

  return { firstByte, firstEcho }
}

async function measureSessionMemory(pty) {
  const procs = []
  const marginal = []
  let previous = 0

  for (let i = 0; i < SESSIONS; i++) {
    procs.push(
      pty.spawn(COMMAND, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: process.env.HOME,
        env: process.env
      })
    )
    // Let the shell finish its rc file before sampling, or early sessions
    // look artificially cheap.
    await new Promise((r) => setTimeout(r, 1500))

    const total = procs.reduce((sum, p) => sum + treeRssKb(p.pid), 0)
    if (i > 0) marginal.push(total - previous)
    previous = total
  }

  for (const p of procs) stop(p)
  return { total: previous, marginal }
}

app.on('ready', async () => {
  // node-pty is built against Electron's ABI, so this only runs here.
  const pty = require('node-pty')

  console.log('\nTerminal 42 harness benchmark')
  console.log(`command=${COMMAND}  launches=${LAUNCHES}  sessions=${SESSIONS}`)
  console.log('memory is RSS, not PSS - compare against other runs of this script\n')

  const latency = await measureLaunchLatency(pty)
  const memory = await measureSessionMemory(pty)

  const w = [32, 14, 14, 14]
  console.log(row(['metric', 'median', 'min', 'max'], w))
  console.log('-'.repeat(w.reduce((a, b) => a + b + 2, 0)))

  if (latency.firstByte.length) {
    const s = stats(latency.firstByte)
    console.log(row(['time to first byte', fmtMs(s.median), fmtMs(s.min), fmtMs(s.max)], w))
  }
  if (!latency.firstEcho.length) {
    // A full-screen TUI redraws rather than echoing, so the probe never
    // appears verbatim. That is expected for `--command=copilot`.
    console.log(row(['time to first input echo', 'n/a (TUI)', '', ''], w))
  }
  if (latency.firstEcho.length) {
    const s = stats(latency.firstEcho)
    console.log(row(['time to first input echo', fmtMs(s.median), fmtMs(s.min), fmtMs(s.max)], w))
  }
  if (memory.marginal.length) {
    const s = stats(memory.marginal)
    console.log(row(['memory per extra session', fmtMb(s.median), fmtMb(s.min), fmtMb(s.max)], w))
  }
  console.log(row([`total for ${SESSIONS} sessions`, fmtMb(memory.total), '', ''], w))

  const perSession = median(memory.marginal.length ? memory.marginal : [memory.total])
  if (perSession > 0) {
    console.log(
      `\nheadroom: ~${Math.floor((8 * 1024 * 1024) / perSession)} sessions per 8 GB at this cost`
    )
  }
  console.log()
  app.exit(0)
})
