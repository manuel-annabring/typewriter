"""Step 12: typebar basket (session 4).

Replaces the mesh of TypebarBasket (was a 64-vertex blockout box) by a static fan at rest:
N flat typebars lying almost horizontal and pointing at the strike point, each ending at
the outer end in its own type slug (a small cube), and a pivot rail (an arc round the
strike point) joining the inner ends, held by two posts. There is deliberately no rail at
the outer end: every slug stands free (Manuel's call, 2026-10-29, after the first version
had the pivot rail outside). Object name, origin, applied transforms, no parent, no modifiers
and the single slot Mat_Metal stay. Values: preset c ("flat radial fan") of the basket
widget, picked on 2026-10-29.

Re-runnable on its own output: build_basket() clears the mesh and rebuilds it from the
parameters below (all mm, Blender world frame, Z up, keyboard at -Y). The mesh is stored
in object space, so the object's location is subtracted. Do not run it on a file where the
Body, platen or paper path changed without running check() afterwards.

Geometry: C is the strike point in plan (x 0, y STRIKE_Y). Bar i lies in the vertical plane
through C at azimuth phi_i (spread +-FAN_DEG). At distance s along the bar from its outer
(slug) end the plan radius is OUTER_RADIUS - s*sin(LEAN) and the height OUTER_Z +
s*cos(LEAN); LEAN is the angle from vertical, so 90 is flat. The pivot end (s = BAR_LENGTH)
is therefore the inner, slightly higher end.

Run in the live session (MCP) or headless: exec this file, then build_basket() and check().
"""

import math

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

STRIKE_Y = 40.65  # plan position of StrikePoint (x 0)
BARS = 15  # odd, so one bar sits on the centre line
FAN_DEG = 45.0  # half angle of the fan
OUTER_RADIUS = 38.0  # plan distance from the strike point to the slugs (outer end of the bars)
OUTER_Z = 70.5  # bar centre height at the outer end (floor of the well is z 68.6)
LEAN_DEG = 85.0  # bar angle from vertical (85 = 5 degrees above horizontal)
BAR_LENGTH = 22.0  # outer end to pivot end
BAR_WIDTH = 1.2  # tangential
BAR_THICK = 1.0
SLUG_LENGTH = 3.0  # a cube: the outer end has room (pitch 4.3 mm at the outer radius)
SLUG_WIDTH = 3.0
SLUG_THICK = 3.0
RAIL_TUBE = 1.5  # pivot rail tube radius
FLOOR_Z = 68.6
POST_RADIUS = 1.2
POST_EXTRA_DEG = 3.0  # posts sit this much beyond the outermost bar
TUBE_SIDES = 8
ARC_STEP_DEG = 3.0

METAL = "Mat_Metal"
MM = 0.001


def _plan(phi, r):
    return Vector((r * math.sin(phi), STRIKE_Y - r * math.cos(phi), 0.0))


def _bar_point(phi, s):
    r = OUTER_RADIUS - s * math.sin(math.radians(LEAN_DEG))
    p = _plan(phi, r)
    p.z = OUTER_Z + s * math.cos(math.radians(LEAN_DEG))
    return p


def _arc(radius, z, phi0, phi1):
    steps = max(2, int(round(math.degrees(phi1 - phi0) / ARC_STEP_DEG)))
    pts = []
    for k in range(steps + 1):
        p = _plan(phi0 + (phi1 - phi0) * k / steps, radius)
        p.z = z
        pts.append(p)
    return pts


def _tube(bm, pts, radius, closed_ends=True):
    """Round tube along a polyline in plan (the up vector is world Z)."""
    rings = []
    for k, p in enumerate(pts):
        a, b = pts[max(k - 1, 0)], pts[min(k + 1, len(pts) - 1)]
        tangent = (b - a).normalized()
        side = tangent.cross(Vector((0.0, 0.0, 1.0))).normalized()
        up = side.cross(tangent)
        ring = []
        for i in range(TUBE_SIDES):
            ang = 2 * math.pi * i / TUBE_SIDES
            ring.append(bm.verts.new(p + (side * math.cos(ang) + up * math.sin(ang)) * radius))
        rings.append(ring)
    for k in range(len(rings) - 1):
        for i in range(TUBE_SIDES):
            j = (i + 1) % TUBE_SIDES
            f = bm.faces.new((rings[k][i], rings[k + 1][i], rings[k + 1][j], rings[k][j]))
            f.smooth = True
    if closed_ends:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])


def _box(bm, a, b, side, up, width, thick):
    """Rectangular prism from point a to point b; side and up are unit vectors."""
    hw, ht = side * (width / 2), up * (thick / 2)
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ends = []
    for p in (a, b):
        ends.append([bm.verts.new(p + hw * sx + ht * sy) for sx, sy in corners])
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((ends[0][i], ends[0][j], ends[1][j], ends[1][i]))
    bm.faces.new(ends[0][::-1])
    bm.faces.new(ends[1])


def _add_bar(bm, phi):
    a, b = _bar_point(phi, 0.0), _bar_point(phi, BAR_LENGTH)  # a: outer (slug) end, b: pivot end
    d = (b - a).normalized()
    side = Vector((math.cos(phi), math.sin(phi), 0.0))
    up = side.cross(d).normalized()
    _box(bm, a, b, side, up, BAR_WIDTH, BAR_THICK)
    _box(bm, a, _bar_point(phi, SLUG_LENGTH), side, up, SLUG_WIDTH, SLUG_THICK)


def _pivot():
    """Plan radius and height of the pivot rail (the inner end of the bars)."""
    end = _bar_point(0.0, BAR_LENGTH)
    return STRIKE_Y - end.y, end.z


def _add_post(bm, phi):
    radius, z = _pivot()
    top = _plan(phi, radius)
    top.z = z
    bottom = top.copy()
    bottom.z = FLOOR_Z + 0.1  # 0.1 mm clear of the floor so the meshes never touch
    _tube(bm, [bottom, top], POST_RADIUS)


def _add_all(bm):
    fan = math.radians(FAN_DEG)
    extra = math.radians(POST_EXTRA_DEG)
    for i in range(BARS):
        _add_bar(bm, fan * (2 * i / (BARS - 1) - 1) if BARS > 1 else 0.0)
    radius, z = _pivot()
    _tube(bm, _arc(radius, z, -fan - extra, fan + extra), RAIL_TUBE)
    for sign in (-1, 1):
        _add_post(bm, sign * (fan + extra))


def build_basket():
    obj = bpy.data.objects["TypebarBasket"]
    if obj.data.materials.find(METAL) < 0:
        obj.data.materials.append(bpy.data.materials[METAL])
    bm = bmesh.new()
    _add_all(bm)
    for f in bm.faces:
        f.material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    loc = obj.location * 1000.0  # object space = world minus the origin (identity rotation and scale)
    for v in bm.verts:
        v.co = (v.co - loc) * MM
    me = obj.data
    bm.to_mesh(me)
    bm.free()
    me.update()
    return {
        "verts": len(me.vertices),
        "tris": sum(len(p.vertices) - 2 for p in me.polygons),
        "slots": [m.name for m in me.materials],
    }


def _tree(obj, depsgraph):
    me = obj.evaluated_get(depsgraph).to_mesh()
    verts = [obj.matrix_world @ v.co for v in me.vertices]
    tree = BVHTree.FromPolygons(verts, [tuple(p.vertices) for p in me.polygons], epsilon=0.0)
    return tree, verts


def check():
    """Overlap hits (pairwise BVH) against the Body, Platen, Paper, PaperHolder, PaperTable and
    every key, plus the smallest distance (mm) from a basket vertex to the Body, platen and the
    sheet's front. Expect no hits."""
    deps = bpy.context.evaluated_depsgraph_get()
    basket = bpy.data.objects["TypebarBasket"]
    bt, bverts = _tree(basket, deps)
    names = ["Body", "Platen", "Paper", "PaperHolder", "PaperTable", "StrikePoint"]
    names = [n for n in names if bpy.data.objects[n].type == "MESH"]
    names += [o.name for o in bpy.data.objects if o.name.startswith("Key_")]
    hits, dist = [], {}
    for n in names:
        ot, _ = _tree(bpy.data.objects[n], deps)
        if bt.overlap(ot):
            hits.append(n)
        if n in ("Body", "Platen", "PaperHolder", "PaperTable"):
            dist[n] = round(min(ot.find_nearest(v)[3] for v in bverts) / MM, 2)
    sheet = bpy.data.objects["Carriage"].matrix_world.translation  # platen axis
    rs = 22.6
    dist["sheet_circle"] = round(min(math.hypot(v.y - sheet.y, v.z - sheet.z) - rs * MM for v in bverts) / MM, 2)
    mn = [round(min(v[i] for v in bverts) / MM, 2) for i in range(3)]
    mx = [round(max(v[i] for v in bverts) / MM, 2) for i in range(3)]
    return {"overlap_hits": hits, "min_dist_mm": dist, "min": mn, "max": mx}
