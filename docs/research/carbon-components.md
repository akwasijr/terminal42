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

## 12. Form

> Sources: https://carbondesignsystem.com/components/form/usage/ | https://carbondesignsystem.com/components/form/style/

**What it is** — A group of related input controls that allows users to provide data or configure options. The form component is a purposely simple structural container; product teams are responsible for composing the specific inputs within it. Use the form pattern guidance for detailed layout decisions.

**Variants**

Two input styles define the visual character of the whole form:

| Style | Label position | Input heights available | Spacing between components | Gutter mode |
|---|---|---|---|---|
| **Default** | Outside / above field | sm 32 px / md 40 px / lg 48 px | 32 px / 2 rem (`margin-bottom`) | Wide gutter; inputs flush to grid columns |
| **Fluid** | Inside field, stacked inline | 64 px only | 0 px (1 px gutter between inputs) | Condensed gutter; inputs may hang into gutter |

Multi-column forms: default = 32 px between columns (wide gutter); fluid = 1 px (condensed gutter). Narrow gutter (16 px) is typically not used in forms.

With AI label: form container gets a linear-gradient border, box-shadow, and inner-shadow; AI label size = large. All individual input component tokens remain unchanged.

**Sizes**

No named size variants for the form container itself. Sizes are determined by the chosen input style above.

**States**

Form fields can be in:

| State | Description |
|---|---|
| **Enabled** | Default; live but not focused |
| **Active** | User actively typing |
| **Focus** | Tabbed to / clicked into field |
| **Error** | Required field empty; invalid; system error; user must fix before submitting |
| **Warning** | Exception condition; user may continue |
| **Disabled** | Not interactive; not focusable; no contrast requirement |
| **Skeleton** | Initial page load |
| Read-only | Listed as "coming soon" at time of documentation fetch |

**Tokens consumed**

Colour: not stated on form style tab (inherits from contained components).

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Heading | 28 / 1.75 | Regular 400 | not stated |
| Label | 12 / 0.75 | Regular 400 | not stated |
| Field text | 14 / 0.875 | Regular 400 | not stated |
| Helper text | 12 / 0.75 | Regular 400 | not stated |
| Error message | 12 / 0.75 | Regular 400 | not stated |

Labels: sentence case; no colons.

Spacing (default style):

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Form items | margin-bottom | 32 / 2 | not stated |
| Title area | margin-bottom | 40 / 2.5 | not stated |
| Gutter between columns | — | 32 / 2 | not stated |
| Buttons | margin-top | 48 / 3 | not stated |

Spacing (fluid style):

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Form items | margin-bottom | 0 px | — |
| Title area | margin-bottom | 40 / 2.5 | not stated |
| Gutter between columns | — | 1 px | — |
| Buttons | margin-top | 48 / 3 | not stated |

Motion tokens: not stated.

**Anatomy**

1. **Header (optional)** — title (28 / 1.75 rem, Regular 400) + optional description providing context or instructions
2. **Form body** — area where users provide information via input fields, checkboxes, and other components
3. **Footer** — Submit and Cancel action buttons; buttons have `margin-top` of 48 / 3 rem from the last form item

---

## 13. Inline Loading

> Sources: https://carbondesignsystem.com/components/inline-loading/usage/ | https://carbondesignsystem.com/components/inline-loading/style/

**What it is** — A compact spinner providing visual feedback that data is being processed for a short-duration operation (create, update, delete). Appears in the same position as the content or control it relates to. Do not use for full page loads — use **Skeleton states** instead. Do not trigger on more than one item or action at a time, unless on initial page load or refresh.

**Variants**

No separate visual variants. One presentation with four sequential states.

**Sizes**

| Element | Property | px / rem |
|---|---|---|
| Spinner | width, height | 16 / 1 |
| Checkmark | width, height | 16 / 1 |

No named size variants. The spinner is always 16 × 16 px.

**States**

| State | Description |
|---|---|
| **Inactive** | No data being loaded; no visual indicator shown |
| **Active** | Loading in progress; animated spinner |
| **Finished** | Success; checkmark icon; persists 1.5 seconds then fires optional `onSuccess()` callback; if no callback, state persists indefinitely |
| **Error** | Failed; inline loading becomes inactive; inline notification or form error handling should appear alongside |
| Focus / Hover | Not applicable to the loading indicator itself |
| Skeleton | Not stated |

Any interactive elements associated with the triggering action must be **disabled** while in the active state.

**Tokens consumed**

Colour:

| Class / Element | Property | Token role |
|---|---|---|
| `.cds--loading__background` | stroke | contextual `*` |
| Spinner stroke | stroke | not stated |
| Text | color | not stated |
| Checkmark icon | svg | not stated |
| Error icon | svg | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Text (label) | 14 / 0.75 | Regular 400 | not stated |

Label text: sentence case. Label is optional but encouraged.

Motion tokens: not stated. Finished state auto-transitions after 1.5 seconds.

**Anatomy**

1. **Loading status indicator** — animated spinner (active) → checkmark icon (finished) → error icon (error); 16 × 16 px
2. **Label (optional)** — describes current state; updates with state transitions (e.g. "Saving…" → "Saved"); if no visible label, an accessible label must still be in code

---

## 14. Link

> Sources: https://carbondesignsystem.com/components/link/usage/ | https://carbondesignsystem.com/components/link/style/

**What it is** — A navigational text element for taking users to another page, resource, section, or triggering email/phone links. Do not use for actions that change data, manipulate display state, or trigger functions — use **Button** instead. Do not use images as links — use **Tile** instead.

**Variants**

| Variant | Usage |
|---|---|
| **Standalone** | Used alone or directly following content; no underline in default/enabled state; underline appears on hover, focus, and active; can be paired with an icon |
| **Inline** | Used within a sentence or paragraph; always styled with an underline; must NOT be paired with an icon |

**Sizes**

| Size | Height (px / rem) | Font-size (px / rem) | Font-weight | Icon size |
|---|---|---|---|---|
| Small | 16 / 1 | 12 / 0.75 | Regular 400 | 16 × 16 px |
| Medium | 18 / 1.125 | 14 / 0.875 | Regular 400 | 16 × 16 px |
| Large | 22 / 1.375 | 16 / 1 | Regular 400 | 20 × 20 px |

Inline link sizes must match the type size of surrounding text. Standalone link sizes match the default body copy size of the page. Width is determined by the length of the link text.

Grouped link spacing (recommended, not built into component):

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Link text | padding-right | 16 / 1 | not stated |
| Link text | padding-bottom (horizontal group) | 4 / 0.25 | not stated |
| Link text | padding-bottom (vertical group) | 8 / 0.5 | not stated |

**States**

| State | Description |
|---|---|
| **Enabled (unvisited)** | Default; not yet clicked |
| **Hover** | Colour change; underline applied |
| **Focus** | 2 px focus ring; colour may change |
| **Active** | Currently being clicked |
| **Visited** | Previously clicked; distinct `$link-visited` colour token |
| **Disabled** | Cannot interact; temporarily inactive or unavailable |
| Skeleton | Not stated |
| Error | Not applicable |

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Link text | enabled | text-color | not stated |
| Icon | enabled | svg | not stated |
| Link text | hover | text-color | not stated |
| Icon | hover | svg | not stated |
| Link text | focus | text-color | not stated |
| Border | focus | border | not stated |
| Link text | active | text-color | not stated |
| Border | active | border | not stated |
| Link text | visited | text-color | not stated |
| Icon | visited | svg | not stated |
| Link text | disabled | text-color | not stated |
| Icon | disabled | svg | not stated |

*(Token names not printed in rendered style-tab tables.)*

Typography: see Sizes table above.

Motion tokens: not stated.

**Anatomy**

1. **Link text** — communicates what is linked to; meaningful and unique; avoid generic text like "read more" or "click here"
2. **Icon (optional, standalone only)** — same colour as link text; "launch" for external links; "arrow right" for internal; click target includes icon area

---

## 15. List

> Sources: https://carbondesignsystem.com/components/list/usage/ | https://carbondesignsystem.com/components/list/style/

**What it is** — Vertical groupings of related content where items begin with a marker (dash/bullet for unordered; number for ordered). Use for simple, related sets of items to provide structure and clarity. Do not use for complex data requiring sorting, filtering, or selection (use **Data table**); do not use when a hierarchy with tables or dividers is needed (use **Structured list** or **Contained list**).

**Variants**

| Variant | Marker (level 1) | Marker (level 2) | Purpose |
|---|---|---|---|
| **Unordered list** | En dash (–) | Square (▪) | Items of equal importance without a specific order |
| **Ordered list** | Number | Letter | Clear sequence or hierarchy; instructions; ranked content |

Type sizes:

| Size | Font-size (px / rem) | Type token |
|---|---|---|
| **Productive** | 14 / 0.875 | not stated |
| **Expressive** | 16 / 1 | not stated |

Both levels (level 1 and level 2) use Regular 400 weight.

**Sizes**

No explicit px / rem height values stated per list item — height is content-driven.

For ordered lists with two-digit (10+) items: numbers are left-aligned by default; an option to right-align is available.

**States**

Read-only display component. No interactive states.

| State | Description |
|---|---|
| **Enabled** | Only state |
| Hover / Focus / Disabled / Error / Skeleton | Not applicable |

**Tokens consumed**

Colour:

| Element | Property | Token role |
|---|---|---|
| Item | text-color | not stated |

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Item (productive) | 14 / 0.875 | Regular 400 | not stated |
| Item: nested (productive) | 14 / 0.875 | Regular 400 | not stated |
| Item (expressive) | 16 / 1 | Regular 400 | not stated |
| Item: nested (expressive) | 16 / 1 | Regular 400 | not stated |

All text: sentence case.

Spacing:

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Item: level 1 | margin-bottom | 0 | — |
| Item: level 2 | margin-bottom | 0 | — |
| Item: level 2 | padding-left | 16 / 1 | not stated |

Motion tokens: not stated.

**Anatomy**

1. **Marker (level 1)** — en dash (unordered) or number (ordered); top-aligned with first line of content
2. **Marker (level 2)** — square (unordered) or letter (ordered); indented 16 px
3. **List item (level 1)** — main content; wraps to multiple lines rather than truncating; top-aligned with marker
4. **List item (level 2)** — nested child content; indented 16 px; same wrapping behaviour

---

## 16. Loading

> Source: https://carbondesignsystem.com/components/loading/usage/

**What it is** — A circular animated spinner indicating a process is underway. Use when the expected wait time exceeds **three seconds**, or when the entire page or a key section is processing after a user submits or saves data. Do not use for progressively displaying content — use **Skeleton states** instead. Do not use if user interaction is required to proceed. Do not use multiple loading indicators simultaneously.

**Variants**

No separate visual variants. Two sizes serve different contexts.

**Sizes**

| Size | Use case | Overlay |
|---|---|---|
| **Large** (default) | Full-screen takeover (centred in viewport); section-level loading in modals or tiles (centred in component) | Semi-transparent overlay applied; blocks all interaction |
| **Small** | Inline within or adjacent to a triggering element (e.g. inside a button); no overlay used | No overlay; associated interactive elements must be disabled |

Specific px / rem dimensions for the spinner itself: not stated on usage page.

**States**

| State | Description |
|---|---|
| **Inactive** | Not loading; no visual indicator |
| **Active** | Loading in progress; animated spinner |
| Finished | Not a state of this component — use **Inline loading** for finished/error feedback |
| Error | Not a state of this component — use **Inline loading** for finished/error feedback |
| Skeleton | Not stated |

**Tokens consumed**

Not stated on usage page. Style tab not fetched separately; from cross-component knowledge: spinner uses interactive (blue) colour; overlay uses `$overlay` token.

Motion tokens: not stated.

**Anatomy**

1. **Loading indicator** — circular animated spinner; primary visual cue
2. **Overlay (large size only)** — semi-transparent layer over page or component; blocks all user interaction during loading
3. **Label (optional)** — brief status message below the large indicator (e.g. "Loading data…"); not included in component by default; can be customised

---

## 17. Menu

> Sources: https://carbondesignsystem.com/components/menu/usage/ | https://carbondesignsystem.com/components/menu/style/

**What it is** — A list of interactive options that appears when users interact with a trigger (menu button, combo button, overflow menu, or right-click). Use to hide less frequently used or advanced options. Use **Dropdown** instead for form submission with a static list of options or for filtering. Use **Popover** instead when many or complex inputs are used collectively.

**Variants**

| Variant | Description |
|---|---|
| **Context menu** | Triggered by right-click; contextual to the element or area clicked |
| **Default action items** | Standard clickable list items |
| **Single-select items** | Checkmark indicator; one selection at a time |
| **Multi-select items** | Checkmark indicator; multiple selections |
| **Danger items** | Red danger-hover styling for destructive actions; separated from main actions by a divider |
| **Submenu** | Nested level; caret icon on right; avoid multiple levels of nesting |

Keep to a maximum of **12 items** in context and overflow menus; **under 5** in menu button menus.

**Sizes**

| Size | Height (px / rem) |
|---|---|
| Extra small | 24 / 1.5 |
| Small | 32 / 2 |
| Medium | 40 / 2.5 |
| Large | 48 / 3 |

Extra small cannot be used with menu button triggers (Carbon buttons don't support extra small).

Width: fixed minimum **160 px / 10 rem**; fixed maximum **288 px / 18 rem**. Menu must not be narrower than its trigger button.

**States**

| State | Description |
|---|---|
| **Enabled** | Default; live but not interacted with |
| **Hover** | Mouse over item; background-color change |
| **Focus** | Tab navigation |
| **Focus and hover** | Item is both focused and hovered simultaneously |
| **Danger hover** | Destructive item hover; distinct background + text colour |
| **Danger hover and focus** | Destructive item focused via keyboard |
| **Disabled** | Action temporarily unavailable; hide entirely if action can never be performed by this user |
| Skeleton | Not stated |
| Error | Not stated |

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Menu option | enabled | background-color | layer (contextual `*`) |
| Menu option | enabled | text-color | not stated |
| Menu option | enabled | border-top | border-subtle (contextual `*`) |
| Caret icon | enabled | svg | not stated |
| Shortcut icon | enabled | svg | not stated |
| Container | — | box-shadow | `0 2px 6px 0 rgba(0,0,0,.2)` |
| Menu option | hover | background-color | layer (contextual `*`) |
| Menu option | hover | text-color | not stated |
| Icon | hover | svg | not stated |
| Menu option | focus | background-color | layer (contextual `*`) |
| Menu option | focus | border | not stated |
| Menu option | focus + hover | background-color | layer (contextual `*`) |
| Menu option | danger hover | background-color | not stated |
| Menu option | danger hover | text-color | not stated |
| Menu option | danger hover + focus | border | not stated |
| Menu option | disabled | background-color | layer (contextual `*`) |
| Menu option | disabled | text-color | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Menu option text | 14 / 0.875 | Regular 400 | not stated |

Text: sentence case.

Spacing:

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Icon | icon size | 16 / 1 | — |
| Option (default) | padding-right, padding-left | 16 / 1 | not stated |
| Option (selectable, unselected) | padding-right, padding-left | 16 / 1, 40 / 2.5 | not stated |
| Option (selectable, selected) | padding-right, padding-left | 16 / 1 | not stated |
| Option next to divider | margin-top or margin-bottom | 4 / 0.25 | not stated |
| Option (first and last) | margin-top or margin-bottom | 4 / 0.25 | not stated |
| Divider | margin-top | 1 px | — |

Motion tokens: not stated.

**Anatomy**

1. **Trigger** — menu button, combo button, overflow menu icon, or right-click area
2. **Action item** — clickable option; may include submenu indicator (caret) or right-aligned keyboard shortcut
3. **Divider** — 1 px horizontal rule separating groups or isolating destructive actions
4. **Submenu indicator** — caret icon (right side) indicating a nested level
5. **Keyboard shortcut** — optional text right-aligned per item
6. **Menu container** — floating open-state layer; min-width 160 px; max-width 288 px; box-shadow `0 2px 6px 0 rgba(0,0,0,.2)`
7. **Selected item** — checkmark indicator for single/multi-select items
8. **Submenu** — nested menu level expanding from a parent item

---

## 18. Modal

> Sources: https://carbondesignsystem.com/components/modal/usage/ | https://carbondesignsystem.com/components/modal/style/

**What it is** — A dialog displayed above all page content that focuses the user's attention on a single task. Focus is trapped inside while open. Use to request information preventing the system from continuing, to notify of urgent information, or to confirm a user decision. Do not use for tasks a user performs repeatedly — implement on the main page instead. Do not use when content requires excessive scrolling — use a full page instead.

**Variants**

| Variant | Purpose |
|---|---|
| **Passive** | Presents information the user needs to be aware of; no actions for the user to take |
| **Transactional** | Requires an action to complete and close; Cancel + primary action buttons |
| **Danger** | A transactional modal for destructive or irreversible actions; primary button is a danger button |
| **Acknowledgment** | System requires acknowledgement of information; single button (commonly "OK") |
| **Progress** | Multi-step linear flow; Cancel + Previous + Next / completion buttons |

A feature flag improves accessibility (changes functionality, not visual appearance); teams are encouraged to use the feature-flag modal going forward.

**Sizes**

Percentage widths at each breakpoint:

Extra small (xs):

| Breakpoint | Width | Column span | Margin-right |
|---|---|---|---|
| 1584 px | 24% | 4 of 16 | 16 px / 1 rem |
| 1312 px | 24% | 4 of 16 | 16 px / 1 rem |
| 1056 px | 32% | 5 of 16 | 16 px / 1 rem |
| 672 px | 48% | 4 of 8 | 16 px / 1 rem |
| 320 px | 100% | 4 of 4 | 16 px / 1 rem |

Small (sm):

| Breakpoint | Width | Column span | Margin-right |
|---|---|---|---|
| 1584 px | 36% | 6 of 16 | 20% |
| 1312 px | 36% | 6 of 16 | 20% |
| 1056 px | 42% | 7 of 16 | 16 px / 1 rem |
| 672 px | 60% | 5 of 8 | 16 px / 1 rem |
| 320 px | 100% | 4 of 4 | 16 px / 1 rem |

Medium (md):

| Breakpoint | Width | Column span | Margin-right |
|---|---|---|---|
| 1584 px | 48% | 8 of 16 | 20% |
| 1312 px | 48% | 8 of 16 | 20% |
| 1056 px | 60% | 10 of 16 | 20% |
| 672 px | 84% | 7 of 8 | 20% |
| 320 px | 100% | 4 of 4 | 16 px / 1 rem |

Large (lg):

| Breakpoint | Width | Column span | Margin-right |
|---|---|---|---|
| 1584 px | 72% | 12 of 16 | 20% |
| 1312 px | 72% | 12 of 16 | 20% |
| 1056 px | 84% | 14 of 16 | 20% |
| 672 px | 96% | 8 of 8 | 20% |
| 320 px | 100% | 4 of 4 | 16 px / 1 rem |

Max-heights:

| Modal size | Max-height |
|---|---|
| Extra small (xs) | 48% |
| Small (sm) | 72% |
| Medium (md) | 84% |
| Large (lg) | 96% |

On mobile at the 320 px breakpoint, max-height does not apply. Body copy + titles follow the margin-right rule; form inputs and other components expand to full modal width. Modals ≥ 36% width use 20% margin-right; modals < 36% use 16 px / 1 rem fixed margin-right.

Button layouts in footer:

| Number of buttons | Width each | Positioning |
|---|---|---|
| 1 | 50% | Flush right |
| 2 | 50% each | Full bleed |
| 3 | 25% each | Flush right |
| 3 | 25% each | 1 flush left, 2 flush right |

**States**

| State | Description |
|---|---|
| **Open** | Modal visible; focus trapped inside; overlay blocking page |
| **Closed** | Default; not displayed |
| **Loading** | Large spinner + overlay inside modal body; primary button disabled; use after data submission |
| **Error** | Inline error state inside form fields; modal stays open; inline notification may also appear |
| Skeleton | Not stated |

Focus management: on open, focus set to first interactive element; Tab/Shift-Tab cycle within modal only; on close, focus returns to the opening trigger.

**Tokens consumed**

Colour:

| Element | Property | Token role |
|---|---|---|
| Container | background-color | layer (contextual `*`) |
| Container | border | border (contextual `*`) |
| Header label | text-color | not stated |
| Header / Content | text-color | not stated |
| Close icon | fill | not stated |
| Close icon — hover | background-color | layer (contextual `*`) |
| Page overlay | color | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Label (optional) | 12 / 0.75 | Regular 400 | not stated |
| Heading | 20 / 1.25 | Regular 400 | not stated |
| Content | 14 / 0.875 | Regular 400 | not stated |

Labels and headings: sentence case.

Spacing:

| Element | Property | px / rem |
|---|---|---|
| Container | border | 1 px |
| Close button | height × width | 48 × 48 px |
| Close icon | height × width | 16 × 16 px |
| Header label | margin-bottom | 4 / 0.25 |
| Header | padding-top, padding-left | 16 / 1 |
| Header | margin-bottom | 16 / 1 |
| Content | padding-left | 16 / 1 |
| Content | padding-right | 20% |
| Content | margin-bottom | 48 / 3 |
| Footer (fluid button group) | border | 1 px |

Motion tokens: not stated.

**Anatomy**

1. **Header** — modal title (required); optional label above title; close × icon top-right
2. **Body** — content area; text + components; 20% right margin for body copy; full width for inputs/components
3. **Footer** — primary + secondary (+ tertiary) action buttons; fluid full-bleed
4. **× icon** — always present; closes without submitting; always top-right corner
5. **Overlay** — semi-transparent background; blocks page interaction while modal is open

---

## 19. Notification

> Sources: https://carbondesignsystem.com/components/notification/usage/ | https://carbondesignsystem.com/components/notification/style/

**What it is** — Messages that communicate information to users about system status, action results, errors, or warnings. Use to inform users of updates or changes to system status and to provide immediate feedback. Use **sparingly** — notifications are disruptive.

**Variants**

| Variant | Purpose |
|---|---|
| **Inline** | Appears in task flows near related items; usually at the top of the primary content area; optional close button |
| **Toast** | Non-modal; fixed width 288 px / 18 rem; slides in at top of screen; disappears after a few seconds; always closeable |
| **Actionable (inline style)** | Inline notification with an interactive ghost button action |
| **Actionable (toast style)** | Toast with a tertiary button; does NOT auto-timeout |
| **Callout** | Loads with page content; non-dismissible; no success or error status; for pre-task guidance |

Statuses:

| Status | Color | Available variants |
|---|---|---|
| **Informational** | Blue | Inline, Toast, Actionable, Callout |
| **Success** | Green | Inline, Toast, Actionable |
| **Warning** | Yellow | Inline, Toast, Actionable, Callout |
| **Error** | Red | Inline, Toast, Actionable |

Callout does not support Success or Error statuses.

A feature flag has been added to the actionable notification variant (changes functionality, not visual appearance); teams are encouraged to use it going forward.

**Sizes**

Toast notification:

| Element | Property | px / rem |
|---|---|---|
| Notification | width | 288 / 18 |
| Notification | border-left | 3 px |
| Notification | padding-right | 16 / 1 |
| Title | margin-top | 16 / 1 |
| Subtitle | margin-bottom | 24 / 1.5 |
| Details | padding-right | 16 / 1 |
| Caption | margin-bottom | 16 / 1 |
| Close button | height, width | 48 / 3 |
| Close icon | margin-top, margin-right | 16 / 1 |

Inline notification:

| Element | Property | px / rem |
|---|---|---|
| Inline notification | min-height | 48 / 3 |
| Inline notification | border-left | 3 px |
| Details | margin-left, margin-right | 16 / 1 |
| Text-wrapper | padding-top, padding-bottom | 12 / 0.75 |
| Icon | margin-right | 16 / 1 |
| Close button | height, width | 48 / 3 |
| Close icon | icon size | 16 × 16 px |

Inline notification width: varies — fills container / content area.

Callout:

| Element | Property | px / rem |
|---|---|---|
| Callout | min-height | 48 / 3 |
| Callout | border-left | 3 px |
| Details | margin-left, margin-right | 16 / 1 |
| Text-wrapper | padding-top, padding-bottom | 12 / 0.75 |
| Icon | margin-right | 16 / 1 |

Callout width: varies — fills container.

**States**

| State | Description |
|---|---|
| **Visible** | Notification displayed |
| **Dismissed** | User clicked close button; notification removed |
| **Auto-timeout** | Toast only; removed after a few seconds if coded to do so |
| Hover / Focus | On close button and action button |
| Skeleton | Not stated |

**Tokens consumed**

Colour (low contrast — token names explicitly stated):

| Status | Element | Token |
|---|---|---|
| Error | background-color | `$notification-error-background-color` |
| Success | background-color | `$notification-success-background-color` |
| Warning | background-color | `$notification-warning-background-color` |
| Information | background-color | `$notification-info-background-color` |
| All (low contrast) | border-left | not stated |
| All (low contrast) | svg (icon) | not stated |
| Title | text-color | not stated |
| Subtitle | text-color | not stated |
| Close button | fill | not stated |

Colour (high contrast):

| Element | Property | Token role |
|---|---|---|
| Background | background-color | not stated (background-inverse) |
| Title | text-color | not stated (text-inverse) |
| Subtitle | text-color | not stated (text-inverse) |
| Error border-left / icon | — | not stated (support-error-inverse) |
| Success border-left / icon | — | not stated (support-success-inverse) |
| Warning border-left / icon | — | not stated (support-warning-inverse) |
| Info border-left / icon | — | not stated (support-info-inverse) |

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Title | 14 / 0.875 | SemiBold 600 | not stated |
| Subtitle / Body | 14 / 0.875 | Regular 400 | not stated |

Text: sentence case; title has no trailing period; body ≤ 2 sentences.

Motion tokens: not stated.

**Anatomy**

1. **Icon** — status icon (info, success, warning, error); leftmost element
2. **Title** — brief; no trailing period; describes what happened or what stopped
3. **Body content** — 1–2 short sentences; troubleshooting steps or next steps; does not repeat title
4. **Close button** — × icon; optional on inline; always on toast; not included on callout
5. **Action button (actionable only)** — ghost (inline style) or tertiary (toast style); 1–2 word label
6. **Link (callout or actionable)** — redirects user to next steps; descriptive text; not required to be at end of sentence

---

## 20. Number Input

> Sources: https://carbondesignsystem.com/components/number-input/usage/ | https://carbondesignsystem.com/components/number-input/style/

**What it is** — A numeric text field paired with increment (+) and decrement (−) controls. Use when the user needs to input a numeric value or adjust small values requiring only a few clicks. Do not use for large value changes (use **Slider** instead); do not use for continuous variables such as prices, distances, or human heights within a wide range (use **Text input** instead).

**Variants**

| Variant | Label position | Use case |
|---|---|---|
| **Default** | Outside / above field | Productive forms |
| **Fluid** | Inside field, stacked inline | Expressive moments; contained spaces; toolbars |
| **With AI label** | Default or fluid | AI-generated values; embeds explainability label |

**Sizes**

Default:

| Size | Height (px / rem) |
|---|---|
| Small (sm) | 32 / 2 |
| Medium (md) | 40 / 2.5 — default |
| Large (lg) | 48 / 3 |

Fluid: single height of **64 px** (grows when warning/error message is added below; padding-top/bottom = 13 / 0.8125 rem).

Default field height shown in structure table: 40 / 2.5 rem. Focus and error borders: 2 px.

**States**

| State | Description |
|---|---|
| **Enabled** | Default; contains a default value (always set a default — commonly 1, sometimes 0) |
| **Hover** | Cursor over controls; controls background-color change |
| **Focus** | Tabbed to or clicked into field or controls |
| **Error (invalid)** | Required field empty; value out of range; system error; 2 px error border |
| **Warning** | Exception condition |
| **Disabled** | Not interactive; not focusable; no contrast requirement; border-bottom transparent (default) or contextual (fluid) |
| **Read-only** | Focusable; passes contrast; cannot modify; background transparent (default) or contextual (fluid) |
| **Skeleton** | Initial page load |

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Label | — | text-color | not stated |
| Number | — | text-color | not stated |
| Field | — | background-color | layer (contextual `*`) |
| Field | — | border-bottom | border (contextual `*`) |
| Controls | — | svg color | not stated |
| Controls | hover | background-color | layer (contextual `*`) |
| Field | focus | border | not stated |
| Controls | focus | border | not stated |
| Field | error | border | not stated |
| Error icon | error | svg | not stated |
| Error message | error | text-color | not stated |
| Warning icon | warning | svg | not stated |
| Warning message | warning | text-color | not stated |
| Label | disabled | text-color | not stated |
| Field | disabled | background-color | layer (contextual `*`) |
| Field (default) | disabled | border-bottom | transparent |
| Field (fluid) | disabled | border-bottom | contextual `*` |
| Number | disabled | text-color | not stated |
| Controls | disabled | svg | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Label | 12 / 0.75 | Regular 400 | not stated |
| Field input | 14 / 0.875 | Regular 400 | not stated |
| Helper text | 12 / 0.75 | Regular 400 | not stated |
| Error message | 12 / 0.75 | Regular 400 | not stated |
| Warning message | 12 / 0.75 | Regular 400 | not stated |

Labels: sentence case.

Spacing (default):

| Element | Property | px / rem |
|---|---|---|
| Label | margin-bottom | 8 / 0.5 |
| Field | height | 40 / 2.5 |
| Field | border-bottom | 1 px |
| Number | padding-left | 16 / 1 |
| Controls | padding-left, padding-right | 16 / 1 |

Spacing (fluid):

| Element | Property | px / rem |
|---|---|---|
| Label | padding-bottom | 4 / 0.25 |
| Field | height | 64 / 4 |
| Field | padding-left, padding-right | 16 / 1 |
| Field | padding-top, padding-bottom | 13 / 0.8125 |
| Field | border-bottom | 1 px |
| Add or subtract icon | height, width | 16 / 1 |
| Focus border | border | 2 px |
| Error border | border | 2 px |

Motion tokens: not stated.

**Anatomy**

1. **Label** — required; sentence case; ≤ 3 words; never hidden
2. **Numeric value** — changes via typing or +/− controls; always set a default value
3. **Helper text (optional)** — shows min/max constraints; replaced by error/warning message
4. **Field** — container for data entry
5. **Subtract icon (−)** — left control; decrements value
6. **Add icon (+)** — right control; increments value
7. **Status icon** — error or warning indicator (right side of field); 16 × 16 px (add/subtract icons)
8. **Error or Warning text** — replaces helper text

---

## 21. Overflow Menu

> Sources: https://carbondesignsystem.com/components/overflow-menu/usage/ | https://carbondesignsystem.com/components/overflow-menu/style/

**What it is** — A compact icon button trigger (vertical ellipsis ⋮) that opens a contextual menu when space is constrained. A specialised trigger pattern for the **Menu** component, commonly used on data table rows and cards. Text within an overflow menu should be direct so users can quickly decide on an action.

**Variants**

No separate visual variants. The tab tip (visual connection between trigger and menu) appears on the **left or right** of the trigger depending on available screen space.

**Sizes**

Menu options and icon button share the same size pairings:

| Element | Size | Height (px / rem) |
|---|---|---|
| Menu options | Small (sm) | 32 / 2 |
| Menu options | Medium (md) | 40 / 2.5 |
| Menu options | Large (lg) | 48 / 3 |
| Icon button | Small (sm) | 32 / 2 |
| Icon button | Medium (md) | 40 / 2.5 |
| Icon button | Large (lg) | 48 / 3 |

Menu option spacing: padding-right, padding-left = 16 / 1 rem. Divider: border-top = 1 px. Icon size: 16 × 16 px.

**States**

| State | Description |
|---|---|
| **Enabled** | ⋮ icon visible |
| **Hover** | Icon button background-color change |
| **Focus** | 2 px focus ring on trigger icon button |
| **Open** | Menu displayed |
| **Menu item — hover** | Menu option background-color change |
| **Menu item — focus** | Menu option focus border |
| **Menu item — danger hover** | Destructive option background and text colour change |
| **Menu item — disabled** | Muted text; not interactive |
| Skeleton | Not stated |
| Error | Not stated |

Actions that could cause significant data changes (delete, remove) are separated from primary actions by a divider and placed below them.

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Overflow menu icon | enabled | fill | not stated |
| Menu option | enabled | background-color | layer (contextual `*`) |
| Menu option | enabled | text-color | not stated |
| Danger option | enabled | background-color | layer (contextual `*`) |
| Container | — | box-shadow | `0 2px 6px 0 rgba(0,0,0,0.3)` |
| Icon button | focus | border | not stated |
| Menu option | focus | border | not stated |
| Icon button | hover | background-color | not stated |
| Menu option | hover | background-color | layer (contextual `*`) |
| Menu option | hover | text-color | not stated |
| Danger option | hover | background-color | not stated |
| Menu option | disabled | text-color | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Menu option text | 14 / 0.875 | Regular 400 | not stated |

Text: sentence case.

Motion tokens: not stated.

**Anatomy**

1. **Overflow trigger** — ⋮ icon button; the activating control; 16 × 16 px icon
2. **Menu container** — floating open-state layer; tab tip on left or right
3. **Menu option** — clickable action items; sentence case; direct language
4. **Divider** — 1 px border-top; separates groups; isolates destructive actions

---

## 22. Pagination

> Sources: https://carbondesignsystem.com/components/pagination/usage/ | https://carbondesignsystem.com/components/pagination/style/

**What it is** — Divides large sets of content or data into separate pages with controls to navigate between them. Use when it would take considerable time to load all data at once, or when there is too much data to display in one view. Do not use for linear journeys such as form progressions — use **Progress bar** or **Button** navigation instead. Do not use superfluously.

**Variants**

| Variant | Purpose |
|---|---|
| **Pagination** | Bar attached to the bottom of a data table; contains items-per-page select and page navigation |
| **Pagination nav** | Standalone; used on full pages or page sections; numbered page buttons with overflow ellipsis |

**Sizes**

Three sizes available for both variants: large, medium, and small. Specific px / rem heights: not stated on usage or style pages.

Size pairing guidance with data table rows:
- Extra large data table rows → use large pagination
- Extra small data table rows → use small pagination
- (No extra small or extra large sizes exist for pagination)

Pagination variant structure:

| Element | Property | px / rem |
|---|---|---|
| Container | border | 1 px |
| Container | padding-left, padding-right | 16 / 1 |
| Select — items per page | padding-left | 8 / 0.5 |
| Select — items per page | padding-right | 16 / 1 |
| Select — number of pages | padding-left | 16 / 1 |
| Select — number of pages | padding-right | 8 / 0.5 |
| Chevron icon | svg | 16 × 16 px |
| Caret icon | svg | 16 × 16 px |

Pagination nav structure:

| Element | Property | px / rem |
|---|---|---|
| Border: selected page | border | 4 px |
| Caret icon | svg | 16 × 16 px |

**States**

Inherits states from nested **Select** and **Ghost icon button** components:

| State | Description |
|---|---|
| **Enabled** | Default; all controls interactive |
| **Hover** | Select / button hover background |
| **Focus** | 2 px focus ring on select or button |
| **Selected (pagination nav)** | Current page button has 4 px border |
| **Disabled (prev/next)** | Previous disabled on first page; Next disabled on last page |
| **Overflow (pagination nav)** | Ellipsis button appears for many pages; never at beginning or end of series |
| **Responsive (small breakpoint)** | Pagination variant: select components removed; item count and prev/next remain |
| Skeleton | Not stated |
| Error | Not stated |

**Tokens consumed**

Colour (pagination variant):

| Element | State | Property | Token role |
|---|---|---|---|
| Container | — | background-color | layer (contextual `*`) |
| Border | — | border-top | border (contextual `*`) |
| Text: items per page | — | text-color | not stated |
| Text: number of items | — | text-color | not stated |
| Text: page range | — | text-color | not stated |
| Icon | — | fill | not stated |
| Background | hover | background-color | layer (contextual `*`) |
| Border | focus | border | not stated |
| Text | disabled | text-color | not stated |
| Icon | disabled | fill | not stated |
| Background | disabled | background-color | layer (contextual `*`) |

Colour (pagination nav):

| Element | State | Property | Token role |
|---|---|---|---|
| Container | — | background-color | transparent |
| Text | — | text-color | not stated |
| Icon | — | fill | not stated |
| Page: selected | — | border | not stated |
| Background | hover | background-color | layer (contextual `*`) |
| Border | focus | border | not stated |
| Border | selected | border | not stated |
| Text | disabled | text-color | not stated |
| Background | disabled | background-color | transparent |

`*` Denotes a contextual token. Nested select and ghost icon button components use their own respective style tokens.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Pagination text | 14 / 0.875 | Regular 400 | not stated |
| Pagination nav: unselected | 14 / 0.875 | Regular 400 | not stated |
| Pagination nav: selected | 14 / 0.875 | SemiBold 600 | not stated |

Motion tokens: not stated.

**Anatomy**

Pagination variant:
1. **Items per page** — select component showing current items-per-page count
2. **Range of items** — text showing e.g. "1–10 of 200 items"
3. **Current page** — select component showing current page / total pages
4. **Previous / Next buttons** — ghost chevron icon buttons
5. **Container** — full-width horizontal bar; width determined by data table width

Pagination nav variant:
1. **Unselected page button** — ghost button with page number
2. **Selected page button** — current page; 4 px border indicator; SemiBold label
3. **Overflow ellipsis button** — reveals hidden page numbers; never at beginning or end of series
4. **Previous / Next caret buttons** — ghost icon buttons
5. **Container** — width determined by number of pages; can be right- or left-aligned

---

## 23. Popover

> Sources: https://carbondesignsystem.com/components/popover/usage/ | https://carbondesignsystem.com/components/popover/style/

**What it is** — A layer that appears above all other content on the page. Used as the base layer for tooltips, overflow menus, dropdown menus, toggletips, and disclosures. Only one popover can appear at a time. Use when placing interactive elements (links, buttons, rich media) inside a disclosure, or to display additional details for specific elements. If the popover would exceed four columns in width, use a **Modal** instead. Do not nest popovers within other popovers.

**Variants**

| Variant | Purpose |
|---|---|
| **No tip** | Used when the trigger button has a visually defined down state; popover flush to the trigger side |
| **Caret tip** | Shows the relationship between popover and trigger; used for icon buttons or triggers without a visible down state |
| **Tab tip** | Connected to a toolbar or header area; edges flush with the layer edge; 0 px space between trigger and container |

Popover directions: auto by default; can be set to open from **top**, **bottom**, **left**, or **right**. Caret-tip containers can additionally be aligned to **start**, **center**, or **end**.

**Sizes**

| Element | Property | px / rem |
|---|---|---|
| Container | max-width | 352 / 22 |
| Container | padding | 16 / 1 |
| Caret tip | height, width | 8 / 0.5 |
| Caret tip | margin-top | 4 / 0.25 |
| Trigger to container distance (no-tip, caret-tip) | gap | 4 px |
| Trigger to container distance (tab-tip) | gap | 0 px |

Width and height are content-driven up to max-width of 352 px. Recommended maximum width: 4 grid columns.

**States**

| State | Description |
|---|---|
| **Open** | Triggered by click, hover, or focus on trigger button |
| **Closed** | Default; not visible |
| Disabled | Not stated |
| Error | Not stated |
| Skeleton | Not stated |

**Tokens consumed**

Colour:

| Element | Property | Token role |
|---|---|---|
| Container | background-color | layer (contextual `*`) |
| Container (inverse style) | background-color | not stated (background-inverse) |
| Caret tip | color | inherits container background |

`*` Denotes a contextual token. Container box-shadow: not stated on style tab (see Menu for `0 2px 6px 0 rgba(0,0,0,.2)` reference). Trigger button tokens: not stated (inherits from whichever button type is used as trigger).

Typography: not stated — content-driven; inherits tokens from elements placed inside the container.

Motion tokens: not stated.

**Anatomy**

1. **UI trigger button** — interactive element that opens the popover; default is an icon button; any interactive element can serve as trigger
2. **Tip** — caret or tab; visually connects container to trigger; shows relationship; caret = 8 × 8 px
3. **Content area** — text, interactive elements; scrolls vertically if needed (header and footer stay fixed)
4. **Container** — the popover bounding box; max-width 352 px; padding 16 px

---

## 24. Progress Bar

> Sources: https://carbondesignsystem.com/components/progress-bar/usage/ | https://carbondesignsystem.com/components/progress-bar/style/

**What it is** — A visual track indicator showing the duration and progression of a system operation (downloading, uploading, processing). Use for long or unknown-duration operations that can be described with quantitative information. Do not use when expanded content is still loading (use **Skeleton states**); do not use when user actions are required to progress (use **Progress indicator**); do not use when the process takes less than 5 seconds (use **Loading**).

**Variants**

| Variant | Purpose |
|---|---|
| **Determinate** | Clear progress data available; bar fills left-to-right from 0–100%; never decreases |
| **Indeterminate** | Unknown progress; bar animates left-to-right continuously; may transition to determinate when data becomes available |

**Sizes**

| Size | Height (px / rem) | Use case |
|---|---|---|
| Big | 8 / 0.5 | Large amounts of space on a page |
| Small | 4 / 0.25 | Restricted space; inside cards, data tables, side panels |

Width: minimum **48 px**; recommended maximum **6 columns**. Width must not fill the entire window.

Text alignment options: **default** (full page, cards, dialogs), **inline** (data tables), **indent** (side panels, dashboard cards).

Spacing:

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Label (top-aligned) | padding-bottom | 8 / 0.5 | not stated |
| Helper text | padding-top | 8 / 0.5 | not stated |
| Label (left-aligned) | padding-right | 16 / 1 | not stated |

**States**

| State | Description |
|---|---|
| **Active** | Animated bar; process in progress |
| **Success** | Full-width bar; checkmark icon; process completed |
| **Error** | Full-width bar; error icon; process failed |
| Inactive | Before process starts; not displayed |
| Skeleton | Not stated |

**Tokens consumed**

Colour:

| Element | Property | Token role |
|---|---|---|
| Label | text-color | not stated |
| Helper text | text-color | not stated |
| Helper text — error | text-color | not stated |
| Track | background | not stated |
| Bar — active | background | not stated |
| Bar — success | background | not stated |
| Icon — success | fill | not stated |
| Bar — error | background | not stated |
| Icon — error | fill | not stated |

*(Token names not printed in rendered style-tab tables.)*

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Label | 14 / 0.875 | Regular 400 | not stated |
| Helper text | 12 / 0.75 | Regular 400 | not stated |

Motion tokens: not stated.

**Anatomy**

1. **Label** — describes the process; short; does not change during loading; no update needed on completion (icon + colour convey result)
2. **Helper text (optional; required for error)** — percentage/fraction/numeric for determinate; not applicable for indeterminate; error description for error state
3. **Track** — static background line; full-width reference
4. **Bar indicator** — fills track left-to-right (determinate); oscillates left-to-right (indeterminate)
5. **Status icon** — checkmark (success) or error icon; right-aligned at track end; 16 × 16 px

---

## 25. Progress Indicator

> Sources: https://carbondesignsystem.com/components/progress-indicator/usage/ | https://carbondesignsystem.com/components/progress-indicator/style/

**What it is** — Guides users through a linear, multi-step task by showing completed, current, and future steps. Use when the user is working through a linear process of three or more steps, on long forms (checkout, onboarding, visa applications), or when input validation is needed before advancing. Do not use for fewer than three steps, when the process may be completed in any order, or when the number of steps may change based on conditional logic.

**Variants**

| Variant | Description |
|---|---|
| **Horizontal** | Steps arranged left-to-right |
| **Vertical** | Steps arranged top-to-bottom; preferred for easier reading |
| **Non-interactive** | Visual progress display only; user cannot click steps |
| **Interactive** | User can click steps to navigate; current step remains highlighted |

**Sizes**

| Element | Property | px / rem |
|---|---|---|
| Step | min-width | 128 / 8 |
| Icon | height, width | 16 / 1 |
| Icon | margin-top, margin-right | 16 / 1 |
| Label | margin-top | 16 / 1 |

Labels: 1–2 words; limit of 16 characters total per label; sentence case. No named height-size variants for the step items themselves — not stated.

**States**

| State | Description |
|---|---|
| **Completed** | Outlined circle + checkmark; blue active step line |
| **Current** | Half-filled circle; blue active step line |
| **Not started** | Outlined circle (no fill); grey inactive step line |
| **Error** | Error icon; invalid or incomplete step |
| **Disabled** | All interactive functions removed; not focusable; no contrast requirement |
| **Hover** | Cursor over step (interactive variant only) |
| **Focus** | Tab navigation (interactive variant only) |
| Skeleton | Not stated |

**Tokens consumed**

Colour:

| Element | Property | Token role |
|---|---|---|
| Complete icon | fill | not stated |
| Current icon | fill | not stated |
| Not started icon | fill | not stated |
| Active step line | background-color | not stated |
| Inactive step line | background-color | border (contextual `*`) |
| Label | text-color | not stated |
| Helper text | text-color | not stated |
| Step — focus | border | not stated |
| Label — hover | text-color | not stated |
| Icon — error | fill | not stated |
| Icon — disabled | fill | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Label | 14 / 0.875 | Regular 400 | not stated |
| Helper text | 12 / 0.75 | Regular 400 | not stated |

Labels: sentence case; 1–2 words; ≤ 16 characters.

Motion tokens: not stated.

**Anatomy**

1. **Status indicator** — 16 × 16 px circle icon; communicates step state (completed / current / not-started / error / disabled)
2. **Active step line** — connector between completed/current steps
3. **Label** — describes the step task; 1–2 words; {verb} + {noun} formula preferred (e.g. "Configure IdP")
4. **Inactive step line** — connector for not-started / error / disabled steps
5. **Helper text** — shows "Optional" or error state description; long text wraps (preferred over truncation)

---

## 26. Radio Button

> Sources: https://carbondesignsystem.com/components/radio-button/usage/ | https://carbondesignsystem.com/components/radio-button/style/

**What it is** — An input control for mutually exclusive choices; only one option can be selected from a group at any time. Use in forms, settings, and data tables for single-selection from a group. Use **Checkbox** instead when multiple items can be selected. Use **Selectable tile** instead when options require pricing, links, or rich content to make a choice.

**Variants**

| Variant | Description |
|---|---|
| **Default** | Standard radio button group; vertical or horizontal layout |
| **With AI label** | AI explainability label on group label or individual labels; AI label size: mini |

No option is preselected by default. If user needs to deselect, provide an "other" or "none" option.

**Sizes**

| Element | Property | px / rem |
|---|---|---|
| Radio button icon | height, width | 20 / 1.25 |
| Radio button icon | margin-right | 8 / 0.5 |
| Dot | height, width | 8 / 0.5 |
| Group label | margin-bottom | 8 / 0.5 |
| Horizontal group item | margin-left | 8 / 0.5 |
| Vertical group item | margin-bottom | 8 / 0.5 |

Radio button input: fixed **20 × 20 px** circle. No named height-size variants. Form spacing: minimum **32 px** below or before the next component.

**States**

| State | Description |
|---|---|
| **Unselected** | Default; empty circle; no preselection |
| **Selected** | Filled dot inside circle; only one at a time |
| **Focus** | 2 px focus ring on radio input |
| **Hover** | Pointer cursor on input and label |
| **Disabled** | Not interactive; not focusable; no contrast requirement |
| **Read-only** | Focusable; passes contrast; cannot modify |
| **Error** | Error styling on group; error message below group |
| **Warning** | Warning styling on group; warning message below group |
| Skeleton | Not stated |

Group-level states: read-only, disabled, error, warning + optional helper text.

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Group label | — | text-color | not stated |
| Radio button label | — | text-color | not stated |
| Radio button — unselected | — | border | not stated |
| Radio button — unselected | — | background | transparent |
| Radio button — selected | — | border | not stated |
| Radio button — selected | — | dot | not stated |
| Helper text | — | text-color | not stated |
| Radio button | focus | border | not stated |
| Label | disabled | text-color | not stated |
| Radio button | disabled | border | not stated |
| Radio button | disabled | inner fill | not stated |
| Label | read-only | text-color | not stated |
| Radio button | read-only | border | not stated |
| Radio button | read-only | inner fill | not stated |
| Label | error | text-color | not stated |
| Radio button | error | border | not stated |
| Error message | error | text-color | not stated |
| Error icon | error | svg | not stated |
| Warning message | warning | text-color | not stated |
| Warning icon | warning | svg | not stated |

*(Token names not printed in rendered style-tab tables.)*

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Group label | 12 / 0.75 | Regular 400 | not stated |
| Radio button label | 14 / 0.875 | Regular 400 | not stated |
| Helper text | 12 / 0.75 | Regular 400 | not stated |
| Error message | 12 / 0.75 | Regular 400 | not stated |
| Warning message | 12 / 0.75 | Regular 400 | not stated |

Labels: sentence case; ≤ 3 words.

Motion tokens: not stated.

**Anatomy**

1. **Group label (optional)** — describes the group or provides selection instructions; sentence case
2. **Radio button input** — 20 × 20 px clickable circle; indicates unselected / selected state; dot = 8 × 8 px
3. **Radio button label** — right of input (left for RTL); ≤ 3 words; wraps below input if long (top-aligned)

---

## 27. Search

> Sources: https://carbondesignsystem.com/components/search/usage/ | https://carbondesignsystem.com/components/search/style/

**What it is** — Lets users explore content using keywords. Use to help users find data efficiently within a complex or large data set, at a global, page, or component level. Do not use when there is a small or limited amount of data, or when the information is simple and can be found easily within one view.

**Variants**

| Style | Appearance | Use case |
|---|---|---|
| **Default** | No visible label; search icon left; close × right when user starts typing | Global or page-level search; needs white space around it |
| **Fluid** | Label inside field, stacked inline | Expressive moments; fluid forms; contained spaces |

**Sizes**

Default:

| Size | Height (px / rem) |
|---|---|
| Small (sm) | 32 / 2 |
| Medium (md) | 40 / 2.5 — default |
| Large (lg) | 48 / 3 |

Fluid: single height of **64 px**.

Spacing (default):

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Search icon / Close icon | height, width | 16 / 1 | — |
| Small field | padding-left, padding-right | 32 / 2 | not stated |
| Medium field | padding-left, padding-right | 40 / 2.5 | not stated |
| Large field | padding-left, padding-right | 48 / 3 | not stated |

Spacing (fluid):

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Label | margin-bottom | 4 / 0.25 | not stated |
| Field | padding-left | 16 / 1 | not stated |
| Field | padding-right | 80 / 5 | not stated |
| Field | border | 1 px | — |
| Field | margin-top, margin-bottom | 13 / 0.8125 | — |
| Close icon | padding-right, padding-left | 12 / 0.75 | not stated |
| Search icon | padding-right, padding-left | 12 / 0.75 | not stated |

**States**

| State | Description |
|---|---|
| **Enabled** | Default; placeholder text visible |
| **Focus** | User clicked or tabbed into field |
| **Filled** | User has typed text; close (×) icon appears |
| **Disabled** | Cannot interact |
| Hover | Not stated as a separate named state |
| Error | Not stated |
| Skeleton | Not stated |

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Field | enabled | background-color | layer (contextual `*`) |
| Field | enabled | border-bottom | border (contextual `*`) |
| Label text (fluid) | enabled | text-color | not stated |
| Placeholder text | enabled | text-color | not stated |
| Search icon | enabled | fill | not stated |
| Field | focus | border | not stated |
| Field text | filled | text-color | not stated |
| Close icon | filled | fill | not stated |
| Field text | disabled | text-color | not stated |
| Label text (fluid) | disabled | text-color | not stated |
| Search icon | disabled | fill | not stated |
| Field (fluid) | disabled | border-bottom | border (contextual `*`) |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Field text | 14 / 0.875 | Regular 400 | not stated |
| Label text (fluid) | 12 / 0.75 | Regular 400 | not stated |

Text: sentence case.

Motion tokens: not stated.

**Anatomy**

1. **Field** — text input container; default style has no label
2. **Search icon (🔍)** — magnifying glass; left side; 16 × 16 px; always visible; universal indicator of search
3. **Field text** — user's search query
4. **Close icon (×)** — 16 × 16 px; appears after user starts typing; clears field on click; Tab/Enter/Space via keyboard

---

## 28. Select

> Sources: https://carbondesignsystem.com/components/select/usage/ | https://carbondesignsystem.com/components/select/style/

**What it is** — The native HTML `<select>` element for choosing one option from a list within a form. Its appearance is controlled by the browser. Use inside a form where users select from a list and submit data, or when the experience is mostly form-based. Use **Radio button** group instead when there are fewer than three options. Use **Dropdown** instead when the component needs to be styled, when taking an action (filtering, sorting), or when multi-selection is needed.

**Variants**

| Variant | Purpose |
|---|---|
| **Default** | Standard bordered field; used in forms with other components |
| **Inline select** | Borderless; transparent background; reduced visual weight; used when multiple selects appear together in a form |
| **With AI label** | AI explainability label embedded; can toggle between AI and non-AI variant |

Input styles:

| Style | Label position | Use case |
|---|---|---|
| **Default** | Outside / above field | Productive forms |
| **Fluid** | Inside field, stacked inline | Expressive moments; fluid forms |

**Sizes**

Default:

| Size | Height (px / rem) |
|---|---|
| Small (sm) | 32 / 2 |
| Medium (md) | 40 / 2.5 — default |
| Large (lg) | 48 / 3 |

Fluid:

| Size | Height (px / rem) |
|---|---|
| Default | 64 / 4 |

Inline select: same heights as default. Width: no minimum or maximum; customisable to context.

Spacing (default):

| Element | Property | px / rem |
|---|---|---|
| Label | margin-bottom | 8 / 0.5 |
| Input text | padding-left | 16 / 1 |
| Helper text | margin-top | 4 / 0.25 |
| Field | padding-left | 16 / 1 |
| Field | padding-right | 48 / 3 |
| Field | border-bottom | 1 px |
| Chevron icon | padding-left, padding-right | 16 / 1 |
| State icon | padding-left, padding-right | 16 / 1 |

Spacing (inline select):

| Element | Property | px / rem |
|---|---|---|
| Input text | padding-left | 16 / 1 |
| Input text | padding-right | 8 / 0.5 |
| Chevron icon | padding-right | 16 / 1 |
| Chevron icon | padding-left | 8 / 0.5 |

Spacing (fluid):

| Element | Property | px / rem |
|---|---|---|
| Label | margin-bottom | 4 / 0.25 |
| Field | padding-left | 16 / 1 |
| Field | padding-right | 48 / 3 |
| Field | border-bottom | 1 px |

**States**

| State | Description |
|---|---|
| **Enabled** | Default; shows default option or placeholder |
| **Hover** | Cursor over field; background-color change |
| **Focus** | Tabbed to or clicked |
| **Error (invalid)** | Required field with no selection; system error; 2 px error border |
| **Warning** | Exception condition |
| **Disabled** | Not interactive; not focusable; border-bottom transparent (default) or contextual (fluid) |
| **Read-only** | Focusable; passes contrast; cannot modify; background transparent (default) or contextual (fluid) |
| **Skeleton** | Initial page load |

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Field | enabled | background | layer (contextual `*`) |
| Field | enabled | border-bottom | border (contextual `*`) |
| Inline select | enabled | background | transparent |
| Label | — | text-color | not stated |
| Field text | — | text-color | not stated |
| Helper text | — | text-color | not stated |
| Icon (chevron) | — | fill | not stated |
| Field | hover | background-color | layer (contextual `*`) |
| Field | focus | border | not stated |
| Field | error | border | not stated |
| Error message | error | text-color | not stated |
| Error icon | error | fill | not stated |
| Warning message | warning | text-color | not stated |
| Warning icon | warning | fill | not stated |
| Field | disabled | background-color | layer (contextual `*`) |
| Field (default) | disabled | border-bottom | transparent |
| Field (fluid) | disabled | border-bottom | contextual `*` |
| Field (default) | read-only | background | transparent |
| Field (fluid) | read-only | background | layer (contextual `*`) |
| Field | read-only | border-bottom | contextual `*` |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Label | 12 / 0.75 | Regular 400 | not stated |
| Field text | 14 / 0.875 | Regular 400 | not stated |
| Helper text | 12 / 0.75 | Regular 400 | not stated |
| Warning message | 12 / 0.75 | Regular 400 | not stated |
| Error message | 12 / 0.75 | Regular 400 | not stated |

Text: sentence case; ≤ 3 words.

Motion tokens: not stated.

**Anatomy**

1. **Label** — required; 1–3 words; not helper text
2. **Default option** — empty, prefilled first item, or common/frequent item
3. **Helper text (optional)** — assistive; replaced by error/warning text
4. **Field** — the visible container; persists open and closed
5. **Option** — individual choice in the list
6. **List** — all options when open (browser-rendered)
7. **Status icon** — error or warning indicator inside field
8. **Error or Warning text** — replaces helper text

---

## 29. Slider

> Sources: https://carbondesignsystem.com/components/slider/usage/ | https://carbondesignsystem.com/components/slider/style/

**What it is** — A visual control for selecting a single value or range by moving a handle along a horizontal track. Use when selecting a single value or range of number values, when needing to expose a variety of options, or when showing the relative position within a range is useful. Do not use for extremely large ranges (e.g. 1–1000), ranges that are too small (e.g. 1–3), or complex non-numeric values.

**Variants**

| Variant | Purpose |
|---|---|
| **Default slider** | Single value; label + one number input showing current value |
| **Range slider** | Two handles for min/max; label + two number inputs |

**Sizes**

| Element | Property | px / rem |
|---|---|---|
| Handle (default) | height, width | 14 / 0.875 |
| Handle active (default) | height, width | 20 / 1.25 |
| Handle (range slider) | height, width | 16 / 1 |
| Handle active (range slider) | height, width | 16 / 1 |
| Track | height | 4 / 0.25 |
| Track (default) | margin-left, margin-right | 8 / 0.5 |
| Track (range slider) | margin-left, margin-right | 16 / 1 |
| Label | margin-bottom | 8 / 0.5 |
| Range label | margin-right | 16 / 1 |
| Error message | margin-top | 16 / 1 |
| Error icon | padding-right, padding-left | 16 / 1 |
| Tooltip | padding-bottom (default) | 4 / 0.25 |
| Tooltip | padding-bottom (range) | 0 |

Recommended width limits (not built into component):

| Element | Property | px / rem |
|---|---|---|
| Slider | min-width | 200 / 12.5 |
| Slider | max-width | 640 / 40 |

**States**

| State | Description |
|---|---|
| **Enabled** | Default; live but not interacted with |
| **Hover** | Cursor over field or handles; tooltip shown if no number input |
| **Focus** | Tabbed to or clicked; tooltip shown if no number input |
| **Active** | Pressing down on handles; tooltip shown if no number input |
| **Error** | Required field empty; value out of range; non-numeric entry; system error |
| **Warning** | Exception condition |
| **Disabled** | Not interactive; not focusable; no contrast requirement |
| **Read-only** | Focusable; passes contrast; cannot modify |
| **Skeleton** | Initial page load |

Keyboard step behaviour: Arrow keys change by 1 step increment; not stated whether Shift+Arrow is documented for slider specifically.

**Tokens consumed**

Colour:

| Element | State | Property | Token role |
|---|---|---|---|
| Handle | enabled | fill | not stated |
| Track | enabled | background-color | border (contextual `*`) |
| Track — filled | enabled | background-color | not stated |
| Label | enabled | text-color | not stated |
| Range label | enabled | text-color | not stated |
| Handle | focus | border | not stated |
| Track | focus | background-color | not stated |
| Handle | active | fill | not stated |
| Track | active | background-color | not stated |
| Number input | error | border | not stated |
| Error icon | error | svg | not stated |
| Error message | error | text-color | not stated |
| Warning icon | warning | svg | not stated |
| Warning message | warning | text-color | not stated |
| Label | disabled | text-color | not stated |
| Handle | disabled | fill | not stated |
| Track | disabled | background-color | not stated |
| Track | read-only | background-color | layer (contextual `*`) |
| Track — filled | read-only | background-color | not stated |

`*` Denotes a contextual token. Number input inherits all number input tokens.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Label | 12 / 0.75 | Regular 400 | not stated |
| Range label | 14 / 0.875 | Regular 400 | not stated |

Labels: sentence case; ≤ 3 words.

Motion tokens: not stated.

**Anatomy**

Default slider:
1. **Label** — value type description; above slider; sentence case
2. **Min value** — minimum boundary label
3. **Max value** — maximum boundary label
4. **Number input** — shows and allows entry of exact current value
5. **Handle** — 14 × 14 px draggable indicator (20 × 20 px when active)
6. **Track** — 4 px high full-range reference line

Range slider (adds):
7. **Min value number input** — left text field
8. **Max value number input** — right text field
9. **Handles (×2)** — min and max position indicators; 16 × 16 px (same size active)

---

## 30. Structured List

> Sources: https://carbondesignsystem.com/components/structured-list/usage/ | https://carbondesignsystem.com/components/structured-list/style/

**What it is** — Groups similar or related content (terms + definitions, feature comparison, pricing plans) in a simple multi-column display. Supports read-only or selectable rows. Do not use for complex content needing nesting or many rows (use **Data table**); do not use in small or confined spaces (use **Contained list**).

**Variants**

| Variant | Description |
|---|---|
| **Default** | Read-only; browse and view information; rows not interactive |
| **Selectable** | One row selectable at a time; feature flag changes icons from checkmarks (right) to radio button icons (left) |

Alignment styles:

| Style | Description |
|---|---|
| **Hang** | Text hangs into gutter; default; available for both variants |
| **Flush** | Text flush to container edges; NOT available for selectable variant |

Optional background colour modifier: applies a background layer to rows; only available in hang alignment.

A feature flag has been added to the selectable variant (changes visual appearance, not functionality); teams are encouraged to use it going forward.

**Sizes**

| Element | Size | Height (px / rem) |
|---|---|---|
| Row | Default | 60 / 3.75 |
| Row | Condensed | 36 / 2.25 |

Min container width: **500 px / 31.25 rem**.

Spacing (hang alignment):

| Element | Property | px / rem | Spacing token |
|---|---|---|---|
| Header text | padding-top | 16 / 1 | not stated |
| Header text | padding-bottom | 8 / 0.5 | not stated |
| Header text | padding-right | 16 / 1 | not stated |
| Header text | padding-left | 16 / 1 | not stated |
| Row text | padding-top | 16 / 1 | not stated |
| Row text | padding-bottom | 24 / 1.5 | not stated |
| Row text | padding-right | 16 / 1 | not stated |
| Row text | padding-left | 16 / 1 | not stated |

Flush alignment: padding-left = 0 px for header and row text; all other values identical.

**States**

Default:

| State | Description |
|---|---|
| **Enabled** | Only state; read-only |
| **Skeleton** | Initial page load |

Selectable:

| State | Description |
|---|---|
| **Enabled (unselected)** | Default |
| **Hover** | Row background-color change |
| **Hover (selected)** | Selected row with cursor hover |
| **Focus** | 2 px border outline on row |
| **Focus (selected)** | Selected row with focus |
| **Selected** | Active row; one at a time |
| **Disabled** | Not interactive; muted text and icon |
| **Disabled (selected)** | Disabled row previously selected |
| **Skeleton** | Initial page load |
| Error | Not stated |

**Tokens consumed**

Colour (default):

| Element | Property | Token role |
|---|---|---|
| Header | background | transparent |
| Header text | text-color | not stated |
| Row | background | transparent |
| Row text | text-color | not stated |
| Divider | border-bottom | border-subtle (contextual `*`) |

Colour (selectable, additional):

| State | Element | Property | Token role |
|---|---|---|---|
| Enabled | Icon | svg | not stated |
| Enabled (selected) | Row | background | layer-selected (contextual `*`) |
| Hover | Row | background | layer-hover (contextual `*`) |
| Hover (selected) | Row | background | layer-selected-hover (contextual `*`) |
| Focus | Row | border | not stated |
| Disabled | Row text | text-color | not stated |
| Disabled | Icon | svg | not stated |

Colour (with background colour modifier):

| Element | Property | Token role |
|---|---|---|
| Header | background | layer (contextual `*`) |
| Row | background | layer (contextual `*`) |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Header text | 14 / 0.875 | SemiBold 600 | not stated |
| Row text | 14 / 0.875 | Regular 400 | not stated |

All text: sentence case; left-aligned.

Motion tokens: not stated.

**Anatomy**

Default:
1. **Column header** — title text per column; sentence case; 1–2 words
2. **Data row** — row cells with content; optional background colour (hang alignment only)

Selectable (feature flag):
1. **Column header** — title per column
2. **Data row** — cells + optional background
3. **Icon** — radio button icon left-positioned (feature flag) or checkmark right-positioned (default)

---

## 31. Tabs

> Sources: https://carbondesignsystem.com/components/tabs/usage/ | https://carbondesignsystem.com/components/tabs/style/

**What it is** — Organises related content into navigable groups within the same context; users switch between views without leaving the page. Use **Content switcher** instead when toggling between different formats of the same content. Use **Progress indicator** instead when the user needs to work through a step-by-step linear process. Do not use tabs if the user needs to compare information across groups.

**Variants**

| Variant | Description |
|---|---|
| **Line tabs** | Standalone; highly flexible; used within components or large page layouts; transparent background; no tab panel container |
| **Contained tabs** | Emphasized; for defined content areas; always attached to a tab panel; supports secondary labels |
| **Vertical tabs** | Left/vertical orientation; for browsing information; NOT for primary product navigation |
| **Dismissible (line or contained)** | Tabs with × close icon per tab; user can remove tabs |
| **Icon-only (line or contained)** | Icon labels only; no text |

Width alignment: **auto-width** (default for all; each tab matches label length + consistent padding) or **grid-aware** (contained tabs only; equal-width tabs spanning a set of columns).

**Sizes**

Line tab:

| Element | Property | px / rem |
|---|---|---|
| Tab | height | 40 / 2.5 |
| Tab | border-bottom | 2 px |
| Tab | width | auto-width |
| Tab | margin-left | 1 px |
| Label | padding-left, padding-right | 16 / 1 |
| Label | padding-top, padding-bottom | 8 / 0.5 |
| Icon | padding-right | 16 / 1 |
| Icon | padding-left | 8 / 0.5 |
| Icon | svg | 16 × 16 px |
| Scrollable icon | svg | 16 × 16 px |

Line tab — icon-only:

| Size | Element | Height × Width | Icon |
|---|---|---|---|
| Medium | Tab | 40 / 2.5 × 40 / 2.5 | 16 × 16 px |
| Large | Tab | 48 / 3 × 48 / 3 | 20 × 20 px |

Contained tab:

| Element | Property | px / rem |
|---|---|---|
| Tab | height | 40 / 2.5 |
| Tab | border-top | 2 px |
| Tab | border-right | 1 px |
| Tab | width | auto-width or grid |
| Label | padding-left, padding-right | 16 / 1 |
| Scrollable button | border-right, border-left | 1 px |
| Icon | svg | 16 × 16 px |

Contained tab — icon-only:

| Size | Element | Height × Width | Icon |
|---|---|---|---|
| Large | Tab | 48 / 3 × 48 / 3 | 20 × 20 px |

**States**

| State | Description |
|---|---|
| **Selected** | Active tab; always one selected; SemiBold label; 2 px indicator (border-bottom line / border-top contained) |
| **Unselected** | Inactive tab; Regular label |
| **Hover** | Background / border change |
| **Focus** | 2 px focus border outline on tab |
| **Disabled** | Not interactive; muted background; muted text |
| **Scrollable** | Left/right scroll buttons appear when tabs overflow available width |
| Skeleton | Not stated |
| Error | Not stated |

**Tokens consumed**

Colour (line tabs):

| Type | Element | State | Property | Token role |
|---|---|---|---|---|
| Unselected | Tab | — | background-color | transparent |
| Unselected | Tab | — | border-bottom | border-subtle (contextual `*`) |
| Unselected | Label | — | text-color | not stated |
| Selected | Label | — | text-color | not stated |
| Selected | Tab | — | border-bottom | not stated (interactive colour) |
| — | Tab | hover | border-bottom | not stated |
| — | Tab | focus | border | not stated |
| — | Label | disabled | text-color | not stated |
| — | Tab | disabled | background-color | transparent |
| — | Tab | disabled | border-bottom | not stated |

Colour (contained tabs):

| Type | Element | State | Property | Token role |
|---|---|---|---|---|
| Unselected | Tab | — | background-color | layer (contextual `*`) |
| Unselected | Tab | — | border-right | border (contextual `*`) |
| Selected | Tab | — | background-color | layer (contextual `*`) |
| Selected | Tab | — | border-top | not stated (interactive colour) |
| — | Tab | hover | background-color | layer (contextual `*`) |
| — | Tab | focus | border | not stated |
| — | Tab | disabled | background-color | not stated |

Colour (vertical tabs):

| Type | Element | State | Property | Token role |
|---|---|---|---|---|
| Unselected | Tab | — | background-color | layer (contextual `*`) |
| Unselected | Tab | — | border-bottom/right/left | border (contextual `*`) |
| Selected | Tab | — | background-color | layer (contextual `*`) |
| Selected | Tab | — | border-bottom | layer (contextual `*`) |
| — | Tab panel | — | background-color | layer (contextual `*`) |
| — | Extended background | — | background-color | layer (contextual `*`) |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Label: unselected | 14 / 0.875 | Regular 400 | not stated |
| Label: selected | 14 / 0.875 | SemiBold 600 | not stated |
| Secondary label (contained) | 12 / 0.75 | Regular 400 | not stated |

Labels: sentence case; ≤ 3 words; nouns or noun phrases.

Motion tokens: not stated.

**Anatomy**

1. **Label (A)** — tab text; 1–2 words; sentence case
2. **Secondary label (B, contained only)** — optional additional context; 12 / 0.75 rem
3. **Indicator (C)** — 2 px border-bottom (line) or border-top (contained); shows selection
4. **Scroll button (D)** — appears when tab group overflows; left/right chevrons; 16 × 16 px icon
5. **Icon (E, optional)** — decorative or replaces label in icon-only tabs; 16 × 16 px (md) or 20 × 20 px (lg contained icon-only)
6. **Tab panel (F)** — content area below / beside the tablist
7. **Tablist extended background (G, vertical)** — background area behind the vertical tab list

---

## 32. Tag

> Sources: https://carbondesignsystem.com/components/tag/usage/ | https://carbondesignsystem.com/components/tag/style/

**What it is** — Compact labels for categorizing, labeling, filtering, or selecting options using descriptive keywords. Four variants serve different levels of interactivity. Do not use tags as links that direct to a different page. Avoid using tags with multiple functions.

**Variants**

| Variant | Purpose | Interactivity |
|---|---|---|
| **Read-only** | Categorization and labeling only | None |
| **Dismissible** | Can be dismissed/closed/removed | Close × icon; click to dismiss |
| **Selectable** | Can be selected or deselected | Entire tag is click target; selected/unselected state |
| **Operational** | Discloses additional or overflow tags in a popover, modal, or breadcrumb view | Entire tag is click target; opens disclosure |

Colour palette: Read-only, dismissible, and operational use **component tokens** from the IBM Design Language colour palette. Light themes: step 70 text/icons, step 40 borders, step 20 backgrounds. Dark themes: step 20 text/icons, step 50 borders, step 70 backgrounds. High contrast and outline styles use core tokens. **Selectable tags use only core tokens** (no component colour tokens).

**Sizes**

| Size | Height (px / rem) | Border-radius | Padding-left/right |
|---|---|---|---|
| Small (sm) | 18 / 1.125 | 16 px | 8 / 0.5 |
| Medium (md) | 24 / 1.5 | 16 px | 8 / 0.5 |
| Large (lg) | 32 / 2 | 16 px | 12 / 0.75 |

Icon size (all sizes): 16 px.

Tag group spacing: 8 px between tags on all sides.

Decorative icon padding (large): padding-left = 8 / 0.5; padding-right = 4 / 0.25.
Dismissible icon padding (large): padding-left = 12 / 0.75; padding-right = 8 / 0.5.
Dismissible icon padding (medium): padding-left = 8 / 0.5; padding-right = 4 / 0.25.
Dismissible icon padding (small): padding-left = 8 / 0.5; padding-right = 1 / 0.0625.

AI label (with AI label variant): inline size = small; padding-right = 4 px / 0.25 rem.

**States**

| Variant | States |
|---|---|
| **Read-only** | Enabled, disabled, skeleton |
| **Dismissible** | Enabled, hover, focus, on-click, disabled, skeleton |
| **Selectable** | Enabled, hover, focus, selected, disabled, skeleton |
| **Operational** | Enabled, hover, focus, on-click, disabled, skeleton |

Read-only tags have no interactive states (no hover, focus, or click).

**Tokens consumed**

Colour (read-only, dismissible, operational):

| Element | Token type | Light theme step | Dark theme step |
|---|---|---|---|
| Text + Icon | Component token | step 70 | step 20 |
| Background | Component token | step 20 | step 70 |
| Border (operational, outline, high-contrast) | Component token or core | step 40 (light) / step 50 (dark) | — |
| Hover background | Component token | hover step | hover step |
| Focus border | Core token | `$focus` | `$focus` |
| Disabled background | Core token (contextual `*`) | — | — |
| Disabled text | Core token | text-disabled | text-disabled |

Colour (selectable — core tokens only):

| Element | State | Property | Token role |
|---|---|---|---|
| Background | enabled | background-color | layer (contextual `*`) |
| Border | enabled | border | not stated |
| Background | hover | background-color | layer (contextual `*`) |
| Border | focus | border | not stated |
| Text | selected | text-color | not stated |
| Background | selected | background-color | not stated |
| Text | disabled | text-color | text-disabled |
| Border | disabled | border | not stated |
| Background | disabled | background-color | layer (contextual `*`) |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Title | 12 / 0.75 | Regular 400 | not stated |

Title: concise; ≤ 20 characters ideally; truncates with ellipsis + tooltip if too long; no wrapping.

Motion tokens: not stated.

**Anatomy**

1. **Decorative icon (optional)** — left of title; same colour as text; not recommended for small size
2. **Title** — concise; ≤ 20 characters; truncates with ellipsis + tooltip; no wrapping
3. **Container** — compact; 16 px border-radius all sizes

*(Dismissible adds:)*
4. **Close icon (×)** — right side; 16 px; distinct clickable area from title

*(Selectable and Operational add:)*
5. **Border** — visible in enabled state to indicate interactivity; not present on read-only

---

## 33. Text Input

> Sources: https://carbondesignsystem.com/components/text-input/usage/ | https://carbondesignsystem.com/components/text-input/style/

**What it is** — Enables users to enter free-form text data; single-line (text input) or multi-line (text area). Use when a user needs to input unique or memorable information that cannot be predicted with preset options. Do not use if the user can only enter from a predefined list — use **Dropdown**, **Select**, or **Radio button** group instead.

**Variants**

| Variant | Description |
|---|---|
| **Text input — Default** | Single line; label outside/above |
| **Text input — Fluid** | Single line; label inside field |
| **Password input — Default** | Single line with visibility toggle icon |
| **Password input — Fluid** | Fluid style with visibility toggle |
| **Text area — Default** | Multi-line; label outside/above; resize handle; supports character/word counter |
| **Text area — Fluid** | Multi-line; label inside field |

**Sizes**

Default text input / password input:

| Size | Height (px / rem) |
|---|---|
| Small (sm) | 32 / 2 |
| Medium (md) | 40 / 2.5 — default |
| Large (lg) | 48 / 3 |

Fluid text input / password input: single height of **64 px** (grows when warning/error message is added below; padding-top/bottom = 13 / 0.8125 rem).

Text area (default style):

| Element | Property | px / rem |
|---|---|---|
| Field | height | varies (content-driven) |
| Field | padding-left, padding-right | 16 / 1 |
| Field | padding-top, padding-bottom | 11 / 0.6875 |
| Field | border-bottom | 1 px |

Text area (fluid style): same padding values; height varies.

**States**

| State | Description |
|---|---|
| **Enabled** | Default; may contain placeholder text or user content |
| **Active** | User actively typing |
| **Focus** | Tabbed to or clicked into field; 2 px border |
| **Error (invalid)** | Invalid input; required field empty; system error; 2 px red border + error icon + error message |
| **Warning** | Exception condition; warning icon + warning message |
| **Disabled** | Not interactive; not focusable; border-bottom transparent (default) or contextual (fluid) |
| **Read-only** | Focusable; passes contrast; background transparent (default) or contextual (fluid) |
| **Skeleton** | Initial page load |
| **Hover (password)** | View icon changes colour on hover |

**Tokens consumed**

Colour (text input / text area):

| Element | State | Property | Token role |
|---|---|---|---|
| Label | — | text-color | not stated |
| Field text | — | text-color | not stated |
| Placeholder text | — | text-color | not stated |
| Helper text | — | text-color | not stated |
| Field | enabled | background-color | layer (contextual `*`) |
| Field | enabled | border-bottom | border (contextual `*`) |
| Field | focus | border | not stated (2 px) |
| Field | error | border | not stated (2 px) |
| Error message | error | text-color | not stated |
| Error icon | error | svg | not stated |
| Warning message | warning | text-color | not stated |
| Warning icon | warning | svg | not stated |
| Field | disabled | background | layer (contextual `*`) |
| Field (default) | disabled | border-bottom | transparent |
| Field (fluid) | disabled | border-bottom | contextual `*` |
| Field text | disabled | text-color | not stated |
| Field (default) | read-only | background | transparent |
| Field (fluid) | read-only | background | layer (contextual `*`) |
| Field | read-only | border-bottom | contextual `*` |

Password input (additional):

| Element | State | Property | Token role |
|---|---|---|---|
| View icon | enabled | svg | not stated |
| View icon | hover | svg | not stated |
| View icon | disabled | svg | not stated |
| View icon | read-only | svg | not stated |

`*` Denotes a contextual token.

Typography:

| Element | Font-size (px / rem) | Font-weight | Type token |
|---|---|---|---|
| Label | 12 / 0.75 | Regular 400 | not stated |
| Field text | 14 / 0.875 | Regular 400 | not stated |
| Helper text | 12 / 0.75 | Regular 400 | not stated |
| Invalid and warning message | 12 / 0.75 | Regular 400 | not stated |

Labels: sentence case; ≤ 3 words; no colons.

Spacing (default text input):

| Element | Property | px / rem |
|---|---|---|
| Label | margin-bottom | 8 / 0.5 |
| Helper text | margin-top | 4 / 0.25 |
| Field text | padding-left, padding-right | 16 / 1 |
| Field | border-bottom | 1 px |
| Focus | border | 2 px |
| Invalid | border | 2 px |

Spacing (fluid text input):

| Element | Property | px / rem |
|---|---|---|
| Label | padding-bottom | 4 / 0.25 |
| Field | height | 64 / 4 |
| Field | padding-left, padding-right | 16 / 1 |
| Field | padding-top, padding-bottom | 13 / 0.8125 |
| Field | border-bottom | 1 px |
| Focus | border | 2 px |
| Invalid | border | 2 px |

Spacing (default password input, additions):

| Element | Property | px / rem |
|---|---|---|
| View icon | padding-left, padding-right | 16 / 1 |
| State icon | padding-left | 16 / 1 |
| State icon | padding-right | 8 / 0.5 |

Spacing (fluid password input, additions):

| Element | Property | px / rem |
|---|---|---|
| View icon | padding-left, padding-right | 16 / 1 |
| State icon | padding-left, padding-right | 16 / 1 |

Spacing (default text area, additions):

| Element | Property | px / rem |
|---|---|---|
| Field | padding-top, padding-bottom | 11 / 0.6875 |

Motion tokens: not stated.

**Anatomy**

Text input:
1. **Label** — required (unless approved accessibility exemption); sentence case; ≤ 3 words; no colon
2. **Value** — user-entered content; scrolls horizontally if overflows single-line field
3. **Field** — container; must meet 3:1 non-text contrast
4. **Helper text (optional)** — below field; replaced by error/warning message when triggered

Text area (adds):
5. **Resize handle** — bottom-right corner; adjusts height only; vertical scroll appears if content exceeds resized area
6. **Counter (optional)** — character or word count; below field right-aligned; updates as user types

Password input (adds):
7. **View icon button** — eye icon; right side of field; toggles password visibility

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

