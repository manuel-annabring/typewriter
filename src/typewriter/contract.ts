import type { Object3D } from 'three'

// Node names from SPEC.md section 5. Keep in sync with tools/blender/contract_spec.py.
// Lever and Paper are children of Carriage (they slide with it); the guard looks nodes up by name.
const KEY_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Backspace'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Enter'],
  ['Shift_L', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Comma', 'Period', 'Shift_R'],
] as const

export const KEY_NODE_NAMES: readonly string[] = [...KEY_ROWS.flat(), 'Space'].map(
  (n) => `Key_${n}`,
)

export const REQUIRED_NODE_NAMES: readonly string[] = [
  'Body',
  'Base',
  'Carriage',
  'Platen',
  'Knob_L',
  'Knob_R',
  'PaperHolder',
  'Paper',
  'Lever',
  'StrikePoint',
  'TypebarBasket',
  ...KEY_NODE_NAMES,
]

/** Fails loudly if the loaded model is missing a node the code relies on. */
export function assertModelContract(root: Object3D): void {
  const missing = REQUIRED_NODE_NAMES.filter((name) => !root.getObjectByName(name))
  if (missing.length > 0) {
    throw new Error(
      `typewriter.glb breaks the model contract (SPEC.md section 5). Missing nodes: ${missing.join(', ')}`,
    )
  }
}
