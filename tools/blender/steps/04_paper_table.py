"""Step 04: PaperTable, the plate behind the platen that the sheet's tail rests on.

Slice 6c (paper path). Builds or rebuilds the `PaperTable` mesh as a child of `Carriage`,
origin at the Carriage origin (the platen axis). The plate follows the tail the code draws
(`src/lib/paperBend.ts`): the tail leaves the paper wrap circle (radius 22.6 mm) where its
direction is TAIL_ANGLE above horizontal and runs straight up and back. The plate's top
face sits TABLE_GAP under that line. Values picked in the side-view widget on 2026-10-26.

Run in the live session (MCP) or headless: exec this file, then call build_paper_table().
Blender frame: Z up, keyboard at -Y, so "back" is +Y.
"""

import math

import bmesh
import bpy
from mathutils import Matrix

TAIL_ANGLE_DEG = 35.0  # keep equal to TAIL_ANGLE in src/lib/paperBend.ts
WRAP_RADIUS = 0.0226  # platen axis to sheet plane (measured; platen radius 22 mm)
TABLE_GAP = 0.0008  # top face below the tail
TABLE_THICKNESS = 0.0015
TABLE_START = 0.0  # along the tail, from where it leaves the platen
TABLE_LENGTH = 0.130
TABLE_HALF_WIDTH = 0.1315  # to the inner faces of the carriage end plates (PaperHolder)
EDGE_BEVEL = 0.0004
EDGE_SEGMENTS = 2
MATERIAL = "Mat_Metal"


def table_profile():
    """The plate's side-view corners (y, z) in Carriage space: top start, top end,
    bottom end, bottom start."""
    a = math.radians(TAIL_ANGLE_DEG)
    p0 = (WRAP_RADIUS * math.sin(a), -WRAP_RADIUS * math.cos(a))  # tail leaves the wrap
    d = (math.cos(a), math.sin(a))  # up and back along the tail
    m = (math.sin(a), -math.cos(a))  # away from the platen, under the tail

    def at(t, o):
        return (p0[0] + t * d[0] + o * m[0], p0[1] + t * d[1] + o * m[1])

    t0, t1 = TABLE_START, TABLE_START + TABLE_LENGTH
    g0, g1 = TABLE_GAP, TABLE_GAP + TABLE_THICKNESS
    return [at(t0, g0), at(t1, g0), at(t1, g1), at(t0, g1)]


def build_paper_table():
    carriage = bpy.data.objects["Carriage"]
    mat = bpy.data.materials[MATERIAL]

    bm = bmesh.new()
    prof = table_profile()
    left = [bm.verts.new((-TABLE_HALF_WIDTH, y, z)) for y, z in prof]
    right = [bm.verts.new((TABLE_HALF_WIDTH, y, z)) for y, z in prof]
    bm.faces.new(list(reversed(left)))
    bm.faces.new(right)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([left[i], left[j], right[j], right[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.bevel(
        bm, geom=list(bm.edges), offset=EDGE_BEVEL, segments=EDGE_SEGMENTS,
        affect="EDGES", clamp_overlap=True,
    )

    obj = bpy.data.objects.get("PaperTable")
    if obj is None:
        me = bpy.data.meshes.new("PaperTable")
        obj = bpy.data.objects.new("PaperTable", me)
        carriage.users_collection[0].objects.link(obj)
    me = obj.data
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    me.materials.append(mat)

    obj.parent = carriage
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)
    return obj
