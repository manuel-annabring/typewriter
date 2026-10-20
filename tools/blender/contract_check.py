"""Contract check for the typewriter model (SPEC.md section 5).

Run on any .blend, headless:

    /Applications/Blender.app/Contents/MacOS/Blender -b path/to/file.blend \\
        --python tools/blender/contract_check.py

Exits with code 1 if any error is found. Warnings do not fail the check.
export_glb.py runs this first and refuses to export on errors.
"""

import os
import re
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract_spec as spec  # noqa: E402

TOL = 1e-4  # transforms
ORIGIN_TOL = 0.001  # key origin vs. bbox center (1 mm)
PIVOT_TOL = 0.006  # lever hinge vs. nearest vertex, carriage vs. platen center


def _local_bbox(obj):
    vs = [v.co for v in obj.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi


def _world_bbox_center(obj):
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return (lo + hi) / 2


def run_check():
    errors, warnings = [], []
    scene = bpy.context.scene
    objs = {o.name: o for o in scene.objects if o.type in {"MESH", "EMPTY"}}

    # 1. Names: present, no Blender duplicate suffixes, nothing unexpected.
    for name in spec.REQUIRED_NAMES:
        if name not in objs:
            errors.append(f"missing object: {name}")
    for name in objs:
        if re.search(r"\.\d{3}$", name):
            errors.append(f"duplicate-suffix name (rename it): {name}")
        elif name not in spec.REQUIRED_NAMES:
            warnings.append(f"object not in contract (will be exported): {name}")

    # 2. Units and transforms: meters, scale and rotation applied everywhere.
    if abs(scene.unit_settings.scale_length - 1.0) > 1e-6:
        errors.append(f"unit scale is {scene.unit_settings.scale_length}, expected 1.0 (meters)")
    for name, o in objs.items():
        m3 = o.matrix_basis.to_3x3()
        deviation = max(abs(m3[i][j] - (1.0 if i == j else 0.0)) for i in range(3) for j in range(3))
        if deviation > TOL:
            errors.append(f"{name}: scale/rotation not applied (Ctrl+A in Blender)")

    # 3. Hierarchy.
    carriage = objs.get("Carriage")
    if carriage is not None:
        if carriage.type != "EMPTY":
            errors.append("Carriage should be an Empty (group)")
        if carriage.parent is not None:
            errors.append("Carriage must be top-level")
        for child in spec.CARRIAGE_CHILDREN:
            o = objs.get(child)
            if o is not None and o.parent is not carriage:
                errors.append(f"{child} must be a child of Carriage")
    for name, o in objs.items():
        if name.startswith("Key_") and o.parent is carriage and carriage is not None:
            errors.append(f"{name} must not be under Carriage")
    for name in ("Lever", "Body", "Base"):
        o = objs.get(name)
        if o is not None and o.parent is carriage and carriage is not None:
            errors.append(f"{name} must not be under Carriage")
    strike, body = objs.get("StrikePoint"), objs.get("Body")
    if strike is not None and body is not None and strike.parent is not body:
        errors.append("StrikePoint must be a child of Body (fixed relative to Body)")
    if strike is not None and strike.type != "EMPTY":
        errors.append("StrikePoint should be an Empty")

    # 4. Origins.
    for name in spec.KEY_NAMES:
        o = objs.get(name)
        if o is None or o.type != "MESH":
            if o is not None:
                errors.append(f"{name} must be a mesh")
            continue
        lo, hi = _local_bbox(o)
        if ((lo + hi) / 2).length > ORIGIN_TOL:
            errors.append(f"{name}: origin not at the key center")
    lever = objs.get("Lever")
    if lever is not None and lever.type == "MESH":
        lo, hi = _local_bbox(lever)
        nearest = min(v.co.length for v in lever.data.vertices)
        if nearest > PIVOT_TOL or ((lo + hi) / 2).length < 0.02:
            errors.append("Lever: origin must be at the hinge (end of the arm), not the center")
    platen = objs.get("Platen")
    if carriage is not None and platen is not None and platen.type == "MESH":
        d = _world_bbox_center(platen) - carriage.matrix_world.translation
        if d.length > PIVOT_TOL:
            errors.append("Carriage origin must sit on the platen axis at the carriage rest position")
    for name in ("Body", "Base"):
        o = objs.get(name)
        if o is not None and o.matrix_world.translation.length > 0.005:
            warnings.append(f"{name}: origin is not at the machine center on the ground")
    meshes = [o for o in objs.values() if o.type == "MESH" and o.data.vertices]
    if meshes:
        floor = min((o.matrix_world @ v.co).z for o in meshes for v in o.data.vertices)
        if abs(floor) > 0.001:
            warnings.append(f"lowest point is at z={floor:.4f} m, expected 0 (machine sits on the ground)")

    # 5. Materials: only the contract names, all present.
    used = {s.material.name for o in meshes for s in o.material_slots if s.material}
    for name in used - set(spec.MATERIALS):
        errors.append(f"material not in contract: {name}")
    for name in set(spec.MATERIALS) - used:
        errors.append(f"material not used by any object: {name}")
    for o in meshes:
        if not any(s.material for s in o.material_slots):
            errors.append(f"{o.name}: no material")

    # 6. Paper: UVs fill 0 to 1 and the physical size is A4.
    paper = objs.get("Paper")
    if paper is not None and paper.type == "MESH":
        uv_layer = paper.data.uv_layers.active
        if uv_layer is None:
            errors.append("Paper has no UV map")
        else:
            uvs = [uv_layer.data[l.index].uv for l in paper.data.loops]
            us, vs = [uv.x for uv in uvs], [uv.y for uv in uvs]
            if min(us) > 1e-4 or max(us) < 1 - 1e-4 or min(vs) > 1e-4 or max(vs) < 1 - 1e-4:
                errors.append("Paper UVs must fill 0 to 1")
            else:

                def corner_pos(u, v):
                    for l in paper.data.loops:
                        uv = uv_layer.data[l.index].uv
                        if abs(uv.x - u) < 1e-4 and abs(uv.y - v) < 1e-4:
                            return paper.matrix_world @ paper.data.vertices[l.vertex_index].co
                    return None

                c00, c10, c01 = corner_pos(0, 0), corner_pos(1, 0), corner_pos(0, 1)
                if c00 is None or c10 is None or c01 is None:
                    errors.append("Paper UVs need corners at (0,0), (1,0) and (0,1)")
                else:
                    w, h = (c10 - c00).length, (c01 - c00).length
                    if abs(w - spec.PAPER_WIDTH) > 0.002 or abs(h - spec.PAPER_HEIGHT) > 0.002:
                        errors.append(
                            f"Paper is {w*1000:.0f} x {h*1000:.0f} mm, expected "
                            f"{spec.PAPER_WIDTH*1000:.0f} x {spec.PAPER_HEIGHT*1000:.0f} mm (A4)"
                        )

    # 7. Budget and leftover modifiers.
    tris = 0
    for o in meshes:
        if o.modifiers:
            warnings.append(f"{o.name}: has modifiers (applied at export, apply them before sharing)")
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    if tris > spec.TRIANGLE_BUDGET:
        errors.append(f"triangle count {tris} is over the budget of {spec.TRIANGLE_BUDGET}")

    return errors, warnings, tris


def main():
    errors, warnings, tris = run_check()
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"contract check: {len(errors)} error(s), {len(warnings)} warning(s), {tris} triangles")
    if errors:
        sys.exit(1)
    print("contract check: PASS")


if __name__ == "__main__":
    main()
