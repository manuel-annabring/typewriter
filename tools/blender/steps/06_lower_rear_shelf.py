"""Step 06: lower the Body's rear shelf so the sheet clears it under the platen.

Slice 6c (paper path). The sheet wraps round the bottom of the platen at the paper radius
(22.6 mm below the axis, z about 69.4 mm), but the rear shelf top was at z 69.8 mm, so
the shelf hid a strip of paper. This moves the shelf top (the rear deck and the central
well in front of it), its edge bevels and the fillets at the foot of the walls down by
DROP. The walls above simply get taller; no vertex is added or removed.

Run in the live session (MCP) or headless: exec this file, then call lower_rear_shelf().
Run it once only: it moves vertices relative to where they are. World coordinates in
meters, Blender frame (Z up, front is -Y).
"""

import bpy
from mathutils import Vector

DROP = 0.0012
# Shelf top (69.8 mm), wall-foot fillets (70.4 to 71.8 mm), rear and side edge bevels
# (67.8 and 69.2 mm). Measured on 2026-10-26.
Z_MIN = 0.0675
Z_MAX = 0.0720
Y_MIN = -0.015  # behind the front face of the typebar hump's rear wall


def lower_rear_shelf():
    body = bpy.data.objects["Body"]
    mw = body.matrix_world
    inv = mw.inverted()
    moved = 0
    for v in body.data.vertices:
        p = mw @ v.co
        if p.y > Y_MIN and Z_MIN < p.z < Z_MAX:
            v.co = inv @ (p - Vector((0.0, 0.0, DROP)))
            moved += 1
    body.data.update()
    return moved
