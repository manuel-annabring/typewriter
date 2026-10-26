# Typewriter: CLAUDE.md

Interactive 3D typewriter for the web. The visitor types (physical keyboard or clicking the 3D keys) and the text appears on a sheet of paper while the carriage slides.

`SPEC.md` is the source of truth for scope, the Blender-to-code model contract, and the build order. Read it before starting any task. If the code needs something the spec doesn't say, propose a change to the spec instead of silently deviating.

## How we work

- Follow the build order in SPEC.md section 7. One slice per session. Phase 1 before Phase 2.
- For anything touching more than about 3 files, propose a short plan first and wait for approval.
- Commit after every working slice with a clear message.
- For shape or geometry decisions (paper path, angles), first show an interactive 2D side-view widget (`show_widget`) built from the same maths, let Manuel pick values, then implement step by step and pause after each step with a browser check.
- Manuel is learning Blender through this project. Since the live-MCP workflow (see "Blender workflow" below) Claude makes the modeling edits and explains each one in 2 to 3 sentences (what, why, which Blender concept). Give a numbered walkthrough with keyboard shortcuts only when Manuel wants to do or tweak something himself. Keep it short: no coordinate tables or long value lists; give exact numbers only where the contract needs them. Answer in English (Manuel's decision on 2026-10-23, replaces the earlier "German when he does").
- Before describing or planning Blender work, inspect the saved `.blend` headlessly (object extents, vertex count, modifiers, scale) instead of judging from a screenshot. Verify menu and shortcut names against the Blender 5.2 manual (bundled at `/Users/manuelannabring/.venvs/blender-mcp/lib/python3.13/site-packages/blmcp/data/manual`) before giving them.
- Don't add features outside the current slice. Note ideas in your reply instead.
- Manuel is a senior React developer but new to three.js, r3f and Blender. Don't explain React basics. Do explain three.js, r3f, shader or Blender concepts in 2 to 3 sentences the first time they appear.
- Never change the model contract (SPEC.md section 5) on your own.
- Don't add dependencies without asking.
- Before committing, show the diff summary and `git status`, then wait for Manuel's OK; then commit and push.
- If you said you would ask before a deviation, ask. Flag any deviation prominently in the reply.

## Model and effort

Manuel chooses model and effort at the start of each session. You can't change them, but you can recommend. Default setup: Sonnet 5.5 at medium effort.

- When you propose a slice plan, add one line recommending model and effort for that slice.
- Planning, architecture, store design, carriage and paper logic: Opus, or Sonnet at high effort.
- Routine implementation (key animation, UI overlay, glue code): Sonnet, medium.
- Tricky bugs (pivots and transforms, canvas-to-UV mapping, timing): Sonnet at high effort first, Opus if still stuck.
- Mechanical Blender work (renaming, contract check): Sonnet, low or medium.
- Review of a finished slice: Opus or high effort, in a fresh session.
- Chores (.gitignore, commit messages, small renames): low or medium.
- When something goes wrong, first check whether the prompt, SPEC.md or CLAUDE.md is unclear or wrong. Then suggest raising effort. Suggest a bigger model last. A bigger model or higher effort doesn't fix a wrong input.
- If you fail twice at the same problem, stop and say so. Suggest the next step (clearer input, higher effort, or Opus) instead of trying more variations.
- Changing effort mid-session loses the prompt cache, so prefer deciding at session start.

## Stack

three, @react-three/fiber, @react-three/drei, React, TypeScript, Vite, Zustand. Model as GLB from Blender, components generated with gltfjsx.

Installed (all pinned exactly): react and react-dom 19.3.1, three 0.186.1 (@types/three 0.186.0), @react-three/fiber 9.8.2, @react-three/drei 10.7.9, zustand 5.0.15, vite 8.3.4, @vitejs/plugin-react 6.1.2, typescript 6.0.3, eslint 10.13.0 with typescript-eslint 8.72.0. Node v26.7.0 (Vite needs ^20.19 or >=22.12).

- TypeScript stays on 6.0.x because typescript-eslint 8.72 supports `<6.1.0`. Don't move to TypeScript 7 until typescript-eslint supports it.

- Exact installed versions in `package.json` are the source of truth. Pin exact versions (no `^`).
- Before writing r3f, drei or three code, check the installed versions. Do not mix API patterns from other versions.
- The r3f major version must match the React major version.
- drei: stay on the stable 10.x line, not alpha prereleases.
- Don't upgrade packages unless asked.
- Use the Node version required by the installed Vite.

## Commands

- `npm run dev`: dev server
- `npm run build`: `tsc -b && vite build`
- `npm run typecheck`: `tsc --noEmit` for `tsconfig.app.json` and `tsconfig.node.json`
- `npm run lint`: `eslint .`
- `npm test`: vitest unit tests (`src/**/*.test.ts`)
- `npm run preview`: serve the production build
- `npm run gen:model`: regenerate `src/typewriter/TypewriterModel.generated.tsx` from `public/models/typewriter.glb` (gltfjsx 6.5.3 via npx, plus patches for React 19 and strict TS). Never edit the generated file by hand.

Blender (headless, `B=/Applications/Blender.app/Contents/MacOS/Blender`, scripts in `tools/blender/`):

- Contract check: `$B -b tools/blender/typewriter.blend --python tools/blender/contract_check.py`
- Export (runs the check first, refuses on errors): `$B -b tools/blender/typewriter.blend --python tools/blender/export_glb.py`
- Previews (Workbench PNGs, does not save the .blend): `$B -b tools/blender/typewriter.blend --python tools/blender/render_preview.py -- <output_dir>`
- `tools/blender/typewriter.blend` is the source of truth (hand-edited in 6a/6b, live-MCP edited from slice 6c on). `build_blockout.py` is retired: it built the original blockout into `typewriter-blockout.blend` and must not be re-run against `typewriter.blend`. Keep it for reference only.
- After changing the model: export, then `npm run gen:model`.

Known noise: the build warns that the main chunk is over 500 kB (three and drei), and the browser console shows `THREE.Clock: This module has been deprecated`, which comes from r3f 9.8.2 itself. Both are expected until r3f is updated.

## Folder structure

```
reference/          concept sheet (not shipped)
public/models/      typewriter.glb
src/
  scene/            Canvas, lights, camera, environment
  typewriter/       Typewriter.tsx (wrapper, behavior), contract.ts (required node names),
                    TypewriterModel.generated.tsx (generated, never hand-edit), Key, Carriage, Lever, Paper
  store/            Zustand typing store
  input/            keyboard and pointer, dispatch store actions only
  lib/              pure helpers (paper grid, glyph jitter, key mapping), unit-testable
  ui/               HTML overlay (Loader, hints, buttons)
tools/blender/      headless Blender scripts + typewriter.blend (source of truth)
tools/gen-model.mjs gltfjsx wrapper behind `npm run gen:model`
```

## Code rules

- TypeScript strict. No `any`.
- All typing state lives in the Zustand store. Components never own typing state.
- The input layer only calls store actions (`typeChar`, `space`, `returnCarriage`, `backspace`, `newSheet`).
- Subscribe to the store with selectors, never the whole store. For per-frame reads use `useStore.getState()`.
- Animate in `useFrame` using refs and damping. No `setState` in `useFrame`.
- No allocations in `useFrame` or render: no `new Vector3`, `new Color` or materials there. Create once (module scope or `useMemo`).
- Paper uses a `CanvasTexture`. Draw only the new glyph per keystroke, then set `needsUpdate`. Set the correct color space.
- Find model parts by the names in the SPEC contract. If a name is missing, fail loudly in development. Never guess.
- gltfjsx output stays in its own generated file (use `--types`). Put behavior in wrapper components so regenerating doesn't overwrite it.
- Dispose textures and geometries that we create ourselves on unmount.
- Pointer events on keys: stop propagation and show a pointer cursor on hover.
- Audio starts only after the first user interaction.

## Blender and model rules

- The model contract is SPEC.md section 5.
- The Blender MCP tools run arbitrary Python with no guards. Use the official Blender Lab server (Blender 5.1+), make a safety copy before each session and before each risky step, and never open untrusted files while connected.
- Run the contract check (names, applied transforms, origins) before every export.
- Export glTF binary (`.glb`), +Y up.
- All edits, live or by hand, must keep object and material names, applied transforms, origins and parent links. Replace meshes, never delete contract objects.

### Blender workflow (live MCP + journal, decided 2026-10-22)

Why: hand-modeling the full typewriter was too hard for a Blender beginner. We now work in one shared live Blender session, similar to writing three.js code together.

- **Live (default).** Manuel starts the MCP add-on server and opens `typewriter.blend`. Claude edits the open scene through the MCP, looks at the result (`get_screenshot_of_area_as_image`, viewport renders, headless previews) and explains each step in 2 to 3 sentences. Manuel may tweak or play at any time; Claude re-inspects the scene before the next step because it may have changed. Inspect before editing, never assume values.
- **Safety.** Before each session copy the saved file to `typewriter-pre-<slice>.blend1` (git-ignored). Claude saves with `bpy.ops.wm.save_mainfile()` at checkpoints (after each working part) and tells Manuel. Never save over a state Manuel is in the middle of editing without asking.
- **Journal.** Every live step that worked goes into `tools/blender/steps/NN_<part>.py` as a small, re-runnable function with its parameters at the top. The journal documents how a part was made and is the base for scripted repetition. Do not re-run old steps against `typewriter.blend` without asking. Anything not in the journal is lost if the file is lost.
- **Scripts for repetition.** Keys, stems, rows and other repeated parts are generated by a parametric script in the journal, not by clicking 43 times. Organic or subtle shapes are modeled live, with Manuel's taste deciding.
- **Checkpoint per part.** After each part: run the headless contract check, render a preview (front, side, top), show Manuel the result, and commit only after his OK. Export and `npm run gen:model` only after the contract check passes.
- **Headless stays headless.** Contract check, export and previews run via `Blender -b`, not through the live session.
- Prefer `bpy.data`/`bmesh` for geometry and verify the object mode and the active object before `bpy.ops` calls; set selection and active explicitly. `execute_blender_code` is the last resort when a dedicated MCP tool exists.
- Blender coordinates: Z up, keyboard at -Y; the exporter maps this to glTF +Y up, front facing +Z.
- Approved contract interpretations: `Paper` and `Lever` are children of `Carriage` (`Lever` origin stays at the hinge; `Paper` is flat, A4, 128 segments along its height); `StrikePoint` is an Empty under `Body` at x=0; `Carriage` origin is on the platen axis at its rest position (x=0.085, so the carriage overhangs the body's right edge at rest); special keys are Space, Tab, Enter, Backspace, Shift_L, Shift_R, Comma, Period; keyboard is flat (identity rotations), rows stepped in height.
- Node names live in two places that must stay in sync: `tools/blender/contract_spec.py` and `src/typewriter/contract.ts`.
- Multi-material objects (all letter/digit keys, Lever) export as a group named like the object with child meshes `Key_A_1`, `Key_A_2`. Find them with `getObjectByName('Key_A')`, never by the child names.
- gltfjsx stays pinned and one-off via `npx` (not a dependency); regenerate only through `npm run gen:model`, which patches gltfjsx 6.5.3 output for React 19 and strict TS and fails if its output changes shape.

## Verify before saying "done"

1. `npm run typecheck`, `npm run lint` and `npm run build` pass.
2. Look at the result in the browser (screenshot) and read the console. No errors or warnings.
3. Test the slice's behavior by hand: keyboard and clicking keys.
4. For model changes: contract check passes and the GLB loads.
5. Summarize what changed in 1 to 2 sentences.

## Lessons learned

(Add hard-won lessons here as they come up, for example "Don't create materials inside useFrame".)

- Tooling: ESLint 10 flat config (not oxlint, which the create-vite template uses). `tsconfig.app.json` is strict plus `noUncheckedIndexedAccess`. `@types/node` is not installed, so `tsconfig.node.json` has `types: []`; don't use Node APIs in `vite.config.ts` or `eslint.config.js` without asking.
- `npm install` blocks the optional `fsevents` install script (allowScripts). This is harmless.
- `.claude/` is gitignored. `.claude/launch.json` (dev server on port 5173) is for the in-app browser preview only.
- The create-vite template targets TS 7. We deliberately did not copy that choice (see Stack).
- If another dev server holds port 5173, `preview_start` falls back to 5174. Use whatever port it reports.
- The dev-only contract guard throws if a node is missing, which unmounts the Canvas and leaves the loader overlay on screen. The error is in the console.
- Paper bend (Phase 2): `usePaperBend` owns the line feed and the wrap. The `Paper` node never moves; a vertex shader on `Mat_Paper` (`onBeforeCompile`, GLSL in `src/lib/paperBend.ts` next to its TS twin `bendPoint`, keep them in sync) feeds each vertex by the `uPaperFeed` uniform and wraps it round the platen axis (Carriage origin, radius = axis-to-sheet distance, about 22.6 mm): up past the tangent point to the paper bail (`BAIL_WRAP`, 25°, so the typed part leans back about 33°) and down round the bottom until the tail leaves at `TAIL_ANGLE` (35° above horizontal, the paper table's slope); past either end the sheet runs straight. The wrap is a uniform, `wrapAngleFor(sheetLean, TAIL_ANGLE)` (about 133°), with the lean measured from the model at mount. The tail must stay flatter than the front (about 57°), i.e. bail wrap plus wrap angle at most half a turn, or the sheet crosses itself mid-page; a unit test checks the gap. The tail floats until a paper table exists (SPEC section 7, step 6). Above the bail the free, typed part droops back under its own weight: extra lean `droopAngle` = rate x (L^3 - (L - u)^3), with L the free length (from `uPaperTopRest` plus the feed, so it grows as you type) and `DROOP_AT_REFERENCE` (25°) at 25 cm. The droop has no exact formula, so `bendPoint` and the shader both sum `DROOP_STEPS` (24) short pieces; that keeps distances along the sheet within 0.1 mm (the text doesn't stretch). The strike point, the wrap and the tail are unaffected. Back faces show plain paper with faint ink show-through (`BACK_INK`). `Paper.frustumCulled` is off because culling uses the flat mesh. `StrikePoint` is about 7 mm below the tangent point, so glyphs land on the start of the wrap (arc length is kept, so they still sit under the strike).
- three caches a material's compiled program and calls `onBeforeCompile` only when it builds a new one. Uniform objects must survive remounts and hot reloads (kept in `material.userData`), or a remount updates values the cached program never reads (symptom: the paper stops feeding after an HMR). Programs are found by `customProgramCacheKey`, not by shader source, so the key must contain the injected GLSL (`PROGRAM_KEY` in `usePaperBend`), or a shader edit keeps running the old program until a full reload. The stored uniforms carry that key too, so new shader code (e.g. a new uniform) gets a fresh uniforms object.
- `Lever` is a child of `Carriage`, so `useCarriageAnimation` does not move it; don't add lever sliding back. `measureSheet` (in `usePaperBend`) reads only the sheet's two edge rows (the mesh is subdivided), so it must never average over all vertices.
- Carriage and paper (slice 5): carriage position (`useCarriageAnimation`) and line feed (`usePaperBend`) are derived from `cursor` each frame (nothing stored). Rest x, the sheet's up axis and height, and the strike point's offset along the sheet are measured from the loaded nodes at mount, never hard-coded. glTF frame: the sheet's up axis is (0, cos 8°, -sin 8°), not the Blender-frame (0, sin 8°, cos 8°). `StrikePoint` sits near the sheet's bottom (about 22 mm above the bottom edge), not its middle, so row 0 at the strike means feeding the sheet down about 245 mm. The carriage target is `restX - (col + 0.5) * 2.54 mm` (half cell centres the glyph under the strike).
- Store behavior: bell fires once when the cursor reaches `BELL_COL` (60) via `bellSeq`; lock at col 66; Backspace moves one column back without erasing and clears the lock; Enter on the last row returns the carriage without a feed (typing overstrikes). The 3D lever is the pseudo-key name `'Lever'` in `pressedKeys`; `pressKey('Lever')` runs `returnCarriage` like Enter.
- ESLint `react-hooks/immutability` rejects mutating a value returned by a hook (e.g. `useThree(s => s.gl)`). Read it with `useThree(s => s.get)` and call `get()` inside the effect.
- Browser pane testing: the `computer` `type` action fires no keydown events; use `key` (e.g. "h e l l o"). Synthetic `KeyboardEvent`s on window need `key` and `code`; to hold a key, dispatch keydown and keyup separately. The pane lags a frame or two behind state, and `read_console_messages` is cumulative across reloads, so reload before judging errors (stale hot-reload errors linger). Synthetic pointer events can move OrbitControls; use real clicks.
- Side or inspection views in the browser pane: orbit limits block a plain drag. Temporarily expose r3f state (`Object.assign(window, { __t: get })` in an effect), then in the console set `controls.enabled = false` and move `camera.position` / `lookAt`. Remove the hook before committing. Hide `Body`, `Platen`, knobs or brackets (`visible = false`) to see paper or lever paths. For a side profile of the paper: camera at x ≈ 1.5 m with a narrow fov (5 to 14°), looking along -x, and hide `Platen`, `PaperHolder` and the knobs (the platen extends past the paper and hides its edge). Read the bend uniforms from `Paper.material.userData.paperBend.uniforms`.
- Lighting (`Scene.tsx`): metal renders black without an environment map, so one is built from drei `Lightformer` panels plus a dim backdrop (no downloaded HDRI). The map has no parallax: a panel position is a direction, and every side needs a panel (a camera-facing metal surface reflects the camera side, which was empty at first). `environmentIntensity` is about 0.4 with a low ambient light; raise it and the plastic washes out. Ground shadow is drei `ContactShadows`, re-rendered every frame so the carriage and keys move it.
- Manuel hand-tunes values (e.g. shadow blur and opacity) in `Scene.tsx` between turns. Re-read a file before scripted search-and-replace; a replace on stale text silently matches nothing.
- Blender MCP setup: the official Blender Lab server is registered as `blender` in the local, git-ignored `.mcp.json` and runs from the venv at `/Users/manuelannabring/.venvs/blender-mcp/bin/blender-mcp` (Python 3.13 from Homebrew). The Blender add-on (MCP 1.0.3) listens on localhost:9876. Manuel stops the server in the add-on panel when it isn't in use. The `claude` CLI is not on his PATH, so config changes mean editing `.mcp.json` by hand. A project `.mcp.json` server must be approved once via `/mcp` in a terminal `claude` session started from the project folder (check `enabledMcpjsonServers` for this path in `~/.claude.json`); sessions read the approval at start, so a running session can't pick it up and the desktop app can't reconnect it. Start a new session after approving.
- Blender MCP (since 2026-10-22, see "Blender workflow"): live edits on `typewriter.blend` are allowed after a safety copy, every working step is journaled in `tools/blender/steps/`. Safety copies and experiments use the `*.blend1` name pattern (git-ignored; `typewriter-scratch.blend` is NOT ignored). The server can disconnect mid-session (it did on 2026-10-22); then stop editing, ask Manuel to restart the add-on server, and re-inspect the scene. Headless `Blender -b` inspection scripts always work. Don't open other or untrusted `.blend` files while the server runs. Contract check, export and previews stay headless.
- Paper path in the model must follow the code, not the other way round: the bail sits where `BAIL_WRAP` ends (33° above the platen's front horizontal, sheet radius 22.6 mm, platen 22 mm) and the paper table slopes at `TAIL_ANGLE` (35° above horizontal). If a model part needs a different angle, change the constant in `src/lib/paperBend.ts` too.
- Model status: Base and Body are hand-modeled. The 44 keys (still 72-vertex round blockouts, about 18 mm), Platen, Knobs, PaperHolder (it is the paper bail), Lever and TypebarBasket are blockouts; the remaining modeling is a to-do list in SPEC.md section 7 step 6. `Paper`, `Carriage` and `StrikePoint` are contract-critical; leave them as they are.
- Key labels (SPEC section 5, "Key label atlas"): painted in code, not baked in. `useKeyLabels` paints one `CanvasTexture` atlas per key material (`Mat_KeyCream`, `Mat_KeyDark`, 8 x 8 cells, cell = index in `KEY_NODE_NAMES` + 1, cell 0 blank) and sets the material colour to white after reading its Blender colour. Layout lives in `contract.ts` / `contract_spec.py` / `src/lib/keyLabels.ts`; the contract check verifies each key's UVs. After reshaping any keycap, re-run `tools/blender/steps/02_key_uvs.py` last (top face = highest upward-facing polygon, so keep a flat top).
- `Mat_Body` is also used by `Knob_L` and `Knob_R`. `steps/03_body_material.py` holds variants A (metallic 0.35, roughness 0.45; committed), B (clearcoat) and C (both). Clearcoat exports as `KHR_materials_clearcoat`; three then builds a `MeshPhysicalMaterial` and gen:model changes the type of that material. Clearcoat reads as glossy plastic, not metal; real metal needs metallic about 0.85, a brighter base colour and more environment light.
- Fonts: Inter (variable woff2, OFL) in `public/fonts/` for key labels, Special Elite for the paper. Download single files from a pinned tag (the Inter release zip is 34 MB), and ask before downloading.
- Browser pane: `resize_window` to a custom size can leave the canvas partly rendered (it did again with an 800 x 600 emulation in a 264 px tall pane; a resize event didn't help); go back to the `desktop` preset before judging a screenshot, and wait about 5 s after navigating. A `Canvas` `camera` prop was not reliably applied for a debug camera; set the camera in an effect instead.
- Blender hand-edit gotchas (5.2): every Ctrl+S rotates the previous save into `typewriter.blend1` (git-ignored), so before risky edits copy a known-good state to a separate `*.blend1` name. Edit > Undo History survives saving. `Alt+S` resets object scale without touching the mesh, `Ctrl+A > Scale` bakes it in; a stray scale on `StrikePoint` (child of `Body`) also fails the contract check. `Body` and `StrikePoint` must stay: replace the mesh, never delete the object (the child link breaks). Material slots can't be removed in Edit Mode. There is no Add > Single Vertex; use a Plane and move or subdivide its vertices. If `G X` isn't parallel to the world X axis, Transform Orientation is on Normal; set it to Global. `Shade Auto Smooth` adds a modifier (not allowed on contract objects); use Shade Smooth by Angle.
- Shell design target (6b, from the reference side view): low front lip, ramp under the keys, hump over the typebars, lower rear shelf for the carriage; the shell's plan-view corners are concentric with the `Base`. A ramp under the keys means the keycap slice must re-seat the keys (flat, identity rotations, rows stepped by about 8 to 11 mm).
- Base and `Body` are flush: same footprint, 300 mm wide, 242.3 mm deep (x ±150, y -156..86.3), plan corners R 30 mm (8 points per corner). Body sits on the Base top (z 12). Rear wall of the hump stays at y <= ~15.6 (paper clearance). Base edge softness (measured, its Bevel is applied): about 1.8 mm top, 2.5 mm bottom, 2 segments, smooth shading. Match it on the Body. Body must be a closed manifold mesh (check for 0 boundary edges; a missing bottom face breaks bevel and shading).
- Hand-edit recipes (5.2): to put several vertices on one exact coordinate, `S <axis> 0` (flatten to median, pivot Median Point, Global orientation) then set the median in the N panel; typing a median alone only shifts the selection. Rounded plan corners: duplicate `Base`, raise its upper rings by `G Z 100` to make a tall cutter, Boolean Intersect (Exact) on `Body`, apply, delete the cutter. `Ctrl+A` over a modifier panel applies it; Apply is greyed in Edit Mode. Bevel modifier: Clamp Overlap (Geometry subpanel) silently caps Width on short edges. Check Viewport Overlays > Statistics after applying; Body should stay in the hundreds of vertices (3000+ means too many segments).
- Inspect the saved `.blend` headlessly after every hand edit (extents, vertex and boundary-edge counts, modifiers, scale, contract check) and compare to expectations before saying it is fine. Name safety copies `*.blend1`; a plain `*.blend` copy such as `typewriter-body-ok.blend` is not git-ignored and must never be committed.
