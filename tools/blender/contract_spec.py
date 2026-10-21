"""Model contract (SPEC.md section 5) as data, shared by the build, check and export scripts.

Keep in sync with src/typewriter/contract.ts (the TypeScript copy of the node names).
"""

import string

# Key layout (rows from back to front). Names follow SPEC.md section 5.
KEY_ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Backspace"],
    ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L", "Enter"],
    ["Shift_L", "Z", "X", "C", "V", "B", "N", "M", "Comma", "Period", "Shift_R"],
]
SPACE_KEY = "Space"
# Keys drawn dark (modifiers); everything else is a cream cap.
DARK_KEYS = {"Tab", "Enter", "Backspace", "Shift_L", "Shift_R"}

KEY_NAMES = [f"Key_{n}" for row in KEY_ROWS for n in row] + [f"Key_{SPACE_KEY}"]

CARRIAGE_CHILDREN = ["Platen", "Knob_L", "Knob_R", "PaperHolder", "Paper", "Lever"]

REQUIRED_NAMES = (
    ["Body", "Base", "Carriage", "Lever", "Paper", "StrikePoint", "TypebarBasket"]
    + CARRIAGE_CHILDREN
    + KEY_NAMES
)

MATERIALS = [
    "Mat_Body",
    "Mat_KeyCream",
    "Mat_KeyDark",
    "Mat_Wood",
    "Mat_Platen",
    "Mat_Metal",
    "Mat_Paper",
]

# A4 in meters
PAPER_WIDTH = 0.210
PAPER_HEIGHT = 0.297
# Paper is subdivided along its height so code can bend it around the platen. The bend
# spike (22 mm platen radius, about 12 degrees per facet at 64) showed visible facets, so 128.
PAPER_HEIGHT_SEGMENTS = 128

TRIANGLE_BUDGET = 100_000

# SPEC.md section 5 requires Key_A to Key_Z and Key_0 to Key_9.
assert all(f"Key_{c}" in KEY_NAMES for c in string.ascii_uppercase + string.digits)
