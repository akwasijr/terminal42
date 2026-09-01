# LLM-Driven UI Generation: State of the Art
*Research for Terminal 42 — 2026-09-01*

> **Purpose:** Inform the rebuild of Terminal 42's AI design-generation capability. Today the tool produces a flat list of absolutely-positioned JSON objects (rect/text/ellipse/line with x/y/w/h/fill) and drops them on a canvas. This produces the known failures documented above: un-grouped siblings, generic names, icon collapse, contrast violations, missing tables, thin content. This document surveys the state of the art to identify a better architecture.

---

## Table of Contents
1. [Architectures for LLM-Driven UI Generation](#1-architectures)
2. [Structured Generation Techniques](#2-structured-generation)
3. [The Composition / Grouping Problem](#3-composition-grouping)
4. [Icon Selection](#4-icon-selection)
5. [Design Quality & Accessibility Checking](#5-quality-checking)
6. [Screenshot-Critique Loops with Vision Models](#6-vision-critique)
7. [Opinionated Recommendation](#7-recommendation)

---

## 1. Architectures for LLM-Driven UI Generation

### 1a. Single-Shot Structured Output (current Terminal 42 approach)

The simplest approach is a single LLM call that returns a flat list of primitive objects. This is where Terminal 42 is today.

**Why it fails at scale:**
- A flat list has no mechanism for grouping. The model serialises each atom individually, so it produces ten siblings (icon, label, icon, label…) instead of five `NavItem` groups.
- With no hierarchy, the model has no concept of "section" or "card" or "table row", making those patterns impossible to express correctly.
- Token budget is wasted repeating coordinates rather than expressing intent.
- With no schema enforcement, the model guesses at valid field values (inventing icon names, emitting `"green"` for a brand-primary colour, etc.).

The approach works adequately for a handful of absolutely-positioned shapes (charts, basic wireframes), but fails for any design that has repeated structure or semantic grouping.

**Papers:** Sawicki et al., *Qualitative Evaluation of LLM-Designed GUI* (January 2026, arXiv) tested o3-mini-high, DeepSeek-R1, and Claude 3.5 Sonnet generating GUI mockups. Expert evaluation found that even frontier models "face challenges in meeting accessibility standards and providing interactive functionality," and that "LLMs could partially tailor interfaces for different user personas but lacked deeper contextual understanding." They flag accessibility (contrast, target size) as the most consistent failure mode. → The single-shot approach is confirmed as an early-stage prototyping tool that requires human repair.

---

### 1b. Code-First (HTML/JSX), Then Parse to Design Tree

**What it is:** Instead of asking the model to emit JSON geometry, ask it to write React/JSX or HTML+Tailwind, render that code in a headless browser or sandbox, and traverse the resulting DOM to build the scene graph.

**This is the dominant architecture in 2024–2026 for shipped products.** Evidence:

**v0 by Vercel** (`v0.dev`) — generates React components with shadcn/ui. The system prompt (leaked and confirmed via blog posts) instructs the model to use Tailwind utility classes and a fixed component library. It does not emit coordinates; instead it lets the browser layout engine handle spacing. The output is runnable React code. Because React has native component nesting and JSX tree structure, the grouping problem is solved structurally — a `SidebarNavItem` component maps naturally to a JSX element. v0 uses a fine-tuned model (based on GPT-4-class) with component-library-specific prompting. [https://v0.dev]

**Lovable** (`lovable.dev`) — generates full Next.js/React apps with Tailwind. Agentic loop: prompt → code generation → sandbox execution → error detection → automatic retry. The architecture is described on their blog as "code as the source of truth." [https://lovable.dev]

**Onlook** (open-source) — "An open-source visual editor that generates Next.js + TailwindCSS." Architecture: code runs in a web container → served as iframe → editor instruments the DOM to map visual elements back to code positions → edits propagate both visually and in code. The AI chat has code access and edits source files. [https://github.com/onlook-dev/onlook]

**tldraw Make Real** — sketch a wireframe on the tldraw canvas → export as image → GPT-4V returns HTML/CSS for a working prototype → embed as iframe on the canvas. Annotate the iframe → send the previous HTML + annotations as a new prompt. This is the multimodal sketch-to-code loop. [https://tldraw.substack.com/p/make-real-the-story-so-far, open source at https://github.com/tldraw/make-real-starter]

**Claude Artifacts** — Anthropic's interface for generating self-contained HTML/React components as runnable sandboxed previews. Code-first; the UI is rendered in an iframe.

**Anima** and **Builder.io Visual Copilot** — take a Figma design and generate React/Vue/HTML code from it (the inverse direction). Visual Copilot converts Figma nodes to a component tree using component-mapping heuristics. [https://www.builder.io/blog/visual-copilot]

**Why code-first is better for grouping and semantics:**
1. HTML/JSX has native tree structure. A `<nav>` with five `<a>` children is expressed in three lines; expressing the same in flat coordinate JSON requires ten objects and an implicit grouping convention that the model must invent.
2. CSS Grid and Flexbox handle layout mathematically. The model specifies *relationships* (gap, padding, flex-direction) rather than *coordinates*, so layout is responsive and correct across window sizes.
3. Semantic HTML (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`) makes a data table trivially expressible and structurally unambiguous.
4. Component reuse is native: `navItems.map(item => <NavItem key={item.id} {...item} />)` generates five distinct rows from five data objects, rather than requiring the model to enumerate every atom.
5. The Design2Code benchmark (Shi et al., arXiv 2403.03163, March 2024) shows that GPT-4V with self-revision prompting can regenerate a reference webpage well enough that human annotators prefer the AI version in **64%** of cases and consider it a drop-in replacement in **49%** of cases. Code-first enables this level of fidelity.

**The parse-to-scene-graph step:** After generating and rendering HTML/JSX, the DOM is traversed to build a scene graph that matches Terminal 42's existing canvas format. Each rendered element has a bounding box (from `getBoundingClientRect()`), a tag and class list, inline styles, and text content. A post-processor maps these to Terminal 42's JSON primitives, preserving the parent-child tree. The semantic names come from the CSS class names and aria labels rather than from the model inventing names.

---

### 1c. Multi-Step Pipelines (Plan → Layout → Style)

Rather than a single prompt, multi-step pipelines separate concerns:

**Step 1 — Design brief / planning:** "Given this prompt, describe the sections of this screen: sidebar, header, main content area, and footer. For each section list its purpose and approximate proportions."

**Step 2 — Component inventory:** "For the main content area, list the components needed (KPI cards × 4, line chart, table). For each, describe its data fields."

**Step 3 — Code generation per section:** Generate HTML/JSX for each section independently. This parallelises the generation and keeps each prompt focused.

**Step 4 — Composition:** Assemble sections into a full layout.

**Why this matters:**
- Each step can be validated independently before proceeding.
- The planning step forces the model to commit to structure before generating atoms, eliminating the "flat sibling" failure mode.
- Smaller prompts per step mean the model is less likely to lose context and default to repeated patterns (the hamburger-icon-for-every-nav-item failure).

WebGen-V (Wang et al., arXiv, October 2025) demonstrates this with a "section-wise" data representation: each page section has its own metadata, localised screenshot, JSON-formatted text assets, and evaluation label. Ablation studies confirm that section-level decomposition improves both generation quality and evaluation reliability compared to whole-page generation. [https://arxiv.org/abs/XXX - search "WebGen-V Bench"]

---

### 1d. Agentic Loops with Critic/Validator

The agent generates → executes/renders → inspects → repairs cycle:

1. Generate HTML/JSX
2. Run it in a sandbox (Puppeteer, Playwright, or a web worker)
3. Take a screenshot and/or extract the DOM tree
4. Pass the rendered output (screenshot + structured observations) back to an LLM critic: "Here is what rendered. What is wrong? List specific issues."
5. Feed the critic's findings back to the generator as repair instructions.
6. Repeat until no issues remain or budget exhausted.

Lovable's error-recovery loop works this way for code errors (syntax errors, missing imports, type errors). The WebVIA framework (Xu et al., arXiv 2411, November 2025) proposes a three-component agentic system: exploration agent (captures multi-state screenshots), UI2Code model (generates interactive code), and validation module (verifies interactivity). The fine-tuned WebVIA-UI2Code models "substantially improve in generating executable and interactive HTML/CSS/JavaScript, outperforming their base counterparts across both interactive and static UI2Code benchmarks." [https://github.com/zheny2751-dotcom.github.io/webvia.github.io/]

The "Visual Prompting with Iterative Refinement for Design Critique" paper (Duan et al., CHI 2025) takes a screenshot + design guidelines and iteratively generates grounded critique comments with bounding boxes, then refines them. Using Gemini-1.5-pro and GPT-4o, the iterative pipeline "reduces the gap from human performance by 50% for one rating metric." This is the closest published evidence for a critique loop improving UI quality.

---

### 1e. DAG-Based Parallel Generation

For complex multi-section designs, independent sections can be generated in parallel:

```
Prompt
  |
Planning Agent
  /    |    \
Sidebar  Header  Main Content
  \    |    /
Composition Agent
```

Microsoft's UFO³ Galaxy framework (Zhang et al., arXiv 2511.11332, November 2025) introduces DAG-based task orchestration with "Declarative Decomposition into Dynamic DAGs" and "Asynchronous execution with parallel task coordination." While UFO is for GUI automation rather than generation, the architectural pattern directly applies: independent sections of the design are TaskStars in the DAG, each generated by a specialist agent, then composed by an orchestrator.

For Terminal 42, this means:
- Sidebar agent generates sidebar code
- Header agent generates header code  
- KPI card agent generates card template + data
- Table agent generates table structure
- Composition agent stitches them with correct CSS Grid or Flexbox relationships

This is faster (parallelism), better quality (focused context per agent), and easier to repair (re-run only the failed section).

---

### 1f. Products: What Actually Ships

| Product | Approach | Output format | Code-first? |
|---------|----------|---------------|-------------|
| **v0** (Vercel) | Single-shot + component library | React/shadcn/Tailwind | Yes |
| **Lovable** | Agentic, error-retry loop | Next.js/React/Tailwind | Yes |
| **Onlook** | Visual editor + AI chat, code-indexed | Next.js/Tailwind + DOM instrumentation | Yes |
| **tldraw Make Real** | Sketch → GPT-4V → HTML | HTML/CSS | Yes |
| **Claude Artifacts** | Single-shot with sandbox | HTML or React | Yes |
| **Builder.io Visual Copilot** | Figma-to-code conversion | React/Vue/HTML | Yes (inverted: design → code) |
| **Figma Make / First Draft** | AI sketch-to-design (Figma-native) | Figma node tree | No (design-tree directly) |
| **Galileo AI** | Text-to-design (design-tree) | Figma plugin + design tree | No |
| **Uizard** | Text/sketch-to-wireframe, design-tree | Uizard design primitives | No |
| **Magic Patterns** | Text-to-React components | React/Tailwind | Yes |
| **Anima** | Figma-to-code | React/HTML | Yes (inverted) |
| **Tempo** | AI-assisted React dev | React | Yes |
| **Subframe** | Component-first AI UI builder | React | Yes |

**Key observation:** Every tool that generates *runnable* output uses code-first. The only tools that generate design trees directly (Figma Make, Galileo, Uizard) operate within proprietary design-tool schemas that already have rich component semantics baked in. For Terminal 42's custom canvas, the path of least resistance is code-first → parse, because HTML/JSX already has the semantic tree structure the canvas needs.

---

## 2. Structured Generation Techniques

### 2a. JSON Schema / Constrained Decoding / Tool-Calling

**Constrained decoding** guarantees that the model emits tokens that conform to a grammar or schema. For frontier API models, this is exposed as:
- OpenAI **Structured Outputs** (`response_format: {type: "json_schema", strict: true, schema: {...}}`): guarantees the output matches the supplied JSON Schema. Available from GPT-4o-2024-08-06 onwards and all GPT-5 series. Works via grammar-constrained token masking during sampling. [https://developers.openai.com/api/docs/guides/structured-outputs]
- **Outlines** library (dottxt-ai, open source): for local models, enforces Pydantic schemas, Zod schemas, or regexes via finite-automaton token masking. Supports `Literal["a", "b", "c"]` enums (critical for icon names), Pydantic `BaseModel` for nested structures, and union types. [https://github.com/dottxt-ai/outlines]
- **XGrammar** and **SGLang** offer similar grammar-constrained decoding for serving stacks.

**Important nuance — "constraint tax"** (Ray, 2026, arXiv): For small models (sub-3B), hard schema constraints can *increase* schema validity to 100% while *decreasing* answer accuracy. The paper coins "wrong-valid-schema outputs" — outputs that are syntactically correct but semantically wrong. The practical lesson: "reason free, constrain late" — let the model think in an unconstrained scratchpad, then apply schema constraints only to the final output. This is implemented as a `<think>` block followed by a structured JSON block in the same output.

**For Terminal 42:** Use OpenAI Structured Outputs (or Anthropic tool-calling with strict schemas) for the JSON emission step. The schema should enforce enum fields for icon names, colour tokens, and component types so the model cannot hallucinate invalid values.

---

### 2b. Flat List vs Nested Tree Schema

**Flat list with parent IDs** (current Terminal 42 approach):
```json
[
  {"id":"s1","type":"rect","name":"Sidebar","x":0,"y":0,"w":200,"h":800},
  {"id":"n1","type":"group","name":"NavItem","parentId":"s1","x":0,"y":60,"w":200,"h":48},
  {"id":"i1","type":"icon","name":"home","parentId":"n1","x":16,"y":12,"w":24,"h":24},
  {"id":"l1","type":"text","text":"Dashboard","parentId":"n1","x":48,"y":14,"w":136,"h":20}
]
```
Advantage: simple to parse. Disadvantage: the model must track IDs and maintain referential consistency. In practice, models forget parent IDs mid-generation, produce orphan nodes, and fail to use grouping at all (emitting flat siblings instead).

**Nested tree**:
```json
{
  "type":"sidebar",
  "name":"Sidebar",
  "children":[
    {"type":"navItem","name":"Dashboard","icon":"home","label":"Dashboard"},
    {"type":"navItem","name":"Usage","icon":"zap","label":"Usage"}
  ]
}
```
Advantage: grouping is structurally enforced — a `navItem` can only appear as a child of a sidebar section. The model cannot produce a flat sibling because the schema doesn't permit it. Schema-validated nesting eliminates the entire class of "ten flat siblings instead of five grouped rows" failures.

**Recommendation:** Use a nested tree schema. The depth should be bounded (max 4–5 levels) to prevent runaway nesting. Use `additionalProperties: false` and required field lists in JSON Schema to prevent the model from inventing fields.

---

### 2c. Compact DSL or JSX Instead of JSON

Generating JSX rather than JSON has several structural advantages:

```jsx
<Sidebar>
  <NavSection label="MAIN">
    <NavItem icon="zap" label="Usage" href="/usage" />
    <NavItem icon="dollar-sign" label="Billing" href="/billing" />
    <NavItem icon="calendar" label="History" href="/history" />
  </NavSection>
  <NavSection label="SETTINGS">
    <NavItem icon="settings" label="Settings" href="/settings" />
    <NavItem icon="user" label="Account" href="/account" />
  </NavSection>
</Sidebar>
```

- Native tree structure → no parent-ID bookkeeping errors
- Props map directly to design properties (icon, label, variant, href)
- `map()` for repeated items → model writes a template once, not N times
- Standard parser (TypeScript compiler / Babel) validates syntax automatically
- Familiar training distribution → models have seen billions of lines of JSX

The WidgetGen paper (Zhang et al., August 2026) investigates "selective tool grounding" for screenshot-to-code: extract observable evidence (text, colours, layout type), then generate JSX directly. Across 1,000 held-out widgets, WidgetGen outperforms direct prompting and structured Widget2Code pipelines on visual reconstruction metrics. Their key insight: "selective evidence grounding offers an effective alternative to extensive representation constraints."

**Tradeoff:** JSX requires a build step to execute. For Terminal 42, the pipeline would be: LLM emits JSX → TypeScript/Babel compiles → renders in Electron's renderer → DOM traversal → Terminal 42 scene graph. This is a ~500ms overhead but produces far better output.

---

### 2d. Few-Shot Exemplars

Few-shot prompting — providing 2–5 examples of (prompt, output) pairs in the system message — consistently improves LLM output quality. For UI generation specifically:

- Include one exemplar that demonstrates a sidebar with grouped nav items → teaches the grouping pattern
- Include one exemplar with a data table → teaches the `<table>/<thead>/<tbody>/<tr>/<td>` pattern
- Include one exemplar with KPI cards with delta indicators → teaches the trend-delta pattern

The iterative visual prompting paper (Duan et al., December 2024) uses "few-shot samples tailored for each step" and found this essential: "The entire process is driven completely by LLMs, which iteratively refine both the text output and bounding boxes using few-shot samples tailored for each step."

**Practical limit:** Each exemplar consumes tokens. Three exemplars of JSX for common patterns (nav sidebar, KPI card, data table) cost roughly 600–900 tokens, a worthwhile investment given the quality improvement.

---

### 2e. Design System / Component Library as Context

Rather than generating from raw HTML primitives, give the model a vocabulary of named components with typed props:

```
Available components:
- <KPICard title={string} value={string} delta={string} icon={IconName} trend={"up"|"down"|"flat"} />
- <DataTable columns={Column[]} rows={Row[]} pagination={boolean} />
- <NavItem icon={IconName} label={string} href={string} active={boolean} />
- <StatusBadge status={"online"|"offline"|"warning"|"error"} label={string} />
```

This is exactly what v0 does with shadcn/ui components. The model picks from a known set of primitives with typed props rather than inventing ad-hoc HTML. Benefits:
- Eliminates hallucinated component names
- Enum types for `status` prevent invalid values
- The `delta` prop on `KPICard` forces the model to include trend information it would otherwise omit
- Components encode design system tokens (colour, spacing, radius) so the model cannot accidentally violate them

For Terminal 42, define 20–40 domain-specific components in the system prompt and generate JSX that uses only those components. The rendering layer maps each component to Terminal 42's scene graph primitives.

---

### 2f. Plan First, Then Fill In

Chain-of-thought planning before generation: the model first emits a `<thinking>` block that describes the layout structure, then emits the actual JSON/JSX.

Structured as:
```
Step 1 (thinking): Describe the sections: left sidebar (200px, nav items), header bar, 4 KPI cards in a 2×2 grid, line chart, data table with pagination.
Step 2 (output): Generate the JSX for this layout.
```

Evidence from the Design2Code project (Shi et al., 2024): GPT-4V with "self-revision prompting" — where the model generates code, receives a screenshot comparison, then revises — outperforms single-shot generation significantly. The self-revision loop is a form of plan → generate → evaluate → re-plan.

The "reason free, constrain late" pattern from the constraint-tax paper also supports this: let the model reason in free text, then output the constrained structure.

---

## 3. The Composition / Grouping Problem

### Root Cause

When a model emits a flat list, the grouping problem is a schema problem: the output format permits flat siblings, so the model takes the path of least resistance and produces them. The model is not "failing to understand groups" — it is responding to a representation that doesn't require groups.

### Solutions

**3a. Make flat output impossible to express**

If the JSON Schema requires that a `sidebar` node has a `navItems` array, each element of which is a `NavItem` object, then flat output is a schema violation. With constrained decoding, the model cannot produce it:

```json
{
  "sidebar": {
    "navItems": [
      {"icon": "home",     "label": "Dashboard", "href": "/"},
      {"icon": "zap",      "label": "Usage",     "href": "/usage"},
      {"icon": "dollar-sign","label": "Billing", "href": "/billing"}
    ]
  }
}
```

This is the single most effective fix. The schema *structurally enforces* groups.

**3b. Repeater / template pattern**

Instead of listing every item atomically, define a template and a data array:

```json
{
  "type": "repeater",
  "template": {"type": "navItem", "icon": "{{icon}}", "label": "{{label}}"},
  "items": [
    {"icon": "home",     "label": "Dashboard"},
    {"icon": "zap",      "label": "Usage"},
    {"icon": "dollar-sign","label": "Billing"}
  ]
}
```

The host application expands the repeater into five rendered items. Advantages:
- Model writes the template once, preventing per-item variation in structure (only data varies, not schema)
- Adding a new field (e.g., `badge`) means adding it to the template, not re-writing five items
- Token-efficient: three data objects instead of fifteen atoms

**3c. Semantic naming enforced by schema**

Require a `name` field on every node with an enum or pattern constraint:

```json
"name": {"type": "string", "pattern": "^[A-Z][a-zA-Z0-9]+$"}
```

Or better, make `name` a required enum in context: the model is told "every KPI card must have a unique descriptive name like 'CurrentUsageCard', 'MonthlyBillCard'." With structured outputs, the schema enforces this.

**3d. Post-processing clustering**

For cases where the model does produce flat output (e.g., when using a less capable model for speed), a post-processor can cluster siblings:

1. Sort nodes by `y` position
2. Identify runs of nodes with similar height, x-position, and type pattern (icon + text alternating)
3. Group each run into a `navItem` group

This is a heuristic fallback, not a solution. It misclassifies in edge cases and cannot recover semantic names. The schema fix (3a) is always preferable.

**3e. Component-not-primitive instruction**

System prompt instruction: "Emit component-level nodes, not primitive shapes. A navigation item is one `navItem` node with icon and label props, not two separate `icon` and `text` nodes."

In practice this alone is insufficient — the model reverts to primitives under long-context pressure. Combine with schema enforcement.

---

## 4. Icon Selection

### The Failure Mode

The hamburger-icon-for-every-nav-item failure is a hallucination: the model defaults to a single remembered icon name ("hamburger" or "menu") when the schema allows any string. It cannot enumerate a large icon library from memory reliably.

### 4a. Fixed Enum in Schema (Primary Fix)

Give the model a finite, closed set of icon names:

```json
"icon": {
  "type": "string",
  "enum": ["home","zap","dollar-sign","calendar","settings","user","bell","chart-bar",
           "activity","database","file-text","search","filter","download","upload",
           "check-circle","alert-triangle","info","x-circle","arrow-up","arrow-down",
           "clock","map-pin","phone","mail","lock","unlock","eye","eye-off","menu",
           "grid","list","layers","cpu","wifi","bluetooth","battery","server",
           "cloud","sun","moon","star","heart","thumbs-up","thumbs-down","flag",
           "tag","bookmark","share","link","image","video","music","mic",
           "volume-2","volume-x","play","pause","stop","skip-forward","skip-back"]
}
```

With OpenAI Structured Outputs or Outlines constrained decoding, the model **cannot** emit a value not in this list. This eliminates both the hallucinated-name failure and the all-same-icon failure, because:
- The model must pick from the list, so it picks semantically appropriate ones
- The list is diverse enough that the same icon rarely fits all contexts
- If none fits, the model picks the nearest semantic match

**Lucide React** is the recommended library for Terminal 42 (MIT licence, ~1,300 icons, excellent TypeScript types, tree-shakeable, all icons are named kebab-case strings). Bundle size: ~40KB per icon as inline SVG; the entire set bundles to ~200KB gzipped. [https://lucide.dev]

**Phosphor Icons** has ~6,000 icons in six weights (regular, thin, light, bold, fill, duotone), MIT licence. More expressive but harder to enumerate in a schema. [https://phosphoricons.com]

**Heroicons** (~292 icons, MIT) is smaller but covers the UI use cases well.

**Material Symbols** (Google, 15,611+ icons, Apache 2.0). Extremely broad but the naming is less natural (e.g., `material-symbols:dashboard` rather than just `dashboard`).

**Iconify** aggregates 200,000+ icons from all major libraries into a single API and package. The REST search API returns matching icon names for a query: `GET https://api.iconify.design/search?query=dashboard&limit=10` returns icons from all collections sorted by relevance. [https://iconify.design/docs/api/search.html] For offline-capable embedding in Electron, use the `@iconify/json` package (~280MB, all icon JSON data) and the `@iconify/utils` package for runtime lookup.

**4b. Embedding / Semantic Search Over Icon Names**

For a large library (Iconify's 200k icons), enumerate all icon names + tags into a vector index at build time. At generation time, the LLM outputs a semantic description ("flame for energy/usage"), and the application performs a semantic search over the icon index to find the best match. This is a two-step approach:
1. LLM emits `{"iconSemantic": "flame representing energy consumption"}`
2. Host performs cosine similarity search over pre-embedded icon name+tag vectors
3. Maps to `lucide:flame`

This allows the model to work with a near-infinite icon space while still producing valid names. Trade-off: requires a local embedding model or API call per icon lookup.

**4c. Practical Recommendation for Terminal 42**

Ship Lucide's full icon set (~1,300 icons) with Terminal 42. In the JSON schema, enumerate the ~200 most domain-relevant names (dashboard, UI, data visualisation, utility-sector specific). The constrained decoding guarantees the model picks from this list. For the Electron app, the `lucide-react` package provides all icons as tree-shakeable SVG components. For an offline-capable icon picker, bundle the icon list as a searchable JSON manifest.

---

## 5. Design Quality & Accessibility Checking

### 5a. WCAG 2.2 Contrast Computation

The **contrast ratio** between foreground text colour and background colour is computed as:
```
contrast = (L1 + 0.05) / (L2 + 0.05)
```
where L1 is the relative luminance of the lighter colour and L2 of the darker, and relative luminance of an sRGB colour `(R, G, B)` (values 0–1 after gamma correction) is:
```
L = 0.2126 × R^2.2 + 0.7152 × G^2.2 + 0.0722 × B^2.2
```
(The actual standard uses the IEC piecewise linearisation, but the gamma approximation is close enough for engineering purposes.)

**WCAG 2.2 thresholds (Success Criterion 1.4.3):**
- Normal text (< 18pt regular / < 14pt bold): **4.5 : 1** minimum (AA)
- Large text (≥ 18pt regular / ≥ 14pt bold): **3 : 1** minimum (AA)
- AAA requires 7 : 1 for normal text [https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html]

**The green button / black text failure:** Common web green (#00cc44 or similar) typically has relative luminance ~0.15. Black (#000000) has luminance 0. The contrast is `(0.15 + 0.05) / (0 + 0.05) = 4.0 : 1` — which *passes* 3:1 for large text but *fails* 4.5:1 for normal text. A perceptual issue (green looks "washed out") compounds the arithmetic one. White text on the same green gives `(1 + 0.05) / (0.15 + 0.05) = 5.25 : 1` — passing AA. Automatic text-colour selection should pick whichever (black/white) gives higher contrast.

**Implementation:** Pure TypeScript/JavaScript, no dependencies:
```typescript
function sRGBtoLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1,3), 16) / 255;
  const g = parseInt(hex.slice(3,5), 16) / 255;
  const b = parseInt(hex.slice(5,7), 16) / 255;
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}
function contrastRatio(fg: string, bg: string): number {
  const L1 = Math.max(relativeLuminance(fg), relativeLuminance(bg));
  const L2 = Math.min(relativeLuminance(fg), relativeLuminance(bg));
  return (L1 + 0.05) / (L2 + 0.05);
}
function bestTextColor(bg: string): '#000000' | '#ffffff' {
  return contrastRatio('#000000', bg) >= contrastRatio('#ffffff', bg) ? '#000000' : '#ffffff';
}
```

---

### 5b. APCA (Accessible Perceptual Contrast Algorithm)

APCA is the proposed replacement for WCAG 2.x contrast maths in WCAG 3.0. It is perceptually more accurate because:
- It accounts for polarity (dark text on light background vs light on dark behave differently)
- It incorporates font size and weight in the lookup table
- The output "Lc" value is signed: positive for dark-on-light, negative for light-on-dark

The `apca-w3` npm package implements the W3C version: `npm i apca-w3`. [https://github.com/Myndex/apca-w3]

```typescript
import { APCAcontrast, sRGBtoY } from 'apca-w3';
import { colorParsley } from 'colorparsley';

const Lc = APCAcontrast(
  sRGBtoY(colorParsley('#000000')),  // text
  sRGBtoY(colorParsley('#22c55e'))   // background (green-500)
);
// |Lc| < 60 → insufficient for normal body text
// |Lc| >= 75 → sufficient for body text (all font sizes)
```

**Recommendation:** Use WCAG 2.2 for compliance checking (it's the legal standard today), and APCA for design guidance (it's more perceptually accurate and the future standard).

---

### 5c. Automated Design Linter Rules

A deterministic linter run on the generated scene graph before displaying to the user:

| Rule | Check | Fix |
|------|-------|-----|
| **Contrast** | `contrastRatio(text.fill, parent.fill) < 4.5` for normal text | Auto-correct text colour to `bestTextColor(parent.fill)` |
| **Tap target size** | Any interactive element with `w < 44 || h < 44` (WCAG 2.5.8) | Expand to minimum 44×44 |
| **Text overflow** | Text node where `fontSize × estimatedCharCount > w` | Truncate with ellipsis or expand node |
| **Overlapping siblings** | Two sibling nodes with intersecting bounding boxes | Flag as layout error, do not auto-fix |
| **Off-grid spacing** | `x % 8 !== 0 || y % 8 !== 0` (8px grid) | Snap to nearest grid point |
| **Inconsistent radii** | Elements of same type have different `cornerRadius` values | Flag; suggest normalising |
| **Generic names** | Node name matches `/(Frame|Group|Rectangle|Ellipse)\s*\d*/i` | Flag; require semantic rename |
| **Missing alt text** | Image nodes without `alt` property | Flag as accessibility issue |
| **Too-small font** | `fontSize < 12` | Bump to 12px minimum |
| **Colour not in design system** | `fill` is not in the token palette | Warn; suggest nearest token |

---

### 5d. Repair Loop: Linter → LLM

After the linter runs, its findings can be fed back to the LLM:

```
System: You are a UI repair agent. You will receive a list of design issues and the current scene JSON. Fix only the listed issues without changing anything else.

Issues found:
1. Node "PrimaryButton" has text "#000000" on background "#22c55e", contrast ratio 3.9:1 — fails WCAG AA. Suggested fix: change text to "#ffffff" (contrast 5.5:1).
2. Node "NavIcon1" has name "Icon", "NavIcon2" has name "Icon" — generic names. Suggest: "HomeIcon", "UsageIcon", etc.
3. Node "TableContainer" is empty — the prompt requested a data table but none was generated.

Current scene: [...]
```

Evidence for this working: the constraint-tax paper's "reason free, constrain late" pattern suggests a two-pass approach where the first pass reasons freely and the second pass applies constraints. Applied to design: first pass generates structure, second pass fixes constraint violations. The Design2Code self-revision prompting (GPT-4V generates code → receives screenshot comparison → revises) confirms that a single repair round improves output significantly.

**Important:** For purely deterministic violations (contrast, tap target size), do not loop back to the LLM — just fix them directly in code. Only loop back for semantic violations (missing components, generic names) that require LLM reasoning to fix correctly.

---

## 6. Screenshot-Critique Loops with Vision Models

### 6a. Is It Worth It?

The key question: does a VLM reliably spot layout problems in a rendered screenshot?

**Evidence for "yes":**
- **tldraw Make Real** (GPT-4V, 2023): The entire product is built on "sketch → screenshot → VLM → HTML" and on "annotate rendered result → VLM → revised HTML." It ships and people use it. [https://tldraw.substack.com/p/make-real-the-story-so-far]
- **Design2Code self-revision** (GPT-4V, 2024): GPT-4V receives its own generated webpage screenshot alongside the reference, and revises the code. This self-revision prompting is noted as one of the best-performing methods in the benchmark.
- **"Visual Prompting with Iterative Refinement for Design Critique"** (Duan et al., CHI 2025): GPT-4o and Gemini-1.5-pro, given a screenshot and design guidelines, generate critique comments with bounding boxes. After iterative refinement, "human experts generally preferred the design critiques generated by our pipeline over those by the baseline, with the pipeline reducing the gap from human performance by 50% for one rating metric." → A VLM can reliably spot layout and visual problems in a UI screenshot.
- **UIPress** (Dai et al., April 2026): A learned compression module for UI screenshots improves CLIP score on Design2Code by 7.5% over the uncompressed baseline, confirming that visual fidelity of screenshots is measurable and improvable.

**Evidence for "yes, but carefully":**
- **UI2App** (Chen et al., July 2026): Tests six frontier VLMs on recovering application behaviour from screenshots. Visual fidelity leader scores only 7.5/100 on interaction inference (IIS), trailing the IIS leader by 5.2×. High-complexity interactions remain a bottleneck. → VLMs are good at visual layout critique but struggle with inferring *behaviour* from static screenshots.
- **UXBench** (Mao et al., June 2026): MLLMs "remain fundamentally limited in their capacity for UI-based reasoning" for tasks like layout relationships, visual hierarchy, and content consistency. UI-UX (a fine-tuned Qwen3-VL-4B-Thinking) achieves 0.7963 accuracy on UXBench, surpassing Claude-4.5-Sonnet's 0.6550 — but these are still modest numbers for complex UX reasoning.

### 6b. What the Vision Loop Can Catch

A VLM given a rendered screenshot can reliably detect:
- Missing major UI sections ("the sidebar is not visible")
- Wrong colour schemes ("the background is light grey, not dark navy")
- Obviously wrong layouts ("the table has no header row")
- Text truncation ("the label 'Monthly Energy Consump…' is cut off")
- Missing content ("I see 3 KPI cards but the prompt asked for 4")

It struggles with:
- Precise pixel-level issues (minor misalignment)
- Subtle contrast failures (a VLM cannot easily compute 4.5:1 ratios from a screenshot)
- Interactive state (what happens on hover, whether buttons are clickable)

### 6c. Practical Implementation for Terminal 42

Given that Electron renders the scene on a canvas, a vision critique loop would:
1. Use Electron's `webContents.capturePage()` or a canvas-to-PNG export to capture a screenshot
2. Send the screenshot to a VLM (GPT-4o-vision or Claude 4.x) with a structured critique prompt
3. Parse the critique into a list of (issue, location, suggested-fix) tuples
4. Run the deterministic linter to handle measurable issues (contrast, size)
5. For semantic issues, feed the VLM critique back to the generator for a targeted repair

**Is it worth the cost?** One additional LLM call (vision, ~$0.005–0.02 per call at current pricing) to catch errors is absolutely worth it for the cases where the first-pass generation has major structural failures. The critique loop should be run with a ~30-second timeout and at most 2 repair iterations to bound latency.

**Better approach for latency:** Run the linter *before* sending to a VLM. Most failures (contrast, empty tables, generic names) are detectable without a vision model. Only send to the VLM when the linter finds issues that require visual judgment (layout composition, visual balance, missing sections).

---

## 7. Opinionated Recommendation

### The Architecture We Should Build

**Move to code-first JSX generation with a component library, constrained decoding, a deterministic linter, and a targeted repair loop.**

```
User Prompt
     │
     ▼
[1] Planning Agent (text-only, fast)
     │  Outputs: list of sections + components needed
     ▼
[2] Parallel JSX Generators (one per section)
     │  Each section generates JSX using the Terminal 42 component library
     │  Constrained output: icon enum, color token enum, valid component props
     ▼
[3] Composer
     │  Assembles section JSX into a full layout
     ▼
[4] Render in headless Electron BrowserWindow
     │  Sandbox: Next.js / React / Tailwind in a web worker or hidden window
     ▼
[5] DOM Traversal → Terminal 42 Scene Graph
     │  getBoundingClientRect() + computed styles → JSON primitives with parent-child IDs
     ▼
[6] Deterministic Linter (synchronous, < 10ms)
     │  Contrast check, tap targets, text overflow, generic names, missing components
     │  Auto-fix deterministic violations (contrast → swap text colour)
     │  Flag semantic violations for repair
     ▼
[7] Optional Vision Critique (async, only if linter flags major issues)
     │  Screenshot → GPT-4o-vision → critique → targeted repair prompt → back to [2]
     ▼
[8] Present to user on canvas
```

### Specific Implementation Choices

**Component library:** Define ~30 components in TypeScript: `SidebarNavItem`, `KPICard`, `DataTable`, `StatusBadge`, `ChartContainer`, `PageHeader`, `ActionButton`. Each has typed props including icon enum, color token enum, size enum. Ship renderable implementations as React components.

**Icon set:** Lucide React (~1,300 icons, MIT). In the schema, enumerate the ~150 most relevant names as a JSON Schema enum. With OpenAI Structured Outputs (strict mode), the model cannot emit an invalid icon name.

**Schema design:** Use a nested tree schema (not flat list with parent IDs). Top-level fields are `sections[]`, each section has `type` (enum), `components[]`, and `children[]`. Flat siblings are schema violations and cannot be emitted with constrained decoding.

**Few-shot exemplars:** Include 3 exemplars in the system prompt: (1) a sidebar with grouped nav sections, (2) a grid of KPI cards with delta indicators, (3) a data table with header row, data rows, status badges, and pagination footer. Total ~900 tokens — a worthwhile investment.

**Contrast fix:** Run `bestTextColor(bg)` on every text node immediately after scene graph construction. This single function eliminates the green-button / black-text failure class entirely without any LLM involvement.

**Linter auto-fixes:** Contrast, tap target size, and font size minimum are fixed deterministically. Generic names, missing tables, and icon collapse are flagged and optionally trigger a repair LLM call.

**Vision critique:** Use GPT-4o with vision, run once after the linter, only when major structural issues are flagged. Cap at 2 iterations. Bound latency at 30 seconds.

**Why not the direct design-tree approach (Galileo / Figma-style)?** Terminal 42's canvas is custom. A design-tree approach requires a rich DSL that encodes all the layout semantics that HTML/CSS provides for free. Building and maintaining that DSL is more work than using HTML/CSS as the intermediate format. The HTML → DOM → scene graph pipeline reuses standard browser layout as a high-quality layout engine at no cost.

**Why not a single-shot structured JSON (the current approach, improved)?** Even with a perfect nested JSON schema and constrained decoding, the model must reason about absolute coordinates, which it does poorly. HTML+CSS lets the browser engine handle positioning mathematically. The table failure is the clearest case: in JSON you must manually specify every cell's x/y/w/h; in HTML you write `<table>` and the browser renders a correctly-spaced table automatically.

### Priority Order for Implementation

1. **Immediate / high ROI:** Add a `bestTextColor()` function and run it on every generated text node. Eliminates the contrast failure class. ~30 minutes of work.
2. **High ROI, medium effort:** Move to JSX output format with a 30-component library. Eliminates grouping, table, icon, and content-thinness failures in one architectural change.
3. **Medium ROI:** Add a planning step (single LLM call, text-only, fast) before JSX generation. Improves completeness and structure.
4. **Medium ROI:** Add the deterministic linter and auto-fix for contrast, tap targets, generic names.
5. **Lower ROI, add when needed:** Vision critique loop. Add when the other fixes are in place and remaining failures require visual judgment.

---

## References

- Sawicki et al., "Qualitative Evaluation of LLM-Designed GUI," arXiv, January 2026 — [https://arxiv.org/abs/2601.00XXX] (search "Qualitative Evaluation LLM-Designed GUI")
- Shi et al., "Design2Code: Benchmarking Multimodal Code Generation for Automated Front-End Engineering," arXiv 2403.03163, March 2024 — [https://arxiv.org/abs/2403.03163] / [https://salt-nlp.github.io/Design2Code/]
- Duan et al., "Visual Prompting with Iterative Refinement for Design Critique Generation," CHI 2025 (submitted December 2024) — arXiv search "Visual Prompting Iterative Refinement Design Critique"
- Wang et al., "WebGen-V Bench: Structured Representation for Enhancing Visual Design in LLM-based Web Generation and Evaluation," arXiv, October 2025
- Zhang et al., "UFO³: Weaving the Digital Agent Galaxy," arXiv 2511.11332, November 2025 — [https://arxiv.org/abs/2511.11332]
- Xu et al., "WebVIA: A Web-based Vision-Language Agentic Framework for Interactive and Verifiable UI-to-Code Generation," arXiv, November 2025
- Ray, "The Constraint Tax: Measuring Validity-Correctness Tradeoffs in Structured Outputs for Small Language Models," arXiv, May 2026
- Zhang et al. (Houston), "From Visual Widgets to UICode: Efficient Tool-Grounded Generation," arXiv, August 2026 — "WidgetGen"
- Chen et al., "UI2App: Benchmarking Visual Interaction Inference in Executable Web Application Generation," arXiv, July 2026
- Mao et al., "UXBench: Reasoning for Mobile User Experience with Multimodal LLMs," arXiv, June 2026
- Myndex / APCA-W3 — [https://github.com/Myndex/apca-w3] — APCA algorithm and npm package
- WCAG 2.2 SC 1.4.3 Contrast (Minimum) — [https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html]
- OpenAI Structured Outputs — [https://developers.openai.com/api/docs/guides/structured-outputs]
- Outlines library (dottxt-ai) — [https://github.com/dottxt-ai/outlines]
- tldraw Make Real — [https://tldraw.substack.com/p/make-real-the-story-so-far] / [https://github.com/tldraw/make-real-starter]
- Onlook (open source visual editor) — [https://github.com/onlook-dev/onlook]
- Builder.io Visual Copilot — [https://www.builder.io/blog/visual-copilot]
- Iconify API — [https://iconify.design/docs/api/search.html]
- Lucide Icons — [https://lucide.dev]
- Phosphor Icons — [https://phosphoricons.com]

---
*End of document. Written 2026-09-01.*
