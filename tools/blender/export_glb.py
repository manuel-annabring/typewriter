"""Runs the contract check, then exports the scene as glTF binary (+Y up).

    /Applications/Blender.app/Contents/MacOS/Blender -b path/to/file.blend \\
        --python tools/blender/export_glb.py -- [output.glb]

Default output: public/models/typewriter.glb. Refuses to export if the check has errors.
Size budget (SPEC.md section 5): GLB under about 5 MB.
"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import contract_check  # noqa: E402

SIZE_BUDGET_BYTES = 5 * 1024 * 1024


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else os.path.join(HERE, "..", "..", "public", "models", "typewriter.glb")
    out = os.path.abspath(out)

    errors, warnings, tris = contract_check.run_check()
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    if errors:
        print(f"contract check FAILED ({len(errors)} error(s)); not exporting")
        sys.exit(1)
    print(f"contract check: PASS ({tris} triangles)")

    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        use_selection=False,
    )
    size = os.path.getsize(out)
    print(f"exported {out} ({size / 1024:.0f} KB)")
    if size > SIZE_BUDGET_BYTES:
        print(f"WARN  GLB is over the {SIZE_BUDGET_BYTES // 1024 // 1024} MB budget")


if __name__ == "__main__":
    main()
