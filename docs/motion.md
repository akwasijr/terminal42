# Motion — what it is, what is built, what is missing

Motion is the second canvas in Terminal 42. Form is a canvas for laying out a
page; Motion is a canvas for making a piece of animation out of image cards.

This document is written against the twenty-one reference screenshots in
`~/Desktop/Screenshots`. It records what the reference tool actually does,
what the first build got wrong, and the order the rest should be built in.

---

## 1. The thing itself

A Motion piece is a **frame** with a **component** running in it.

- The **frame** is a fixed-aspect rectangle (16:9, 4:5, 9:16, 1:1, 4:3) with a
  background colour, an optional dot grid, and rounded or square corners. It
  is what a still or a video is cropped to.
- A **component** is a generator: it takes numbers and produces a deck of
  cards in 3D. Carousel, Ring, Slider, Card shuffle, Card drop, Image
  repeater, Space, Elevator, Ribbon, Parallax, Feed. Seven more are listed but
  greyed out as *Soon*: Grid, Flip, Global, Cubic, Column, Plate, Spin.
- **Cards** wear images from a library, and carry their own shape (aspect,
  corner radius, gradient overlay, back opacity).
- **Text** and **Logo** layers sit flat over the frame.

You never place a card. You set `cards = 10, radius = 4.50, spin = Y,
speed = 0.35` and the arrangement falls out. What you *do* by hand is aim the
camera, pick images, and choose a preset.

**The canvas is the tool.** Video is one of two ways to get a file out at the
end — the other being a still. The first build treated video as the point,
which is the mistake this document exists to correct.

---

## 2. Two kinds of motion, and why it matters

This is the part the first build missed entirely, and it changes the shape of
the document.

**Idle motion** is the component's own animation: a carousel spins, a slider
steps, a feed scrolls. It is controlled by the `Animation` toggle inside the
Component section, and by that component's own `Speed` / `Mode` / `Hold` /
`Transition` parameters. It runs forever and it loops seamlessly.

**Entrance and exit** are separate: cards fly in at the start and out at the
end, and text and logos have their own in and out. The Export panel exposes
exactly four switches — `Component in`, `Component out`, `Text + logo in`,
`Text + logo out` — and the Play button in the toolbar is described as:

> Play — replay every entrance animation in the frame at once (component,
> text, logos). Click again to loop it every 5s.

So Play is not a transport for the idle loop. Play means *show me the
entrance again*. The idle motion is already running the whole time you work.

The first build has only idle motion and a phase scrubber, which is why the
tool felt like a video preview rather than a canvas: the only thing the
transport could do was scrub a loop that was already playing.

### What this implies for the timeline model

A piece has a timeline made of three parts:

```
  [ entrance ]        [ idle loop, forever ]        [ exit ]
   0 → in_dur          loops seamlessly              out_dur
```

- On the canvas: the idle loop runs continuously. Play replays the entrance,
  then hands back to the idle loop. A second click makes it repeat every 5s.
- On export: the video is entrance (if enabled) + N loops + exit (if enabled),
  or, with the entrance and exit switched off and `Seamless loop` on, exactly
  one idle loop — which is the case the current exporter already handles.

Idle motion must stay a pure function of loop phase, closing at 0 and 1.
Entrance and exit are one-shot and do **not** have to close; they are a
separate function of their own progress that blends into the idle placement.

---

## 3. The reference layout

### Frame chrome — a floating toolbar above the canvas

Left to right: **Play**, **Fit**, **16:9** (aspect), **background colour**
(swatch that expands into a row of swatches plus a custom picker, showing the
hex on hover), **Pose** (globe), **Grid** (toggle), **Grid size** (a caret that
opens a popover), **Reset view**.

The grid popover has Columns and Rows steppers, preset chips (25×20, 24×24,
12×12, 20×10, 16×9, 10×10, 8×8, 8×6), a "Saved" slot, and grid colour
swatches.

Below the canvas, centred: **+ Save layout**.

The frame can also go edge to edge, filling the whole area with the toolbar
floating over it.

### Left panel — components and their presets

Two tabs, **Components** and **Layouts**. Components is a plain list that
drills down: click *Ring* and the panel becomes a back arrow plus fifteen
full-width preview tiles labelled *Ring 01 … Ring 15*, the active one marked
with a dot. Each tile is a real render of that preset.

### Middle panel — the component's parameters

Titled with the component name, with a Reset. Sections, each collapsible with
its own reset: **Component** (the component's own parameters), **Pose**,
**Card tilt**, **Displacement**, **Transform**, **Easing**, then **Frame**
(corners, gap) and **Animation**.

### Right panel — Visual and Export

**Visual**: `Cards` (size, corner, gradient overlay, opacity, side, back
opacity), `Images`, `Effects` (badged *New*), `Text | Logo`.

**Export**: a `Video` group with the four animation switches and an Output
block (resolution 720/1080/1440/2K/4K, grid behind component, format
MP4/WebM/GIF, frame rate 24/30/60, seamless loop, duration), a summary line
— `Output MP4 · 1080×608 · 30fps · 5.0s · 16:9` — and **Export video**. Then a
`Static` group: still format PNG/JPEG, scale 1–4×, transparent background.

### Images

Two tabs, **Library** and **Bentos**. Library holds **Videos** (an empty drop
slot) and **Images**, which contains a **System Bank** of 54 stock pictures in
a three-column grid, with selected images marked by a dot in the corner.

---

## 4. Parameter parity

The reference exposes more per component than the first build does. Recorded
here so the gap is a checklist rather than a guess.

**Carousel**: Component (on/off), Animation (on/off), Cards, Card scale, Rows,
Radius, Ramp amount, Stagger radial, Stagger vertical, Image order
(in-order/scatter), Type (continuous/step), Spin axis (X/Y/Z), Speed, Bend,
Bend axis (auto/vertical/horizontal), Bend always, Direction (forward/reverse).

**Slider**: Cards, Card scale, Gap, Stagger, Depth, Spin X, Spin Y, Spin Z,
Axis (horizontal/vertical), Mode (stepped/continuous), Step size, Direction,
Hold, Transition, Drift.

**Card shuffle**: Stagger, Depth, Axis, Images (3/5/7), Card scale, Mode,
Step size, Direction, Hold, Transition, Drift.

Shared: Pose (tilt X/Y/Z + a draggable sphere), Card tilt (tilt X/Y/Z +
stagger across cards), Displacement (displace Z, displace Y, speed, offset,
free orbit, pan X, pan Z, pan speed), Transform (position X, position Y,
scale), Easing (a curve editor with four numbers and a preset list).

Note the pattern the reference uses for stepped components: **Hold** and
**Transition** in seconds, not an abstract speed. A stepped slider holds for
1.0s then takes 3.0s to move. That reads better than a speed multiplier and
should be adopted.

---

## 5. What the first build got right

- The pure-function-of-phase rule, and one `computePlacements` shared by the
  screen, the scrubber and the exporter.
- Eleven components with tests for loop closure and determinism.
- The three-group transform hierarchy (pose → drift → cards).
- Card faces drawn on a 2D canvas so the exporter reproduces the screen.
- Persistence, autosave, thumbnails, layouts, presets.
- Direct manipulation: drag to turn, scroll to zoom, click and drag a card,
  drop a picture onto a card, hand edits as offsets with a reset.
- PNG and MP4 export at the frame's aspect.

## 6. What is wrong or missing

1. **No entrance or exit animation at all**, and therefore Play means the
   wrong thing. *(The single biggest gap.)*
2. **No frame toolbar.** Aspect, background, grid, grid size, fit, reset view
   and pose mode are buried in panels instead of sitting over the canvas.
3. **Pose is not a mode.** The reference toggles Pose, then drag = pose,
   Shift+drag = scale, Cmd+drag = move. The build maps drags differently and
   always-on.
4. **Presets are wrong shape** — a cramped three-column grid of tiny tiles
   rather than full-width labelled previews in a drill-down.
5. **Components list does not drill down.**
6. **Parameter gaps** per component (section 4), especially Rows, Ramp,
   Stagger radial/vertical, Direction, Bend always, Hold/Transition/Drift.
7. **No image library.** There is no bank to choose from, only file import,
   and no Videos slot, no Bentos.
8. **No Effects section.**
9. **No Logo layer** — text exists, logos do not.
10. **Export panel is thinner than the reference**: no animation switches, no
    summary line, no grid-behind-component, no transparent-background story
    for video.
11. **Frame has no Gap** parameter.
12. **Export is presented as the destination** rather than as one action.

---

## 7. Order of work

Each phase is meant to be usable on its own.

**Phase 1 — Make the canvas the tool.**
Frame toolbar (play, fit, aspect, background, pose mode, grid, grid size,
reset view), Save layout under the frame, edge-to-edge mode, and the pose
modifier scheme. Move aspect/background/grid out of the side panels.

**Phase 2 — Entrance and exit.**
Add the timeline model: an entrance and exit per layer group (component,
text + logo), each with a shape, duration, stagger and easing. Play replays
them; a second click loops every 5s. Export composes entrance + loops + exit.

**Phase 3 — Presets and the component drawer.**
Drill-down list, full-width preset previews rendered from the real component,
active marker, and preset labels.

**Phase 4 — Parameter parity.**
Fill the per-component gaps, adopt Hold/Transition/Drift for stepped
components, add Frame gap.

**Phase 5 — Images.**
A proper library: our own bank of images (the reference's 54 cannot be
redistributed), import, per-card assignment, and the Videos slot if video
cards are wanted.

**Phase 6 — Text and Logo layers.**
Both as flat overlays with their own entrance and exit.

**Phase 7 — Effects.**
Blur, grain, vignette, shadow and colour grade across the frame, composited
with the backdrop and overlay.

**Phase 8 — Export, finished properly.**
Animation switches, summary line, grid behind component, still options,
transparent background.

---

## 8. Open questions

- ~~**Effects**: what belongs there?~~ **Decided**: blur, grain, vignette,
  shadow and a colour grade, applied over the whole frame rather than per
  card. Drawn in the same 2D compositing pass as the backdrop and overlay so
  the exporter reproduces them for free.
- ~~**Bentos**: what is a bento here?~~ **Decided**: a multi-image layout
  preset — a bento-grid arrangement of pictures, saved and applied as a set.
- **Videos as card faces**: the Library has a Videos slot. Do cards need to be
  able to play video, or is that for a background?
- **The image bank**: the reference ships 54 stock pictures. Ours has to come
  from somewhere — generated placeholders, an open-licence set, or whatever
  the user drops in.
- **Where a piece goes**: does a Motion piece need to be usable inside a Form
  design, or is a file the only output?
