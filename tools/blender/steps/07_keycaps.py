"""Step 07 (slice 6c, keycaps and key levers): replace the 44 key blockouts with rounded caps on levers.

Each key keeps its object, name and material slots; only the mesh and the height change. Cap
tops sit on one line parallel to the side cheeks of the keyboard well (ROW0_TOP_Z at row 0,
falling SLOPE_DEG towards the front).

Under each cap sits a key lever like on a real typewriter: a flat steel strip (LEVER_T x
LEVER_H, on edge) that runs down from the cap as a riser, bends 90 degrees with radius LEVER_R
and runs back (+Y) through the hump's front wall (WALL_Y) to end ARM_INTO mm inside the Body.
Routing "two levels" (picked in the widget, 2026-10-26): row 0 on an upper level, rows 1 to 3
share one lower level, the Space bar's two arms (at +-SPACE_STEM_X) are lowest. A level is the
z of the arm's centre line: the cap foot minus LEVER_R, so the riser has no straight part
left. Rows 1 to 3 use the lowest of their foots (row 3). Pressing a key moves the whole key
(cap, riser and arm) 4 mm down; arms never touch each other, see the widget maths.

The origin ends up at the bounding-box centre of cap, riser and arm (contract, SPEC.md
section 5), which is now well behind the cap. A rebuild therefore finds the cap's plan centre
from the mesh's top face, not from the object location.

Profile maths (fillet, profile, outline) are the same as the side-view widget the values
were picked in: a cap is a rounded-rect plan outline (circle for letter keys, stadium for
modifiers, rounded bar for Space) swept along a side profile with a flat top, a taper and
two fillets. The flat top is one n-gon, so steps/02_key_uvs.py finds it as the label face.

Re-runnable (it rebuilds from the current x, y). Run steps/02_key_uvs.py afterwards: a new
mesh has no UVs. Live: exec this file, then call build_keycaps() (all keys) or
build_keycaps(["Key_G"]). Headless: `Blender -b typewriter.blend --python 07_keycaps.py`
builds all keys (does not save). World coordinates in meters, Blender frame (Z up, front -Y).
"""

import math
import os
import sys

import bmesh
import bpy

# --- parameters (mm, degrees), picked in the widget on 2026-10-26 --------------------------
CAP_D = 18.0  # plan size of a letter cap at its foot
CAP_H = 7.0  # cap height, foot to flat top
CAP_TAPER = 0.5  # side inset from foot to top (before the fillets)
TOP_FILLET = 1.6
TOP_SEGS = 5
BOTTOM_FILLET = 0.4
BOTTOM_SEGS = 1
SEGS_PER_QUARTER = 8  # plan outline points per 90 degrees
LEVER_T = 1.5  # strip thickness (x)
LEVER_H = 5.0  # strip width: depth (y) of the riser, height (z) of the arm
LEVER_R = 4.0  # bend radius of the strip's centre line (inner edge 1.5 mm)
LEVER_BEND_SEGS = 8
LEVER_INTO_CAP = 0.5  # riser top reaches this far into the cap (no gap)
WALL_Y = -50.4  # hump front wall (measured 2026-10-26: -50.3 to -50.6)
ARM_INTO = 8.0  # arms end this far behind the wall (the TypebarBasket starts at y -41.8)
ROW0_TOP_Z = 61.5  # cap top of the back row
ROW0_Y = -59.75  # back row centre line (measured), pivot of the top line
SLOPE_DEG = 24.0  # top line falls this much towards the front
MOD_W = 23.5  # modifier keys are stadiums this wide (x), CAP_D deep
SPACE_W = 150.0
SPACE_D = 14.0
SPACE_H = 6.0
SPACE_RC = 6.0  # plan corner radius of the space bar
SPACE_DROP = 0.0  # space bar top relative to the top line
SPACE_STEM_X = 50.0  # two levers at +-this from the bar centre
FLOOR_Z = 14.5  # keyboard well floor (steps/08); only used to report arms that dip into it

MM = 0.001

_here = os.path.dirname(bpy.data.filepath)
if _here not in sys.path:
    sys.path.insert(0, _here)
import contract_spec as spec  # noqa: E402

# Per-key plan x in mm, absolute (keys not listed keep their x). The bottom row moves 6 mm
# left of its blockout layout: at MOD_W, Shift_R hit the right cheek, and now Z sits half a
# key right of A.
BOTTOM_ROW_X = (-105.5, -82.0, -58.5, -35.0, -11.5, 12.0, 35.5, 59.0, 82.5, 106.0, 129.5)
BOTTOM_ROW_SHIFT = -6.0
X_OVERRIDE = {n: x + BOTTOM_ROW_SHIFT for n, x in zip(spec.KEY_ROWS[3], BOTTOM_ROW_X)}


def fillet(p, u, v, r, n):
    """Arc of radius r in corner p between edges along unit vectors u and v (from u's side)."""
    if r <= 0:
        return [p]
    ang = math.acos(max(-1.0, min(1.0, u[0] * v[0] + u[1] * v[1])))
    t = r / math.tan(ang / 2)
    t1 = (p[0] + u[0] * t, p[1] + u[1] * t)
    t2 = (p[0] + v[0] * t, p[1] + v[1] * t)
    b = (u[0] + v[0], u[1] + v[1])
    bl = math.hypot(*b)
    h = r / math.sin(ang / 2)
    c = (p[0] + b[0] / bl * h, p[1] + b[1] / bl * h)
    a1 = math.atan2(t1[1] - c[1], t1[0] - c[0])
    a2 = math.atan2(t2[1] - c[1], t2[0] - c[0])
    d = (a2 - a1 + math.pi) % (2 * math.pi) - math.pi
    return [(c[0] + r * math.cos(a1 + d * i / n), c[1] + r * math.sin(a1 + d * i / n)) for i in range(n + 1)]


def profile(h):
    """(inset, z) rings from the flat top's edge down to the foot's inner edge, in mm."""
    tp = CAP_TAPER
    side = math.hypot(tp, h)
    top = fillet((tp, h), (1, 0), (-tp / side, -h / side), TOP_FILLET, TOP_SEGS)
    foot = fillet((0, 0), (tp / side, h / side), (1, 0), BOTTOM_FILLET, BOTTOM_SEGS)
    return top + foot


def outline(w, d, rc, inset, seg):
    """Rounded-rect plan outline (CCW from above), shrunk by inset; same count for any inset."""
    cx, cy = w / 2 - rc, d / 2 - rc
    signs = [(1, 1), (-1, 1), (-1, -1), (1, -1)]
    pts = []
    for k, (sx, sy) in enumerate(signs):
        for j in range(seg + 1):
            if j == 0 and (cx if k % 2 else cy) < 1e-9:
                continue  # zero-length straight edge: the previous corner already ends here
            a = math.radians(k * 90 + j * 90 / seg)
            pts.append((sx * cx + (rc - inset) * math.cos(a), sy * cy + (rc - inset) * math.sin(a)))
    return pts


def top_z(y_mm):
    return ROW0_TOP_Z + math.tan(math.radians(SLOPE_DEG)) * (y_mm - ROW0_Y)


def key_shape(short):
    """(w, d, rc, h, lever x offsets, top drop) of a key in mm."""
    if short == spec.SPACE_KEY:
        return SPACE_W, SPACE_D, SPACE_RC, SPACE_H, (-SPACE_STEM_X, SPACE_STEM_X), SPACE_DROP
    w = MOD_W if short in spec.DARK_KEYS else CAP_D
    return w, CAP_D, CAP_D / 2, CAP_H, (0.0,), 0.0


def lever_rings(sx, level, foot, arm_end_y):
    """Rings (centre, width axis) of one lever, from the riser top to the arm end, in mm.

    Plan centre of the cap is x = y = 0. The strip's thickness axis is always x; its width axis
    w turns with the bend: +Y on the riser, +Z on the arm. Each ring is 4 corners
    (+-T/2 along x, +-H/2 along w).
    """
    rings = [((sx, 0.0, foot + LEVER_INTO_CAP), (0.0, 1.0, 0.0))]
    for i in range(LEVER_BEND_SEGS + 1):
        p = math.pi / 2 * i / LEVER_BEND_SEGS
        c = (sx, LEVER_R - LEVER_R * math.cos(p), level + LEVER_R - LEVER_R * math.sin(p))
        rings.append((c, (0.0, math.cos(p), math.sin(p))))
    rings.append(((sx, arm_end_y, level), (0.0, 0.0, 1.0)))
    return rings


def build_mesh(short, cap_top, level, arm_end_y):
    """bmesh of one key in mm, plan centre at x=y=0, world z. Cap faces mat 0, levers mat 1."""
    w, d, rc, h, levers, _ = key_shape(short)
    foot = cap_top - h
    rings = profile(h)
    if rc <= rings[0][0]:
        raise RuntimeError(f"{short}: corner radius {rc} too small for the top fillet")
    bm = bmesh.new()
    vrings = [
        [bm.verts.new((x, y, foot + z)) for x, y in outline(w, d, rc, inset, SEGS_PER_QUARTER)]
        for inset, z in rings
    ]
    n = len(vrings[0])
    bm.faces.new(vrings[0])  # flat top, normal +Z (label face)
    for upper, lower in zip(vrings, vrings[1:]):
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new((lower[j], lower[k], upper[k], upper[j]))
    bm.faces.new(list(reversed(vrings[-1])))  # underside, normal -Z
    cap_faces = list(bm.faces)

    sharp = []
    for sx in levers:
        quads = []
        for c, wv in lever_rings(sx, level, foot, arm_end_y):
            quads.append([
                bm.verts.new((c[0] + a * LEVER_T / 2, c[1] + b * LEVER_H / 2 * wv[1], c[2] + b * LEVER_H / 2 * wv[2]))
                for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))
            ])
        for q0, q1 in zip(quads, quads[1:]):
            for j in range(4):
                k = (j + 1) % 4
                f = bm.faces.new((q0[j], q0[k], q1[k], q1[j]))
                f.material_index = 1
        bm.faces.new(list(reversed(quads[0]))).material_index = 1  # riser top, inside the cap
        bm.faces.new(quads[-1]).material_index = 1  # arm end, inside the Body
        sharp += [(q[j], q1[j]) for q, q1 in zip(quads, quads[1:]) for j in range(4)]
    for a, b in sharp:
        for e in a.link_edges:
            if b in e.verts:
                e.smooth = False  # the strip's four long edges stay crisp
    for f in cap_faces:
        f.material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # outward on the cap and every lever
    for f in bm.faces:
        f.smooth = True
    if BOTTOM_FILLET <= 0:  # a hard foot edge: keep the underside from smoothing into the side
        for v in vrings[-1]:
            for e in v.link_edges:
                if all(u in vrings[-1] for u in e.verts):
                    e.smooth = False
    return bm


def cap_center(obj):
    """Plan centre of a key's cap in mm: the centroid of its flat top (the highest up-facing polygon)."""
    top = max((p for p in obj.data.polygons if p.normal.z > 0.9), key=lambda p: p.center.z)
    c = obj.matrix_basis @ top.center  # not matrix_world: that is stale right after obj.location changes
    return c.x / MM, c.y / MM


def key_row(short):
    """Row index 0 (back) to 3 (front) of a key, 4 for Space."""
    return next((i for i, row in enumerate(spec.KEY_ROWS) if short in row), 4)


def lever_level(short, cap_y_mm):
    """z of the arm's centre line (mm): row 0 and Space at their own foot minus the bend radius,
    rows 1 to 3 on the level row 3 allows (the lowest of the four rows' limits)."""
    row = key_row(short)
    if row in (0, 4):
        return top_z(cap_y_mm) + key_shape(short)[5] - key_shape(short)[3] - LEVER_R
    front = bpy.data.objects["Key_" + spec.KEY_ROWS[3][0]]
    return top_z(cap_center(front)[1]) - CAP_H - LEVER_R


def build_key(name):
    obj = bpy.data.objects[name]
    short = name[len("Key_"):]
    old = obj.data
    cap_x, y_mm = cap_center(obj)
    x_mm = X_OVERRIDE.get(short, cap_x)
    drop = key_shape(short)[5]
    level = lever_level(short, y_mm)
    bm = build_mesh(short, top_z(y_mm) + drop, level, WALL_Y + ARM_INTO - y_mm)
    dark = short in spec.DARK_KEYS
    if dark:  # modifier keys have a single slot (Mat_KeyDark): levers use it too
        for f in bm.faces:
            f.material_index = 0
    lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
    hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
    ctr = [(a + b) / 2 for a, b in zip(lo, hi)]
    for v in bm.verts:
        v.co = ((v.co.x - ctr[0]) * MM, (v.co.y - ctr[1]) * MM, (v.co.z - ctr[2]) * MM)

    mesh = bpy.data.meshes.new(old.name + "_new")
    bm.to_mesh(mesh)
    bm.free()
    for m in old.materials:
        mesh.materials.append(m)
    old_name = old.name
    obj.data = mesh
    if old.users == 0:
        bpy.data.meshes.remove(old)
    mesh.name = old_name
    obj.location = ((x_mm + ctr[0]) * MM, (y_mm + ctr[1]) * MM, ctr[2] * MM)
    return dict(name=name, verts=len(mesh.vertices), tris=sum(len(p.vertices) - 2 for p in mesh.polygons),
                top_mm=round(top_z(y_mm) + drop, 2), level_mm=round(level, 2),
                dips_floor=round(max(0.0, FLOOR_Z - (level - LEVER_H / 2)), 2))


def build_keycaps(names=None):
    if bpy.context.mode != "OBJECT":
        raise RuntimeError("Switch to Object Mode first")
    names = names or spec.KEY_NAMES
    reports = [build_key(n) for n in names]
    return dict(done=len(reports), tris=sum(r["tris"] for r in reports), keys=reports[:6])


if __name__ == "__main__":
    print(build_keycaps())
