"""Step 07 (slice 6c, keycaps): replace the 44 key blockouts with rounded caps on stems.

Each key keeps its object, name, material slots and plan position (x, y); only the mesh and
the height change. Cap tops sit on one line parallel to the side cheeks of the keyboard well
(ROW0_TOP_Z at row 0, falling SLOPE_DEG towards the front). Stems reach STEM_EMBED below the
well floor (z 13.5: inside the floor slab, and a pressed key's foot, 4 mm lower, inside the Base). The origin
ends up at the bounding-box centre (contract), so the location is recomputed on every run.

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
STEM_D = 5.0
STEM_SEGS = 12
STEM_EMBED = 1.0  # stem foot below the well floor (13.5 mm: inside the 1.5 mm floor slab; steps/08)
STEM_INTO_CAP = 0.5  # stem top reaches this far into the cap (no gap)
ROW0_TOP_Z = 61.5  # cap top of the back row
ROW0_Y = -59.75  # back row centre line (measured), pivot of the top line
SLOPE_DEG = 24.0  # top line falls this much towards the front
MOD_W = 23.5  # modifier keys are stadiums this wide (x), CAP_D deep
SPACE_W = 150.0
SPACE_D = 14.0
SPACE_H = 6.0
SPACE_RC = 6.0  # plan corner radius of the space bar
SPACE_DROP = 0.0  # space bar top relative to the top line
SPACE_STEM_X = 50.0  # two stems at +-this from the bar centre
FLOOR_Z = 14.5  # keyboard well floor, lowered from 16.5 by steps/08 (Body bottom is at 13.0)

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
    """(w, d, rc, h, stem x offsets, top drop) of a key in mm."""
    if short == spec.SPACE_KEY:
        return SPACE_W, SPACE_D, SPACE_RC, SPACE_H, (-SPACE_STEM_X, SPACE_STEM_X), SPACE_DROP
    w = MOD_W if short in spec.DARK_KEYS else CAP_D
    return w, CAP_D, CAP_D / 2, CAP_H, (0.0,), 0.0


def build_mesh(short, cap_top):
    """bmesh of one key in mm, plan centre at x=y=0, world z. Cap faces mat 0, stems mat 1."""
    w, d, rc, h, stems, _ = key_shape(short)
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

    r = STEM_D / 2
    z0, z1 = FLOOR_Z - STEM_EMBED, foot + STEM_INTO_CAP
    for sx in stems:
        ring = [(sx + r * math.cos(2 * math.pi * i / STEM_SEGS), r * math.sin(2 * math.pi * i / STEM_SEGS))
                for i in range(STEM_SEGS)]
        lo = [bm.verts.new((x, y, z0)) for x, y in ring]
        hi = [bm.verts.new((x, y, z1)) for x, y in ring]
        for j in range(STEM_SEGS):
            k = (j + 1) % STEM_SEGS
            f = bm.faces.new((lo[j], lo[k], hi[k], hi[j]))
            f.material_index = 1
    for f in cap_faces:
        f.material_index = 0
    for f in bm.faces:
        f.smooth = True
    if BOTTOM_FILLET <= 0:  # a hard foot edge: keep the underside from smoothing into the side
        for v in vrings[-1]:
            for e in v.link_edges:
                if all(u in vrings[-1] for u in e.verts):
                    e.smooth = False
    return bm


def build_key(name):
    obj = bpy.data.objects[name]
    short = name[len("Key_"):]
    old = obj.data
    x_mm = X_OVERRIDE.get(short, obj.location.x / MM)
    y_mm = obj.location.y / MM
    drop = key_shape(short)[5]
    bm = build_mesh(short, top_z(y_mm) + drop)
    dark = short in spec.DARK_KEYS
    if dark:  # modifier keys have a single slot (Mat_KeyDark): stems use it too
        for f in bm.faces:
            f.material_index = 0
    zs = [v.co.z for v in bm.verts]
    zc = (min(zs) + max(zs)) / 2
    for v in bm.verts:
        v.co = (v.co.x * MM, v.co.y * MM, (v.co.z - zc) * MM)

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
    obj.location = (x_mm * MM, y_mm * MM, zc * MM)
    return dict(name=name, verts=len(mesh.vertices), tris=sum(len(p.vertices) - 2 for p in mesh.polygons),
                top_mm=round(top_z(y_mm) + drop, 2), z_mm=round(zc, 2))


def build_keycaps(names=None):
    if bpy.context.mode != "OBJECT":
        raise RuntimeError("Switch to Object Mode first")
    names = names or spec.KEY_NAMES
    reports = [build_key(n) for n in names]
    return dict(done=len(reports), tris=sum(r["tris"] for r in reports), keys=reports[:6])


if __name__ == "__main__":
    print(build_keycaps())
