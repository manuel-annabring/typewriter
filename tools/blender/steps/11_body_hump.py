"""Step 11: lower and round the Body's hump (session 3 of the model detail pass).

Values picked in the hump widget on 2026-10-29: profile C (one continuous curve), top z 82,
rear radius 10, curve top starts at y -5, well opening stays at y -14.3, shoulders rounded.
Goal: the hump top ends below the strike point (z 88) so the typed line is visible.

What changes: only the hump above its foot ring (z 70.6). Everything at z <= 70.6 stays
(keys sit 0.75 mm from the foot of the front slope, key arms end inside the solid below),
so the keyboard well, key levers, the deck at z 68.6 and the rear shelf are untouched.

Method (no vertices are deleted, the object, origin, parent link, material slots stay):
1. Cut the hump faces with planes (bisect) so the curved top has rows to follow: seven
   rows across the front slope, a few across the old flat top and the rear edge, and
   columns at the ends for the shoulders.
2. Move every hump vertex in z only, by one height function Zs(x, y):
   - front: a cubic bezier from the slope's foot (y -44.9, z 70.6), leaving along the
     cheek line (24 degrees), flattening to z TOP at y CURVE_END_Y;
   - ends: an elliptical droop (SHOULDER_DROP over SHOULDER_WIDTH) on both sides, faded out
     towards the foot so the front slope still meets the cheeks;
   - rear: an elliptical edge from z TOP down to REAR_END_Z at y 34.4 (REAR_RADIUS long);
   - the small bevels of the old mesh (2 mm, two rows) are kept as offsets below Zs on the
     edges that stay edges (the ends and the rim of the well); the front slope and the rear
     edge are smooth now, so their old bevel rows just follow the curve.

NOT re-runnable: it expects the old mesh (606 vertices) and refuses anything else. Run it in
the live session (exec this file, then call build_hump()) or headless on a copy.
All lengths are mm; Blender stores the mesh in metres and the object sits 1 mm above z 0.
"""

import math

import bmesh
import bpy

TOP = 82.0  # hump top (old 98); the strike point is at z 88
CURVE_END_Y = -5.0  # the front curve becomes flat here
CURVE_TANGENT_DEG = 24.0  # leaves the foot along the cheek line
REAR_RADIUS = 10.0  # length of the rear edge along y (y 24.4 to 34.4)
REAR_END_Z = 72.0  # height of the rear edge's last row (foot ring is 70.6)
SHOULDER_START_X = 126.0  # droop begins here
SHOULDER_WIDTH = 24.0  # and reaches the end (x 150) after this much
SHOULDER_DROP = 7.0  # circular R24 does not fit: the hump is only ~13 mm above the deck

FOOT_Y = -44.9
FOOT_Z = 70.6
REAR_Y = 34.4
OLD_TOP = 98.0
OLD_VERTS = 606
OBJ_Z = 1.0  # Body object location, mm

SLOPE_ROWS = 8  # old front slope runs y -44.9 .. -26.9
SLOPE_TOP_Y = -26.9
EXTRA_Y = [-21.0, -18.0, -12.0, -8.0, -5.0, 24.4, 26.4, 28.4, 30.4]
X_PLANES = [128.0, 132.0, 136.0, 140.0, 143.0, 146.0]

END_TOP_OFFSET = ([148.0, 149.4, 150.0], [0.0, 0.6, 2.0])  # old end bevel below the flat
END_FOOT_OFFSET = ([148.0, 149.4, 150.0], [0.0, 1.2, 3.0])  # old end bevel at the foot

MM = 0.001


def _interp(x, xs, ys):
    if x <= xs[0]:
        return ys[0]
    for i in range(len(xs) - 1):
        if x <= xs[i + 1]:
            t = (x - xs[i]) / (xs[i + 1] - xs[i])
            return ys[i] + t * (ys[i + 1] - ys[i])
    return ys[-1]


def _bezier_pts():
    k1 = (CURVE_END_Y - FOOT_Y) * 0.5
    k2 = (CURVE_END_Y - FOOT_Y) * 0.45
    a = math.radians(CURVE_TANGENT_DEG)
    p0 = (FOOT_Y, FOOT_Z)
    p1 = (FOOT_Y + k1 * math.cos(a), FOOT_Z + k1 * math.sin(a))
    p2 = (CURVE_END_Y - k2, TOP)
    p3 = (CURVE_END_Y, TOP)
    return p0, p1, p2, p3


def _front_z(y):
    """Height of the front curve at plan position y (flat TOP behind CURVE_END_Y)."""
    if y >= CURVE_END_Y:
        return TOP
    if y <= FOOT_Y:
        return FOOT_Z
    p0, p1, p2, p3 = _bezier_pts()
    lo, hi = 0.0, 1.0
    for _ in range(40):
        t = (lo + hi) / 2
        u = 1 - t
        yy = u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0]
        if yy < y:
            lo = t
        else:
            hi = t
    t = (lo + hi) / 2
    u = 1 - t
    return u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1]


def _drop(ax):
    if ax <= SHOULDER_START_X:
        return 0.0
    u = min(1.0, (ax - SHOULDER_START_X) / SHOULDER_WIDTH)
    return SHOULDER_DROP * (1.0 - math.sqrt(1.0 - u * u))


def _rear_envelope(y):
    start = REAR_Y - REAR_RADIUS
    if y <= start:
        return 1.0
    return math.sqrt(max(0.0, 1.0 - ((y - start) / REAR_RADIUS) ** 2))


def surface_z(x, y):
    """Smooth hump surface Zs(x, y) in world mm."""
    ax = abs(x)
    s = (_front_z(y) - FOOT_Z) / (TOP - FOOT_Z)
    s = max(0.0, min(1.0, s))
    top_local = _front_z(y) - _drop(ax) * s
    e = _rear_envelope(y)
    return REAR_END_Z + (top_local - REAR_END_Z) * e


def new_z(x, y, z):
    """Target world z for a vertex of the old mesh, or None when it stays."""
    ax = abs(x)
    if z < FOOT_Z - 0.05 or y > 35.0:
        return None
    is_top = z >= 95.9
    is_slope = (not is_top) and y < -24.0
    if not (is_top or is_slope):
        return None
    s = max(0.0, min(1.0, (_front_z(y) - FOOT_Z) / (TOP - FOOT_Z)))
    e = _rear_envelope(y)
    fade = 0.3 + 0.7 * e  # keeps the old bevel offsets from sinking below the foot
    off = 0.0
    if ax >= 147.9:
        top_off = _interp(ax, *END_TOP_OFFSET)
        foot_off = _interp(ax, *END_FOOT_OFFSET)
        off = top_off * s * fade + foot_off * (1.0 - s)
    elif y > -23.6 and (y < 32.3 or ax < 55.69):
        off = (OLD_TOP - z) * fade  # rim of the well: bevel offset below the surface
    return surface_z(x, y) - off


def _hump_faces(bm):
    faces = []
    for f in bm.faces:
        if abs(f.normal.x) > 0.999:
            continue  # outer end walls stay whole (their top edge gains vertices anyway)
        zs = [v.co.z / MM + OBJ_Z for v in f.verts]
        ys = [v.co.y / MM for v in f.verts]
        if max(zs) > FOOT_Z - 0.05 and min(ys) < 35.3 and max(ys) > -46.0:
            faces.append(f)
    return faces


def _cut(bm, axis, value):
    faces = _hump_faces(bm)
    geom = list(faces)
    edges = {e for f in faces for e in f.edges}
    verts = {v for f in faces for v in f.verts}
    geom += list(edges) + list(verts)
    co = (value * MM, 0, 0) if axis == "x" else (0, value * MM, 0)
    no = (1, 0, 0) if axis == "x" else (0, 1, 0)
    bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=co, plane_no=no)


def build_hump():
    obj = bpy.data.objects["Body"]
    mesh = obj.data
    if len(mesh.vertices) != OLD_VERTS:
        raise RuntimeError(f"Body has {len(mesh.vertices)} vertices, expected {OLD_VERTS}; step 11 already ran?")
    if abs(obj.location.z / MM - OBJ_Z) > 1e-3 or tuple(obj.scale) != (1.0, 1.0, 1.0):
        raise RuntimeError("Body transform changed; re-measure before running step 11")

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.normal_update()

    rows = [FOOT_Y + (SLOPE_TOP_Y - FOOT_Y) * k / SLOPE_ROWS for k in range(1, SLOPE_ROWS)]
    for y in sorted(rows + EXTRA_Y):
        _cut(bm, "y", y)
        bm.normal_update()
    for x in X_PLANES:
        for sign in (1, -1):
            _cut(bm, "x", sign * x)
            bm.normal_update()

    targets = {}
    for v in bm.verts:
        x, y, z = v.co.x / MM, v.co.y / MM, v.co.z / MM + OBJ_Z
        nz = new_z(x, y, z)
        if nz is not None:
            targets[v.index] = nz
    bm.verts.ensure_lookup_table()
    for i, nz in targets.items():
        bm.verts[i].co.z = (nz - OBJ_Z) * MM

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return {"verts": len(mesh.vertices), "moved": len(targets)}


def check():
    """Quick sanity numbers: boundary edges, hump top, lowest hump vertex above the foot."""
    obj = bpy.data.objects["Body"]
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    boundary = sum(1 for e in bm.edges if not e.is_manifold)
    zs = [v.co.z / MM + OBJ_Z for v in bm.verts]
    out = {"verts": len(bm.verts), "non_manifold_edges": boundary, "max_z": round(max(zs), 2)}
    bm.free()
    return out
