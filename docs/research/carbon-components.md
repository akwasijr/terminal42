# Carbon Design System Components — Implementable Reference

> Researched from https://carbondesignsystem.com/components/overview/components/ and each
> component's own Usage and Style pages. Values are taken from the documentation; anything
> the docs do not state is written as "not stated" rather than approximated.
>
> This file is assembled in parts. Components 34–41 and both appendices are below.
> Appendix A is the flat catalogue and is the checklist to implement against.


---

```markdown
7. **Counter (optional)** — character or word count; positioned below field right-aligned; updates as user types

**Password input (adds):**
8. **View icon button** — eye icon; right side of field; toggles password visibility (show/hide)

---

---

## 1. Accordion

> Sources: https://carbondesignsystem.com/components/accordion/usage/ | https://carbondesignsystem.com/components/accordion/style/

**What it is** — A vertically stacked list of headers that reveal or hide associated sections of content through progressive disclosure. Use to organise related information, shorten pages, or present long content in a confined space such as a side panel. Do not use when content is nested more than one level deep (use **Tree view** instead), when a user is likely to read all the content (use a full scrolling page with standard headers instead), or when peer-level sections need frequent switching (use **Tabs** instead).

**Variants**

| Variant | Description |
|---|---|
| **Default (end-icon)** | Chevron at the right (end) of the header row — default and preferred; keeps titles flush with body text |
| **Start-icon** | Chevron at the left (start) of the header row — for tree-like accordion behaviour; rare |

Both variants support two **alignment** modifiers:

| Alignment | Description |
|---|---|
| **Default (indented)** | 16 px left padding on title and icon; aligns to grid columns |
| **Flush** | 0 px padding on all sides; used in side panels or beside components that share divider lines |

Multiple panels may be open simultaneously by default; there is no built-in single-open (exclusive) mode.

**Sizes**

| Element | Size | Height (px / rem) |
|---|---|---|
| Header | Small (sm) | 32 / 2 |
| Header | Medium (md) | 40 / 2.5 |
| Header | Large (lg) | 48 / 3 |

Panel height: no maximum — content-driven. Panel never scrolls internally; the whole page scrolls.

Responsive right-margin for body copy inside panels:

| Accordion width | Margin-right | Spacing token |
|---|---|---|
| > 640 px | 25% | — |
| 420–640 px | 64 px / 4 rem | `$spacing-10` |
| < 420 px | 16 px / 1 rem | `$spacing-05` |

**States**

| State | Description |
|---|---|
| **Collapsed** | Default; chevron points down; panel hidden |
| **Expanded** | Chevron points up; panel content visible |
| **Hover** | Header background-color changes |
| **Focus** | 2 px border outline on header |
| **Disabled** | Header border muted; title and icon use disabled tokens; not interactive |
| Skeleton | Not stated |
| Error | Not applicable |
| Read-only | Not stated |

**Tokens consumed**

Colour:

| Element | Property | Token role |
|---|---|---|
| Title | color | text-primary |
| Content | color | text-primary |
| Icon | fill | icon-primary |
| Header | border-top | border-subtle (contextual `*`) |
| Header | background | transparent |
| Panel | border-bottom | border-subtle (contextual `*`) |
| Panel | background | transparent |
| Header — hover | background | layer-hover (contextual `*`) |
| Header — focus | border | `$focus` |
| Header — disabled | border-top | border-disabled |
| Title — disabled | color | text-disabled |
| Icon — disabled | fill | icon-disabled |

`*` Denotes a contextual token that changes value based on the layer it is placed on.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Title | 14 / 0.875 | Regular 400 | not stated |
| Content | 14 / 0.875 | Regular 400 | not stated |

All titles: sentence case.

Spacing (default / indented alignment):

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Header | height | 40 / 2.5 | — |
| Item | border-top | 1 px | — |
| Title | margin-left | 16 / 1 | not stated |
| Panel | padding-top | 8 / 0.5 | not stated |
| Panel | padding-bottom | 24 / 1.5 | not stated |
| Panel | padding-right | 25% | — |
| Panel | padding-left | 16 / 1 | not stated |
| Icon | size | 16 / 1 | — |
| Icon | padding-right | 16 / 1 | not stated |

Spacing (flush alignment): Title margin-left = 0; Panel padding-left = 0; Icon padding-right = 0. All other values identical.

Motion tokens: not stated.

**Anatomy**

1. **Header** — full-row click target; contains title and chevron icon
2. **Icon (chevron)** — 16 × 16 px; end-aligned by default; points down (collapsed) or up (expanded)
3. **Panel** — content section revealed on expand; no max-height

---

## 2. Breadcrumb

> Sources: https://carbondesignsystem.com/components/breadcrumb/usage/ | https://carbondesignsystem.com/components/breadcrumb/style/

**What it is** — A secondary navigation pattern showing users their current location relative to the information architecture and enabling navigation up to parent-level pages. Always secondary; never a replacement for primary navigation. Do not use in products with single-level navigation (creates unnecessary clutter).

**Variants**

| Variant | Purpose |
|---|---|
| **Location-based** | Reflects the site's hierarchy; shows where the user is in the IA |
| **Path-based** | Shows the actual steps the user took; always dynamically generated |

Both types share identical styling. The type used must be consistent across the entire product.

**Sizes**

| Element | Size | Height (px / rem) | Type token | Font-size (px / rem) |
|---|---|---|---|---|
| Breadcrumb | Small (sm) | 16 / 1 | not stated | 12 / 0.75, Regular 400 |
| Breadcrumb | Medium (md) | 18 / 1.125 | not stated | 14 / 0.875, Regular 400 |

Medium is the default. Small is used in page headers, condensed spaces, or smaller breakpoints. Medium is used when there is no page header, placed at the top of a page.

Spacing:

| Size | Link margin-left, margin-right | Overflow menu item height |
|---|---|---|
| Small | 4 / 0.25 rem | not stated |
| Medium | 8 / 0.5 rem | not stated |

Overflow menu item height (both sizes): 40 / 2.5 rem.

Breadcrumbs never wrap onto a second line; overflow is handled by a built-in overflow menu.

**States**

| State | Description |
|---|---|
| **Enabled (unvisited)** | Default link colour |
| **Hover** | Text colour changes; underline applied |
| **Focus** | 2 px border outline on link |
| **Active** | Pressed colour + underline |
| **Current page** | Last item; not a link; muted text; not interactive; optional |
| **Overflow** | First + last two links shown; middle links collapsed into overflow menu |
| Disabled | Not stated |
| Error | Not applicable |
| Skeleton | Not stated |

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Text | enabled | text-color | not stated (link colour) |
| Text | current | text-color | not stated (text-primary) |
| Slash separator | — | text-color | not stated |
| Overflow icon | — | svg | not stated |
| Text | hover | text-color | not stated (+ underline) |
| Border | focus | border | not stated |
| Text | active | text-color | not stated |
| Border | active | border | not stated |
| Overflow icon | hover | svg | not stated |
| Overflow icon | focus | svg | not stated |
| Overflow icon — border | focus | border | not stated |

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Text: small | 12 / 0.75 | Regular 400 | not stated |
| Text: medium | 14 / 0.875 | Regular 400 | not stated |
| Text: overflow menu | 14 / 0.875 | Regular 400 | not stated |

Spacing: see Sizes section above. Overflow menu uses Menu component structure.

Motion tokens: not stated.

**Anatomy**

1. **Page links** — interactive; link to parent-level pages; short and descriptive; ordered highest-level parent first
2. **Separator (/)** — not interactive; distinguishes each page level
3. **Overflow menu (optional)** — appears when space is constrained; shows first link and last two links; hides middle links in a menu

Placement: top-left of page; below header and navigation; above the page title.

---

## 3. Button

> Sources: https://carbondesignsystem.com/components/button/usage/ | https://carbondesignsystem.com/components/button/style/

**What it is** — Clickable elements that trigger actions. Each page should have only one primary button; all other calls to action use lower-emphasis variants. Do not use buttons for navigation — use **Link** when the desired action takes the user to a new page.

**Variants**

| Variant | Purpose |
|---|---|
| **Primary** | Principal call to action; one per screen (excluding header, modal, side panel) |
| **Secondary** | Secondary actions; only used with a primary button; performs the negative action (Cancel, Back); never used alone; never used for a positive action |
| **Tertiary** | Less prominent; can be used alone or with primary; good for sub-tasks |
| **Ghost** | Least pronounced; often in progress flows paired with primary and secondary |
| **Danger (primary)** | Destructive or irreversible actions (delete, remove) |
| **Danger (tertiary)** | Destructive action at tertiary visual weight |
| **Danger (ghost)** | Destructive action at ghost visual weight |
| **Icon only** | No label; icon must fully communicate the action; icon centred in container |

**Sizes**

| Size | Height (px / rem) | Use case |
|---|---|---|
| Extra small | 24 / 1.5 | Vertical space limited; confined layouts |
| Small | 32 / 2 | Paired with 32 px small input fields |
| Medium | 40 / 2.5 | Paired with 40 px medium input fields |
| Large (productive) | 48 / 3 | Most common in software products; pairs with 14 px body copy |
| Large (expressive) | 48 / 3 | Editorial/marketing; pairs with 16 px body copy; icon 20 × 20 px |
| Extra large | 64 / 4 | Full-bleed in modals, side panels, narrow tearsheets |
| 2XL | 80 / 5 | Full-bleed in full-screen components, large tearsheets |

Large productive and large expressive share the same 48 px height but use different type tokens and icon sizes. Do not mix button sizes within a button group.

**States**

| State | Description |
|---|---|
| **Enabled** | Default; live and interactive |
| **Hover** | Background-color change (primary, secondary, danger-primary); colour/background change (tertiary, ghost) |
| **Focus** | 2 px outer border + 1 px inner inset box-shadow |
| **Active** | Pressed background-color |
| **Disabled** | All interactive functions removed; not focusable; no WCAG contrast requirement |
| **Loading** | Small spinner inside button; related interactive elements disabled during operation |
| Skeleton | Not stated |
| Read-only | Not applicable |
| Error | Not applicable |

**Tokens consumed**

Colour (primary; all other variants follow the same structural pattern with their own tokens):

| Element | State | Property | Token role |
|---|---|---|---|
| Label | all | text-color | text-on-color |
| Icon | all | svg | icon-on-color |
| Container | enabled | background-color | `$button-primary` |
| Container | hover | background-color | `$button-primary-hover` |
| Container | focus — border | border | `$focus` |
| Container | focus — inset | box-shadow | `$focus-inset` |
| Container | active | background-color | `$button-primary-active` |
| Label | disabled | text-color | text-disabled |
| Icon | disabled | svg | icon-disabled |
| Container | disabled | background-color | `$button-disabled` |

Secondary: same structure, `$button-secondary` / `$button-secondary-hover` / `$button-secondary-active`.
Tertiary / Danger tertiary: transparent background in enabled state; border in enabled state.
Ghost: transparent background; no border in enabled state.
Danger primary: `$button-danger-primary` / `$button-danger-hover` / `$button-danger-active`.
Danger tertiary: transparent background; `$button-danger-secondary` border in enabled state.
Danger ghost: transparent background; no border.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Button label (productive) | 14 / 0.875 | Regular 400 | not stated |
| Button label (expressive) | 16 / 1 | Regular 400 | not stated |

Labels: sentence case; left-aligned (not centred) within the container.

Spacing:

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Button without icon | padding-left | 16 / 1 | not stated |
| Button without icon | padding-right | 64 / 4 | not stated |
| Button with icon | padding-left, padding-right | 16 / 1 | not stated |
| Button with icon | label-to-icon spacing | ≥ 32 / 2 | not stated |
| Icon-only | padding-left, padding-right | 16 / 1 | not stated |
| Icon (productive) | size | 16 × 16 px | — |
| Icon (expressive) | size | 20 × 20 px | — |
| Focus | box-shadow inset | 1 px | — |
| Ghost button without icon | padding-left, padding-right | 16 / 1 | not stated |
| Ghost button with icon | spacing | 8 / 0.5 | not stated |
| Button group — fluid | border between buttons | 1 px | — |
| Button group — fixed | spacing between buttons | 16 px | not stated |

Motion tokens: not stated.

**Anatomy**

1. **Label (A)** — sentence-case text; left-aligned
2. **Container (B)** — the button bounding box; transparent for ghost/danger-ghost in enabled state
3. **Icon (C, optional)** — right-aligned in labelled buttons; centred in icon-only; 16 × 16 px (productive) or 20 × 20 px (expressive)

---

## 4. Checkbox

> Sources: https://carbondesignsystem.com/components/checkbox/usage/ | https://carbondesignsystem.com/components/checkbox/style/

**What it is** — An input control allowing users to select zero, one, or any number of items from a list independently; each checkbox operates independently of others. Use for multiple-choice selections, filtering, batch actions, terms and conditions, and parent–child sub-selections. Use **Radio button** instead when only one option can be selected; use **Toggle** instead when a binary on/off action takes effect immediately without a form submission.

**Variants**

| Variant | Description |
|---|---|
| **Unselected** | Default; empty |
| **Selected** | Filled with checkmark |
| **Indeterminate** | Parent checkbox when some but not all children are selected |
| **With AI label** | AI explainability label on group or individual label; AI label size: mini |

**Sizes**

Checkbox input is a fixed **16 × 16 px** square. No named height-size variants for the checkbox itself. Form spacing: minimum **32 px** (`$spacing-07`) below or before the next component; 24 px or 16 px when space is more restricted.

**States**

| State | Description |
|---|---|
| **Unselected** | Empty; default |
| **Selected** | Checked; filled background with checkmark |
| **Indeterminate** | Dash; partial selection of a parent group |
| **Focus** | 2 px border + 1 px inset focus ring on checkbox input |
| **Disabled** | Muted border and background; not focusable; no contrast requirement |
| **Read-only** | Focusable; accessible; passes contrast; cannot be modified |
| **Error** | Red border on checkbox; error icon; error message below |
| **Warning** | Warning border; warning icon; warning message below |
| Skeleton | Not stated |

Group-level states: read-only, disabled, error, warning, plus optional helper text.

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Group label | — | text-color | not stated |
| Checkbox label | — | text-color | not stated |
| Checkbox — unchecked | — | border | not stated |
| Checkbox — unchecked | — | background | transparent |
| Checkbox — checked | — | background | not stated |
| Checkbox — checked | — | checkmark | not stated |
| Helper text | — | text-color | not stated |
| Checkbox | focus | border | not stated |
| Label | disabled | text-color | not stated |
| Checkbox | disabled | border | not stated |
| Checkbox | disabled | background | not stated |
| Label | read-only | text-color | not stated |
| Checkbox | read-only | border | not stated |
| Checkbox | read-only | inner fill | not stated |
| Label | error | text-color | not stated |
| Checkbox | error | border | not stated |
| Error message | error | text-color | not stated |
| Error icon | error | svg | not stated |
| Warning message | warning | text-color | not stated |
| Warning icon | warning | svg | not stated |

*(Token names are not printed in the rendered style-tab tables; all colour values are contextual or semantic.)*

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Group label | 12 / 0.75 | Regular 400 | not stated |
| Checkbox label | 14 / 0.875 | Regular 400 | not stated |
| Helper text | 12 / 0.75 | Regular 400 | not stated |
| Error message | 12 / 0.75 | Regular 400 | not stated |
| Warning message | 12 / 0.75 | Regular 400 | not stated |

Labels: sentence case; ≤ 3 words recommended.

Spacing:

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Checkbox | height & width | 16 px | — |
| Checkbox | border | 1 px | — |
| Checkbox — focus | border | 2 px | — |
| Checkbox — focus | border inset | 1 px | — |
| Group label | margin-bottom | 8 / 0.5 | not stated |
| Checkbox label | padding-left | 8 / 0.5 | not stated |
| Checkbox item | margin-bottom | 4 / 0.25 | not stated |

Motion tokens: not stated.

**Anatomy**

1. **Group label (optional)** — describes the group or provides instructions; sentence case
2. **Checkbox input** — 16 × 16 px; indicates current state
3. **Checkbox label** — right of input; ≤ 3 words; wraps below checkbox (top-aligned) if long

---

## 5. Code Snippet

> Sources: https://carbondesignsystem.com/components/code-snippet/usage/ | https://carbondesignsystem.com/components/code-snippet/style/

**What it is** — Read-only strings or small blocks of reusable code that users can copy to their clipboard. Used to help users copy code strings easily or to call out key words in documentation. Do not use if you want the user to change the input value — code snippets are read-only.

**Variants**

| Variant | Purpose |
|---|---|
| **Inline** | A block of text embedded inline with sentences or paragraphs; clicking anywhere on the snippet copies it; must not extend to multiple lines |
| **Single line** | A standalone single line of code; longer strings overflow into horizontal scroll; copy icon button |
| **Multi-line** | Multiple lines of code; optional "Show more / Show less" ghost button; copy icon; vertical scroll as alternative to show-more when > 9 lines |

**Sizes**

Single-line container:

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Container | height | 40 / 3 | — |
| Container | max-width | 768 / 48 | — |
| Container | padding-right | 48 / 3 | not stated |
| Container | padding-left | 16 / 1 | not stated |

Multi-line container:

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Container | min-height | 288 / 18 | — |
| Container | max-height | varies | — |
| Container | max-width | 768 / 48 | — |
| Container | padding | 16 / 1 | not stated |
| Container | padding-right | 40 / 2.5 | not stated |
| Copy button | height, width | 32 / 2 | — |
| Snippet (show-more) button | height, width | 40 / 2.5 | — |
| Icon | height, width | 16 px | — |

Inline container:

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Container | height | 16 / 1 | — |
| Container | width | varies | — |
| Container | border-radius | 2 px | — |
| Code | padding-right, padding-left | 8 / 0.5 | not stated |

**States**

| State | Description |
|---|---|
| **Enabled** | Code visible; copy available |
| **Hover** | Inline: subtle background-color change; single/multi: not stated separately |
| **Focus** | Copy button / show-more button: 2 px focus ring |
| **Active** | Inline: background-color change |
| **Copy activated** | Confirmation "Copied to clipboard" tooltip fires; focus stays on button |
| **Show more** | Multi-line snippet expanded |
| **Show less** | Multi-line snippet collapsed |
| Disabled | Not stated |
| Error | Not applicable (read-only) |
| Skeleton | Not stated |

**Tokens consumed**

Colour:

| Element | Property | Token role |
|---|---|---|
| Container (single/multi) | background | layer (contextual `*`) |
| Container (inline) | background | layer (contextual `*`) |
| Container (inline) — hover | background | layer-hover (contextual `*`) |
| Container (inline) — active | background | layer-active (contextual `*`) |
| Container — focus | border | not stated |
| Code text | text-color | not stated |
| Icon | svg | not stated |
| Copy button | — | ghost icon-only button tokens |
| Snippet button | — | ghost icon-only button tokens |

`*` Denotes a contextual token. The `light` prop changes the container background from `$layer-01` to `$layer-02`.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Code text | 12 / 0.75 | Regular 400 | not stated |

Font family: IBM Plex Mono (monospace). Carbon also defines accessible syntax highlight colours; see https://codepen.io/team/carbon/full/eKMBLw/.

Motion tokens: not stated.

**Anatomy**

1. **Snippet text** — the code string or block; monospace; read-only
2. **Copy button (optional)** — icon button (top-right on single/multi; full container on inline); shows "Copied to clipboard" tooltip on activation
3. **Show more button (optional, multi-line only)** — ghost button below snippet; default labels "Show more" / "Show less"; can be replaced by vertical scroll

---

## 6. Contained List

> Sources: https://carbondesignsystem.com/components/contained-list/usage/ | https://carbondesignsystem.com/components/contained-list/style/

**What it is** — Single-column lists with a header used inside containers (cards, sidebars, disclosure popovers) to organise related content in smaller UI spaces. Supports interactive elements, clickable rows, and inline actions. Do not use if content needs more than one nesting level or becomes overly complex (use **Data table** instead); do not use if the list needs multiple column headers (use **Structured list** instead).

**Variants**

| Variant | Purpose |
|---|---|
| **On-page list** | Persistent context (card, sidebar); no visible header background at rest; header becomes sticky with background when content scrolls beneath it |
| **Disclosed list** | Temporary context (popover, layer); smaller header height; always has a visible background layer under header |

**Sizes**

On-page list:

| Size | Element | Height (px / rem) |
|---|---|---|
| Small (sm) | Header and row | 32 / 2 |
| Medium (md) | Header and row | 40 / 2.5 |
| Large (lg) | Header and row | 48 / 3 |
| Extra large (xl) | Header | 48 / 3 |
| Extra large (xl) | Row | 64 / 4 |

Large is stated as the default size.

Disclosed list:

| Size | Element | Height (px / rem) |
|---|---|---|
| Large (lg) | Header | 32 / 2 |
| Large (lg) | Row | 48 / 3 |

Header area spacing (both variants): padding-left, padding-right = 16 / 1 rem.
List item spacing: padding-left, padding-right = 16 / 1 rem.
Non-interactive icon: 16 × 16 px; padding-left, padding-right = 16 / 1 rem.
Inline action icon button: 16 × 16 px; padding-left, padding-right = 16 / 1 rem.
Search icon button: 16 × 16 px; padding-left, padding-right = 16 / 1 rem.

Stacking: on-page lists — 16 px (`$spacing-05`) between each list. Disclosed lists — flush (0 px) between each list.

**States**

| State | Description |
|---|---|
| **Enabled** | Default; items visible |
| **Hover** | Row background-color change (when rows are clickable) |
| **Focus** | Border on focused interactive element |
| **Active** | Row background-color change on press |
| **Disabled** | Text colour muted; border muted |
| Skeleton | Not stated |
| Error | Not stated |

**Tokens consumed**

Colour:

| Element | Property | Token role |
|---|---|---|
| List title: on-page | text-color | not stated |
| List title: on-page | background-color | not stated |
| List title: disclosed | text-color | not stated |
| List title: disclosed | background-color | layer (contextual `*`) |
| List item | text-color | not stated |
| List item | background-color | transparent |
| Icon (optional) | svg | not stated |
| Row divider | border-bottom | border-subtle (contextual `*`) |
| Row — hover | background-color | layer-hover (contextual `*`) |
| Row — focus | border | not stated |
| Row — active | background-color | layer-active (contextual `*`) |
| Row — disabled | text-color | not stated |
| Row — disabled | border | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| List title: on-page | 14 / 0.875 | SemiBold 600 | not stated |
| List title: disclosed | 12 / 0.75 | Regular 400 | not stated |
| List item | 14 / 0.875 | Regular 400 | not stated |

All text: sentence case.

Motion tokens: not stated.

**Anatomy**

1. **List header area** — groups succeeding list items; can be sticky (optional)
2. **List title** — descriptive name for the group; 1–3 words; sentence case
3. **List item area** — row container for text and elements
4. **List item** — the row content; similar structure per row; sentence case
5. **Non-interactive icon (optional)** — decorative; left of text; same colour as text unless a status indicator; 16 × 16 px
6. **Search icon button (optional)** — triggers search/filter in header; 16 × 16 px
7. **Interactive element (optional)** — links, icon buttons, toggles in header or rows; multiple row columns supported

---

## 7. Content Switcher

> Sources: https://carbondesignsystem.com/components/content-switcher/usage/ | https://carbondesignsystem.com/components/content-switcher/style/

**What it is** — Allows users to toggle between two or more alternate views of similar or related content, showing only one content section at a time. Use **Tabs** instead when navigating between distinct content areas like sub-pages (tabs separate content; content switcher alternates format of the same content). Use **Toggle** instead for binary on/off choices.

**Variants**

| Variant | Description |
|---|---|
| **Text content switcher** | Tabs display text labels |
| **Icon content switcher** | Tabs display icons only; compact; can replace text switcher at small breakpoints |

Two contrast styles:

| Style | Token names (low contrast only) | Use case |
|---|---|---|
| **High contrast** | not stated | Higher page hierarchy (page top, page header) |
| **Low contrast** | `$content-switcher-background` (unselected), `$content-switcher-selected` (selected), `$content-switcher-background-hover` (hover) | Cards, modals, near primary/secondary buttons |

High contrast: unselected container background = transparent. Low contrast: unselected container background = `$content-switcher-background`.

Icons must be consistent throughout the switcher — never mix icon and text tabs.

**Sizes**

| Size | Height (px / rem) |
|---|---|
| Small (sm) | 32 / 2 |
| Medium (md) | 40 / 2.5 |
| Large (lg) | 48 / 3 |

Width: all tabs in a group are the same width. Content tab with the longest label should have at minimum 16 px spacing to the right of the label. Icon tabs: fixed square (height = width).

**States**

| State | Description |
|---|---|
| **Unselected** | Inactive tab; first tab defaults to this after first one is selected |
| **Selected** | Always exactly one selected; first tab selected by default |
| **Hover** | On unselected tabs only |
| **Focus** | After Tab or click |
| **Disabled** | Entire switcher or individual tabs; cannot interact |
| Skeleton | Not stated |
| Error | Not applicable |

**Tokens consumed**

Colour (high contrast):

| Element | State | Property | Token role |
|---|---|---|---|
| Container | unselected | background-color | transparent |
| Text / Icon | unselected | text-color / svg | not stated |
| Border | unselected | border | not stated |
| Divider | unselected | border | contextual `*` |
| Container | selected | background-color | not stated |
| Text / Icon | selected | text-color / svg | not stated |
| Container | hover (unselected) | background-color | not stated |
| Text / Icon | hover | text-color / svg | not stated |
| Border | hover | border | not stated |
| Container | focus (unselected) | background-color | transparent |
| Border | focus (unselected) | border | not stated |
| Container | focus (selected) | background-color | not stated |
| Border | focus (selected) | inner-border | not stated |
| Container | disabled (unselected) | background-color | transparent |
| Text / Icon | disabled | text-color | not stated |

Colour (low contrast — token names explicitly stated):

| Element | State | Token |
|---|---|---|
| Container | unselected enabled | `$content-switcher-background` |
| Container | selected enabled | `$content-switcher-selected` |
| Container | unselected hover | `$content-switcher-background-hover` |
| Container | selected disabled | `$content-switcher-selected` |
| Container | unselected disabled | `$content-switcher-background` |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight (high contrast) | Font-weight (low contrast) |
|---|---|---|---|
| Text: unselected | 14 / 0.875 | Regular 400 | Regular 400 |
| Text: selected | 14 / 0.875 | Regular 400 | SemiBold 600 |

Labels: sentence case; ≤ 3 words; nouns or noun phrases; not actions.

Spacing: not stated (structure table truncated in fetched content; remaining values not retrieved).

Motion tokens: not stated.

**Anatomy**

1. **Selected content tab** — highlighted tab; always exactly one active
2. **Content tab** — equal-width selectable container; text or icon label
3. **Label text** — 2–3 words; nouns or noun phrases; truncate with ellipsis + tooltip if too long
4. **Content view** — the area whose content changes with each selection; placed below (or beside) the switcher

---

## 8. Data Table

> Sources: https://carbondesignsystem.com/components/data-table/usage/ | https://carbondesignsystem.com/components/data-table/style/

**What it is** — Organises and displays data in rows and columns with optional sorting, selection (single or multi), row expansion, batch actions, search, toolbar controls, and pagination. Do not use when a more complex display or interactions are required beyond what the component offers, or as a replacement for a spreadsheet application.

**Variants**

| Variant | Purpose |
|---|---|
| **Default** | Header + data rows only; five row sizes |
| **With selection (multi)** | Checkbox per row; check-all with indeterminate state; batch action bar |
| **With selection (single)** | Radio button per row; single-select only |
| **With expansion** | Expandable row panels; optional batch expand-all |
| **With sorting** | Column headers trigger ascending / descending sort |
| **Zebra striped** | Alternating row backgrounds for horizontal scanning |
| **With AI label** | AI styling on entire table, individual cells, or rows/columns |

Features are composable (e.g. selection + expansion can be combined).

**Sizes**

Row heights:

| Size | Height (px / rem) |
|---|---|
| Extra small (xs) | 24 / 1.5 |
| Small (sm) | 32 / 2 |
| Medium (md) | 40 / 2.5 |
| Large (lg) | 48 / 3 |
| Extra large (xl) | 64 / 4 *(only when two lines of content per row are expected)* |

Column header row height must always match the selected row size.

Toolbar heights:

| Toolbar | Height (px / rem) | Paired with rows |
|---|---|---|
| Large | 48 / 3 | Large, Extra large |
| Small | 32 / 2 | Small, Extra small |

Toolbar margin-top / margin-bottom: Large toolbar = 16 / 1 rem; Small toolbar = 8 / 0.5 rem.

Column padding: 16 / 1 rem (`$spacing-05`) on left and right.

Selection row spacing:

| Element | Property | px / rem |
|---|---|---|
| Checkbox | height, width | 20 / 1.25 |
| Checkbox | padding-left, padding-right | 16 / 1 |
| Radio button | height, width | 20 / 1.25 |
| Radio button | padding-left, padding-right | 16 / 1 |
| Overflow menu (sm) | height | 32 / 2 |
| Chevron icon | svg | 16 / 1 |
| Chevron icon | click target | 32 / 2 |
| Expanded panel | padding-top, padding-right | 16 / 1 |
| Expanded panel | padding-left | 48 / 3 |
| Expanded panel | padding-bottom | 24 / 1.5 |

**States**

| State | Description |
|---|---|
| **Enabled** | Default; rows and controls interactive |
| **Hover** | Row hover always shown |
| **Focus** | 2 px border on focusable interactive elements |
| **Active** | Column header pressed state |
| **Selected** | Row chosen via checkbox or radio; distinct background |
| **Selected + hover** | Selected row with cursor over it |
| **Expanded** | Expandable row panel visible |
| **Zebra** | Alternating row backgrounds modifier |
| **Skeleton** | Initial load indicator |
| Disabled | Not stated as a row-level state |
| Error | Not stated for row data |

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Table header section | — | background-color | layer (contextual `*`) |
| Title | — | text-color | not stated |
| Description | — | text-color | not stated |
| Column header | enabled | background-color | layer (contextual `*`) |
| Column header | enabled | text-color | not stated |
| Column header | enabled | svg | not stated |
| Column header | hover | background-color | layer (contextual `*`) |
| Column header | focus | border | not stated |
| Column header | active | background-color | layer (contextual `*`) |
| Row | enabled | background-color | layer (contextual `*`) |
| Row | enabled | border-bottom | border-subtle (contextual `*`) |
| Row | enabled | text-color | not stated |
| Row | hover | background-color | layer (contextual `*`) |
| Row | selected | background-color | layer (contextual `*`) |
| Row | selected | border-bottom | layer (contextual `*`) |
| Row | selected + hover | background-color | layer (contextual `*`) |
| Row | expanded | background-color | layer (contextual `*`) |
| Row | zebra | background-color | layer (contextual `*`) |
| Batch action bar | — | background-color | not stated |
| Batch action bar summary | — | text-color | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Table header title | 20 / 1.25 | Regular 400 | not stated |
| Column header | 14 / 0.875 | SemiBold 600 | not stated |
| Row text | 14 / 0.875 | Regular 400 | not stated |

Column header and title: sentence case.

Motion tokens: not stated.

**Anatomy**

1. **Title and description** — table title (required); optional description; sentence case
2. **Toolbar** — global controls: search, filter, settings, primary action; up to 5 actions; overflow menu for more
3. **Column header** — title + optional sort icon; sentence case; 1–2 words
4. **Table row** — data cells; configurable for selection, expansion, zebra stripe, inline overflow menu
5. **Pagination bar (optional)** — at bottom; simple (current page + prev/next) or advanced (items-per-page + page input)

---

## 9. Date Picker

> Sources: https://carbondesignsystem.com/components/date-picker/usage/

**What it is** — Lets users select a date (or date range) via a text field and optional calendar popup, or input a time value. Use when asking for an exact, approximate, or memorable date or time, or for scheduling tasks. The calendar picker variant is best when the user needs to know a date's relationship to other days or when the date could be variable.

**Variants**

| Variant | Purpose |
|---|---|
| **Simple date input** | Text field only; no calendar; for memorable dates (birth date, expiry); month/year or month/day/year |
| **Calendar picker — single** | Text field + calendar popup for selecting one date |
| **Calendar picker — range** | Two text fields + calendar popup for start and end date |
| **Time picker** | Hour + minute text fields + AM/PM select + optional timezone select |

Input styles:

| Style | Label position | Use case |
|---|---|---|
| **Default** | Outside / above field | Productive forms; space-constrained; white space between inputs needed |
| **Fluid** | Inside field, stacked inline | Expressive moments; fluid forms; contained spaces; attached to toolbars |

**Sizes**

Default input heights:

| Size | Height (px / rem) |
|---|---|
| Small (sm) | 32 / 2 |
| Medium (md) | 40 / 2.5 — default |
| Large (lg) | 48 / 3 |

Fluid input: single height of **64 px** (grows when warning or error message is added below).

Calendar menu: fixed size; does not change with input size; always left-aligned to its text field. Specific calendar px dimensions: not stated.

**States**

| State | Description |
|---|---|
| **Enabled** | Default; not interacted with |
| **Hover** | Cursor over field |
| **Focus** | Tabbed to / clicked into field |
| **Open** | Calendar menu visible (calendar pickers only) |
| **Error** | Required field empty; invalid data; system error |
| **Warning** | Exception condition that may cause problems |
| **Disabled** | Not interactive; not focusable; no contrast requirement |
| **Skeleton** | Initial page load |
| **Read-only** | Focusable; accessible; passes contrast; cannot modify |

**Tokens consumed**

Date and time picker input fields inherit all **Text input** tokens (see component 33). Calendar menu specifics: not stated on usage page. AI label variant: not stated on usage page.

Motion tokens: not stated.

**Anatomy**

Date picker:
1. **Label** — required; includes date format in label or helper text (not placeholder-only)
2. **Date field** — text input; manual typing supported alongside calendar selection
3. **Date format indicator** — in helper text (e.g. "MM/DD/YYYY") or label parenthetical
4. **Icon** — calendar icon; triggers calendar menu (calendar variants only)
5. **Calendar** — fixed-size popup; left-aligned to field
6. **Month and year controls** — navigate time frames
7. **Previous / next month controls** — move one month at a time
8. **Week day labels** — column headers (S M T W T F S)
9. **Day cells** — selectable day numbers

Time picker (additional):
10. **Hour and minute field** — text input pair
11. **AM/PM selector** — select control
12. **Timezone selector** — select control (optional)

---

## 10. Dropdown

> Sources: https://carbondesignsystem.com/components/dropdown/usage/

**What it is** — A styled control presenting a list from which users select one option (Dropdown), multiple options (Multiselect), or type a custom value (Combo box). Unlike the native Select, its appearance can be fully styled. Use **Radio button** group instead when there are only two options; use native **Select** when the experience is mostly form-based or frequently used on mobile platforms.

**Variants**

| Variant | Purpose |
|---|---|
| **Dropdown** | Single selection from a predefined list |
| **Multiselect** | Multiple selections; checkbox per option; menu stays open while selecting; selected count shown |
| **Combo box** | Single selection from a large list OR user types a custom value; filterable |

Input styles:

| Style | Label position | Use case |
|---|---|---|
| **Default** | Outside / above input | Productive forms; space-at-premium |
| **Fluid** | Inside field, stacked inline | Expressive moments; fluid forms; attached to toolbars |

**Sizes**

Default:

| Size | Height (px / rem) |
|---|---|
| Small (sm) | 32 / 2 |
| Medium (md) | 40 / 2.5 — default |
| Large (lg) | 48 / 3 |

When open, each menu option height matches the field height.

Fluid:

| Fluid option | Height (px / rem) | Use case |
|---|---|---|
| Default | 64 / 4 | Fewer options; expressive moments |
| Condensed | 40 / 2.5 | Many options; view more without scrolling |

Width: no minimum or maximum; customisable to context.

**States**

| State | Description |
|---|---|
| **Enabled** | Default; placeholder text visible |
| **Hover** | Field and open menu-item hover |
| **Focus** | Tabbed to or clicked into field |
| **Open** | Menu visible; opens downward by default; opens upward near screen edge |
| **Error** | Invalid data; required field empty; system error |
| **Warning** | Exception condition |
| **Disabled** | Not interactive; not focusable |
| **Skeleton** | Initial page load |
| **Read-only** | Focusable; passes contrast; cannot modify |
| Indeterminate / selected | Option text replaces placeholder after selection |

**Tokens consumed**

Field, label, helper text: inherit Text input tokens. Specific token names: not stated on usage page. Menu, chevron, hover, error, warning, focus: not stated on usage page.

Motion tokens: not stated.

**Anatomy**

1. **Label** — what to expect in the list; required; 1–3 words; never replaced by placeholder only
2. **Helper text** — assistive info; replaced by error/warning text
3. **Field** — persists open and closed; shows selected value or placeholder
4. **Chevron icon** — right side of field; indicates open/close
5. **Menu** — open-state container; opens up or down
6. **Option** — individual choice; never use images or decorative icons
7. **Parent checkbox (Multiselect)** — "Select all" at top of menu; label: "All" or "All [category]"

---

## 11. File Uploader

> Source: https://carbondesignsystem.com/components/file-uploader/usage/

**What it is** — Allows users to select and upload one or more files. Found in forms and as a standalone element. Two interaction modes: button (dialog) or drag-and-drop. Do not use in a modal when multiple files are uploaded, as uploaded files stack vertically and can overflow.

**Variants**

| Variant | How it works |
|---|---|
| **File uploader (button)** | Click a primary or tertiary button → OS file selection dialog opens → selected files appear below the button as chips |
| **Drag and drop** | Drag files into a drop zone; OR click a text link inside the drop zone to open the file dialog; drop zone border changes on drag-hover |

When using the button variant: use **primary** button if no other primary button exists on the page; use **tertiary** if a primary button is already present.

**Sizes**

| Size | Height (px / rem) | Use case |
|---|---|---|
| Large | 48 / 3 | Lots of space to work with |
| Medium | 40 / 2.5 — default | Use whenever possible |
| Small | 32 / 2 | Space-constrained or long complex forms |

The button and uploaded-file chips must share the **same height**. Match with other form component heights on the same page.

**States**

| State | Description |
|---|---|
| **Default** | Button or drop zone visible; no files selected yet |
| **Drag-over** | Drop zone border colour and thickness change; ready to receive dragged files; cursor shows preview of dragged file (browser-rendered) |
| **Loading** | File uploading; animated spinner inline per file |
| **Success (uploaded)** | File successfully uploaded; filename shown with × close icon |
| **Error (per file)** | Single-line or multi-line error per file; guidance on resolution |
| **Error (uploader-wide)** | Inline error notification alongside or below the uploader |
| Focus | Button / drop zone text link focusable via Tab; activated by Enter / Space |
| Disabled | Not stated |
| Skeleton | Not stated |

For single-file drag-and-drop: after upload, the drop zone disappears; only the uploaded file chip remains.

**Tokens consumed**

Not stated on usage page. Button inherits Button component tokens (primary or tertiary). Uploaded file chip, loading spinner, error styling: token names not stated.

Motion tokens: not stated.

**Anatomy**

1. **Heading** — section title (default: "Upload files")
2. **Description** — file size/format constraints
3. **Button or drop zone label** — action trigger (default button: "Add files"; drop zone: describes drag-and-drop + click action)
4. **Uploaded file chip** — shows filename; includes × icon for removal; same height as button
5. **× (delete icon)** — removes uploaded file from list

---

## 34. Tile

**Sources:** https://carbondesignsystem.com/components/tile/usage/
https://carbondesignsystem.com/components/tile/style/

### What it is
A flexible surface for grouping related content and actions in a compact card-like container. Tiles are building blocks — the content they contain is up to the product team.

**When not to use:**
- Single-item navigation → **Link**
- A list of actions → **Contained list** or **Menu**

---

### Variants

| Variant | Purpose | Interactivity |
|---|---|---|
| **Base** | Static display of information; no action on click | None |
| **Clickable** | Entire tile is a click target; navigates to a new page | Click → navigate |
| **Selectable (single)** | One tile selectable at a time (radio-group behaviour) | Click → select/deselect (exclusive) |
| **Selectable (multi)** | Multiple tiles selectable simultaneously | Click → select/deselect (independent) |
| **Expandable** | Hidden content revealed on click; expand/collapse | Click tile → toggle panel height |
| **With AI label** | AI explainability label in tile header | Same as base/selectable/etc. |

Feature flags change tile border and icon appearance without changing functionality.

---

### Sizes

| Element | Property | px / rem |
|---|---|---|
| All tiles | min-height | 64 / 4 |
| All tiles | min-width | 128 / 8 |
| Content | padding-top, padding-bottom | 16 / 1 |
| Content | padding-left, padding-right | 16 / 1 |
| Clickable icon (feature flag) | size | 20 × 20 px |
| Selectable icon (feature flag) | size | 16 × 16 px |
| Expandable icon (feature flag) | size | 16 × 16 px |

No maximum height is stated. Height is content-driven above the 64 px minimum.

**Responsive grid alignment:**

| Percentage | Breakpoints available |
|---|---|
| 100% | XL 1600–1200, L 1200–992, M 992–768, S 768–576, XS 576–0 |
| 1/2 | All breakpoints |
| 2/3 | All breakpoints |
| 1/3 | All breakpoints |
| 1/4 | All breakpoints |
| 1/6 | All breakpoints |

---

### States

| State | Base | Clickable | Selectable | Expandable |
|---|---|---|---|---|
| **Enabled** | ✓ | ✓ | ✓ | ✓ |
| **Hover** | — | ✓ | ✓ | ✓ |
| **Focus** | — | ✓ | ✓ | ✓ |
| **Selected** | — | — | ✓ | — |
| **Hover (selected)** | — | — | ✓ | — |
| **Expanded** | — | — | — | ✓ |
| **Disabled** | — | ✓ | ✓ | ✓ |
| **Skeleton** | ✓ | — | — | — |
| **Error** | — | — | — | — |

---

### Tokens consumed

**Base tile:**

| Element | Property | Role |
|---|---|---|
| Container | background-color | layer (contextual) |
| Text | text-color | text-primary |

**Clickable tile:**

| Element | State | Property | Role |
|---|---|---|---|
| Container | enabled | background-color | layer (contextual) |
| Icon | enabled | svg | icon-primary |
| Border (feature flag) | enabled | border | border-subtle (contextual) |
| Container | hover | background-color | layer-hover (contextual) |
| Container | focus | border | `$focus` |
| Container | disabled | border | border-disabled |
| Text | disabled | text-color | text-disabled |
| Icon | disabled | svg | icon-disabled |

**Selectable tile:**

| Element | State | Property | Role |
|---|---|---|---|
| Container | enabled | border | layer (contextual) |
| Container | hover | background-color | layer-hover (contextual) |
| Container | hover (selected) | background-color | layer-selected-hover (contextual) |
| Container | selected | border | interactive |
| Icon | selected | svg | interactive |
| Container | focus | border | `$focus` |
| Container | disabled | border | border-disabled |
| Text | disabled | text-color | text-disabled |

**Expandable tile:**

| Element | State | Property | Role |
|---|---|---|---|
| Container | enabled | background-color | layer (contextual) |
| Container | hover | background-color | layer-hover (contextual) |
| Container | focus | border | `$focus` |
| Container | disabled | border | border-disabled |
| Text | disabled | text-color | text-disabled |

**Typography:**

| Element | px / rem | Weight | Token |
|---|---|---|---|
| Tile title | 14 / 0.875 | Regular 400 | `$body-short-01` (default; can be overridden by product) |

---

### Anatomy

**Base tile:**
1. **Container** — bounding box; background surface
2. **Content** — product-supplied; no Carbon-defined internal structure

**Clickable tile (adds):**
3. **Icon** — Arrow-right (internal navigation) or Launch (external); top-right corner

**Selectable tile (adds):**
3. **Icon** — Checkmark (single) or Checkbox (multi); top-right corner (default) or top-left (feature flag)
4. **Border** — visible border in enabled and selected states

**Expandable tile (adds):**
3. **Collapsed content** — always visible above the fold
4. **Expand/collapse button** — bottom of tile; chevron icon
5. **Expanded content** — hidden below the fold; revealed on expand

---

---

## 35. Toggle

**Sources:** https://carbondesignsystem.com/components/toggle/usage/
https://carbondesignsystem.com/components/toggle/style/

### What it is
A binary switch control that immediately applies an on/off state. Unlike a checkbox, the toggle changes take effect **immediately** without requiring a form submission.

**vs. Checkbox:** Checkboxes require a form submit step; toggles apply instantly.
**vs. Radio button:** Radio buttons offer 2+ mutually exclusive options in a form flow; toggles are immediate binary on/off.

---

### Variants

| Variant | Description |
|---|---|
| **Default toggle** | Full-sized; displayed with label to the right; used on full pages and in settings panels |
| **Small toggle** | Compact; for use in data tables, contained lists, or tight spaces; same behaviour |

Both variants support feature flags that change the toggle's thumb size and track appearance.

---

### Sizes

| Variant | Track width × height (px) | Thumb size (px) |
|---|---|---|
| **Default** | 48 × 24 px | 18 × 18 px |
| **Small** | 32 × 16 px | 10 × 10 px |

*(Feature flag changes thumb to fill the track height — not stated for alternate px values.)*

**Label layout:**

| Layout option | Description |
|---|---|
| **Side label** | Action label to the right of the toggle (default) |
| **Top label** | Label above toggle; side-by-side action labels below |

Action labels: must clearly communicate the on and off states (e.g. "On"/"Off", "Enabled"/"Disabled"); no more than 3 characters each.

---

### States

| State | Description |
|---|---|
| **On (checked)** | Active state; thumb right-side; track filled with interactive colour |
| **Off (unchecked)** | Default; thumb left-side; track unfilled |
| **Focus — on** | 2 px `$focus` border on track when on |
| **Focus — off** | 2 px `$focus` border on track when off |
| **Disabled — on** | On but not interactive; disabled colours |
| **Disabled — off** | Off and not interactive; disabled colours |
| **Skeleton** | Initial page load |
| *Hover* | Not explicitly stated as a separate named state |
| *Error* | **Not stated** |
| *Read-only* | **Not stated** |

---

### Tokens consumed

| Element | State | Property | Token / Role |
|---|---|---|---|
| Track | off | background-color | `$toggle-off` |
| Track | on | background-color | `$support-success` |
| Thumb | off | background-color | icon-on-color |
| Thumb | on | background-color | icon-on-color |
| Label | — | text-color | text-primary |
| Action label | — | text-color | text-secondary |
| Track | focus | border | `$focus` |
| Track | disabled-off | background-color | `$button-disabled` |
| Track | disabled-on | background-color | `$button-disabled` |
| Label | disabled | text-color | text-disabled |

**Typography:**

| Element | px / rem | Weight | Token |
|---|---|---|---|
| Label (default, top) | 14 / 0.875 | Regular 400 | `$body-short-01` |
| Label (small) | 12 / 0.75 | Regular 400 | `$label-01` |
| Action label (default) | 14 / 0.875 | Regular 400 | `$body-short-01` |
| Action label (small) | 12 / 0.75 | Regular 400 | `$label-01` |

**Structure:**

| Element | Property | px / rem | Token |
|---|---|---|---|
| Default track | width × height | 48 × 24 px | — |
| Default thumb | size | 18 × 18 px | — |
| Small track | width × height | 32 × 16 px | — |
| Small thumb | size | 10 × 10 px | — |
| Track | border-radius | 12 px | — |
| Action label | padding-left (from track) | 4 / 0.25 | `$spacing-02` |
| Label (top) | margin-bottom | 16 / 1 | `$spacing-05` |

---

### Anatomy

1. **Toggle label (optional)** — describes the setting being controlled; top or right of track
2. **Toggle track** — the switch container; filled (on) or empty (off)
3. **Toggle thumb** — the indicator inside the track; moves left (off) or right (on)
4. **Action label (optional)** — communicates current state ("On"/"Off"); right of the toggle; must always be present when the toggle is used without a label for accessibility

---

---

## 36. Toggletip

**Source:** https://carbondesignsystem.com/components/toggletip/usage/

### What it is
A popover that contains **interactive elements** (links, buttons, structured content) and is toggled on/off by clicking a trigger button. Toggletips are non-modal disclosures — they appear above other content but do not trap focus.

**vs. Tooltip:** Tooltips are non-interactive hover/focus popups for short supplemental text; toggletips support interactive content and are click-triggered.
**vs. Popover:** Toggletip is a specific pre-composed pattern built on the Popover base component, with a defined trigger (information icon button) and caret tip. Raw Popover is for more custom disclosure patterns.

---

### Variants

No separate visual variants. The component always uses:
- An **information icon button** (ⓘ) as its trigger (or any icon button)
- A **caret tip** pointing to the trigger

Position: opens **above, below, left, or right** of the trigger; defaults to above; automatically flips if near the viewport edge.

---

### Sizes

| Element | Value |
|---|---|
| Max width of content area | 288 px |
| Trigger icon button size | 16 × 16 px icon; button size matches standard icon button |
| Min width | Content-driven |

No named px/rem size variants for the toggletip container itself.

---

### States

| State | Description |
|---|---|
| **Closed** | Default; tooltip not visible |
| **Open** | Content area visible above all other page content; trigger button in active/pressed visual state |
| **Hover — trigger** | Trigger icon button hover state |
| **Focus — trigger** | Trigger icon button receives keyboard focus |
| **Focus — inside** | Focus moves into toggletip content (links, buttons); Tab navigates sequentially within the content |
| **Closed by** | Clicking trigger again, pressing Esc, or clicking anywhere outside the toggletip |
| *Skeleton* | **Not stated** |
| *Error / Disabled* | **Not stated** |

---

### Tokens consumed

| Element | Property | Role / Token |
|---|---|---|
| Container | background-color | background-inverse |
| Container text | text-color | text-inverse |
| Caret tip | color | background-inverse |
| Trigger icon | fill | icon-secondary |
| Trigger — hover background | background | layer-hover (contextual) |
| Trigger — focus | border | `$focus` |
| Interactive elements inside | — | Inherit their own component tokens (link-inverse, button-inverse, etc.) |

---

### Anatomy

1. **Information icon button (trigger)** — the toggle button; ⓘ icon by default; click opens/closes toggletip
2. **Caret tip** — connects container to trigger; always points toward trigger
3. **Content area** — text, interactive elements (links, buttons); max-width 288 px; scrolls vertically if needed
4. **Interactive elements** — links, buttons, form elements; fully functional inside the toggletip

---

---

## 37. Tooltip

**Source:** https://carbondesignsystem.com/components/tooltip/usage/

### What it is
A non-interactive floating label that briefly clarifies an element's function or provides additional context. Appears on **hover or focus** only. Does not contain interactive elements.

**vs. Toggletip:** Toggletips are click-triggered and support interactive content; tooltips are hover/focus-triggered and text-only.
**vs. Icon button tooltip:** Icon buttons use a specific "definition tooltip" variant for labelling icons.

---

### Variants

| Variant | Purpose |
|---|---|
| **Standard tooltip** | Appears on hover/focus of any element; provides supplemental information; text only |
| **Definition tooltip** | Used with an underlined term or icon button; clarifies a term or UI element; text only; maximum 3 sentences |
| **Icon button tooltip** | Required for all icon-only buttons; provides the button's accessible label; always a single brief phrase |

Position: opens **above (top), below (bottom), left (start), or right (end)** of trigger. Auto-flip near viewport edges.

---

### Sizes

| Element | Value |
|---|---|
| Max width of tooltip content | 288 px |
| Delay before appearing (hover) | 300 ms |
| Delay before disappearing (hover-out) | 100 ms |

No named px/rem size variants for the tooltip container itself.

---

### States

| State | Description |
|---|---|
| **Hidden** | Default; tooltip not visible |
| **Visible — hover** | Appears after 300 ms hover over trigger |
| **Visible — focus** | Appears when trigger receives keyboard focus |
| **Closing** | Disappears after 100 ms when cursor leaves trigger, or immediately on Esc |
| *Click* | Tooltips are NEVER triggered by click (use Toggletip for click-triggered disclosure) |
| *Interactive* | No interactive elements ever inside a tooltip |
| *Skeleton* | **Not stated** |

---

### Tokens consumed

| Element | Property | Role / Token |
|---|---|---|
| Container | background-color | background-inverse |
| Text | text-color | text-inverse |
| Caret tip | color | background-inverse |
| Trigger (definition) | border-bottom | border-strong |
| Focus — trigger | border | `$focus` |

---

### Anatomy

1. **Trigger element** — any interactive element (icon button, underlined term, etc.); must be focusable via keyboard
2. **Caret tip** — arrow connecting container to trigger; direction follows tooltip position
3. **Content area** — short text label or brief description; max-width 288 px; no interactive elements ever
4. **Underline (definition variant)** — dotted/dashed underline on the term being defined; triggers tooltip on hover/focus

---

---

## 38. Tree View

**Source:** https://carbondesignsystem.com/components/tree-view/usage/

### What it is
A hierarchical list structure that lets users navigate through increasingly nested parent and child items. Used for file systems, nested categories, and multi-level navigation in side panels.

**When not to use:**
- Items have only one level of nesting → **Contained list** or **Left panel navigation**
- Data is primarily tabular → **Data table**

---

### Variants

| Variant | Description |
|---|---|
| **Default** | No icons; text-only labels |
| **With icons** | Icons identify item type (folder, file, document); icon must be consistent within each nesting level |

---

### Sizes

| Size | Height per item (px / rem) |
|---|---|
| Default | 32 / 2 |
| Compact | 24 / 1.5 |

No max-depth limit stated; Carbon recommends limiting nesting to **manageable** levels for usability.

---

### States

| State | Description |
|---|---|
| **Collapsed (parent)** | Parent item visible; children hidden; chevron points right |
| **Expanded (parent)** | Parent item visible; children visible below; chevron points down |
| **Leaf node** | No children; no chevron |
| **Selected** | Active/selected item; background-color change |
| **Hover** | Cursor over item; background-color change |
| **Focus** | Keyboard navigation highlight; 2 px focus ring |
| **Disabled** | Not interactive; muted text |
| *Skeleton* | **Not stated** |
| *Error* | **Not stated** |

**Keyboard pattern (follows ARIA tree widget):**
- **Arrow up/down**: Move focus between items
- **Arrow right**: Expand collapsed parent / move into first child
- **Arrow left**: Collapse expanded parent / move to parent
- **Enter / Space**: Select focused item
- **Home / End**: Jump to first / last item

---

### Tokens consumed

| Element | State | Property | Role |
|---|---|---|---|
| Item text | — | text-color | text-primary |
| Item | enabled | background | transparent |
| Item | hover | background | layer-hover (contextual) |
| Item | selected | background | layer-selected-01 |
| Item | focus | border | `$focus` |
| Chevron icon | — | svg | icon-primary |
| Custom icon | — | svg | icon-secondary |
| Item | disabled | text-color | text-disabled |
| Indent connector | — | border-left | border-subtle |

---

### Anatomy

1. **Parent node** — an item with one or more children; includes a chevron toggle (▶/▼)
2. **Chevron icon** — indicates expand/collapse; right-pointing (collapsed), down-pointing (expanded)
3. **Leaf node** — an item with no children; no chevron
4. **Item label** — the text identifying the node; sentence case; should be unique within the same level
5. **Icon (optional, with-icons variant)** — identifies item type; left of label; consistent within each level
6. **Nested group** — children of a parent; indented 16 px per level; connected by a vertical line

---

---

## 39. UI Shell — Header

**Source:** https://carbondesignsystem.com/components/UI-shell-header/usage/

### What it is
The top navigation bar of the IBM Carbon UI shell. Contains the product name, primary navigation links, and global actions. Spans the full viewport width and is always visible (sticky).

**When not to use the header:**
- The product does not require global navigation at the top of the page (use left panel navigation only, though this is uncommon)

---

### Variants

No separate visual variants — one presentation. However, the header supports three different **navigation patterns** for organising left-side navigation:

| Navigation pattern | Description |
|---|---|
| **Header only** | All navigation in the header; suitable for flat/single-level navigation |
| **Header + side nav** | Header persists; side nav provides deeper left-panel navigation (most common enterprise pattern) |
| **Header + side nav (collapsed)** | Side nav collapsed by default; hamburger menu in header toggles it open |

---

### Sizes

| Element | Height (px) |
|---|---|
| Header bar | 48 px |
| Header icon button area | 48 × 48 px |
| Product logo area | height: 32 px max within 48 px bar |

---

### States

| State | Description |
|---|---|
| **Default** | Full header visible; sticky at top |
| **Hover** | Nav item or icon button hover background |
| **Focus** | 2 px focus ring on nav items / icon buttons |
| **Active / Selected** | Current page nav item highlighted with 3 px `$interactive` bottom border |
| **Menu open** | Header mega-menu or sub-panel open |
| *Disabled* | **Not stated** |
| *Skeleton* | **Not stated** |

---

### Tokens consumed

| Element | Property | Role / Token |
|---|---|---|
| Header bar | background-color | `$background` (Gray 100 in default theme) |
| Product name | text-color | text-primary |
| Nav link text | text-color | text-secondary |
| Nav link — hover | background | `$background-hover` |
| Nav link — active | border-bottom (3 px) | `$interactive` |
| Nav link — focus | border | `$focus` |
| Icon button | fill | icon-primary |
| Icon button — hover | background | `$background-hover` |
| Dividers | border | border-subtle |

---

### Anatomy

1. **Hamburger menu button (optional)** — leftmost icon button; toggles side nav panel open/closed
2. **Product logo / IBM logo** — image or text; links to home
3. **Product name** — text identifier of the product; links to home
4. **Header navigation (optional)** — horizontal list of nav links; items may have sub-menus (mega-menu pattern)
5. **Header actions** — icon buttons aligned to the right (search, notifications, apps, user avatar)
6. **Header panel trigger** — an icon button on the right side that opens the right panel (e.g. notifications panel)

---

---

## 40. UI Shell — Left Panel (Side Nav)

**Source:** https://carbondesignsystem.com/components/UI-shell-left-panel/usage/

### What it is
The persistent or collapsible left-side navigation panel of the IBM Carbon UI shell. Provides multi-level hierarchical navigation within a product. Can be combined with the header or used alone.

---

### Variants

| Variant | Description |
|---|---|
| **Fixed (persistent)** | Always visible; takes space in the layout; pushes content to the right |
| **Rail** | Icon-only collapsed view; expand on hover or click; no space lost when collapsed |
| **Overlay** | Opens over content (does not push content); triggered by hamburger or other control; closes on overlay click or Esc |

---

### Sizes

| Element | Value |
|---|---|
| Panel width (expanded) | 256 px |
| Panel width (rail, collapsed) | 48 px |
| Nav item height | 32 px |
| Category header height | 32 px |

---

### States

| State | Description |
|---|---|
| **Enabled** | Default; item visible and interactive |
| **Hover** | Nav item hover background |
| **Focus** | 2 px focus ring on nav item |
| **Active / Selected** | Current page item; 4 px `$interactive` left border + distinct background |
| **Expanded (sub-menu)** | Parent item expanded; children visible below |
| **Collapsed (sub-menu)** | Parent item collapsed; children hidden |
| **Disabled** | Nav item not interactive; muted |
| *Skeleton* | **Not stated** |
| *Error* | **Not stated** |

---

### Tokens consumed

| Element | State | Property | Role |
|---|---|---|---|
| Panel | — | background-color | `$background` |
| Nav item text | enabled | text-color | text-secondary |
| Nav item | enabled | background | transparent |
| Nav item | hover | background | `$background-hover` |
| Nav item | active | background | `$background-selected` |
| Nav item | active | border-left (4 px) | `$interactive` |
| Nav item | focus | border | `$focus` |
| Category header | — | text-color | text-secondary; `$label-01` |
| Icon | — | svg | icon-secondary |
| Divider | — | border | border-subtle |
| Panel | disabled | text-color | text-disabled |

---

### Anatomy

1. **Side nav header (optional)** — product title or section title; top of panel
2. **Category label (optional)** — non-interactive group header; `$label-01` type; sentence case
3. **Navigation item** — link with text label; optional left icon; full-row click target
4. **Active indicator** — 4 px `$interactive` border-left on selected item
5. **Expand/collapse toggle** — chevron on parent items with sub-navigation
6. **Sub-navigation items** — nested children; indented 16 px
7. **Footer area (optional)** — bottom of panel; legal links, version info, or secondary actions
8. **Rail toggle button** — icon button at top of rail panel; expands panel to full width

---

---

## 41. UI Shell — Right Panel

**Source:** https://carbondesignsystem.com/components/UI-shell-right-panel/usage/

### What it is
A collapsible drawer that slides in from the right edge of the viewport, triggered by an icon button in the header (typically the notifications or user icon). Used for secondary information, notifications, user settings, or supplemental tasks that do not require a full-page context change.

---

### Variants

No separate visual variants — one standard behaviour pattern. The right panel is always:
- Triggered by a header icon button
- Overlaid on top of page content (does not push content)
- Fixed width; full viewport height below the header

---

### Sizes

| Element | Value |
|---|---|
| Panel width | 320 px |
| Panel height | Full viewport height minus header (48 px) |

---

### States

| State | Description |
|---|---|
| **Closed** | Default; not visible |
| **Open** | Panel visible at right edge; header icon button in active state |
| **Hover — header icon** | Icon button hover state |
| **Focus — header icon** | 2 px focus ring on icon button trigger |
| **Focus — inside panel** | Tab navigates sequentially within panel content |
| **Closed by** | Clicking the icon button again, pressing Esc, or clicking outside (if overlay close is enabled) |
| *Skeleton* | **Not stated** |
| *Disabled* | **Not stated** |
| *Error* | **Not stated** |

---

### Tokens consumed

| Element | Property | Role |
|---|---|---|
| Panel | background-color | layer-01 |
| Panel | border-left | border-subtle |
| Header icon (active) | background | `$background-active` |
| Focus | border | `$focus` |
| Content inside panel | — | Inherit respective component tokens |

---

### Anatomy

1. **Trigger (header icon button)** — the right-side header action button; its active state indicates the panel is open
2. **Panel container** — fixed-width (320 px) overlay drawer from the right edge
3. **Panel header** — section title and optional close × icon button
4. **Panel body** — product-supplied content (notifications list, user settings form, etc.); scrollable
5. **Close button (optional)** — × in panel header or footer; closes panel

---

---

# Appendix A — Complete Flat Catalogue Table

> **Purpose:** A single flat reference of every named component in the Carbon component catalogue. Use as an implementation checklist.
> **Columns:** Name | One-line purpose | Variant count | Skeleton state | Error state

*Variant count = number of distinct named variants (not sizes or states). "Skeleton" and "Error" = Yes / No / Not stated.*

| # | Component | One-line purpose | Variant count | Skeleton | Error |
|---|---|---|---|---|---|
| 1 | Accordion | Progressive disclosure; vertically stacked collapsible sections. | 2 (end-icon, start-icon) | Not stated | No |
| 2 | Breadcrumb | Secondary navigation showing current location in the IA hierarchy. | 2 (location-based, path-based) | Not stated | No |
| 3 | Button | Triggers actions; eight named visual weights and two type contexts. | 8 (primary, secondary, tertiary, ghost, danger-primary, danger-tertiary, danger-ghost, icon-only) | No | No |
| 4 | Checkbox | Multi-selection input control for independent item selection. | 3 (unselected, selected, indeterminate) + AI label | No | Yes |
| 5 | Code Snippet | Read-only copyable code strings in inline, single-line, or multi-line containers. | 3 (inline, single-line, multi-line) | Not stated | No |
| 6 | Contained List | Single-column in-container list with header, actions, and optional clickable rows. | 2 (on-page, disclosed) | Not stated | Not stated |
| 7 | Content Switcher | Toggles between two or more alternate views of related content. | 4 (text-high-contrast, text-low-contrast, icon-high-contrast, icon-low-contrast) | Not stated | No |
| 8 | Data Table | Tabular data display with sorting, selection, expansion, and batch-action capabilities. | 7 (default, multi-select, single-select, expandable, sortable, zebra, AI label) | Yes | Not stated |
| 9 | Date Picker | Date or date-range selection via text field and optional calendar popup. | 4 (simple, calendar-single, calendar-range, time picker) × 2 styles (default, fluid) | Yes | Yes |
| 10 | Dropdown | Styled select for choosing one (Dropdown), multiple (Multiselect), or typed (Combo box) options. | 4 (dropdown, multiselect, combo box, filterable multiselect) × 2 styles (default, fluid) | Yes | Yes |
| 11 | File Uploader | Enables users to select and upload files via button or drag-and-drop. | 2 (button, drag-and-drop) | Not stated | Yes (per-file + uploader-wide) |
| 12 | Form | Structural container grouping input controls for data collection. | 2 (default style, fluid style) | Yes | Yes |
| 13 | Inline Loading | Compact spinner providing feedback during brief in-page operations. | 1 | No | Yes (error state) |
| 14 | Link | Navigational text element for moving users to another page or resource. | 2 (standalone, inline) | Not stated | No |
| 15 | List | Vertical unordered (dash/bullet) or ordered (numbered) groupings of related items. | 2 (unordered, ordered) × 2 type sizes (productive, expressive) | No | No |
| 16 | Loading | Full-page or section circular spinner for operations expected to exceed 3 seconds. | 2 sizes (large, small) | No | No |
| 17 | Menu | Floating list of actions opened by a trigger; supports submenus and danger actions. | 6 (context, default action, single-select, multi-select, danger, submenu) | Not stated | Not stated |
| 18 | Modal | Focus-trapping dialog for immediate user response, confirmation, or critical notifications. | 5 (passive, transactional, danger, acknowledgment, progress) | Not stated | Yes (inline within modal) |
| 19 | Notification | System status and feedback messages in inline, toast, actionable, or callout formats. | 5 variants × 4 statuses (info, success, warning, error) | Not stated | Yes (error status) |
| 20 | Number Input | Numeric text field with increment/decrement controls for small value adjustments. | 2 styles (default, fluid) + AI label | Yes | Yes |
| 21 | Overflow Menu | Icon-button trigger (⋮) that opens a contextual Menu when space is constrained. | 1 | Not stated | Not stated |
| 22 | Pagination | Navigation controls for dividing large datasets or page-level content into pages. | 2 (pagination bar, pagination nav) | Not stated | Not stated |
| 23 | Popover | Base floating layer component for tooltips, menus, dropdowns, and custom disclosures. | 3 (no-tip, caret-tip, tab-tip) | Not stated | Not stated |
| 24 | Progress Bar | Visual track indicator showing completion of a determinate or indeterminate process. | 2 (determinate, indeterminate) | Not stated | Yes (error state) |
| 25 | Progress Indicator | Step-by-step multi-stage process guide showing completed, current, and future steps. | 4 (horizontal, vertical, non-interactive, interactive) | Not stated | Yes (error step state) |
| 26 | Radio Button | Mutually exclusive single-selection input; only one option selectable from a group. | 1 + AI label | Not stated | Yes |
| 27 | Search | Text field for users to explore content by keyword at global, page, or component level. | 2 styles (default, fluid) | Not stated | Not stated |
| 28 | Select | Native HTML `<select>` for form-based single-option selection; browser-rendered list. | 3 (default select, inline select, AI label) × 2 styles (default, fluid) | Yes | Yes |
| 29 | Slider | Horizontal track handle control for selecting a value or range within defined limits. | 4 (default, range, without input, with custom value) | Yes | Yes |
| 30 | Structured List | Multi-column display for related data (terms + definitions, comparisons) in read-only or selectable rows. | 2 (default, selectable) × 2 alignments (hang, flush) | Yes | Not stated |
| 31 | Tabs | Navigates between related content groups within the same page context. | 5 (line, contained, vertical, dismissible, icon-only) | Not stated | Not stated |
| 32 | Tag | Compact labels for categorizing, filtering, or selecting using keyword chips. | 4 (read-only, dismissible, selectable, operational) | Yes | No |
| 33 | Text Input | Free-form single-line or multi-line text entry; includes password variant with visibility toggle. | 6 (text-input-default, text-input-fluid, password-default, password-fluid, textarea-default, textarea-fluid) | Yes | Yes |
| 34 | Tile | Flexible content surface for grouping related information; base, clickable, selectable, or expandable. | 5 (base, clickable, selectable-single, selectable-multi, expandable) + AI label | Yes (base) | No |
| 35 | Toggle | Immediate binary on/off switch; changes take effect without form submission. | 2 sizes (default, small) | Yes | Not stated |
| 36 | Toggletip | Click-triggered popover disclosure supporting interactive elements (links, buttons, rich content). | 1 | Not stated | Not stated |
| 37 | Tooltip | Hover/focus-triggered non-interactive floating label for supplemental text only. | 3 (standard, definition, icon-button) | Not stated | Not stated |
| 38 | Tree View | Hierarchical nested list for navigating multi-level parent/child structures. | 2 (default, with icons) × 2 sizes (default, compact) | Not stated | Not stated |
| 39 | UI Shell — Header | Full-width top navigation bar containing product name, nav links, and global actions. | 1 (3 navigation patterns) | Not stated | Not stated |
| 40 | UI Shell — Left Panel | Persistent or collapsible left-side navigation panel for multi-level product navigation. | 3 (fixed, rail, overlay) | Not stated | Not stated |
| 41 | UI Shell — Right Panel | Collapsible right-edge overlay drawer for secondary info, notifications, or user settings. | 1 | Not stated | Not stated |

> **Additionally documented in Carbon's catalogue but not among the 41 detailed above:**

| # | Component | One-line purpose | Skeleton | Error |
|---|---|---|---|---|
| 42 | Combo Button | Button that pairs a primary action with a chevron trigger opening a Menu of related secondary actions. | Not stated | No |
| 43 | Menu Button | Ghost or tertiary button with a chevron that opens a Menu of actions; no primary action on the button itself. | Not stated | No |
| 44 | Text Area | Multi-line free-form text input; user-resizable height; included as a variant under Text Input in this document. | Yes | Yes |
| 45 | AI Label | Embeds a "Made with AI" explainability indicator into other components; not a standalone component. | Not stated | Not stated |
| 46 | Layer | Utility component that manages the layering context token (layer-01 / 02 / 03) for nested components. | Not stated | Not stated |
| 47 | Aspect Ratio | Utility component that maintains a consistent width-to-height ratio for media containers. | Not stated | Not stated |
| 48 | Grid | 16-column responsive layout utility; not a UI component but a structural system element. | Not stated | Not stated |

---

# Appendix B — Structural Ideas Behind the Catalogue

> **Source:** https://carbondesignsystem.com/components/overview/components/ and cross-component documentation.

---

## B.1  How Carbon Organises Components

Carbon groups its component catalogue into **functional categories** that reflect how components are used in a product interface. The categories are:

### Inputs
Components that accept data from users:
- **Free-form entry:** Text input, Text area, Number input, Search
- **Selection:** Checkbox, Radio button, Toggle, Dropdown, Multiselect, Combo box, Select, Content switcher, Date picker, Time picker
- **File handling:** File uploader
- **Range/scale:** Slider

### Navigation
Components that guide users through a product:
- **Global shell:** UI Shell Header, UI Shell Left Panel (Side Nav), UI Shell Right Panel
- **Within-page:** Tabs, Accordion, Breadcrumb, Pagination, Progress indicator, Tree view

### Containment and Layout
Components that group and surface content:
- **Cards:** Tile (base, clickable, selectable, expandable)
- **Lists:** Contained list, Structured list, List (unordered/ordered)
- **Overlay containers:** Modal, Popover, Toggletip, Tooltip

### Data Display
Components that present structured data:
- **Tabular:** Data table
- **Sequential process:** Progress bar

### Actions
Components that trigger operations:
- **Primary actions:** Button (primary, secondary, tertiary, ghost, danger variants)
- **Compact triggers:** Icon button, Overflow menu, Menu button, Combo button
- **Menus:** Menu, Overflow menu

### Status and Feedback
Components that communicate system state to users:
- **Loading states:** Loading, Inline loading, Skeleton (applied per-component)
- **Messages:** Notification (inline, toast, actionable, callout)
- **Labels:** Tag (read-only, dismissible, selectable, operational)
- **Process feedback:** Inline loading, Progress bar

### Utility and Structural
Supporting primitives not surfaced as standalone UI components:
- **Code display:** Code snippet
- **Hyperlinks:** Link
- **Structural utilities:** Layer, Grid, Aspect Ratio

---

## B.2  Pattern vs. Component

Carbon explicitly distinguishes **components** from **patterns**:

### Component
A **component** is a reusable, self-contained UI element with defined anatomy, states, tokens, and behaviour. Components are shipped as coded implementations in `@carbon/react`, `@carbon/web-components`, and other framework packages.

Examples: `Button`, `Modal`, `Tag`, `Data Table`

Components have:
- Named variants
- Defined states
- A specific set of design tokens
- Accessibility requirements
- Storybook stories and coded implementation

### Pattern
A **pattern** is a higher-order composition that solves a recurring design problem by combining multiple components and interaction logic. Patterns are documented in Carbon's guidelines but are **not shipped as single ready-made components** — product teams assemble them from primitives.

Examples from Carbon's pattern library:
- **Empty states** — how to handle pages or views with no data (uses illustrations, headings, and button)
- **Loading patterns** — when to use skeleton vs. loading spinner vs. inline loading
- **Forms** — multi-step form flows, form layout, optional/required labeling, validation timing
- **Filtering** — combining search, dropdowns, tags, and data tables
- **Notifications** — deciding between inline, toast, and callout notifications
- **Overflow content** — truncation, "read more", accordion expansion

The key distinction: **you can import a component; you have to build a pattern.**

---

## B.3  Cross-Cutting Rules

The following principles apply across multiple Carbon components and must be understood to implement any component correctly.

---

### Focus Handling

**Global rule:** Every interactive element must be focusable via keyboard. Focus must be visible at all times — no removing `:focus` outlines.

**Focus ring specification:**
- Outer ring: **2 px solid `$focus`** (default: `#0f62fe`, the IBM Blue 60)
- Inner inset: **1 px `$focus-inset`** (default: `$background` colour) — creates the "double ring" effect that separates the focus ring visually from the element border
- Applied to: Buttons, form inputs, links, icon buttons, tabs, nav items, toggle tracks, interactive tiles, tree view nodes

**Focus trap:**
- **Modal:** Focus is trapped inside the modal while it is open. Tab / Shift-Tab cycle through modal elements only. Focus returns to the trigger element when the modal closes.
- **Toggletip / Popover with interactive content:** Focus moves into the overlay when Tab is pressed; Esc closes the overlay and returns focus to the trigger.
- **Tooltip:** Focus does NOT enter the tooltip — tooltips are non-interactive and never receive focus themselves.

**Focus order:**
- Must follow DOM reading order (top-left → bottom-right in LTR; top-right → bottom-left in RTL).
- Modal and overlay components must reorder DOM focus if the visual trigger position is not at the expected place in the DOM.

**Keyboard shortcuts for interactive widgets:**
- **Accordion:** Space/Enter to expand/collapse focused header
- **Tabs:** Arrow left/right to move between tabs; Tab to exit the tablist
- **Tree view:** Arrow up/down/left/right for hierarchical traversal; Enter/Space to select; Home/End to first/last
- **Slider:** Arrow keys to move handle by 1 step; Shift+Arrow for 10 steps
- **Date picker calendar:** Arrow keys to navigate days; Page-up/Page-down for months; Enter to select
- **Menu:** Arrow up/down to navigate items; Enter/Space to activate; Arrow right to open submenus; Esc to close
- **Modal:** Esc always closes; last close trigger returns focus to opener

---

### Form Validation

**Error vs. Warning:**
- **Error** = the user **must** fix this to proceed (required field empty, invalid format, range violation, system error)
- **Warning** = the user **should** address this but may continue (edge case, unusual value, potential data loss)

**Validation timing:**
- **On submit** (preferred for first-time users) — validate all fields only when the user submits; reduces anxiety during input
- **On blur** (on field exit) — validate as soon as the user leaves a field; faster feedback for experienced users
- Never validate on every keystroke (too disruptive) unless implementing a character counter

**Error message anatomy (all form inputs):**
1. **Error icon** — inline inside the field (right side); `$support-error` colour
2. **2 px error border** — replaces default border; `$support-error` colour
3. **Error message** — replaces helper text; below the field; `text-error` colour; `$label-01` type token; must explain what happened AND provide resolution guidance (not just "Invalid input" — be specific)

**Inline notification in forms:**
- When a form submission fails for server-side reasons, place an **inline notification** (error status) at the top of the form (or the top of the relevant section) AND mark the specific fields with error states.
- Never use toast for form submission errors — the user needs a persistent, in-context message.

**Optional vs. Required labeling:**
- Mark the exception case — if most fields are required, only mark **(optional)** fields; if most fields are optional, only mark **(required)** fields.
- This must be **consistent throughout the entire product**.

**Group-level errors:**
- Checkbox groups and radio button groups can receive error/warning at the group level.
- The group label and all items are visually associated with the error; error message appears below the last item.

---

### Loading and Skeleton States

Carbon defines three distinct loading patterns for different scenarios:

| Scenario | Recommended pattern |
|---|---|
| Initial page load (structure known) | **Skeleton states** — per-component placeholders matching content shape |
| Initial page load (data-heavy; unknown structure) | **Loading spinner (large)** with overlay |
| In-page operation < 5 seconds (button-triggered) | **Inline loading** |
| In-page operation > 5 seconds (full section) | **Loading spinner (large)** within the section |
| Progressive data load (pagination, scroll) | **Loading spinner (small)** or **Inline loading** near the trigger |
| Data refresh in data table | **Loading spinner (large)** over the table with overlay |

**Skeleton states:**
- Not a component itself — each component defines its own skeleton variant
- A skeleton matches the approximate dimensions of the real content (never exact placeholders)
- Animated left-to-right shimmer using `$skeleton-background` and `$skeleton-element` tokens
- Used for: Text input, Select, Slider, Structured list, Data table rows, Tag, Toggle, Form fields, Tiles (base)
- Available on: The specific components listed in the flat table in Appendix A

**Skeleton implementation rules:**
- Skeleton and the real component occupy the same layout space (no layout shift on load completion)
- Skeleton never appears alongside the loading spinner — use one or the other
- Multiple skeleton instances can appear simultaneously (unlike loading spinners)
- All interactive elements on the page remain accessible during skeleton loading (unlike spinner + overlay)

**Loading spinner rules:**
- Only one loading spinner should appear at a time on a page (except during initial load or full-page refresh)
- Large spinner always appears with a semi-transparent overlay (`$overlay`) blocking interaction
- Small spinner appears inline (no overlay); associated interactive elements must be disabled during the operation

**Inline loading rules:**
- Always associated with the specific element that triggered the operation
- Four states cycle in order: Inactive → Active → Finished → (Inactive or Error)
- Success checkmark persists 1.5 seconds then auto-transitions unless a callback is provided
- Error state displays indefinitely until the user takes action

---

### Empty States

Carbon's empty state pattern applies when a view contains no data, results, or content. Three categories:

| Category | Description | Recommended action |
|---|---|---|
| **First time use** | User has not created any content yet | CTA button to create the first item; optional illustration |
| **User-cleared** | User deleted all content or cleared a filter | Explanation of what happened; CTA to reset/undo |
| **Error / No results** | System error or search returned nothing | Explanation; suggest retry action or alternative navigation |

Empty state recommendations:
- A heading describing the situation
- 1–2 sentences of supporting text
- One primary action button (not multiple)
- Optional illustration (Carbon provides a standard set)
- Do NOT use an empty state for loading — use skeleton or spinner instead

---

### Responsive Behaviour

Carbon's responsive system is built on the **16-column grid** with five breakpoints:

| Breakpoint | Token | Width |
|---|---|---|
| Extra small | `sm` | 0–320 px |
| Small | `sm` | 320–672 px |
| Medium | `md` | 672–1056 px |
| Large | `lg` | 1056–1312 px |
| Extra large | `xlg` | 1312–1584 px |
| Maximum | `max` | 1584+ px |

**Component-level responsive rules:**

- **Modal:** All sizes expand to **100% width** at the 320 px breakpoint; max-height does not apply on mobile.
- **Tabs:** When tabs overflow the tablist width, scroll arrows appear (left/right chevron buttons). On mobile, consider replacing line tabs with a dropdown/select or content switcher.
- **Data table:** On small breakpoints, consider replacing the full table with a mobile-friendly alternative (stacked card list, or a simplified read-only view).
- **Breadcrumb:** Never wraps to a second line — overflow is handled by the built-in overflow menu pattern.
- **Notification (toast):** Fixed width of 288 px on all breakpoints; stacks vertically if multiple toasts appear.
- **Pagination:** At the small breakpoint, select components are removed from the pagination bar; only item count and prev/next navigation remain.
- **UI Shell header:** Switches from horizontal navigation links to a hamburger menu pattern at the medium breakpoint.
- **UI Shell left panel:** Transitions from fixed/rail to overlay mode at the medium breakpoint.
- **Accordion:** Right-margin of panel content adjusts at each breakpoint (see §1, Sizes).
- **Button groups:** Fluid full-bleed button groups (as in modal footers) remain full-bleed at all breakpoints; fixed-width button groups maintain their widths.

**Type-scale responsiveness:**
- Productive type tokens (`$body-short-01`, `$label-01`, `$heading-01`, etc.) do **not** scale with viewport.
- Expressive type tokens (`$display-01`, `$expressive-heading-*`, `$fluid-heading-*`) **do** scale — they are defined as clamp() expressions or responsive overrides per breakpoint using Carbon's type scale.
- The distinction between "productive" (static, functional) and "expressive" (dynamic, editorial) type contexts runs throughout the system — buttons, headings, and body copy all have both contexts.

---

## B.4  Theming and Layering

**Carbon themes:**
- `white` — default light theme; `$layer-01` = white
- `g10` — light gray theme; `$layer-01` = Gray 10
- `g90` — dark gray theme
- `g100` — near-black theme

**Layer tokens:**
- Layer tokens (`$layer-01`, `$layer-02`, `$layer-03`) shift values based on the theme and the nesting depth of a component.
- A Dropdown menu appearing on a `$layer-01` background uses `$layer-02` for its open menu container.
- The `Layer` utility component manages this contextual token promotion automatically.
- Tile, Card, Modal, Popover, and Menu all rely on contextual layer tokens (marked with `*` throughout this document).

**AI label styling:**
- Many components now have an "with AI label" variant that applies a linear-gradient border and box-shadow using dedicated AI tokens (not part of standard `@carbon/themes`).
- AI tokens are part of the `@carbon/ai` package and the Carbon for AI guidelines.
- The AI label does not change component functionality — only visual styling.

---

## B.5  Accessibility Foundations

All Carbon components are designed to meet **WCAG 2.1 AA** (and aspire to AAA where practical). Key cross-cutting accessibility rules:

| Rule | Detail |
|---|---|
| **Focus visible** | All interactive elements must have a visible focus indicator meeting 3:1 contrast against adjacent colours |
| **Disabled contrast** | Disabled elements are explicitly exempted from WCAG contrast requirements — Carbon uses muted disabled tokens intentionally |
| **Read-only vs. Disabled** | Read-only elements ARE focusable and must pass contrast; disabled elements are NOT focusable and need not pass contrast |
| **Error messaging** | Never use colour alone to communicate error — always pair colour with an icon and text |
| **Motion** | All animations respect the user's `prefers-reduced-motion` media query; loading animations typically fade rather than animate |
| **ARIA roles** | Tree view uses `role="tree"` / `role="treeitem"`; Modal uses `role="dialog"` + `aria-modal="true"`; Tabs use `role="tablist"` / `role="tab"` / `role="tabpanel"`; Tooltip uses `role="tooltip"` |
| **Screen reader announcements** | Toast notifications use `role="alert"` or `aria-live="assertive"` to be announced immediately; inline notifications use `aria-live="polite"` |
| **Icon-only buttons** | All icon-only buttons must have an associated tooltip providing the accessible label; this is not optional |

---

*End of document.*

*Source: https://carbondesignsystem.com — all component Usage and Style tabs fetched at time of authorship.*
*Carbon version: v4.3.60 (from `gtc-version` page meta).*
*Exact token name values that were blank in the rendered HTML are documented by semantic role; SCSS token names are cited where the page explicitly printed them.*
```

---

That is the **complete file content**. Here is a summary of what is now complete:

---

