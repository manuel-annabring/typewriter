"""Step 05: paper bail on PaperHolder (bar plus two rubber rollers).

Slice 6c (paper path). PaperHolder holds the two carriage end plates and the bail. This
step keeps the end plates, removes the old bail bar (any loose part not centred on the
platen axis) and adds a round bar with two rollers. The rollers touch the sheet where the
code's bail wrap ends (`BAIL_WRAP` in `src/lib/paperBend.ts`): that is SHEET_LEAN plus
BAIL_WRAP above the platen's front horizontal, on the 22.6 mm paper wrap circle, so the
roller centres sit WRAP_RADIUS + ROLLER_RADIUS from the axis. Values picked in the
side-view widget on 2026-10-26.

Run in the live session (MCP) or headless: exec this file, then call build_paper_bail().
Coordinates are PaperHolder (= Carriage) space; Blender frame, Z up, front is -Y.
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

BAIL_WRAP_DEG = 30.0  # keep equal to BAIL_WRAP in src/lib/paperBend.ts
SHEET_LEAN_DEG = 8.0  # the flat sheet's lean back from vertical (Paper mesh)
WRAP_RADIUS = 0.0226
ROLLER_RADIUS = 0.004
ROLLER_WIDTH = 0.010
ROLLER_X = (-0.070, 0.070)
ROLLER_SEGMENTS = 24
BAR_RADIUS = 0.0015
BAR_SEGMENTS = 12
BAR_HALF_LENGTH = 0.1335  # into both end plates (inner faces at about +-131.5 mm)
BAR_MATERIAL = "Mat_Metal"
ROLLER_MATERIAL = "Mat_Platen"
LOOSE_PART_AXIS_TOL = 0.005  # parts centred closer than this to the axis are end plates


def bail_centre():
    """Centre of the bar and rollers in (y, z)."""
    a = math.radians(SHEET_LEAN_DEG + BAIL_WRAP_DEG)
    r = WRAP_RADIUS + ROLLER_RADIUS
    return Vector((-r * math.cos(a), r * math.sin(a)))


def _remove_old_bail(bm):
    seen = set()
    doomed = []
    for v in bm.verts:
        if v in seen:
            continue
        part, stack = [], [v]
        while stack:
            w = stack.pop()
            if w in seen:
                continue
            seen.add(w)
            part.append(w)
            stack.extend(e.other_vert(w) for e in w.link_edges)
        cy = sum(p.co.y for p in part) / len(part)
        cz = sum(p.co.z for p in part) / len(part)
        if math.hypot(cy, cz) > LOOSE_PART_AXIS_TOL:
            doomed.extend(part)
    bmesh.ops.delete(bm, geom=doomed, context="VERTS")
    return len(doomed)


def _cylinder_along_x(bm, x0, x1, radius, segments, mat_index, centre):
    """Capped cylinder from x0 to x1 around (centre.y, centre.z), smooth sides."""
    ret = bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segments,
        radius1=radius, radius2=radius, depth=x1 - x0,
    )
    verts = ret["verts"]
    # create_cone builds along Z, centred on the origin: turn Z onto X, then move.
    rot = Matrix.Rotation(math.radians(90.0), 4, "Y")
    loc = Matrix.Translation(((x0 + x1) / 2, centre.x, centre.y))
    bmesh.ops.transform(bm, matrix=loc @ rot, verts=verts)
    faces = {f for v in verts for f in v.link_faces}
    for f in faces:
        f.material_index = mat_index
        f.normal_update()
        f.smooth = abs(f.normal.x) < 0.5


def build_paper_bail():
    obj = bpy.data.objects["PaperHolder"]
    me = obj.data
    for name in (BAR_MATERIAL, ROLLER_MATERIAL):
        if me.materials.find(name) < 0:
            me.materials.append(bpy.data.materials[name])
    bar_idx = me.materials.find(BAR_MATERIAL)
    roller_idx = me.materials.find(ROLLER_MATERIAL)

    bm = bmesh.new()
    bm.from_mesh(me)
    removed = _remove_old_bail(bm)
    c = bail_centre()
    _cylinder_along_x(bm, -BAR_HALF_LENGTH, BAR_HALF_LENGTH, BAR_RADIUS, BAR_SEGMENTS, bar_idx, c)
    for x in ROLLER_X:
        _cylinder_along_x(
            bm, x - ROLLER_WIDTH / 2, x + ROLLER_WIDTH / 2,
            ROLLER_RADIUS, ROLLER_SEGMENTS, roller_idx, c,
        )
    bm.to_mesh(me)
    bm.free()
    me.update()
    return removed
