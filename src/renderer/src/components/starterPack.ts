import type { SkillFormat } from '../../../preload/index'

export type SkillDomain = 'ux-design' | 'ux-research' | 'product' | 'dev' | 'productivity' | 'docs' | 'misc'

export const DOMAIN_LABEL: Record<SkillDomain, string> = {
  'ux-design': 'UX design',
  'ux-research': 'UX research',
  product: 'Product',
  dev: 'Dev',
  productivity: 'Productivity',
  docs: 'Docs & comms',
  misc: 'Misc'
}

export const DOMAIN_DESCRIPTION: Record<SkillDomain, string> = {
  'ux-design': 'Critique, accessibility, components, design tokens, copy polish.',
  'ux-research': 'Interview prep, synthesis, JTBD, persona drafts, study notes.',
  product: 'PRDs, specs, positioning, launch plans, roadmap and metrics.',
  dev: 'Code review, refactor, debug, tests, PR prep, shell shortcuts.',
  productivity: 'Standups, weekly recaps, inbox triage, focus and planning.',
  docs: 'Readmes, guides, blog posts, slack/email drafts, announcements.',
  misc: 'Anything that does not fit the other modes.'
}

export const DOMAIN_ORDER: SkillDomain[] = ['ux-design', 'ux-research', 'product', 'dev', 'productivity', 'docs', 'misc']

export type StarterSkill = {
  name: string
  format: SkillFormat
  domain: SkillDomain
  tags: string[]
  scope?: 'always' | 'manual'
  description: string
  body: string
}

export const STARTER_PACK: StarterSkill[] = [
  // ───────── ENGINEERING ─────────
  {
    name: 'Code review',
    format: 'prompt',
    domain: 'dev',
    tags: ['review', 'quality'],
    description: 'Critical, high-signal review of the current changes.',
    body: `Review the most recent changes in this repo (staged + unstaged). For each finding, output:
- **File:line**: short title
  Why it matters in one sentence.

Focus on: bugs, security issues, race conditions, missing edge cases, broken contracts, performance regressions. Skip style, formatting, naming preferences, and trivia. If everything is fine, just say so.`
  },
  {
    name: 'Refactor for clarity',
    format: 'prompt',
    domain: 'dev',
    tags: ['refactor'],
    description: 'Refactor selected code without changing behavior.',
    body: `Refactor {{file_or_selection}} for clarity. Rules:
- No behavior changes: same inputs ⇒ same outputs.
- Prefer small functions with descriptive names over comments.
- Remove dead code and unused imports.
- Keep the public API identical unless I say otherwise.

Show a brief diff first, then apply.`
  },
  {
    name: 'Explain this code',
    format: 'prompt',
    domain: 'dev',
    tags: ['learning'],
    description: 'Plain-English walkthrough of a file or function.',
    body: `Explain {{file_or_function}} in plain English.

Start with one sentence on what it does. Then walk through the key steps. Call out anything non-obvious, any side effects, and any gotchas. Skip the obvious lines.`
  },
  {
    name: 'Write tests',
    format: 'prompt',
    domain: 'dev',
    tags: ['tests', 'quality'],
    description: 'Generate tests using the project conventions.',
    body: `Write tests for {{file}}. Use the existing test framework and conventions in this repo: mirror the style of nearby test files.

Cover: happy path, edge cases (empty/null/undefined), error paths, and at least one boundary condition. Don't mock things that aren't necessary. Run the tests after writing them.`
  },
  {
    name: 'Find the bug',
    format: 'prompt',
    domain: 'dev',
    tags: ['debugging'],
    description: 'Hunt down a bug from a description.',
    body: `I'm seeing this bug: {{description}}

Investigate it: read the relevant files, trace the data flow, and form a hypothesis. Don't fix anything yet: just give me your top 1-3 candidate causes ranked by likelihood, with the evidence for each.`
  },
  {
    name: 'Convert to TypeScript',
    format: 'prompt',
    domain: 'dev',
    tags: ['typescript', 'refactor'],
    description: 'Migrate a JS file to TS with proper types.',
    body: `Convert {{file}} to TypeScript. Add proper types: no \`any\` unless absolutely necessary. Infer types from existing usage where possible. Update any imports that referenced the old file. Run the type checker after.`
  },
  {
    name: 'Senior reviewer',
    format: 'persona',
    domain: 'dev',
    tags: ['review'],
    description: 'High-bar, no-nonsense reviewer voice.',
    body: `You are a senior engineer reviewing my work. You have high standards and a low tolerance for unjustified complexity. You ask sharp questions before assuming. You never sugar-coat: but you're never rude. You assume I can take direct feedback. When I'm wrong, you tell me; when I'm right, you say so briefly and move on.`
  },
  {
    name: 'Skeptical security engineer',
    format: 'persona',
    domain: 'dev',
    tags: ['security'],
    description: 'Adversarial mindset for code & infra.',
    body: `You are a security engineer thinking like an attacker. For every change you look at, you ask: how could this be abused? What does an untrusted input look like? Where's the trust boundary? You flag injection vectors, missing authz checks, secrets in logs, broken crypto, and dependency risks. Be specific: name the file and the line.`
  },

  // ───────── WORKFLOW ─────────
  {
    name: 'Summarize PR diff',
    format: 'prompt',
    domain: 'productivity',
    tags: ['git', 'review'],
    description: 'Concise PR summary suitable for a description.',
    body: `Look at the git diff between the current branch and main. Write a PR description with:

**What changed**: 1-3 sentences, plain English.
**Why**: the user-visible reason.
**How to verify**: 2-3 steps a reviewer can run locally.
**Risk**: what could break.`
  },
  {
    name: 'Daily wrap-up',
    format: 'prompt',
    domain: 'productivity',
    tags: ['workflow'],
    description: 'End-of-day summary of work done in this repo.',
    body: `Look at today's commits and uncommitted changes in this repo. Write a daily wrap-up:

**Shipped today**: bullet list of meaningful changes (skip dependency bumps and trivia).
**In progress**: anything half-done worth picking up tomorrow.
**Blockers**: anything stuck.

Keep it tight: under 12 bullets total.`
  },
  {
    name: 'PR prep',
    format: 'recipe',
    domain: 'productivity',
    tags: ['git', 'workflow'],
    description: 'Lint → tests → format → write PR description.',
    body: `# PR prep

## Step 1
Run the project's linter and fix any auto-fixable issues. Don't auto-fix anything that changes behavior.

## Step 2
Run the test suite. If anything fails, stop and report.

## Step 3
Look at the git diff between this branch and main. Write a PR description: **What**, **Why**, **How to verify**, **Risk**. Save it to a file called PR_DESCRIPTION.md in the repo root.`
  },
  {
    name: 'Bug triage',
    format: 'recipe',
    domain: 'productivity',
    tags: ['debugging'],
    description: 'Reproduce → diagnose → propose 1-3 fixes.',
    body: `# Bug triage

## Step 1
Read my bug description: {{description}}

Identify which files are likely involved. List them with one sentence each.

## Step 2
Trace the data flow from input to where the bug shows up. Form 1-3 hypotheses ranked by likelihood, with evidence.

## Step 3
For each hypothesis, propose a fix as a short code sketch. Don't apply anything yet: wait for me to pick one.`
  },
  {
    name: 'New feature scaffold',
    format: 'recipe',
    domain: 'productivity',
    tags: ['workflow'],
    description: 'Plan → scaffold files → wire up → tests.',
    body: `# New feature scaffold

## Step 1
Given the feature description: {{description}}, list the files we'll need (new and modified). Show the proposed file structure.

## Step 2
Create the new files with stub implementations and clear TODO comments.

## Step 3
Wire the new code into the existing entry points so it's reachable but inert.

## Step 4
Add the smallest possible test for the happy path.`
  },
  {
    name: 'Friendly mentor',
    format: 'persona',
    domain: 'productivity',
    tags: ['learning'],
    description: 'Patient explainer for unfamiliar territory.',
    body: `You are a patient, encouraging mentor. When I ask something basic, you don't condescend. You explain the "why" before the "how". You give examples. You point out related concepts I should look up later. You celebrate small wins.`
  },
  {
    name: 'PM thinking partner',
    format: 'persona',
    domain: 'productivity',
    tags: ['product'],
    description: 'Help shape ideas into shippable scope.',
    body: `You are a product manager helping me think through scope. You push back on feature creep. You ask "who is this for?" and "what's the smallest thing that proves this works?". You name trade-offs explicitly. You suggest cutting before adding.`
  },

  // ───────── UX DESIGN ─────────
  {
    name: 'Prioritized screen critique',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['critique'],
    description: 'Top 5 issues on a screen, ranked by user impact, each with a concrete fix.',
    body: `Critique {{screen_or_url_or_screenshot}}.

Rules:
- Surface only the top 5 issues, ranked by user impact.
- Be specific: cite the element, not the area.
- Separate observation from inference; do not invent missing context.
- Skip taste-level tweaks unless they directly affect the primary task.

Output as a table:

| # | Issue | Where | Why it hurts the user | Severity (P0/P1/P2) | Fix (concrete) |

End with: 1-line "primary task this screen serves" + 1-line "what would make it 10× clearer".`
  },
  {
    name: 'UI copy review',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['copy'],
    description: 'Rewrite labels, errors, empty states with rationale and tone notes.',
    body: `Rewrite the user-facing copy in {{file_or_screen}}.

Rules:
- Active voice, plain words, no jargon, no "oops".
- Buttons = verb + noun ("Create project", not "Submit").
- Errors: explain what happened AND how to fix it (no blame).
- Empty states: describe the area + the smallest first action.
- No exclamation marks, no marketing words, no emoji in functional UI.

Output as a table:

| Original | Issue | Rewrite | Rationale | Tone note | Edge case |

End with 3 reusable copy rules I should add to my style guide based on what I rewrote.`
  },
  {
    name: 'Accessibility audit',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['a11y', 'wcag'],
    description: 'WCAG-style audit with severity and concrete fixes per issue.',
    body: `Audit {{screen_or_component}} for accessibility (WCAG 2.2 AA).

Check each of:
- Semantic HTML (landmarks, headings hierarchy, lists, buttons vs links)
- Keyboard flow (focus order, visible focus indicator, no traps, skip links)
- ARIA usage (only when semantic HTML isn't enough)
- Color contrast (≥ 4.5:1 text, 3:1 UI, both modes)
- Touch targets (≥ 44×44 px, ≥ 8 px gap)
- Screen-reader names on icon-only controls
- Reduced-motion + reduced-transparency respected
- Form errors announced and recoverable

Output as a table:

| # | Issue | Where | WCAG ref | Severity (Blocker/Major/Minor) | Fix (code or change) |

End with: must-fix count, total count, and the 3 patterns most worth fixing systemically.`
  },
  {
    name: 'Component spec',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['component', 'spec'],
    description: 'Engineering hand-off spec: anatomy, variants, states, behavior, a11y, do/don\'t.',
    body: `Spec the {{component}} component for engineering hand-off.

Sections:
1. **Purpose**: one sentence on what user problem it solves.
2. **Anatomy**: named parts (label, slot, leading icon, trailing icon, etc.).
3. **Props / variants**: each with allowed values and defaults.
4. **States**: default, hover, focus-visible, active, disabled, loading, error.
5. **Behavior**: what happens on click/keyboard/long-press; async loading; error recovery.
6. **Content rules**: max length, truncation, internationalization, pluralization.
7. **Accessibility**: role, name source, keyboard map, ARIA, reduced motion.
8. **Responsive behavior**: how it adapts at 320 / 768 / 1280 widths.
9. **Tokens used**: reference by token name only; never raw px / hex.
10. **Do / Don't**: 3 of each, with one-line reason.
11. **Open questions**: anything unresolved before implementation.`
  },
  {
    name: 'State design generator',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['states'],
    description: 'Design empty, loading, error, success states for one screen.',
    body: `Design the empty, loading, error, and success states for {{screen}}.

For EACH of the 4 states output:

- **State**: one of empty / loading / error / success
- **User situation**: when does the user hit this?
- **UX goal**: what should they feel/know after 2 seconds?
- **Headline**: 5-8 words
- **Supporting copy**: 1-2 sentences
- **Primary action**: verb + noun
- **Secondary action**: optional
- **Visual / content guidance**: illustration? metric? skeleton? toast?
- **Edge cases**: partial data, slow network, repeated failure
- **Instrumentation event**: name to log when shown

Skip generic stock advice; tailor to this screen's primary task.`
  },
  {
    name: 'Form review',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['form'],
    description: 'Critique a form for clarity, validation, autofill, keyboard, recovery.',
    body: `Review the form in {{screen_or_url}}.

Check:
- Field labels (visible, persistent, plain)
- Input types + autocomplete attributes (email, tel, postal-code, current-password, etc.)
- Required vs optional clearly marked
- Help text vs placeholder used correctly (placeholders are not labels)
- Validation timing (on blur, on submit, never on every keystroke)
- Error messages specific + recoverable
- Field grouping + order (most known to least known)
- Tab order + Enter-to-submit
- Mobile keyboard correctness
- Save / resume + autosave behavior

Output as a table:

| Field | Issue | Severity | Fix | Why it matters for conversion or comprehension |

End with: 3 highest-impact changes ranked by likely conversion lift.`
  },
  {
    name: 'Responsive pass',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['responsive'],
    description: 'Audit a screen across 320 / 768 / 1280 widths for layout, touch, hierarchy.',
    body: `Run a responsive pass on {{screen_or_url}} at 320, 768, and 1280 px.

For each breakpoint check:
- Layout reflow (no horizontal scroll, no clipped content)
- Reading order matches visual order
- Touch targets ≥ 44×44 px with ≥ 8 px gap
- Text truncation handled (ellipsis vs wrap intentional)
- Hierarchy holds (primary action still primary)
- Density appropriate (more compact ≠ harder to scan)
- Images / charts degrade gracefully

Output as a table:

| Width | Issue | Severity | Fix |

End with: 1-line on whether the design is mobile-first, desktop-first, or unclear, and what to change next.`
  },
  {
    name: 'Task flow audit',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['flow'],
    description: 'Find friction, unclear decisions, dead ends across a user flow.',
    body: `Audit the user flow for {{flow_name}} from {{entry_point}} to {{success_state}}.

For each step output:

| # | Step | User goal at this step | Friction observed | Decision required | Severity | Recommendation | Open question |

Then add:
- **Drop-off risks**: where users likely abandon and why
- **Recovery paths**: what happens when they hit a dead end
- **Shortest happy path**: minimum steps if everything goes right
- **Where to instrument**: events worth tracking to validate fixes`
  },
  {
    name: 'Design decision memo',
    format: 'prompt',
    domain: 'ux-design',
    tags: ['memo', 'decision'],
    description: 'Turn options + tradeoffs into a stakeholder-ready recommendation.',
    body: `Draft a design decision memo for {{decision}}.

Sections:
1. **Context**: what triggered this decision and what is at stake.
2. **User problem**: one sentence, evidence-anchored.
3. **Options considered**: at least 3, each with one-line summary.
4. **Recommendation**: which option, in one sentence.
5. **Why this option**: 3-5 reasons tied to user impact.
6. **Tradeoffs**: what we lose by picking this.
7. **Risks**: and how we'd detect / mitigate each.
8. **Validation plan**: what would make us reverse this in 30 days.
9. **Decision owner + date**

Tone: direct, specific, no hype. Length: under one page.`
  },
  {
    name: 'Design critique partner',
    format: 'persona',
    domain: 'ux-design',
    tags: ['critique', 'persona'],
    description: 'Senior product-design critique voice: direct, specific, evidence-seeking.',
    body: `You are my senior product design critique partner. You critique my work the way a thoughtful design lead would.

How you behave:
- Direct, specific, evidence-seeking. Cite the element, not the area.
- Prioritize task clarity, hierarchy, accessibility, interaction quality, edge cases, and product intent: in that order.
- Avoid vague praise ("looks good"). Avoid vague critique ("feels off").
- Always separate **must fix**, **should improve**, and **taste-level optional**.
- When you suggest a change, say what it would cost (effort, breakage, learning).
- If you don't have enough information, ask before you opine.
- Push back when you disagree; do not flatter.

Open every critique with: "Primary task this screen serves: …" then go to feedback.`
  },

  // ───────── SHELL SHORTCUTS ─────────
  {
    name: 'Reset to main (safe)',
    format: 'clip',
    domain: 'dev',
    tags: ['git'],
    description: 'Stash local changes then reset to origin/main.',
    body: `git stash push -u -m "auto-stash before reset" && git fetch origin && git checkout main && git reset --hard origin/main`
  },
  {
    name: 'Delete merged branches',
    format: 'clip',
    domain: 'dev',
    tags: ['git', 'cleanup'],
    description: 'Locally delete branches already merged into main.',
    body: `git branch --merged main | grep -v "^\\*\\| main$\\| master$" | xargs -n 1 git branch -d`
  },
  {
    name: 'Open repo on GitHub',
    format: 'clip',
    domain: 'dev',
    tags: ['git', 'shortcut'],
    description: "Open the current repo's GitHub page in the browser.",
    body: `gh repo view --web`
  },
  {
    name: 'Find big files in repo',
    format: 'clip',
    domain: 'dev',
    tags: ['shell'],
    description: 'List files over 1MB sorted by size.',
    body: `find . -type f -size +1M -not -path "./node_modules/*" -not -path "./.git/*" -exec du -h {} + | sort -rh | head -20`
  },
  {
    name: 'New TypeScript file with header',
    format: 'clip',
    domain: 'dev',
    tags: ['typescript'],
    description: 'Boilerplate file template.',
    body: `/**
 * {{purpose}}
 *
 * Author: me
 * Created: $(date +%Y-%m-%d)
 */

export {}
`
  },

  // ───────── UX RESEARCH ─────────
  {
    name: 'Research plan one-pager',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['plan'],
    description: 'Tight one-pager: question, method, recruit, timeline, deliverable.',
    body: `Draft a one-page research plan for {{study_topic}}.

Sections (one short paragraph or list each):
1. **Decision this informs**: what changes if we do this study?
2. **Research question**: one sentence, answerable.
3. **Sub-questions**: 3-5 specific, scoped.
4. **Method + why**: interview / usability / survey / diary / analytics.
5. **Participants**: N, segments, inclusion + exclusion criteria.
6. **Recruitment source + incentive**
7. **Timeline**: recruit / field / synthesize / share.
8. **Artifacts produced**: guide, notes, transcript, readout.
9. **Success criteria**: what makes this study worth running?
10. **Risks**: bias, recruit difficulty, timing, ethics: and the mitigation.

Be ruthless about scope. If a question doesn't change a decision, cut it.`
  },
  {
    name: 'Assumption + risk mapper',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['assumption', 'risk'],
    description: 'List the riskiest assumptions and the cheapest test for each.',
    body: `For {{product_or_feature}}, surface the riskiest assumptions and recommend how to test each.

Output as a table:

| # | Assumption | Risk if wrong | Evidence today | Confidence (Low/Med/High) | Best research method | Minimum useful test | Decision it would unblock |

Rules:
- Separate user assumptions, business assumptions, and technical assumptions.
- Confidence is based on evidence, not opinion.
- Prefer the cheapest test that would still move confidence by one level.

End with: top 3 to test next, in order, with one-line rationale.`
  },
  {
    name: 'Interview guide draft / review',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['interview'],
    description: 'Draft a new guide or critique an existing one for leading questions and gaps.',
    body: `Help me with an interview guide for {{topic}}.

If I paste a draft, REVIEW it:
- Flag leading, double-barreled, hypothetical, or yes/no questions
- Flag missing probes ("Tell me more…", "What did you do next?", "How did that feel?")
- Flag rapport / setup issues
- Suggest sequencing changes (broad → specific, behavior → opinion)

If no draft, DRAFT one:
- 2 warm-up questions (role + recent context)
- 5-7 open behaviour-first questions
- 3 probes per question
- 1 reflection wrap-up
- Time-budget per section so total ≤ 30 min

Output: numbered guide ready to run, plus 3 risks to watch in moderation.`
  },
  {
    name: 'Recruitment screener',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['screener', 'recruit'],
    description: 'Screener with inclusion / exclusion / quotas / red flags + invite copy.',
    body: `Draft a recruitment screener for {{target_user}}.

Output:
1. **Must-have criteria**: qualifying behaviors / contexts (not titles).
2. **Exclusion criteria**: disqualifying answers and why.
3. **Screener questions**: multiple choice; mark which answers qualify.
4. **Quota logic**: how to balance segments (e.g. 50/50 by usage frequency).
5. **Red flags**: answer patterns that suggest professional respondents or fraud.
6. **Sample invite message**: short, honest, no leading info about the topic.
7. **Consent + incentive language**: one paragraph.

Behavior beats demographics. Avoid title-based qualification unless it gates access.`
  },
  {
    name: 'Usability test plan',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['usability', 'plan'],
    description: 'Tasks, scenarios, success criteria, and what to observe.',
    body: `Draft a usability test plan for {{flow_or_prototype}}.

Sections:
1. **Goal**: what design decision this evaluates.
2. **Hypotheses**: what we expect users to do (and where we expect friction).
3. **Tasks**: 3-5 realistic tasks framed as scenarios, not instructions.
   For each task: scenario, success criteria (binary), expected steps, ideal time.
4. **Observation focus**: what to look for beyond success/fail (hesitation, misclicks, terminology confusion).
5. **Post-task questions**: 2-3, non-leading, tied to severity ranking.
6. **Wrap-up**: 3 reflection questions.
7. **Logistics**: moderated/unmoderated, prototype, recording, notetaker.

Avoid leading the user. Tasks describe the goal, not the path.`
  },
  {
    name: 'Usability test synthesis',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['usability', 'synthesis'],
    description: 'Turn session notes into task success, severity, patterns, recommendations.',
    body: `Synthesize my usability test sessions in {{file_or_paste}}.

Output:

| Task | Success rate | Median time | Top issue observed | Severity (Blocker/Major/Minor) | Evidence (P# quote) | Recommendation | Owner |

Then add:
- **Patterns across tasks**: recurring behaviors or terminology issues.
- **Surprises**: anything that contradicted hypotheses.
- **Open questions**: what we still don't know.
- **Recommended next study**: only if needed.

Anti-hallucination: every observation must cite a participant id (P1, P2, …). Mark inference vs observation explicitly.`
  },
  {
    name: 'Interview synthesis',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['synthesis'],
    description: 'Themes, evidence, contradictions, opportunities: with traceability.',
    body: `Synthesize my raw interview notes in {{file_or_paste}}.

Output sections:
1. **Executive summary**: 5 bullets, decision-ready.
2. **Themes**: 4-7 clusters. For each: one-line definition + 2-3 supporting quotes (with participant id) + confidence (Low/Med/High).
3. **Tensions**: points where participants disagreed.
4. **Surprises**: findings that contradict prior assumptions.
5. **Segment differences**: where heavy / light users, or new / experienced, behaved differently.
6. **Opportunity areas**: design / product implications, not solutions.
7. **Gaps + next research questions**: what we still cannot answer.

Anti-hallucination rules:
- Do NOT invent themes not supported by the notes.
- Quote verbatim where possible; paraphrase otherwise and mark with [paraphrased].
- Separate **observation** from **inference**. Flag weak evidence.`
  },
  {
    name: 'JTBD extractor',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['jtbd'],
    description: 'Evidence-backed jobs with situation, motivation, outcome, workaround.',
    body: `Extract jobs-to-be-done from the research notes in {{file_or_paste}}.

For each job, output:

| # | Situation | Motivation | Desired outcome | Current workaround | Pain it relieves | Evidence (P# quote) | Confidence | Open question |

Format the JTBD statement itself as:
> When [situation], I want to [motivation], so I can [outcome].

Rules:
- 3-7 jobs total. Quality over quantity.
- Every row must cite at least one participant.
- Separate observed evidence from inferred motivation explicitly.
- Skip jobs that are restatements of features.`
  },
  {
    name: 'Survey question writer',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['survey'],
    description: 'Unbiased 5-8 question survey tied to a research goal and decision.',
    body: `Write a survey to answer: {{research_question}}.

For each question output:

| # | Question | Type (single/multi/Likert/open) | Response options | What decision it informs | Bias risk | Notes |

Constraints:
- 5-8 questions max.
- Avoid double-barreled, leading, loaded, or hypothetical phrasing.
- Use balanced scales (e.g. 1-5 with a middle); never agree/disagree on contested topics.
- Open-text only when categories are unknown; otherwise use fixed options.
- Include one screening question if relevant.
- End with one optional open-text "anything we missed?".

Output: copy-paste ready survey, plus a one-paragraph "what we will and won't be able to conclude from this".`
  },
  {
    name: 'Research readout outline',
    format: 'prompt',
    domain: 'ux-research',
    tags: ['readout', 'storytelling'],
    description: 'Stakeholder-ready narrative with findings, implications, and decisions needed.',
    body: `Outline a stakeholder readout for the research findings in {{file_or_paste}}.

Sections:
1. **Headline**: one sentence a busy exec can repeat.
2. **What we studied**: question, method, N, when.
3. **Why it matters now**: link to the decision on the table.
4. **Top 3 findings**: each with one-line claim + evidence (P# or stat) + confidence.
5. **Implications for design / product**
6. **Decisions needed**: and from whom, by when.
7. **Recommended next steps**: short, ordered.
8. **Appendix pointers**: link to themes, transcripts, raw notes.

Tone: confident, evidence-anchored, no jargon. Length: 1 page or one slide deck of ~8 slides. Suggest a slide-by-slide title for each section.`
  },

  // ───────── PRODUCT ─────────
  {
    name: 'PRD skeleton',
    format: 'prompt',
    domain: 'product',
    tags: ['prd', 'spec'],
    description: 'Generate a one-pager PRD skeleton ready to fill in.',
    body: `Draft a one-page PRD skeleton for {{feature}}. Sections:

1. **Problem**: one paragraph, who hurts and why.
2. **Goal**: measurable outcome (not output).
3. **Non-goals**: explicit list of what we are not doing.
4. **Users & jobs**: primary user and the JTBD this serves.
5. **Solution sketch**: 3-5 bullets, no UI specifics.
6. **Success metrics**: leading + lagging.
7. **Risks & open questions**

Leave each section terse and bullet-shaped. Flag assumptions in italics.`
  },
  {
    name: 'Launch plan checklist',
    format: 'prompt',
    domain: 'product',
    tags: ['launch'],
    description: 'Pre-launch checklist tailored to the feature.',
    body: `Given {{feature}}, generate a pre-launch checklist covering:

- Eng readiness (feature flag, rollback plan, monitoring, error budgets)
- Design QA (visual + accessibility pass)
- Docs (changelog entry, help article, in-app copy)
- Comms (internal note, customer email, social post)
- Support (FAQ, known issues, escalation path)
- Metrics (what to watch in the first 24h / 7d / 30d)

Mark each item as P0 / P1 / P2 and assign a likely owner role.`
  },
  {
    name: 'Roadmap one-liners',
    format: 'prompt',
    domain: 'product',
    tags: ['roadmap'],
    description: 'Reduce a list of initiatives to crisp roadmap one-liners.',
    body: `Take my list of initiatives in {{file_or_paste}} and rewrite each as a roadmap one-liner in the form:

> [Verb] [thing] so that [outcome for user/business].

Group by theme. Cut anything that is a task or a feature dressed up as a goal.`
  },

  // ───────── DOCS & COMMS ─────────
  {
    name: 'README starter',
    format: 'prompt',
    domain: 'docs',
    tags: ['readme'],
    description: 'Generate a clean README scaffold for the current repo.',
    body: `Generate a README scaffold for this repo. Sections:

1. One-line tagline
2. What it does (3 sentences max)
3. Quickstart (install, run, test)
4. Project layout (top-level folders only)
5. Contributing (branching + PR convention)
6. License

Keep prose minimal. Prefer code blocks and bullet lists.`
  },
  {
    name: 'Changelog entry',
    format: 'prompt',
    domain: 'docs',
    tags: ['changelog'],
    description: 'Convert recent commits into a user-readable changelog entry.',
    body: `Look at the commits since the last tag and produce a changelog entry grouped under:

- Added
- Changed
- Fixed
- Removed

Write each line from the user's perspective ("You can now…", "Fixed an issue where…"). Skip internal-only refactors. Keep it under 12 lines.`
  },
  {
    name: 'Slack announcement',
    format: 'prompt',
    domain: 'docs',
    tags: ['slack', 'announce'],
    description: 'Short Slack post for shipping something.',
    body: `Draft a Slack announcement for shipping {{feature}}. Format:

> 🚀 *{{feature}}* is live
> One sentence on what it does for users.
> One sentence on why it matters.
> [Docs link] · [Demo link] · cc @{{owner}}

Tone: warm, specific, no hype words ("revolutionary", "supercharge", "unlock").`
  },
  {
    name: 'Blog post outline',
    format: 'prompt',
    domain: 'docs',
    tags: ['blog'],
    description: 'Outline a blog post from a rough idea.',
    body: `Outline a blog post on {{topic}}. Include:

- Working title (3 options, no clickbait)
- Hook (1 paragraph)
- 3-5 H2 sections with 1-line summaries each
- A practical example or screenshot suggestion per section
- Closing call-to-action (1 line)

Audience: practitioners. Keep it concrete, no fluff.`
  },

  // ───────── EXTRA PRODUCTIVITY ─────────
  {
    name: 'Inbox triage',
    format: 'prompt',
    domain: 'productivity',
    tags: ['inbox'],
    description: 'Sort an inbox dump into action / waiting / archive.',
    body: `Triage the inbox items I paste into:

- **Act now** (≤ 2 min): list each with the one action
- **Schedule** (needs a slot): suggest a duration
- **Waiting on others**: note who and what
- **Archive / FYI**

Be ruthless. Default to archive when in doubt.`
  },

  // ───────── WORKFLOW RECIPES ─────────
  {
    name: 'Daily standup digest',
    format: 'recipe',
    domain: 'productivity',
    tags: ['standup', 'daily'],
    description: 'Yesterday\'s git activity → standup-ready 3-bullet update.',
    body: `# Daily standup digest

## Step 1
Run \`git log --author="$(git config user.email)" --since="yesterday" --pretty=format:'%h %s'\` across the repos in {{repo_paths}}. Collect commits and the files touched.

## Step 2
Pull my open PRs and any PRs where I'm a reviewer (use \`gh pr list --author=@me\` and \`gh pr list --search="review-requested:@me"\`).

## Step 3
Write a 3-bullet standup update:
- **Yesterday**: what I shipped, anchored to commits/PRs (no speculation).
- **Today**: what I plan to do, based on open PRs and current branch.
- **Blockers**: only if visible in the data; otherwise say "None".

Save to \`standup-$(date +%Y-%m-%d).md\` in the repo root.`
  },
  {
    name: 'Weekly review',
    format: 'recipe',
    domain: 'productivity',
    tags: ['weekly', 'review'],
    description: 'Synthesize the week from git, PRs, and notes into a Friday wrap-up.',
    body: `# Weekly review

## Step 1
Collect this week's git activity across {{repo_paths}} (\`git log --since="7 days ago" --author="$(git config user.email)"\`), my merged PRs, my open PRs, and PRs I reviewed.

## Step 2
Read any notes I made this week in {{notes_path}}.

## Step 3
Draft a weekly review with sections:
- **Shipped**: concrete user-visible outcomes.
- **In flight**: what's open and where it is.
- **Learned**: 1-3 things worth remembering.
- **Wins**: small or large, list them.
- **Drag**: what slowed me down.
- **Next week's top 3**: single-sentence each, tied to outcomes.

Save to \`reviews/week-$(date +%Y-%m-%d).md\`.`
  },
  {
    name: 'Release readiness check',
    format: 'recipe',
    domain: 'dev',
    tags: ['release', 'workflow'],
    description: 'Verify changelog, migrations, feature flags, tests, docs before tagging.',
    body: `# Release readiness check

## Step 1
List commits since the last tag (\`git log $(git describe --tags --abbrev=0)..HEAD --pretty=format:'%h %s'\`). Group by Added / Changed / Fixed / Removed.

## Step 2
Check the changelog file (CHANGELOG.md or equivalent). Does it cover every user-visible change since the last tag? Diff and list anything missing.

## Step 3
Scan diffs for: schema migrations, new feature flags, new env vars, breaking API changes. List each with the file and the upgrade note required.

## Step 4
Run the full test suite. If it fails, stop and report.

## Step 5
Print a release-go/no-go checklist with each item ticked or flagged. End with a clear ✅ ready or ❌ block reasons.`
  },
  {
    name: 'PR review pass',
    format: 'recipe',
    domain: 'dev',
    tags: ['pr', 'review'],
    description: 'Pull a PR diff → high-signal review → post comment-ready notes.',
    body: `# PR review pass

## Step 1
Fetch the diff for {{pr_url_or_number}} (\`gh pr diff\`). Skim the description and linked issues.

## Step 2
Review with this priority: bugs > security > broken contracts > missing tests > performance regressions > readability. Skip style and naming preferences unless they hide intent.

## Step 3
For each finding output:
- **File:line**: short title
- One-sentence "why it matters"
- Suggested change (code snippet if small)
- Severity (Blocker / Major / Minor / Question)

## Step 4
End with a 2-sentence overall summary and a recommendation: Approve / Approve with comments / Request changes.

Save to \`reviews/pr-{{pr_url_or_number}}.md\`.`
  },
  {
    name: 'Bug repro + fix proposal',
    format: 'recipe',
    domain: 'dev',
    tags: ['bug', 'debug'],
    description: 'Reproduce a bug → minimal failing test → 1-3 fix proposals.',
    body: `# Bug repro + fix proposal

## Step 1
Read the bug report: {{bug_report_or_url}}. Identify the smallest steps to reproduce.

## Step 2
Locate the relevant code. Map the data flow from the user input to where the bug manifests.

## Step 3
Write the smallest possible failing test that captures the bug. Run it; confirm it fails for the right reason.

## Step 4
Propose 1-3 fixes. For each: scope of change, risk, whether it addresses root cause or symptom. Do NOT apply yet.

## Step 5
Wait for me to pick. Then apply only the chosen fix and re-run the failing test plus the surrounding test file.`
  },
  {
    name: 'Dependency upgrade sweep',
    format: 'recipe',
    domain: 'dev',
    tags: ['deps', 'upgrade'],
    description: 'Find outdated deps → categorize by risk → propose batched upgrades.',
    body: `# Dependency upgrade sweep

## Step 1
Run the project's outdated-dependency check (\`npm outdated\`, \`pnpm outdated\`, \`pip list --outdated\`, etc.). List current vs latest.

## Step 2
Categorize each by risk:
- **Patch**: safe to batch.
- **Minor**: usually safe; check changelog.
- **Major**: needs migration; never batch.

Cite the changelog or release notes URL for each major.

## Step 3
Propose 2-3 upgrade batches, smallest risk first. Each batch: list of packages + estimated test impact.

## Step 4
Apply the first (lowest risk) batch only. Run tests. If green, prompt me before continuing to the next batch.`
  },
  {
    name: 'Repo onboarding notes',
    format: 'recipe',
    domain: 'dev',
    tags: ['onboarding'],
    description: 'Walk a new repo → produce a 1-page "how this codebase works" note.',
    body: `# Repo onboarding notes

## Step 1
Read README, package manifest, and the top-level folder structure.

## Step 2
Identify entry points (main, server, CLI, app shell) and how data flows from input to output.

## Step 3
Spot conventions: testing framework, lint rules, state management, styling approach, build pipeline.

## Step 4
Write a one-page note with sections:
- **What this repo does**: 2 sentences.
- **How it's organized**: top folders + their role.
- **Entry points**: where to start reading.
- **Conventions to follow**: testing, naming, state, styling.
- **Surprises / gotchas**: things that took >10 min to figure out.
- **Open questions**: things I still don't understand.

Save to \`onboarding.md\` in the repo root.`
  },
  {
    name: 'Design QA before handoff',
    format: 'recipe',
    domain: 'ux-design',
    tags: ['handoff', 'qa'],
    description: 'Component spec → a11y check → states check → handoff checklist.',
    body: `# Design QA before handoff

## Step 1
Pull the design source / link for {{screen_or_component}}. Note the primary task it supports.

## Step 2
Run a component spec pass: anatomy, props/variants, states (default / hover / focus / active / disabled / loading / error), tokens used.

## Step 3
Run an accessibility pass: semantics, keyboard, focus, contrast (both modes), touch targets, screen-reader names.

## Step 4
Run a state design check: empty / loading / error / success states are all designed. List any missing.

## Step 5
Produce a handoff checklist with each item ✅ ready or ❌ blocker, plus a "what engineering should know" note (2-3 bullets). Save to \`handoff/{{screen_or_component}}.md\`.`
  },
  {
    name: 'Interview kit',
    format: 'recipe',
    domain: 'ux-research',
    tags: ['interview', 'kit'],
    description: 'Research plan → screener → guide → invite copy in one pass.',
    body: `# Interview kit

## Step 1
Draft the one-page research plan for {{study_topic}}. Include the decision it informs, research question, method, N, segments, timeline, and success criteria.

## Step 2
Draft the recruitment screener: must-have criteria, exclusion criteria, screener questions, quota logic, red flags.

## Step 3
Draft the interview guide: 2 warm-ups, 5-7 open behaviour-first questions with 3 probes each, 1 reflection wrap-up. Total ≤ 30 min.

## Step 4
Draft the invite message + consent + incentive language.

## Step 5
Save the full kit to \`research/{{study_topic}}/kit.md\` with H2 sections for plan / screener / guide / invite.`
  },
  {
    name: 'Notes → readout',
    format: 'recipe',
    domain: 'ux-research',
    tags: ['synthesis', 'readout'],
    description: 'Raw interview notes → synthesis → stakeholder readout outline.',
    body: `# Notes → readout

## Step 1
Read raw notes in {{notes_path}}. Confirm participant count and date range.

## Step 2
Synthesize: themes (4-7) with one-line definitions + 2-3 supporting verbatim quotes (P# id) + confidence (Low/Med/High). Flag tensions, surprises, segment differences. Anti-hallucination: every theme must cite ≥ 1 quote.

## Step 3
Extract opportunity areas (problems framed for product/design, not solutions) and gaps (what we still cannot answer).

## Step 4
Outline a stakeholder readout: headline · what we studied · top 3 findings (with evidence + confidence) · implications · decisions needed · next steps. Suggest a slide title for each section.

## Step 5
Save synthesis to \`research/{{study_topic}}/synthesis.md\` and outline to \`research/{{study_topic}}/readout.md\`.`
  },
  {
    name: 'PRD from a notion of an idea',
    format: 'recipe',
    domain: 'product',
    tags: ['prd', 'spec'],
    description: 'Rough idea → problem → options → recommendation → success metrics.',
    body: `# PRD from a notion of an idea

## Step 1
Restate {{idea}} in one sentence. Confirm the user it serves and the JTBD it addresses.

## Step 2
Frame the problem: who hurts, when, why now, evidence. Cut anything not anchored to a real user.

## Step 3
Generate 3 solution options. For each: one-line summary, who it helps most, what it leaves on the table.

## Step 4
Recommend one. Justify in 3-5 bullets tied to user impact + cost. Name explicit non-goals.

## Step 5
Define success metrics: leading + lagging. Add risks + open questions.

## Step 6
Save the full PRD to \`prds/{{idea_slug}}.md\` as a one-pager.`
  },
  {
    name: 'Launch announcement bundle',
    format: 'recipe',
    domain: 'docs',
    tags: ['launch', 'announce'],
    description: 'Single launch → changelog + slack + email + tweet + docs note.',
    body: `# Launch announcement bundle

## Step 1
Look at the diff between the last release tag and HEAD. Summarize the user-visible change in 2 sentences.

## Step 2
Draft a changelog entry under Added / Changed / Fixed (no internal-only refactors).

## Step 3
Draft a Slack post: 🚀 title · 1 sentence on what · 1 sentence on why it matters · docs link · cc owner. Warm tone, no hype words.

## Step 4
Draft a customer email (≤ 150 words): hook, what's new, primary action, link.

## Step 5
Draft a tweet / social post (≤ 240 chars). One sharp line, one link.

## Step 6
Draft a help-doc update bullet (what to add or amend, where).

## Step 7
Save all 5 drafts to \`launches/{{feature}}.md\` with H2 sections.`
  },
  {
    name: 'Inbox zero pass',
    format: 'recipe',
    domain: 'productivity',
    tags: ['inbox', 'workflow'],
    description: 'Triage inbox → schedule → reply templates → follow-up reminders.',
    body: `# Inbox zero pass

## Step 1
Read the inbox dump in {{inbox_paste_or_path}}. Group items into: Act now (≤ 2 min) · Schedule · Waiting on others · Archive.

## Step 2
For each "Act now" item, draft a 1-2 sentence reply.

## Step 3
For each "Schedule" item, propose a slot (today / this week / next week) and a duration.

## Step 4
For each "Waiting on others" item, draft a 1-line nudge to send if no reply in 3 days.

## Step 5
Output a single Markdown plan with sections per category and an explicit "Archive these" list. Save to \`inbox/$(date +%Y-%m-%d).md\`.`
  }
]
