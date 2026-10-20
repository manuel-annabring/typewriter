"""Renders quick Workbench previews of a .blend (never saves the .blend).

    /Applications/Blender.app/Contents/MacOS/Blender -b path/to/file.blend \\
        --python tools/blender/render_preview.py -- <output_dir>

Writes iso_left.png, iso_right.png, front.png, side.png and top.png.
"""

import os
import sys

import bpy
from mathutils import Vector

VIEWS = {
    # name: (camera position, ortho scale or None for perspective)
    "iso_left": ((-0.36, -0.52, 0.36), None),
    "iso_right": ((0.62, -0.52, 0.42), None),
    "front": ((0.085, -2.0, 0.17), 0.62),
    "side": ((-2.0, 0.045, 0.17), 0.62),
    "top": ((0.085, -0.01, 2.0), 0.62),
}
TARGET = Vector((0.06, 0.03, 0.14))


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_dir = argv[0] if argv else "."
    os.makedirs(out_dir, exist_ok=True)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = 1200, 800
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    world = bpy.data.worlds.new("preview")
    world.color = (0.82, 0.80, 0.76)
    scene.world = world

    cam_data = bpy.data.cameras.new("preview_cam")
    cam = bpy.data.objects.new("preview_cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    for name, (pos, ortho) in VIEWS.items():
        cam.location = Vector(pos)
        if name == "top":
            target = Vector((0.085, 0.03, 0.0))
        elif ortho:
            target = Vector((0.085, 0.045, 0.17))
        else:
            target = TARGET
        direction = target - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        cam_data.type = "ORTHO" if ortho else "PERSP"
        if ortho:
            cam_data.ortho_scale = ortho
        else:
            cam_data.lens = 50
        scene.render.filepath = os.path.join(out_dir, f"{name}.png")
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
