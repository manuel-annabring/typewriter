// Regenerates src/typewriter/TypewriterModel.generated.tsx from public/models/typewriter.glb.
//
//   npm run gen:model
//
// Runs gltfjsx (pinned, one-off via npx, not a dependency), then patches the few things
// its 6.5.3 output gets wrong for React 19 and strict TypeScript. Each patch must match,
// so a change in gltfjsx output fails loudly here instead of breaking typecheck later.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = 'src/typewriter/TypewriterModel.generated.tsx'

const run = spawnSync(
  'npx',
  [
    '--yes',
    'gltfjsx@6.5.3',
    'public/models/typewriter.glb',
    '--types',
    '--keepnames',
    '--keepgroups', // keep empty nodes such as StrikePoint
    '--root',
    'public', // GLB is served from /models/typewriter.glb
    '-o',
    out,
  ],
  { cwd: root, stdio: 'inherit' },
)
if (run.status !== 0) process.exit(run.status ?? 1)

const patches = [
  ["import React from 'react'\n", ''],
  [
    "import { GLTF } from 'three-stdlib'",
    "import type { ThreeElements } from '@react-three/fiber'\nimport type { GLTF } from 'three-stdlib'",
  ],
  ['GLTFAction[]', 'THREE.AnimationClip[]'],
  ["JSX.IntrinsicElements['group']", "ThreeElements['group']"],
  [') as GLTFResult', ') as unknown as GLTFResult'],
  // The site is served under a base path (vite.config.ts), so the model URL can't be absolute.
  ["useGLTF('/models/typewriter.glb')", 'useGLTF(MODEL_URL)'],
  ["useGLTF.preload('/models/typewriter.glb')", 'useGLTF.preload(MODEL_URL)'],
  [
    "import type { GLTF } from 'three-stdlib'\n",
    "import type { GLTF } from 'three-stdlib'\n\nconst MODEL_URL = `${import.meta.env.BASE_URL}models/typewriter.glb`\n",
  ],
]

let src = readFileSync(resolve(root, out), 'utf8')
for (const [from, to] of patches) {
  if (!src.includes(from)) throw new Error(`gen-model: expected to find ${JSON.stringify(from)} in gltfjsx output`)
  src = src.replace(from, to)
}
writeFileSync(resolve(root, out), src)
console.log(`gen-model: wrote ${out}`)
