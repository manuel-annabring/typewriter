"""Step 03 (slice 6e): Mat_Body metalness variants.

Mat_Body is the painted-metal shell. It is also used by Knob_L and Knob_R, so they change with it.
Pick a variant below and run: A = partial metalness (satin metal), B = clearcoat on a plain
painted base, C = both. The values are absolute (the original base colour is stored here), so
re-running with another variant never compounds. Does not save the file.

Run live (exec the file in the MCP session) or headless (`Blender -b typewriter.blend --python ...`).
"""

import bpy

# --- parameters -------------------------------------------------------------------------
VARIANT = "A"

# The base colour as first painted in Blender (linear RGB); variants scale it with `lift`
# because metalness removes diffuse light and the shell would otherwise darken.
ORIGINAL_BASE = (0.159, 0.1651, 0.1301)

VARIANTS = {
    # name: metallic, roughness, base colour lift, coat weight, coat roughness
    "A": dict(metallic=0.35, roughness=0.45, lift=1.25, coat=0.0, coat_roughness=0.03),
    "B": dict(metallic=0.0, roughness=0.6, lift=1.0, coat=1.0, coat_roughness=0.1),
    "C": dict(metallic=0.3, roughness=0.5, lift=1.15, coat=0.5, coat_roughness=0.1),
}


def apply(variant):
    v = VARIANTS[variant]
    bsdf = next(n for n in bpy.data.materials["Mat_Body"].node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*(min(c * v["lift"], 1.0) for c in ORIGINAL_BASE), 1.0)
    bsdf.inputs["Metallic"].default_value = v["metallic"]
    bsdf.inputs["Roughness"].default_value = v["roughness"]
    bsdf.inputs["Coat Weight"].default_value = v["coat"]
    bsdf.inputs["Coat Roughness"].default_value = v["coat_roughness"]
    return dict(
        variant=variant,
        base=[round(c, 4) for c in bsdf.inputs["Base Color"].default_value[:3]],
        metallic=bsdf.inputs["Metallic"].default_value,
        roughness=bsdf.inputs["Roughness"].default_value,
        coat=bsdf.inputs["Coat Weight"].default_value,
        used_by=[o.name for o in bpy.data.objects if any(s.material and s.material.name == "Mat_Body" for s in o.material_slots)],
    )


result = apply(VARIANT)
