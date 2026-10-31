# Typewriter: Interactive 3D Typewriter (SPEC)

Status: Draft v1, 2026-10-19
Owner: Manuel

## 1. Goal

A 3D web experience of a typewriter that really writes on a sheet of paper. The visitor types on their physical keyboard or clicks the keys on the 3D model, and the matching letters appear on the paper while the carriage slides along.

Purpose:
- Portfolio piece for 3D developer roles (industry, tech, innovation).
- Second three.js project, and practice for an agent-driven ("vibe coding") workflow.

## 2. Tech stack

| Area | Choice |
|---|---|
| Rendering | three.js, @react-three/fiber (r3f), @react-three/drei |
| App | Vite, React, TypeScript |
| State | Zustand (typing state lives in the store, not in components) |
| Model | Blender, exported as GLB, turned into components with gltfjsx |
| Hosting | TBD |

Pin exact versions in `CLAUDE.md` when the project is created.

## 3. Visual reference

`reference/retromod-sheet.png` is a concept sheet (generated with ChatGPT). Name on the sheet: "RetroMod".

What to take from it:
- Overall shape: rounded shell with sloped top, cutout window over the typebars, wood base strip, cylinder platen with end knobs, flat spacebar, wooden lever at the left.
- Palette: sage-green body, cream key caps, darker modifier keys, walnut base, near-black platen, brushed metal. Sample exact colors from the sheet.
- Key design: round cream cap on a thin dark stem.

What NOT to trust:
- Dimensions (320 mm and 170 mm appear on all three drawings, so depth is unspecified). Use as rough proportions only.
- Key labels (unreadable) and exact key count. We define the layout ourselves.
- The image has no paper, no paper support and almost no visible typebars. Those parts are designed by us.

## 4. Scope

### Phase 1: Core (must work before anything else)

1. **Input**
   - Physical keyboard: map by the character produced (`event.key`), so any real keyboard layout works.
   - Pointer: click or tap a 3D key to type that character.
   - Both paths call the same store action.
2. **Key animation**: the pressed key sinks and returns. Pointer and keyboard presses animate the same way.
3. **Text on paper**
   - Characters are drawn onto a 2D canvas that is used as the paper's texture.
   - Each character gets slight random offset, rotation and ink opacity for a typewriter feel.
   - Only the new character is drawn per keystroke (no full redraw).
4. **Carriage**
   - Classic behavior: the carriage (platen and paper) slides sideways with each character while the strike point stays fixed.
   - Spacebar advances the carriage without printing.
5. **Line end and return**
   - Near the right margin a bell event fires (silent in Phase 1, sound comes in Phase 2).
   - At the margin the carriage locks.
   - Enter or a click on the lever returns the carriage to the left and feeds the paper up one line.
6. **Scene basics**: soft studio lighting, ground shadow, warm neutral background taken from the palette, loading state while the GLB loads, camera with a limited orbit (decided 2026-10-29, see the Phase 2 camera entry).

### Phase 2: Extras (all wanted, built after Phase 1 works)

- **Typewriter sound** (done, 2026-10-30; built on synthesized placeholders, then real CC0 clips): Web Audio API, no library. `pressKey` is the one trigger: it snapshots the store before and after the action and `soundsFor` (pure, `src/lib/soundEvents.ts`) turns that into timed cues, so a click on a 3D key sounds the same as the keyboard and ignored actions are audible.
  - Sounds: `clack` (letters, digits, `,` `.`; 2 clips), `space` (1), `thunk` (Shift, Tab, Backspace and Enter's key; Tab and Shift do nothing else yet), `bell` (once at column 60, 60 ms after the clack that reached it), `lock` (a key ignored at column 66: a dull clunk), and the carriage return as `lever` (the 3D lever only; Enter plays `thunk`), `zip` (a ratchet as long as the slide) and `stop` (the end stop). Key down only, no release sound. Held keys do not repeat. A return from the first columns skips the ratchet (under 80 ms).
  - Timing: the slide is exponential (`LAMBDA_RETURN`, `LAMBDA_FEED` in `src/lib/carriage.ts`), so the ratchet lasts until the remaining distance is 1 mm (`returnSlideSeconds`, about 0.4 s from column 60) and the stop comes at the later of that and the line feed (about 0.13 s).
  - Variation: round-robin without repeating the last variant, plus random pitch (`playbackRate`, ±2 to 4 %) and gain (±1 to 1.5 dB) per hit; at most 24 voices (the oldest fades out in 5 ms); master gain 0.5 into a limiter (fast compressor). All numbers are in `SOUND_SPECS` and neighbours in `src/lib/soundVariation.ts`.
  - Unlock: an `AudioContext` is created and resumed inside the first pointer or key gesture (autoplay rules, iOS Safari); the engine (`src/audio/engine.ts`, buffers, voices, limiter) is a lazy chunk loaded after that. A press that arrives while it loads is held for up to 300 ms and then dropped; typing is never delayed. Blocked or unsupported audio is a silent no-op with no console output.
  - Sources: seven CC0 clips from Freesound in `public/audio/` (mono 44.1 kHz mp3, 60 kB for the six in use; authors, links and processing in `public/audio/LICENSES.txt`): `key_1`, `key_2` (clack), `space_1`, `bell`, `return_slide` (ratchet) and `return_stop` (end stop); `return_full` is an unused alternative. Shift, Tab, Backspace, the lock clunk and the lever have no clips of their own: they play the key clips lower and slower (`rate` in `SOUND_SPECS`: 0.8, 0.55 and 0.5). The ratchet clip (0.73 s) is stretched up to 1.6x to fit the slide and cut at its end with a 20 ms fade. The clips are fetched in the background once the model has loaded (no gesture needed to fetch) and decoded on the first gesture; the code-synthesized placeholders were removed (git history, `749967d`).
  - UI: a "Sound on / Sound off" button, bottom left (`SoundToggle`, state in `src/ui/soundUi.ts`). On by default once a gesture has happened. The mute choice is kept in `localStorage` (`typewriter:muted`; storage access is wrapped, the page works without it). No volume control, no hint.
  - Not yet: the new-sheet sound (comes with the new-sheet slice).
- **Camera** (done, 2026-10-29): free orbit inside limits, an intro flight, a writing view and a reset button. Constants live in `src/scene/cameraConfig.ts`; the maths is in `src/lib/cameraPath.ts`, the behavior in `src/scene/CameraRig.tsx`.
  - Limits: no pan (the machine is always the target), elevation 8° to 61°, azimuth ±70° round the front, distance 0.30 to 1.50 m, damping 0.08. The resting view is 0.69 m from the target at azimuth 28.6° and elevation 24.1°.
  - Intro: starts 2x as far away, 45° up and swung 40° to the left, eases out into the resting view in 2.5 s, 0.4 s after mount (the loader fade). A pointer press or the wheel stops it where it is; a key press fast-forwards it in 0.4 s; typing is never blocked. Reduced motion skips it.
  - Dropped (2026-10-30): event moves (follow the carriage, push in while typing, pull back when idle). They were built and removed again because the result did not feel right (git history: `30eae81`). If camera moves tied to typing are wanted later, start from a fresh discussion.
  - Writing view (done, 2026-10-30): a click on the carriage (paper, platen, holder, table, knobs; not the lever, not a drag) or the "Writing view" button flies the camera to the strike point, which never moves because the paper slides under it, so the typed text lies to its left. Fixed reading angle: 20° up (tuned by Manuel; 45° was too high), 3° off the front. The distance fits 70 columns across the window (`fitDistance`, clamped to 0.08 to 0.40 m), so it adapts to wide, narrow and later portrait windows. It takes 1 s (reduced motion jumps). While in it the distance limits are 0.08 to 0.40 m (orbit and zoom still work, pan stays off); Reset view restores 0.30 to 1.50 m. Hints: a `zoom-in` cursor over the carriage in the overview, the button, a one-time nudge after 15 printed characters (10 s, once per page load, never after the view was used), and Esc.
  - Reset view: a button (bottom right, next to Writing view) offered once the view has moved (orbit, zoom or the writing view); it flies back to the resting view in 0.8 s. Esc does the same.
  - Still open: portrait and small windows (belongs to the mobile slice; the writing view already fits by columns, the overview does not; the constants are in one module).
- **Paper feed and new sheet**: pull the finished page out and insert a fresh one.
- **Whole sheet visible, wrapped around the platen** (done): the full page stays in view the whole time and curves around the platen, instead of being clipped below the strike point (the slice 5 stopgap, a clipping plane on `Mat_Paper`). The `Paper` mesh is already subdivided for this (section 5, slice 5b); the bend is a vertex shader on `Mat_Paper` with the line feed as a uniform, and needs no further contract change.
- **Save or share**: download the page as an image and copy the text to the clipboard.
- **Mobile support** (stretch): tap keys with comfortable touch targets, camera framing for portrait screens. Desktop comes first.

### Out of scope for now

- Visible typebar swing per letter, shift mechanism, ribbon animation.
- Switchable keyboard layouts (the keys are printed QWERTY).
- Accounts, backend, multiplayer.

## 5. Model contract (Blender to code)

The code finds and animates parts by name, so the names and rules below are fixed.

### Object names

| Object | Notes |
|---|---|
| `Body` | Shell |
| `Base` | Wood base strip |
| `Key_A` to `Key_Z`, `Key_0` to `Key_9` | One object per key, origin at the bounding-box centre of the whole key object (cap, riser and lever; amendment, slice 6c levers: with the lever it lies well behind the cap). The press is a pure translation, so the code does not depend on where the origin is |
| `Key_Space`, `Key_Tab`, `Key_Enter`, `Key_Backspace`, `Key_Shift_L`, `Key_Shift_R` | Special keys (final list confirmed once the layout is drawn) |
| `Key_<name>` for punctuation | e.g. `Key_Comma`, `Key_Period` |
| `Carriage` | Parent group of everything that slides: `Platen`, `Knob_L`, `Knob_R`, `PaperHolder`, `PaperTable`, `Paper`, `Lever` |
| `PaperTable` | Child of `Carriage` (amendment, slice 6c). The plate behind the platen that the sheet's tail rests on, sloping at `TAIL_ANGLE`, in `Mat_Metal`. Origin at the `Carriage` origin. The code does not animate it |
| `Lever` | Child of `Carriage` (it slides with it). Origin at its hinge, so it rotates correctly |
| `Paper` | Child of `Carriage`. Flat plane with UVs filling 0 to 1, page ratio A4 (decided), subdivided along its height (128 segments) so code can bend it around the platen |
| `StrikePoint` | Empty marking where characters land, fixed relative to `Body` |
| `TypebarBasket` | Simplified, static |

### Rules

- Export glTF binary (`.glb`), +Y up.
- Apply scale and rotation on all objects. Scale in meters (the real machine is about 0.32 m wide).
- Origins at pivot points (keys at the center, lever at the hinge, `Carriage` at its rest position at the start of a line).
- Materials named: `Mat_Body`, `Mat_KeyCream`, `Mat_KeyDark`, `Mat_Wood`, `Mat_Platen`, `Mat_Metal`, `Mat_Paper`, `Mat_Interior` (amendment, slice 6c cavity: the dark matte inside of the keyboard well, used by `Body`'s second material slot).
- `Body` therefore has two material slots (`Mat_Body`, `Mat_Interior`) and exports as a group named `Body` with child meshes `Body_1` and `Body_2`; `StrikePoint` stays its child.
- Budgets (measured 2026-10-29 on an M1 Pro MacBook Pro, confirmed): GLB under 1.5 MB (now 917 kB, 89 kB brotli); model under 100k triangles (now 36k; the ground-shadow depth pass renders them again while something moves); main pass about 100 draw calls (now 99); 60 fps at devicePixelRatio 2 while typing and during the carriage return (met, vsync-capped); entry JS under 300 kB (now 234 kB, 74 kB gzip), the 3D scene is a separate lazy chunk (1.08 MB, 294 kB gzip); sound adds a lazy engine chunk of 2 kB and 60 kB of mp3 clips under `public/audio/` (budget 150 kB), fetched once the model has loaded.
- Before each export, run a contract check (names present, transforms applied, origins sensible).

### Key label atlas (amendment, slice 6d)

Key labels are drawn in code, not baked into the model. All keys share `Mat_KeyCream` and `Mat_KeyDark`, so each of the two materials gets one canvas atlas (an 8 x 8 grid of square cells; the code paints the label cells and assigns the atlases as `map`). The model only has to say where each key's label lives:

- Every key object has one UV layer (`UVMap`).
- A key's cell is its index in the key list (`KEY_NODE_NAMES` in `contract.ts`, `KEY_NAMES` in `contract_spec.py`: rows back to front, then `Key_Space`) plus 1. Cell 0 is the blank cell (plain background, no label). Cells run left to right, then top to bottom, in the glTF UV frame (v down, origin top-left).
- The key's top face (the face with the label, in `Mat_KeyCream` for cream keys and `Mat_KeyDark` for the modifier keys) maps into its cell, inside a margin of 1/16 of the cell on every side. The top is projected straight down, so the cap's full width fills the inner square.
- Every other face (cap sides, lever, and a cream key's dark parts) maps into the blank cell, so they show the plain base colour.
- The code reads each material's base colour from the model, paints it as the atlas background and sets the material colour to white, so Blender stays the source of truth for the colours. `Key_Space` is blank (its cell stays unlabelled). Labels: letters in uppercase, digits, `,` and `.` as printed, `TAB`, `↵` (Enter), `⇧` (both Shift keys), `←` (Backspace).
- Font: Inter (sans-serif, open license), bundled in `public/fonts/`.

The contract check verifies the UVs (layer present, top face inside its inner cell, all other faces in the blank cell) once the journal script that creates them exists (slice 6d-2).

### Paper path (spike result, slice 5b)

The bend itself is Phase 2 ("Whole sheet visible, wrapped around the platen"), but a throwaway spike (vertex shader on `Mat_Paper`, branch `spike/paper-bend`, not merged) settled the open contract question: **no guide node is needed.** The wrap is derived from the model alone:

- The platen axis is the `Carriage` origin (already enforced by the contract check) and runs along x.
- The wrap radius is the distance from that axis to the sheet's plane (22.6 mm here, against a 22 mm platen), so the sheet leaves the platen tangent to it with no kink.
- The sheet stays flat above the tangent point, wraps around the platen below it, and what the wrap leaves over (a straight tail) is a code-side choice, not a contract item.
- 64 segments showed visible facets on the 22 mm radius (about 12 degrees each); 128 is the contract value. Two vertex columns are enough because the bend only runs along the height.

## 6. Architecture notes

- The Zustand store holds: the lines of text, cursor (row and column), status (typing or locked at margin), a bell counter (`bellSeq`), currently pressed keys. The carriage position and the line feed are not stored: they are derived from the cursor each frame.
- Actions: `typeChar`, `space`, `returnCarriage`, `backspace`, `newSheet`. Input only dispatches actions. Scene components subscribe.
- Animations run in `useFrame` using refs and damping. No React state updates per frame and no creating new objects inside `useFrame`.
- Paper uses a `CanvasTexture`: draw the one new glyph, set `needsUpdate`.
- Typewriter font candidates (open-license, to confirm): Special Elite, Courier Prime.

## 7. Build order

Each step ends with something visible, is tested, and is committed before the next.

0. Setup: Vite, React, TypeScript, r3f, drei, Zustand. `SPEC.md` and `CLAUDE.md` committed.
1. Blockout in Blender against the reference sheet, contract-compliant. Export a rough GLB, load it in r3f with light and orbit.
2. Input to store: keyboard and key clicks update the store, shown in a debug overlay.
3. Key press animation.
4. Paper canvas texture: characters appear at the cursor.
5. Carriage slide, line-end lock, lever return and line feed.
5b. Contract amendments (done): reparent `Lever` under `Carriage` and subdivide `Paper` in the blockout `.blend`; update `contract_spec.py`, `contract.ts` and the contract check; export and `npm run gen:model`; remove the lever sliding from `useCarriageAnimation`. Optional first: a short throwaway spike of the paper bend to settle the guide-node question. Mechanical Blender work, so Sonnet at medium effort; Opus or high effort for the spike.
6. Model detail pass: replace the blockout, materials, optimization. The contract stays the same.
   - Done: `Base`, `Body` (hand-modeled), key labels (6d: atlas UVs and `useKeyLabels`), environment light.
   - Done (keycaps, slice 6c): the 44 keys are rounded caps on stems, generated by `steps/07_keycaps.py` (parameters picked in a side-view widget). Letter caps 18 mm round, modifiers 23.5 mm stadiums, Space a 150 x 14 mm rounded bar; cap tops on one line falling 24° to the front, stems into the well floor. The bottom row moved 6 mm left so `Shift_R` clears the right cheek. Re-run `steps/02_key_uvs.py` after any rebuild.
   - Done (key levers, slice 6c): every key has a flat steel lever (1.5 x 5 mm strip on edge, `Mat_KeyDark`) instead of a stem: a riser under the cap, a 90° bend (radius 4 mm) and an arm running back (+Y) through the hump's front wall (y -50.4) to 8 mm inside the `Body`. Routing "two levels": row 0 arms at z 50.5, rows 1 to 3 at z 23.0, the Space bar's two arms at z 16.2 (they dip about 0.8 mm into the floor slab, hidden; pressed 4 mm they reach below the `Body` bottom into the solid `Base`, also hidden). The back row sits 1 mm right of its blockout x so `Key_1` clears the hump's chamfered corner (0.44 mm). Generated by `steps/07_keycaps.py` (parameters at its top); the widget maths showed no collisions at rest or with a key pressed 4 mm, and a headless mesh check agrees. No comb plate (optional, not built).
   - Done (keyboard cavity, slice 6c): the well floor is lowered from z 16.5 to 14.5 (the `Body` bottom is at z 13.0, so 13 was not possible) and the floor, the foot bevels and the inner walls up to their top edges use the new `Mat_Interior`, so the shell reads as cut open (`steps/08_keyboard_well.py`). Stems were unchanged then (feet at z 13.5); the levers replaced them.
   - Done (platen and knobs, slice 6d): lathe-built `Platen` (plain r 22 cylinder) and knurled `Knob_L` / `Knob_R` with steel stubs, `steps/09_platen_knobs.py`.
   - Done (lever, slice 6e): `Lever` is a 10 mm hub at the hinge, a 5 mm steel rod that leaves the hub vertically (the end plate is 6.5 mm left of the hinge and reaches z 124, so a rising straight arm would cut through it) and bends over to end horizontal in a 9 mm wooden ball (`Mat_Wood`), reach 80 mm. Picked in a side-view widget; `steps/10_lever.py` also holds `swing_clearance()` (rotates about Blender -Y up to 30°: no overlaps; at 25° the nearest parts are `Platen` 2.5 mm (the hub) and `PaperHolder` 4.3 mm). Keep `SWING_DEG` equal to `PRESS_ANGLE` in `useLeverAnimation.ts`.
   - Done (body hump, session 3): the hump top is lowered from z 98 to z 82, under the strike point (z 88), so typed text shows over it. Profile C (picked in a side-view widget): the front slope is one curve leaving the slope's foot (y -44.9, z 70.6) along the cheek line (24°) and flattening at y -5; the rear edge is rounded over 10 mm (y 24.4 to 34.4, ending at z 72); the two ends droop 7 mm over 24 mm (a circular R24 does not fit, the hump is only about 13 mm above the deck). Everything at or below z 70.6 is unchanged, the well opening still starts at y -14.3 (the placeholder typebar corridor clips its front edge by design choice, to be settled with the basket). Journal: `steps/11_body_hump.py` (not re-runnable; 606 to 1086 vertices).
   - Done (typebar basket, session 4): static fan at rest in the well opening, picked in a side-view widget (preset "flat radial fan"; the upright fan looked like bars swung up against the strike point, the hanging one had the slugs facing away from the paper). 15 flat bars in a +-45 degree fan round the strike point, 5 degrees above horizontal, each with its own 3 mm cube (type slug) at the outer end; the inner ends meet one pivot rail on two posts. No rail joins the slugs. 536 vertices, 940 triangles, one material (`Mat_Metal`), no overlaps with Body, platen, paper, paper holder, paper table or keys (15 mm clear of the sheet). Journal: `steps/12_typebar_basket.py` (re-runnable).
   - To do (still blockouts in `typewriter.blend`): `PaperHolder` (partly modeled, see paper path). `Paper`, `Carriage` and `StrikePoint` are contract-critical and stay as they are.
   - Done (paper path, slice 6c): `PaperTable` (child of `Carriage`, `Mat_Metal`) holds the sheet's tail, its top face 0.8 mm under the tail and sloping at `TAIL_ANGLE` (35°); `PaperHolder` carries the bail bar and two rubber rollers (`Mat_Platen`) that touch the sheet where `BAIL_WRAP` (30°, so 38° above the platen's front horizontal) ends. Journal: `steps/04_paper_table.py`, `steps/05_paper_bail.py`. If an angle changes, change the constant in `src/lib/paperBend.ts` and rerun both steps; the tail must stay flatter than the typed front part (about 52° above horizontal).
   - Done: optimization pass (ground shadow redrawn only while something moves, scene code-split behind the loader; numbers in section 5).
   - To do (polish): material tuning (roughness and metalness per `Mat_*`); optional Inter subsetting (352 kB font, key labels use about 40 glyphs).
7. Phase 2 slices, one at a time: ~~sound~~ (done, with CC0 clips), ~~intro camera~~ (done, camera: limits, intro, reset), new sheet, save or share, mobile.
8. Release: performance check, loading state, deployment, portfolio write-up.

## 8. Definition of done (Phase 1)

Status 2026-10-29: all points below are met; Phase 1 is done. Phase 2 so far: the whole sheet wrapped around the platen is built (see CLAUDE.md "Paper bend"). The camera (limits, intro, reset, writing view) and sound are built too. Next: new sheet, save or share, mobile.

- Typing on a physical keyboard prints the right characters on the paper.
- Clicking a 3D key does the same and animates the key.
- The carriage slides one step per character, locks at the margin, and Enter or the lever returns it and feeds a line.
- The build and type check pass with no console errors.
- Runs at a smooth frame rate on a typical laptop.

## 9. How the agent verifies its work

- Run build, type check and lint after every change.
- Check the result visually in the browser (screenshot) and read console messages.
- For the model: run the Blender contract check before every export.

## 10. Open questions

- ~~Backspace~~ Decided in slice 5: moves the carriage back one column without erasing, clears the margin lock, and typing over it overstrikes. Tab is still open (next 5-column stop is the proposal).
- Tab key and Shift: does shift change the printed character, and what do the key caps show?
- Lines and characters per page (the paper format is decided: A4).
- ~~Camera: orbit limits, or a fixed view?~~ Decided 2026-10-29: free orbit inside limits (no pan, elevation 8° to 61°, azimuth ±70° round the front, 0.30 to 1.50 m).
- Is the page content kept between visits (localStorage)? (Only the sound mute choice is kept so far; see the sound entry in section 4.)
- Hosting and domain.
- ~~Sound source~~ Decided 2026-10-30: everything was built and tuned on synthesized placeholders first, then replaced by seven CC0 clips from Freesound (licences read on each page, listed in `public/audio/LICENSES.txt`). The engine only sees `AudioBuffer`s, so a different clip set is a change to `SOUND_SPECS`.
- Project title and any on-screen hint text.
