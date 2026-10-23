"""Step 02 (slice 6d-2): UVs for the key label atlas (SPEC.md section 5, "Key label atlas").

Gives every Key_* object one UV layer. The top face (the highest upward-facing polygon) is
projected straight down into the key's atlas cell, inside the cell margin, upright for a viewer
in front of the machine (text up = +Y). Every other face collapses to the centre of the blank
cell, so cap sides, stems and a cream key's dark parts show the plain base colour.

Re-runnable: it replaces the UV layer on each run, so run it last after any reshaping of the keys.
Run live (exec the file in the MCP session) or headless (`Blender -b typewriter.blend --python ...`).
Does not save the file.
"""

import os
import sys

import bpy

# --- parameters -------------------------------------------------------------------------
UV_LAYER_NAME = "UVMap"
UP_NORMAL_Z = 0.9  # a polygon counts as "facing up" above this normal.z

_here = os.path.dirname(bpy.data.filepath)
if _here not in sys.path:
    sys.path.insert(0, _here)
import contract_spec as spec  # noqa: E402


def top_face(mesh):
    """The highest polygon facing up (the cap's label face), or None."""
    ups = [p for p in mesh.polygons if p.normal.z > UP_NORMAL_Z]
    return max(ups, key=lambda p: p.center.z) if ups else None


def uvs_for_key(obj):
    """Write the atlas UVs for one key. Returns a small report dict."""
    mesh = obj.data
    cell = spec.key_atlas_cell(obj.name)
    top = top_face(mesh)
    if cell is None or top is None:
        raise RuntimeError(f"{obj.name}: not a key or no top face (cell={cell})")

    # Replace any existing layer so a re-run starts clean.
    for layer in list(mesh.uv_layers):
        mesh.uv_layers.remove(layer)
    layer = mesh.uv_layers.new(name=UV_LAYER_NAME)

    # Top face: uniform scale from its larger extent, centred in the cell's inner rect.
    xs = [mesh.vertices[v].co.x for v in top.vertices]
    ys = [mesh.vertices[v].co.y for v in top.vertices]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    side = max(max(xs) - min(xs), max(ys) - min(ys))
    u0, v0, u1, v1 = spec.cell_rect_gltf(cell, inner=True)
    ucx, vcy = (u0 + u1) / 2, (v0 + v1) / 2
    scale = (u1 - u0) / side  # inner rect is square

    # Blank cell centre for everything else.
    bu0, bv0, bu1, bv1 = spec.cell_rect_gltf(spec.ATLAS_BLANK_CELL)
    blank = ((bu0 + bu1) / 2, 1.0 - (bv0 + bv1) / 2)

    for poly in mesh.polygons:
        for li in poly.loop_indices:
            if poly.index == top.index:
                co = mesh.vertices[mesh.loops[li].vertex_index].co
                u = ucx + (co.x - cx) * scale
                v_gltf = vcy - (co.y - cy) * scale  # glTF v runs down, +Y is "up" on the key
                layer.data[li].uv = (u, 1.0 - v_gltf)  # Blender v is 1 - v_gltf
            else:
                layer.data[li].uv = blank
    return dict(name=obj.name, cell=cell, top_verts=len(top.vertices), top_mat=top.material_index)


def run():
    if bpy.context.mode != "OBJECT":
        raise RuntimeError("Switch to Object Mode first")
    names = [n for n in spec.KEY_NAMES if n in bpy.data.objects]
    missing = [n for n in spec.KEY_NAMES if n not in bpy.data.objects]
    reports = [uvs_for_key(bpy.data.objects[n]) for n in names]
    return dict(done=len(reports), missing=missing, sample=reports[:3])


result = run()
