"""Builds the RetroMod blockout from primitives and saves it as a .blend.

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
        --python tools/blender/build_blockout.py -- [output.blend]

Default output: tools/blender/typewriter-blockout.blend

Until the .blend is hand-edited (slice 6), this script is the source of the .blend and
contract changes go here, then re-run. Once the .blend is hand-edited, the .blend is the
source of truth: re-running this script overwrites those edits.

Blender is Z up. Modeling convention here: X right, Y depth (keyboard at -Y, platen at
+Y), Z up. The glTF exporter converts this to +Y up, front facing +Z. Units are meters.
All dimensions below are blockout guesses from the concept sheet (width 0.32 m is the
only number the sheet gives us). Tweak the constants and re-run, or edit in Blender.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract_spec as spec  # noqa: E402

# --- Dimensions (meters) -----------------------------------------------------
BODY_HALF_W = 0.15  # body spans x -0.15..0.15
BODY_HALF_D = 0.15  # body spans y -0.15..0.15
BASE_H = 0.012  # wood strip
BASE_OVERHANG = 0.006
DECK_Z = 0.040  # top of the keyboard deck
WALL_Y = -0.03  # where the tall rear shell starts
TOP_Z_BACK, TOP_Z_FRONT = 0.108, 0.088  # sloped top of the rear shell

PLATEN_Y, PLATEN_Z, PLATEN_R, PLATEN_LEN = 0.045, 0.125, 0.022, 0.270
KNOB_R, KNOB_LEN = 0.016, 0.022
CARRIAGE_REST_X = 0.085  # carriage rest position: strike point (x=0) sits at the left paper margin
STRIKE = Vector((0.0, PLATEN_Y - PLATEN_R - 0.001, PLATEN_Z - 0.005))

KEY_PITCH = 0.0235
ROW_Y = [-0.050, -0.071, -0.092, -0.113]
ROW_X_OFFSET = [-0.006, 0.0, 0.006, 0.012]
ROW_STEM_EXTRA = [0.009, 0.006, 0.003, 0.0]  # rows step down toward the front to suggest the slope
KEY_CAP_R1, KEY_CAP_R2, KEY_CAP_H = 0.0090, 0.0083, 0.0075
KEY_STEM_R, KEY_STEM_H = 0.0035, 0.011

PAPER_TILT = math.radians(8)  # leans back
PAPER_ANCHOR = (0.0215, 0.120)  # (y, z) on the paper plane, just in front of the platen
PAPER_BOTTOM_Z = 0.098

# --- Materials (palette sampled from reference/retromod-sheet.png) ------------
MATERIAL_DEFS = {
    # name: (hex color, metallic, roughness)
    "Mat_Body": ("#6f7165", 0.0, 0.6),
    "Mat_KeyCream": ("#d0c2ad", 0.0, 0.5),
    "Mat_KeyDark": ("#4a5046", 0.0, 0.5),
    "Mat_Wood": ("#5b3f2a", 0.0, 0.5),
    "Mat_Platen": ("#262625", 0.0, 0.7),
    "Mat_Metal": ("#a8a49c", 1.0, 0.35),
    "Mat_Paper": ("#f2eee3", 0.0, 0.9),
}


def hex_to_linear(h):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    return (c(int(h[1:3], 16)), c(int(h[3:5], 16)), c(int(h[5:7], 16)), 1.0)


def make_materials():
    mats = {}
    for name, (hex_color, metallic, roughness) in MATERIAL_DEFS.items():
        m = bpy.data.materials.new(name)
        if m.node_tree is None:
            m.use_nodes = True
        rgba = hex_to_linear(hex_color)
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        m.diffuse_color = rgba  # viewport / Workbench preview color
        mats[name] = m
    return mats


# --- Geometry helpers ---------------------------------------------------------
AXIS_ROT = {
    "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
    "Y": Matrix.Rotation(math.pi / 2, 4, "X"),
    "Z": Matrix.Identity(4),
}


def add_cylinder(bm, center, radius, length, axis="Z", radius2=None, segments=24, mat=0):
    m = Matrix.Translation(center) @ AXIS_ROT[axis]
    res = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=segments,
        radius1=radius,
        radius2=radius if radius2 is None else radius2,
        depth=length,
        matrix=m,
        calc_uvs=False,
    )
    for v in res["verts"]:
        for f in v.link_faces:
            f.material_index = mat


def add_box(bm, center, size, mat=0):
    m = Matrix.Translation(center) @ Matrix.Diagonal(Vector((*size, 1.0)))
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=m, calc_uvs=False)
    for v in res["verts"]:
        for f in v.link_faces:
            f.material_index = mat


def bbox_center(bm):
    xs, ys, zs = [v.co.x for v in bm.verts], [v.co.y for v in bm.verts], [v.co.z for v in bm.verts]
    return Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))


def make_object(name, bm, mats, origin=None, parent=None):
    """Turns a bmesh (in world coordinates) into an object. origin=None puts the origin
    at the bbox center. The child stays where it was built, even when parented."""
    if origin is None:
        origin = bbox_center(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.translate(bm, vec=-origin, verts=bm.verts)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for m in mats:
        mesh.materials.append(m)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = origin
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        set_parent(obj, parent)
    return obj


def set_parent(obj, parent):
    obj.parent = parent
    # Parents here are pure translations, so this keeps the child's world position.
    obj.matrix_parent_inverse = Matrix.Translation(-parent.location)


def make_empty(name, location, display="PLAIN_AXES", size=0.01, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = display
    e.empty_display_size = size
    e.location = location
    bpy.context.scene.collection.objects.link(e)
    if parent is not None:
        set_parent(e, parent)
    return e


def apply_modifiers(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), depsgraph=dg)
    old = obj.data
    obj.modifiers.clear()
    obj.data = mesh
    bpy.data.meshes.remove(old)
    mesh.name = obj.name


def smooth_by_angle(obj, degrees=35):
    me = obj.data
    me.shade_smooth()
    me.set_sharp_from_angle(angle=math.radians(degrees))


# --- Parts -------------------------------------------------------------------
def build_base(mats):
    bm = bmesh.new()
    hw, hd = BODY_HALF_W + BASE_OVERHANG, BODY_HALF_D + BASE_OVERHANG
    add_box(bm, (0, 0, BASE_H / 2), (2 * hw, 2 * hd, BASE_H))
    obj = make_object("Base", bm, [mats["Mat_Wood"]], origin=Vector((0, 0, 0)))
    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width, bev.segments = 0.004, 2
    apply_modifiers(obj)
    smooth_by_angle(obj)
    return obj


def build_body(mats):
    """Shell: side profile extruded across X, bevelled, with the typebar window cut in."""
    bm = bmesh.new()
    profile = [
        (-BODY_HALF_D, BASE_H),
        (BODY_HALF_D, BASE_H),
        (BODY_HALF_D, TOP_Z_BACK),
        (WALL_Y, TOP_Z_FRONT),
        (WALL_Y, DECK_Z),
        (-BODY_HALF_D, DECK_Z),
    ]
    verts = [bm.verts.new((-BODY_HALF_W, y, z)) for (y, z) in profile]
    face = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(2 * BODY_HALF_W, 0, 0), verts=moved)
    obj = make_object("Body", bm, [mats["Mat_Body"]], origin=Vector((0, 0, 0)))

    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width, bev.segments = 0.006, 2

    # Typebar window: a pocket in the sloped top, not a through-hole.
    cb = bmesh.new()
    add_box(cb, (0, -0.004, 0.095), (0.14, 0.036, 0.050))
    cutter = make_object("_cutter", cb, [], origin=Vector((0, 0, 0)))
    boolean = obj.modifiers.new("Window", "BOOLEAN")
    boolean.operation, boolean.object, boolean.solver = "DIFFERENCE", cutter, "EXACT"
    apply_modifiers(obj)
    bpy.data.objects.remove(cutter)
    smooth_by_angle(obj)
    return obj


def build_typebar_basket(mats):
    bm = bmesh.new()
    add_cylinder(bm, (0, -0.002, 0.070), 0.050, 0.016, radius2=0.032, segments=32)
    return make_object("TypebarBasket", bm, [mats["Mat_Metal"]])


def build_keys(mats):
    keys = []

    def make_key(name, bm, dark):
        mat = [mats["Mat_KeyDark"]] if dark else [mats["Mat_KeyCream"], mats["Mat_KeyDark"]]
        keys.append(make_object(f"Key_{name}", bm, mat))

    for r, row in enumerate(spec.KEY_ROWS):
        x0 = -(len(row) - 1) / 2 * KEY_PITCH + ROW_X_OFFSET[r]
        stem_h = KEY_STEM_H + ROW_STEM_EXTRA[r]
        for c, name in enumerate(row):
            dark = name in spec.DARK_KEYS
            x, y = x0 + c * KEY_PITCH, ROW_Y[r]
            bm = bmesh.new()
            add_cylinder(bm, (x, y, DECK_Z + stem_h / 2), KEY_STEM_R, stem_h, mat=0 if dark else 1, segments=12)
            add_cylinder(
                bm, (x, y, DECK_Z + stem_h + KEY_CAP_H / 2), KEY_CAP_R1, KEY_CAP_H, radius2=KEY_CAP_R2, mat=0
            )
            make_key(name, bm, dark)

    bm = bmesh.new()
    bar_y, bar_x, bar_len, bar_depth, bar_t = -0.1345, 0.005, 0.150, 0.014, 0.007
    for sx in (-0.05, 0.05):
        add_cylinder(bm, (bar_x + sx, bar_y, DECK_Z + KEY_STEM_H / 2), KEY_STEM_R, KEY_STEM_H, mat=1, segments=12)
    add_box(bm, (bar_x, bar_y, DECK_Z + KEY_STEM_H + bar_t / 2), (bar_len, bar_depth, bar_t), mat=0)
    make_key(spec.SPACE_KEY, bm, False)
    return keys


def build_carriage(mats):
    cx, cy, cz = CARRIAGE_REST_X, PLATEN_Y, PLATEN_Z
    carriage = make_empty("Carriage", (cx, cy, cz), display="ARROWS", size=0.02)

    bm = bmesh.new()
    add_cylinder(bm, (cx, cy, cz), PLATEN_R, PLATEN_LEN, axis="X", segments=32)
    make_object("Platen", bm, [mats["Mat_Platen"]], parent=carriage)

    for name, sign in (("Knob_L", -1), ("Knob_R", 1)):
        bm = bmesh.new()
        x = cx + sign * (PLATEN_LEN / 2 + KNOB_LEN / 2)
        add_cylinder(bm, (x, cy, cz), KNOB_R, KNOB_LEN, axis="X", segments=24)
        make_object(name, bm, [mats["Mat_Body"]], parent=carriage)

    # Paper bail rod and the two end brackets that hold the platen.
    bm = bmesh.new()
    add_cylinder(bm, (cx, cy - 0.034, cz + 0.012), 0.0018, PLATEN_LEN - 0.020, axis="X", segments=8)
    for sign in (-1, 1):
        add_box(bm, (cx + sign * (PLATEN_LEN / 2 - 0.0025), cy - 0.010, cz + 0.005), (0.005, 0.075, 0.050))
    make_object("PaperHolder", bm, [mats["Mat_Metal"]], origin=Vector((cx, cy, cz)), parent=carriage)

    # Paper: A4 plane leaning back in front of the platen, UVs 0..1 (v up).
    anchor_y, anchor_z = PAPER_ANCHOR
    up = Vector((0.0, math.sin(PAPER_TILT), math.cos(PAPER_TILT)))
    s_bottom = (PAPER_BOTTOM_Z - anchor_z) / math.cos(PAPER_TILT)
    base = Vector((0.0, anchor_y, anchor_z))
    bl_pt = base + up * s_bottom
    tl_pt = bl_pt + up * spec.PAPER_HEIGHT
    half_w = spec.PAPER_WIDTH / 2
    bm = bmesh.new()
    corners = [
        (Vector((cx - half_w, bl_pt.y, bl_pt.z)), (0, 0)),
        (Vector((cx + half_w, bl_pt.y, bl_pt.z)), (1, 0)),
        (Vector((cx + half_w, tl_pt.y, tl_pt.z)), (1, 1)),
        (Vector((cx - half_w, tl_pt.y, tl_pt.z)), (0, 1)),
    ]
    # Subdivided along its height so code can bend it around the platen (SPEC section 5).
    # Still flat; two columns are enough because the bend only runs along the height.
    rows = spec.PAPER_HEIGHT_SEGMENTS
    (bl, _), (br, _), (_, _), (tl, _) = corners
    along = tl - bl
    grid = [
        [bm.verts.new(bl + along * (j / rows)), bm.verts.new(br + along * (j / rows))] for j in range(rows + 1)
    ]
    uv_layer = bm.loops.layers.uv.new("UVMap")
    for j in range(rows):
        face = bm.faces.new((grid[j][0], grid[j][1], grid[j + 1][1], grid[j + 1][0]))
        for loop in face.loops:
            u = 0.0 if loop.vert in (grid[j][0], grid[j + 1][0]) else 1.0
            v = j / rows if loop.vert in (grid[j][0], grid[j][1]) else (j + 1) / rows
            loop[uv_layer].uv = (u, v)
    make_object("Paper", bm, [mats["Mat_Paper"]], parent=carriage)
    return carriage


def build_lever(mats):
    """Hinge at the top of the carriage's left end. Arm points left and up. Parented to
    the Carriage by the caller."""
    hinge = Vector((CARRIAGE_REST_X - PLATEN_LEN / 2 + 0.010, PLATEN_Y, PLATEN_Z + 0.028))
    bm = bmesh.new()
    add_cylinder(bm, (0, 0, 0), 0.004, 0.010, axis="Y", segments=12, mat=0)
    add_box(bm, (-0.0535, 0, 0), (0.113, 0.005, 0.005), mat=0)  # arm, x from +0.003 to -0.110
    add_box(bm, (-0.090, 0, 0), (0.040, 0.012, 0.007), mat=1)  # wooden grip
    bmesh.ops.transform(bm, matrix=Matrix.Rotation(math.radians(25), 4, "Y"), verts=bm.verts)
    return make_object("Lever", bm, [mats["Mat_Metal"], mats["Mat_Wood"]], origin=Vector((0, 0, 0))), hinge


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), "typewriter-blockout.blend")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    mats = make_materials()
    base = build_base(mats)  # noqa: F841
    body = build_body(mats)
    build_typebar_basket(mats)
    build_keys(mats)
    carriage = build_carriage(mats)
    lever, hinge = build_lever(mats)
    lever.location = hinge
    set_parent(lever, carriage)  # the lever slides with the carriage
    make_empty("StrikePoint", STRIKE, display="SPHERE", size=0.004, parent=body)

    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    print(f"saved {out}")

    import contract_check

    errors, warnings, tris = contract_check.run_check()
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"contract check: {len(errors)} error(s), {len(warnings)} warning(s), {tris} triangles")


if __name__ == "__main__":
    main()
