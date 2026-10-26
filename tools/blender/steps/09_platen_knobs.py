"""Step 09: platen and the two carriage knobs (slice 6d).

Replaces the meshes of Platen, Knob_L and Knob_R by lathe-style profiles (rings of
vertices round the platen axis, joined by quads). Object names, origins, parents, applied
transforms and the existing material slots stay; Knob_L / Knob_R get a second slot,
Mat_Metal, for the steel stub. Values picked in the profile widget on 2026-10-26:
knurled rim, flat centre, 3 mm steel stub.

Hard constraint: the paper bend assumes a platen of radius 22 mm on the Carriage axis, so
the platen stays a plain r 22 cylinder (only its ends, hidden inside the end plates, are
chamfered).

Run in the live session (MCP) or headless: exec this file, then call build_platen_knobs().
All lengths below are mm; the axis is the Carriage origin and runs along X.
"""

import math

import bmesh
import bpy
from mathutils import Vector

PLATEN_RADIUS = 22.0  # keep equal to the platen radius assumed in src/lib/paperBend.ts
PLATEN_X = (-50.0, 220.0)  # world x of the two ends (inside the end plates)
PLATEN_CHAMFER = 1.0
PLATEN_SEGMENTS = 64

KNOB_RADIUS = 16.0
KNOB_COLLAR_RADIUS = 9.0
KNOB_COLLAR_WIDTH = 5.0
KNOB_RIM_WIDTH = 11.0
KNOB_EDGE_CHAMFER = 1.5
KNOB_TEETH = 28
KNOB_TOOTH_DEPTH = 0.8
KNOB_STUB_RADIUS = 4.0
KNOB_STUB_LENGTH = 3.0
KNOB_EMBED = 0.3  # the knob sinks this far into the end plate so no gap shows
KNOB_BODY_MATERIAL = "Mat_Body"
KNOB_STUB_MATERIAL = "Mat_Metal"
PLATEN_MATERIAL = "Mat_Platen"

KNURL_STEPS = 4  # vertices per tooth round the rim (flat, tooth, tooth, flat)


def _ring(bm, x, radii, y0=0.0, z0=0.0):
    """Ring of vertices at local x; radii is one value per segment (angle 0 = +Y)."""
    n = len(radii)
    return [
        bm.verts.new((x, y0 + r * math.cos(2 * math.pi * i / n), z0 + r * math.sin(2 * math.pi * i / n)))
        for i, r in enumerate(radii)
    ]


def _join(bm, a, b, mat, smooth):
    n = len(a)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((a[i], a[j], b[j], b[i]))
        f.material_index = mat
        f.smooth = smooth


def _cap(bm, ring, mat):
    f = bm.faces.new(ring)
    f.material_index = mat
    f.smooth = False


def _lathe(bm, rings, seg_mat_smooth, cap_first, cap_last):
    """rings: list of (x, verts); seg_mat_smooth[i] = (material, smooth) for ring i -> i+1."""
    for i in range(len(rings) - 1):
        _join(bm, rings[i][1], rings[i + 1][1], *seg_mat_smooth[i])
    if cap_first is not None:
        _cap(bm, rings[0][1][::-1], cap_first)
    if cap_last is not None:
        _cap(bm, rings[-1][1], cap_last[0])


def _finish(bm, obj):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = obj.data
    bm.to_mesh(me)
    bm.free()
    me.update()


def _mat_index(obj, name):
    if obj.data.materials.find(name) < 0:
        obj.data.materials.append(bpy.data.materials[name])
    return obj.data.materials.find(name)


def build_platen():
    obj = bpy.data.objects["Platen"]
    inv = obj.matrix_world.inverted()
    mat = _mat_index(obj, PLATEN_MATERIAL)
    r, c, n = PLATEN_RADIUS * 0.001, PLATEN_CHAMFER * 0.001, PLATEN_SEGMENTS
    x0 = (inv @ Vector((PLATEN_X[0] * 0.001, 0, 0))).x
    x1 = (inv @ Vector((PLATEN_X[1] * 0.001, 0, 0))).x
    bm = bmesh.new()
    spec = [(x0, r - c), (x0 + c, r), (x1 - c, r), (x1, r - c)]
    rings = [(x, _ring(bm, x, [rad] * n)) for x, rad in spec]
    _lathe(bm, rings, [(mat, True), (mat, True), (mat, True)], mat, (mat,))
    _finish(bm, obj)


def _plate_outer_faces():
    """World x of the carriage end plates' outer faces (the extremes of PaperHolder)."""
    ph = bpy.data.objects["PaperHolder"]
    xs = [(ph.matrix_world @ v.co).x for v in ph.data.vertices]
    return min(xs), max(xs)


def build_knob(name, plate_x, outward):
    """outward = -1 for Knob_L (grows towards -X), +1 for Knob_R."""
    obj = bpy.data.objects[name]
    inv = obj.matrix_world.inverted()
    body = _mat_index(obj, KNOB_BODY_MATERIAL)
    steel = _mat_index(obj, KNOB_STUB_MATERIAL)
    mm = 0.001

    def lx(d):  # d = depth outward from the plate face, in mm -> object-local x
        return (inv @ Vector((plate_x + outward * d * mm, 0, 0))).x

    R, rc, ch = KNOB_RADIUS * mm, KNOB_COLLAR_RADIUS * mm, KNOB_EDGE_CHAMFER * mm
    cw = KNOB_COLLAR_WIDTH
    width = cw + KNOB_RIM_WIDTH
    rs = KNOB_STUB_RADIUS * mm
    plain = KNOB_TEETH * KNURL_STEPS
    teeth = []
    for i in range(plain):
        phase = i % KNURL_STEPS
        teeth.append(R - (KNOB_TOOTH_DEPTH * mm if phase in (1, 2) else 0.0))

    bm = bmesh.new()
    flat = lambda r: [r] * plain
    spec = [
        (-KNOB_EMBED, flat(rc)),
        (cw, flat(rc)),
        (cw, flat(R - ch)),
        (cw + ch / mm, teeth),
        (width - ch / mm, teeth),
        (width, flat(R - ch)),
        (width, flat(rs)),
        (width + KNOB_STUB_LENGTH, flat(rs)),
    ]
    rings = [(d, _ring(bm, lx(d), radii)) for d, radii in spec]
    # Segment i joins ring i and i+1: (material, smooth).
    segs = [
        (body, True),    # collar
        (body, False),   # collar shoulder
        (body, False),   # rim chamfer in
        (body, False),   # knurled rim (flat shading keeps the teeth crisp)
        (body, False),   # rim chamfer out
        (body, False),   # flat face
        (steel, True),   # stub side
    ]
    _lathe(bm, rings, segs, body, (steel,))
    _finish(bm, obj)


def build_platen_knobs():
    left, right = _plate_outer_faces()
    build_platen()
    build_knob("Knob_L", left, -1)
    build_knob("Knob_R", right, +1)
    return {"plate_left_x": left, "plate_right_x": right}
