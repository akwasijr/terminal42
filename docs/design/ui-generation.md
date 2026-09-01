# Generating UI from a prompt

How the Form canvas turns a sentence into a screen, what is wrong with it today,
and what we are changing.

Research behind this: [`docs/research/ui-generation.md`](../research/ui-generation.md),
[`docs/research/autolayout.md`](../research/autolayout.md).

## The pipeline today

```
prompt
  → CanvasAssistant builds a prompt (golden examples + kit catalogue + icon names)
  → copilot CLI one-shot, JSON out                     src/main/canvasAssist.ts
  → AgentAction { kind: 'screen', tree: UINode }       src/renderer/src/lib/canvasAgent.ts
  → compileTree walks the tree and owns ALL geometry   src/renderer/src/lib/uiTree.ts
  → buildComponent draws each kit component            src/renderer/src/lib/uiKit.ts
  → ObjectSpec[] → buildObject → FObj[] on the canvas
```

The shape is right. The model emits intent (a tree of containers and named
components), never coordinates. That is the architecture the research recommends
for a tool whose output is a design tree rather than running code. The failures
are all in the compiler and the kit, not in the architecture.

## What went wrong

Prompt: *"Design a dashboard with a sidebar on the left into dashboard-utility
frame for a utility company showing current usage and a history in a table."*

| # | Symptom | Root cause | Where |
|---|---|---|---|
| 1 | Sidebar came out as 10 flat siblings (Nav icon, Nav label, ×5) | `sidebar()` parents every icon and label straight to the sidebar frame. No per-row container exists to be named or laid out. | `uiKit.ts:204` |
| 2 | Every nav row drew the same hamburger | `resolveIcon` falls back to the **first** token, so `nav-dashboard`, `nav-usage`, `nav-billing` all resolve to `menu`. | `icons24.ts:158` |
| 3 | Some icons drew nothing | ~90 icons only. `usage`, `billing`, `overview`, `consumption`, `support` resolve to `''`, which becomes an empty path. The golden examples the model copies use `flame`, `book` and `drop`, none of which exist. | `icons24.ts`, `goldenExamples.ts:103` |
| 4 | Green button with black text | `readableInk` returns the better of two inks with no minimum, so a mid-tone accent gets black text at ~3:1. | `designQA.ts:35` |
| 5 | No table, thin content | The kit has no table component. `statTile` supports `delta` and nothing asked for it. | `uiKit.ts` |
| 6 | Groups have no auto layout | `compileTree` computes geometry from stack/gap/pad and then discards the intent. The frames it emits are plain groups. | `uiTree.ts:100` |

Confirmed by test, not by inspection:

```
nav-usage -> menu     nav-dashboard -> menu     menu-billing -> menu
BROKEN golden icons: flame book drop
```

## What we already have

Worth stating plainly, because it changes the size of the job.

- A working auto layout engine: `layoutFrame` and `reflowAll` in
  `src/renderer/src/lib/autoLayout.ts`. Row, column, grid, wrap, fixed/fit/fill
  sizing, justify and align, deepest-first reflow, idempotent.
- A Flow section in the inspector wired to it, with W and H mode dropdowns.
- A layer badge for frames that are in flow.

So issue 6 is not "build auto layout". It is "stamp the intent the compiler
already knows onto the frames it emits".

## Decisions

**Keep the tree, do not switch to code-first.** The research is clear that
products generating *runnable* UI have converged on JSX plus a browser layout
pass. We are not one of them: our output is a design tree, and the tools in that
category (Figma Make, Galileo) emit trees directly for the same reason. A
JSX-render-and-traverse pipeline would buy us the browser's layout engine, which
we do not need because we have our own, at the cost of a hidden window, a DOM
walk and a much longer round trip. Revisit if we ever ship code export as the
primary artefact.

**Keep the hand-rolled layout engine.** The research recommends `yoga-wasm-web`
for a greenfield build. Ours is ~250 lines, passes its tests, and covers the
subset we expose. Swapping in a Wasm dependency to gain edge cases we do not
offer in the inspector is not worth it today.

**Make bad output impossible to express, rather than asking for good output.**
Every fix below is deterministic and model-independent. Nothing here depends on
a better prompt.

## The plan

Ordered. Each lands as its own commit.

| Item | Change |
|---|---|
| `icon-resolution-fix` | Prefer the last token (the noun) over the first. Stop silently substituting a wrong icon. Test that every icon name in the golden examples resolves. |
| `icon-library-widen` | Add the UI nouns a dashboard needs. Give the model the enumerated list and validate against it. |
| `contrast-guarantee` | Guarantee 4.5:1: if neither ink clears it, shift the accent container until white text does. Lint generated output for the same rule. |
| `kit-item-grouping` | Every repeated item in a kit component gets its own named frame. Sidebars gain section headers. |
| `generated-autolayout` | `compileTree` stamps `layoutMode`, gap, padding, align and the sizing modes onto every container frame it emits. Kit components do the same for their internal frames. |
| `kit-table-component` | A real table: header row, data rows, status badges, footer. |

### Later, not now

- A deterministic design linter over the generated tree (overlap, off-grid
  spacing, tap targets, text overflow, generic names) with auto-fix.
- A plan-first call before generation.
- A vision critique pass, capped at two repairs. Evidence says it works
  (Design2Code, arXiv 2403.03163) but it is the slowest and least certain win.
- Inferring auto layout from an arbitrary selection (the Shift+A problem). The
  algorithm is written up in `docs/research/autolayout.md` §5.
