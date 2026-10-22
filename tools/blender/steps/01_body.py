"""Step 01 (slice 6c): Body side profile.

Rebuilds the mesh of the existing `Body` object from a parametric side profile
(YZ), extruded along X and trimmed to the Base footprint (rounded plan corners),
then bevelled. No typebar window and no keyboard slot yet: those are step 02.

Replaces the mesh data in place. The object keeps its name, origin, parent links
(StrikePoint) and material slots. Run it with Body in Object mode. Safe to re-run:
it always rebuilds from the parameters below. Units below are millimetres; mesh
coordinates are metres, in the Body object's local frame (object origin z = 1 mm).
"""
import math

import bmesh
import bpy

# ---- parameters (mm) -------------------------------------------------------
FOOT_X = 150.0           # half width, flush with Base
Y_FRONT = -156.0
Y_REAR = 86.3
CORNER_R = 30.0          # plan corner radius, same as Base
CORNER_POINTS = 8        # points per plan corner, same as Base
Z_BOTTOM = 12.0
Z_TOP = 97.0             # plateau height
Z_SHELF = 68.8           # rear shelf the platen sits above (platen bottom ~69)
Y_PLATEAU_END = 13.0     # rear wall of the hump (paper clearance: <= ~15.6)

# Side profile corners (y, z, fillet radius), walked front-bottom -> over the top
# -> rear-bottom. The slope is two straight runs; the big radius at the knee makes
# it a gentle concave sweep, the radius at the shoulder rolls it into the plateau.
PROFILE = [
    (Y_FRONT, Z_BOTTOM, 0.0),
    (Y_FRONT, 30.0, 8.0),         # nose of the front lip
    (-82.0, 55.0, 70.0),          # knee: long shallow run (~19 deg) -> steep run (~51 deg)
    (-48.0, Z_TOP, 38.0),         # shoulder, a big roll into the plateau
    (Y_PLATEAU_END, Z_TOP, 8.0),  # rear top edge of the hump
    (Y_PLATEAU_END, Z_SHELF, 4.0),  # inner corner down to the shelf
    (Y_REAR, Z_SHELF, 6.0),       # rear top edge of the shelf
    (Y_REAR, Z_BOTTOM, 0.0),
]
ARC_STEP_DEG = 7.5

# Bevel: weights scale the modifier width, so top = 1.8 mm and bottom = 2.5 mm
BEVEL_WIDTH = 2.5
BEVEL_TOP = 1.8
BEVEL_SEGMENTS = 2
SHARP_ANGLE = math.radians(30.0)
BOTTOM_TOL = 0.5         # edges below Z_BOTTOM + this count as bottom edges

MM = 0.001


def fillet_profile(corners, step_deg=ARC_STEP_DEG):
    """Turn (y, z, r) corners into a polyline, replacing each corner with an arc."""
    pts = []
    n = len(corners)
    for i, (y, z, r) in enumerate(corners):
        if r <= 0.0 or i in (0, n - 1):
            pts.append((y, z))
            continue
        ay, az, _ = corners[i - 1]
        by, bz, _ = corners[i + 1]
        u = (ay - y, az - z)
        v = (by - y, bz - z)
        lu, lv = math.hypot(*u), math.hypot(*v)
        u = (u[0] / lu, u[1] / lu)
        v = (v[0] / lv, v[1] / lv)
        theta = math.acos(max(-1.0, min(1.0, u[0] * v[0] + u[1] * v[1])))
        d = r / math.tan(theta / 2.0)
        if d > 0.5 * min(lu, lv) + 1e-9:
            raise ValueError(f"fillet radius {r} too large at corner {i} ({y}, {z})")
        t1 = (y + u[0] * d, z + u[1] * d)
        t2 = (y + v[0] * d, z + v[1] * d)
        bis = (u[0] + v[0], u[1] + v[1])
        lb = math.hypot(*bis)
        k = r / math.sin(theta / 2.0) / lb
        c = (y + bis[0] * k, z + bis[1] * k)
        a1 = math.atan2(t1[1] - c[1], t1[0] - c[0])
        a2 = math.atan2(t2[1] - c[1], t2[0] - c[0])
        delta = (a2 - a1 + math.pi) % (2.0 * math.pi) - math.pi
        steps = max(2, math.ceil(abs(math.degrees(delta)) / step_deg))
        for s in range(steps + 1):
            a = a1 + delta * s / steps
            pts.append((c[0] + r * math.cos(a), c[1] + r * math.sin(a)))
    return pts


def build_prism(profile, half_x):
    """Closed prism: the YZ profile extruded along X from -half_x to +half_x."""
    bm = bmesh.new()
    left = [bm.verts.new((-half_x * MM, y * MM, z * MM)) for y, z in profile]
    right = [bm.verts.new((half_x * MM, y * MM, z * MM)) for y, z in profile]
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], left[j], right[j], right[i]))
    bm.faces.new(left)
    bm.faces.new(right[::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def build_plan_cutter(z_low, z_high):
    """Prism of the Base footprint (rounded rectangle) used to trim the plan corners."""
    outline = []
    centres = [
        (FOOT_X - CORNER_R, Y_REAR - CORNER_R, 0.0),
        (-FOOT_X + CORNER_R, Y_REAR - CORNER_R, 90.0),
        (-FOOT_X + CORNER_R, Y_FRONT + CORNER_R, 180.0),
        (FOOT_X - CORNER_R, Y_FRONT + CORNER_R, 270.0),
    ]
    for cx, cy, a0 in centres:
        for s in range(CORNER_POINTS):
            a = math.radians(a0 + 90.0 * s / (CORNER_POINTS - 1))
            outline.append((cx + CORNER_R * math.cos(a), cy + CORNER_R * math.sin(a)))
    bm = bmesh.new()
    low = [bm.verts.new((x * MM, y * MM, z_low * MM)) for x, y in outline]
    high = [bm.verts.new((x * MM, y * MM, z_high * MM)) for x, y in outline]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((low[i], low[j], high[j], high[i]))
    bm.faces.new(low[::-1])
    bm.faces.new(high)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def evaluated_mesh(obj):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    return bpy.data.meshes.new_from_object(obj.evaluated_get(dg))


def weight_sharp_edges(bm, z_bottom):
    """Bevel weight 1.0 on sharp bottom edges, BEVEL_TOP/BEVEL_WIDTH on other sharp edges."""
    layer = bm.edges.layers.float.get("bevel_weight_edge") or bm.edges.layers.float.new("bevel_weight_edge")
    top_weight = BEVEL_TOP / BEVEL_WIDTH
    for e in bm.edges:
        ang = e.calc_face_angle(None)
        if ang is None or ang < SHARP_ANGLE:
            e[layer] = 0.0
            continue
        zmid = 0.5 * (e.verts[0].co.z + e.verts[1].co.z)
        e[layer] = 1.0 if zmid < z_bottom + BOTTOM_TOL * MM else top_weight


def set_area_weighted_normals(mesh):
    """Vertex normals weighted by face area, so big flat faces stay flat next to bevels.

    Plain smooth shading smears the normals of the bevel ring across the long
    triangles of a flat wall (visible streaks). Same idea as the Weighted Normal
    modifier, but baked into the mesh so no modifier is needed.
    """
    acc = [[0.0, 0.0, 0.0] for _ in mesh.vertices]
    for p in mesh.polygons:
        n, a = p.normal, p.area
        for vi in p.vertices:
            acc[vi][0] += n.x * a
            acc[vi][1] += n.y * a
            acc[vi][2] += n.z * a
    normals = []
    for x, y, z in acc:
        ln = math.sqrt(x * x + y * y + z * z) or 1.0
        normals.append((x / ln, y / ln, z / ln))
    mesh.normals_split_custom_set_from_vertices(normals)


def measure_bevel(mesh):
    """Actual bevel widths in mm (top edge of the plateau, bottom edge), read from the mesh."""
    eps = 1e-6
    top_x = [v.co.x for v in mesh.vertices if v.co.x > 0 and abs(v.co.z - Z_TOP * MM) < eps]
    bot_x = [v.co.x for v in mesh.vertices if v.co.x > 0 and abs(v.co.z - Z_BOTTOM * MM) < eps]
    return {
        "top_width_mm": round(FOOT_X - min(top_x) / MM, 3),
        "bottom_width_mm": round(FOOT_X - max(bot_x) / MM, 3),
    }


def rebuild_body():
    body = bpy.data.objects["Body"]
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    mesh = body.data
    # 1. profile prism, wider than the footprint so the plan cutter defines the sides
    prism = build_prism(fillet_profile(PROFILE), FOOT_X + 10.0)
    prism.to_mesh(mesh)
    prism.free()
    # 2. trim the plan corners (Boolean intersect with the Base footprint)
    cutter_mesh = bpy.data.meshes.new("_BodyCutter")
    cutter = bpy.data.objects.new("_BodyCutter", cutter_mesh)
    bpy.context.scene.collection.objects.link(cutter)
    cbm = build_plan_cutter(0.0, 200.0)
    cbm.to_mesh(cutter_mesh)
    cbm.free()
    mod = body.modifiers.new("PlanTrim", "BOOLEAN")
    mod.operation = "INTERSECT"
    mod.solver = "EXACT"
    mod.operand_type = "OBJECT"
    mod.object = cutter
    trimmed = evaluated_mesh(body)
    body.modifiers.remove(mod)
    bpy.data.objects.remove(cutter)
    bpy.data.meshes.remove(cutter_mesh)
    # 3. weight the sharp edges, then bevel
    bm = bmesh.new()
    bm.from_mesh(trimmed)
    bpy.data.meshes.remove(trimmed)
    weight_sharp_edges(bm, Z_BOTTOM * MM)
    bm.to_mesh(mesh)
    bm.free()
    bev = body.modifiers.new("EdgeBevel", "BEVEL")
    bev.limit_method = "WEIGHT"
    bev.width = BEVEL_WIDTH * MM
    bev.segments = BEVEL_SEGMENTS
    # Clamp Overlap silently shrinks the width to ~0.04 mm on this mesh (many short
    # profile edges), so the bevel must be measured afterwards (see measure_bevel).
    bev.use_clamp_overlap = False
    beveled = evaluated_mesh(body)
    body.modifiers.remove(bev)
    # 4. write the result into the original mesh datablock, smooth shaded
    bm = bmesh.new()
    bm.from_mesh(beveled)
    bpy.data.meshes.remove(beveled)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    mesh.update()
    set_area_weighted_normals(mesh)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    stats = {
        "verts": len(bm.verts),
        "faces": len(bm.faces),
        "boundary_edges": sum(1 for e in bm.edges if e.is_boundary),
        "non_manifold_edges": sum(1 for e in bm.edges if not e.is_manifold),
    }
    bm.free()
    stats.update(measure_bevel(mesh))
    return stats


result = rebuild_body()
