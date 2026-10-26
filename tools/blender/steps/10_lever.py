"""Step 10: carriage return lever (slice 6e).

Replaces the mesh of Lever by a hub, a bent steel rod and a wooden ball. Object name,
origin (the hinge), parent (Carriage), applied transforms and both material slots
(Mat_Metal, Mat_Wood) stay. Values picked in the lever widget on 2026-10-27: bent steel
arm with wooden ball, reach 80 mm.

Shape (side view, hinge at the origin, X to the right, Z up; everything lies in the
Blender XZ plane): the rod leaves the hub straight up, then bends over towards -X and ends
horizontal in the ball. The vertical start matters: the end plate sits only 6.5 mm left
of the hinge and reaches z 124, so a rod rising at 24 degrees would cut through it.

Swing: the code turns the node by +25 degrees about glTF +Z, which is Blender -Y, i.e.
rotation_euler.y = -25 degrees. The tip drops. swing_clearance() tests that.

Run in the live session (MCP) or headless: exec this file, then call build_lever() and
swing_clearance(). All lengths below are mm; the mesh is in object-local space (rotation
and scale are identity, so local offsets equal world offsets from the hinge).
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

REACH = 80.0  # straight-line length of the chord from hinge to ball centre, mm
CHORD_X = 0.91  # tip position as a fraction of REACH (widget values)
CHORD_Z = 0.41
CTRL1_Z = 0.30  # first bezier control point: straight above the hinge, so the rod leaves vertically
CTRL2_X = 0.55  # second control point x; its z equals the tip z, so the rod ends horizontal
ROD_START_Z = 3.0  # rod starts inside the hub (hub radius 4)
ROD_RADIUS = 2.5
ROD_SIDES = 8
ROD_STEPS = 48

HUB_RADIUS = 4.0
HUB_HALF_LENGTH = 5.0  # along Y; the old blockout hub was 10 mm wide
HUB_SIDES = 16

BALL_RADIUS = 9.0
BALL_SEGMENTS = 20
BALL_RINGS = 12

METAL = "Mat_Metal"
WOOD = "Mat_Wood"
SWING_DEG = 25.0  # keep equal to PRESS_ANGLE in src/typewriter/useLeverAnimation.ts

MM = 0.001


def _bezier(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u**3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t**3 * d for a, b, c, d in zip(p0, p1, p2, p3))


def _path():
    """Rod centre line as (x, z) points in mm, plus the ball centre."""
    tip = (-CHORD_X * REACH, CHORD_Z * REACH)
    p1 = (0.0, CTRL1_Z * REACH)
    p2 = (-CTRL2_X * REACH, tip[1])
    pts = [_bezier((0.0, ROD_START_Z), p1, p2, tip, i / ROD_STEPS) for i in range(ROD_STEPS + 1)]
    return pts, tip


def _slot(obj, name):
    if obj.data.materials.find(name) < 0:
        obj.data.materials.append(bpy.data.materials[name])
    return obj.data.materials.find(name)


def _add_hub(bm, metal):
    rings = []
    for y in (-HUB_HALF_LENGTH, HUB_HALF_LENGTH):
        rings.append(
            [
                bm.verts.new(
                    (
                        HUB_RADIUS * math.cos(2 * math.pi * i / HUB_SIDES) * MM,
                        y * MM,
                        HUB_RADIUS * math.sin(2 * math.pi * i / HUB_SIDES) * MM,
                    )
                )
                for i in range(HUB_SIDES)
            ]
        )
    a, b = rings
    for i in range(HUB_SIDES):
        j = (i + 1) % HUB_SIDES
        f = bm.faces.new((a[i], b[i], b[j], a[j]))
        f.material_index, f.smooth = metal, True
    for ring, flip in ((a, True), (b, False)):
        f = bm.faces.new(ring[::-1] if flip else ring)
        f.material_index, f.smooth = metal, False


def _add_rod(bm, metal):
    pts, _ = _path()
    rings = []
    for k, (x, z) in enumerate(pts):
        k0, k1 = max(k - 1, 0), min(k + 1, len(pts) - 1)
        tangent = Vector((pts[k1][0] - pts[k0][0], 0.0, pts[k1][1] - pts[k0][1])).normalized()
        side = Vector((0.0, 1.0, 0.0))  # the rod bends in XZ, so Y is a safe fixed normal
        up = tangent.cross(side)
        ring = []
        for i in range(ROD_SIDES):
            ang = 2 * math.pi * i / ROD_SIDES
            off = (side * math.cos(ang) + up * math.sin(ang)) * ROD_RADIUS
            ring.append(bm.verts.new(((x + off.x) * MM, off.y * MM, (z + off.z) * MM)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(ROD_SIDES):
            j = (i + 1) % ROD_SIDES
            f = bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
            f.material_index, f.smooth = metal, True
    f = bm.faces.new(rings[0][::-1])  # start cap, hidden inside the hub
    f.material_index, f.smooth = metal, False
    f = bm.faces.new(rings[-1])  # end cap, hidden inside the ball
    f.material_index, f.smooth = metal, False


def _add_ball(bm, wood):
    _, tip = _path()
    before = set(bm.faces)
    bmesh.ops.create_uvsphere(
        bm,
        u_segments=BALL_SEGMENTS,
        v_segments=BALL_RINGS,
        radius=BALL_RADIUS * MM,
        matrix=Matrix.Translation((tip[0] * MM, 0.0, tip[1] * MM)),
    )
    for f in bm.faces:
        if f not in before:
            f.material_index, f.smooth = wood, True


def build_lever():
    obj = bpy.data.objects["Lever"]
    metal, wood = _slot(obj, METAL), _slot(obj, WOOD)
    bm = bmesh.new()
    _add_hub(bm, metal)
    _add_rod(bm, metal)
    _add_ball(bm, wood)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = obj.data
    bm.to_mesh(me)
    bm.free()
    me.update()
    return {"verts": len(me.vertices), "slots": [m.name for m in me.materials]}


def _tree(obj, depsgraph):
    me = obj.evaluated_get(depsgraph).to_mesh()
    verts = [obj.matrix_world @ v.co for v in me.vertices]
    tree = BVHTree.FromPolygons(verts, [tuple(p.vertices) for p in me.polygons], epsilon=0.0)
    return tree, verts


def swing_clearance(max_deg=SWING_DEG + 5.0, others=("Knob_L", "PaperHolder", "Platen", "PaperTable", "Paper", "Body", "Knob_R")):
    """Rotate the lever about its hinge (Blender -Y) from 0 to max_deg and report, per other
    object, overlap hits and the smallest distance (mm) from a lever vertex to its surface
    at SWING_DEG. Restores the lever's rotation."""
    lever = bpy.data.objects["Lever"]
    rest = lever.rotation_euler.copy()
    deps = bpy.context.evaluated_depsgraph_get()
    hits = {n: [] for n in others}
    nearest = {n: None for n in others}
    try:
        for deg in range(0, int(max_deg) + 1):
            lever.rotation_euler = (rest.x, rest.y - math.radians(deg), rest.z)
            bpy.context.view_layer.update()
            deps = bpy.context.evaluated_depsgraph_get()
            lt, lverts = _tree(lever, deps)
            for n in others:
                ot, _ = _tree(bpy.data.objects[n], deps)
                if lt.overlap(ot):
                    hits[n].append(deg)
                if deg == int(SWING_DEG):
                    d = min(ot.find_nearest(v)[3] for v in lverts)
                    nearest[n] = round(d / MM, 2)
    finally:
        lever.rotation_euler = rest
        bpy.context.view_layer.update()
    return {"overlap_at_deg": {n: h for n, h in hits.items() if h}, "min_gap_mm_at_25deg": nearest}
