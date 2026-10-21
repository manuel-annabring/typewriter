# Typewriter: CLAUDE.md

Interactive 3D typewriter for the web. The visitor types (physical keyboard or clicking the 3D keys) and the text appears on a sheet of paper while the carriage slides.

`SPEC.md` is the source of truth for scope, the Blender-to-code model contract, and the build order. Read it before starting any task. If the code needs something the spec doesn't say, propose a change to the spec instead of silently deviating.

## How we work

- Follow the build order in SPEC.md section 7. One slice per session. Phase 1 before Phase 2.
- For anything touching more than about 3 files, propose a short plan first and wait for approval.
- Commit after every working slice with a clear message.
- Don't add features outside the current slice. Note ideas in your reply instead.
- Manuel is a senior React developer but new to three.js, r3f and Blender. Don't explain React basics. Do explain three.js, r3f, shader or Blender concepts in 2 to 3 sentences the first time they appear.
- Never change the model contract (SPEC.md section 5) on your own.
- Don't add dependencies without asking.

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

- Contract check: `$B -b tools/blender/typewriter-blockout.blend --python tools/blender/contract_check.py`
- Export (runs the check first, refuses on errors): `$B -b tools/blender/typewriter-blockout.blend --python tools/blender/export_glb.py`
- Previews (Workbench PNGs, does not save the .blend): `$B -b tools/blender/typewriter-blockout.blend --python tools/blender/render_preview.py -- <output_dir>`
- `build_blockout.py` is a one-time seed. `tools/blender/typewriter-blockout.blend` is committed and is the source of truth; re-running the script overwrites hand edits.
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
tools/blender/      headless Blender scripts + typewriter-blockout.blend
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
- The Blender MCP tools run arbitrary Python. Use the official Blender Lab server (Blender 5.1+), work on a copy of the `.blend`, and never open untrusted files while connected.
- Run the contract check (names, applied transforms, origins) before every export.
- Export glTF binary (`.glb`), +Y up.
- Workflow: headless scripts (Blender 5.2 LTS installed; no Blender MCP connected). Manuel hand-edits the `.blend` for real modeling (slice 6); the MCP is optional then. Hand edits must keep object and material names, applied transforms and origins.
- Blender coordinates: Z up, keyboard at -Y; the exporter maps this to glTF +Y up, front facing +Z.
- Approved contract interpretations: `Paper` is a child of `Carriage`; `Lever` is top-level; `StrikePoint` is an Empty under `Body` at x=0; `Carriage` origin is on the platen axis at its rest position (x=0.085, so the carriage overhangs the body's right edge at rest); special keys are Space, Tab, Enter, Backspace, Shift_L, Shift_R, Comma, Period; keyboard is flat (identity rotations), rows stepped in height.
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
- Slice 5 stopgap: `Mat_Paper` has a clipping plane 8 mm below the strike point (set in `useCarriageAnimation`), because the flat sheet would otherwise hang out of the machine. It is temporary; the planned replacement (whole sheet visible, wrapped around the platen) is listed in SPEC section 4, Phase 2.
- The carriage hook also slides the `Lever` (top-level in the contract) by the carriage's offset from rest, so the lever stays at the carriage's left end.
- Metal materials render black until an environment map exists (slice 6 / scene polish). Not a bug.
