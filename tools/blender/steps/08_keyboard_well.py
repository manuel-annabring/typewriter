"""Step 08 (slice 6c, keyboard cavity): lower the keyboard well floor and give the well a dark interior.

In the concept sheet the shell looks cut open around the keyboard and you see a dark floor. The
Body's well (floor, a two-segment foot bevel, cheek walls, front lip wall, hump front wall) was
all Mat_Body. This step does two things to the Body mesh, which stays one closed mesh with no
modifiers:

1. Moves the floor and its two foot-bevel rings down to FLOOR_Z. The walls above stretch with
   them. The Body's bottom face is at world z 13.0 (local 12.0 plus the object's +1 mm
   location, a reveal gap above the Base top at z 12), so the floor needs a slab above that.
2. Assigns the new material Mat_Interior (slot 1, replacing the unused Mat_Wood slot) to the
   floor, the bevel rings and every vertical wall face connected to them. The wall faces run up
   to their top edges, where the sage top bevels (Mat_Body) start, so the edge reads as a cut.

The well faces are found by flood fill from the floor face (the largest upward-facing polygon
below z 30), not by coordinates, so the step is re-runnable: a second run finds the floor at
FLOOR_Z, moves nothing and re-assigns the same faces. Keys keep their stems (steps/07 puts the
foot at FLOOR_Z - STEM_EMBED = 13.5 mm, inside the floor slab), so no key changes.

Run live (exec the file in the MCP session) or headless (`Blender -b typewriter.blend --python ...`).
Does not save the file. World coordinates in mm unless named otherwise, Blender frame.
"""

import bmesh
import bpy

# --- parameters (mm) ------------------------------------------------------------------------
FLOOR_Z = 14.5  # new floor height (world); the Body bottom is at 13.0, so this leaves a 1.5 mm slab
FOOT_RISE = 2.1  # the foot bevel rings reach about 2 mm above the floor; anything lower counts as ring
WALL_NZ = 0.02  # a face is a wall when |normal.z| is below this
FLOOR_SEARCH_Z = 30.0  # the floor is the largest upward-facing polygon below this height

# Mat_Interior: dark, matte (linear RGB). Darker than Mat_KeyDark, rougher than Mat_Platen.
INTERIOR_NAME = "Mat_Interior"
INTERIOR_COLOR = (0.014, 0.015, 0.014, 1.0)
INTERIOR_ROUGHNESS = 0.85
INTERIOR_SLOT = 1  # was Mat_Wood (unused on Body); the empty slot after it is dropped

MM = 0.001


def interior_material():
    mat = bpy.data.materials.get(INTERIOR_NAME) or bpy.data.materials.new(INTERIOR_NAME)
    if not mat.node_tree:
        mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = INTERIOR_COLOR
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = INTERIOR_ROUGHNESS
    mat.diffuse_color = INTERIOR_COLOR
    return mat


def well_faces(bm, mw):
    """The floor, the foot bevel rings and the connected vertical walls, found by flood fill."""
    rot = mw.to_3x3()
    ups = [f for f in bm.faces if (rot @ f.normal).z > 0.99 and (mw @ f.calc_center_median()).z * 1000 < FLOOR_SEARCH_Z]
    floor = max(ups, key=lambda f: f.calc_area())
    floor_z = (mw @ floor.calc_center_median()).z * 1000
    dark, queue = {floor}, [floor]
    while queue:
        f = queue.pop()
        for e in f.edges:
            for n in e.link_faces:
                if n in dark:
                    continue
                low = max((mw @ v.co).z for v in n.verts) * 1000 <= floor_z + FOOT_RISE
                wall = abs((rot @ n.normal).z) < WALL_NZ
                if low or wall:
                    dark.add(n)
                    queue.append(n)
    return floor, floor_z, dark


def build_keyboard_well():
    if bpy.context.mode != "OBJECT":
        raise RuntimeError("Switch to Object Mode first")
    body = bpy.data.objects["Body"]
    if body.modifiers:
        raise RuntimeError("Body must have no modifiers")
    mesh = body.data
    mw = body.matrix_world
    bm = bmesh.new()
    bm.from_mesh(mesh)

    floor, floor_z, dark = well_faces(bm, mw)
    drop = floor_z - FLOOR_Z

    # Move the floor and the foot rings: the dark faces' vertices at or below the ring top.
    moved = {v for f in dark for v in f.verts if (mw @ v.co).z * 1000 <= floor_z + FOOT_RISE}
    for v in moved:
        v.co.z -= drop * MM  # Body has no rotation or scale, so a world drop is a local drop

    # Material slots: Mat_Body, Mat_Interior, nothing else.
    mat = interior_material()
    while len(mesh.materials) <= INTERIOR_SLOT:
        mesh.materials.append(None)
    mesh.materials[INTERIOR_SLOT] = mat
    for i in range(len(mesh.materials) - 1, INTERIOR_SLOT, -1):
        mesh.materials.pop(index=i)
    for f in bm.faces:
        f.material_index = INTERIOR_SLOT if f in dark else 0

    boundary = sum(1 for e in bm.edges if e.is_boundary)
    nonmanifold = sum(1 for e in bm.edges if not e.is_manifold)
    xs, ys, zs = zip(*((mw @ v.co) * 1000 for f in dark for v in f.verts))
    report = dict(
        floor_was=round(floor_z, 2), floor_now=FLOOR_Z, moved_verts=len(moved), dark_faces=len(dark),
        total_faces=len(bm.faces), verts=len(bm.verts), boundary_edges=boundary, nonmanifold_edges=nonmanifold,
        dark_bbox=dict(x=[round(min(xs), 1), round(max(xs), 1)], y=[round(min(ys), 1), round(max(ys), 1)],
                       z=[round(min(zs), 1), round(max(zs), 1)]),
    )
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    report["slots"] = [m.name if m else None for m in mesh.materials]
    return report


if __name__ == "__main__":
    print(build_keyboard_well())
