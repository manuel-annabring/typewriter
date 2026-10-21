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
6. **Scene basics**: soft studio lighting, ground shadow, warm neutral background taken from the palette, loading state while the GLB loads, camera with limited orbit (proposed, see open questions).

### Phase 2: Extras (all wanted, built after Phase 1 works)

- **Typewriter sound**: key clack, spacebar, bell, carriage return, lever. Audio starts only after the first user interaction (browser autoplay rules). Source and license TBD.
- **Intro camera animation**: camera moves in to the typewriter on load.
- **Paper feed and new sheet**: pull the finished page out and insert a fresh one.
- **Whole sheet visible, wrapped around the platen**: the full page stays in view the whole time and curves around the platen, instead of being clipped below the strike point (the slice 5 stopgap, a clipping plane on `Mat_Paper`). Likely needs the `Paper` mesh to bend (subdivided plane bent in code or a vertex shader) and so a contract change for `Paper` (section 5): propose it before starting.
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
| `Key_A` to `Key_Z`, `Key_0` to `Key_9` | One object per key, origin at the key's center |
| `Key_Space`, `Key_Tab`, `Key_Enter`, `Key_Backspace`, `Key_Shift_L`, `Key_Shift_R` | Special keys (final list confirmed once the layout is drawn) |
| `Key_<name>` for punctuation | e.g. `Key_Comma`, `Key_Period` |
| `Carriage` | Parent group of everything that slides: `Platen`, `Knob_L`, `Knob_R`, `PaperHolder` |
| `Lever` | Origin at its hinge, so it rotates correctly |
| `Paper` | Plane with UVs filling 0 to 1, page ratio A4 (decided) |
| `StrikePoint` | Empty marking where characters land, fixed relative to `Body` |
| `TypebarBasket` | Simplified, static |

### Rules

- Export glTF binary (`.glb`), +Y up.
- Apply scale and rotation on all objects. Scale in meters (the real machine is about 0.32 m wide).
- Origins at pivot points (keys at the center, lever at the hinge, `Carriage` at its rest position at the start of a line).
- Materials named: `Mat_Body`, `Mat_KeyCream`, `Mat_KeyDark`, `Mat_Wood`, `Mat_Platen`, `Mat_Metal`, `Mat_Paper`.
- Proposed budgets (confirm after the first export): GLB under about 5 MB, triangle count under about 100k.
- Before each export, run a contract check (names present, transforms applied, origins sensible).

### Proposed amendments (not in force until slice 5b lands)

Both come out of slice 5 and are applied in the blockout before the slice 6 detail pass, so slice 6 is built against the final contract.

1. **`Lever` becomes a child of `Carriage`.** It slides with the carriage, so by the rule above it belongs in that group. This replaces the approved interpretation "Lever is top-level". Origin stays at the hinge. Slice 5 slides it from code (`useCarriageAnimation`) as a stopgap; that code is deleted in the same change that reparents it, or the lever would move twice.
2. **`Paper` is subdivided along its height.** Still a flat plane in the file, UVs still 0 to 1, still A4, still a child of `Carriage`, but with enough segments along its height (about 64, to be confirmed) for code to bend it around the platen. The bend itself (a vertex shader on `Mat_Paper`, with the line feed as a uniform) is a Phase 2 feature, see "Whole sheet visible, wrapped around the platen". Open: whether the sheet's path needs a guide node, or can be derived from the platen radius. A short spike of the bend on the blockout answers this before the contract is frozen.

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
5b. Contract amendments (section 5, proposed amendments): reparent `Lever` under `Carriage` and subdivide `Paper` in the blockout `.blend`; update `contract_spec.py`, `contract.ts` and the contract check; export and `npm run gen:model`; remove the lever sliding from `useCarriageAnimation`. Optional first: a short throwaway spike of the paper bend to settle the guide-node question. Mechanical Blender work, so Sonnet at medium effort; Opus or high effort for the spike.
6. Model detail pass: replace the blockout, materials, optimization. The contract stays the same.
7. Phase 2 slices, one at a time: sound, intro camera, new sheet, save or share, mobile.
8. Release: performance check, loading state, deployment, portfolio write-up.

## 8. Definition of done (Phase 1)

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
- Camera: orbit limits, or a fixed view?
- Is the page content kept between visits (localStorage)?
- Hosting and domain.
- Sound source: record yourself or use licensed samples?
- Project title and any on-screen hint text.
