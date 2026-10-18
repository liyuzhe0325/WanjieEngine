"""Blender background runner:
blender --background --python experiments/hex-assembly-lod/blender_make_terrain_lods.py
Outputs terrain_lod1.glb and terrain_lod2.glb from terrain.glb.
Requires Blender installed locally; does not alter the original asset.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parent
MODEL_DIR = ROOT / "models"
SOURCE = MODEL_DIR / "terrain.glb"

if not SOURCE.is_file():
    raise FileNotFoundError(f"Missing source: {SOURCE}")


def export_variant(target_faces: int, filename: str):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("No mesh found in terrain.glb")

    source_faces = sum(len(obj.data.polygons) for obj in meshes)
    ratio = min(1.0, max(0.02, target_faces / max(source_faces, 1)))
    for obj in meshes:
        if ratio >= 0.99:
            continue
        modifier = obj.modifiers.new(name="Terrain_LOD_Decimate", type="DECIMATE")
        modifier.decimate_type = "COLLAPSE"
        modifier.ratio = ratio
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)

    dest = MODEL_DIR / filename
    bpy.ops.export_scene.gltf(
        filepath=str(dest),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
    )
    after = sum(len(obj.data.polygons) for obj in meshes)
    print(f"{filename}: {source_faces} -> {after} faces; {dest}")


export_variant(4500, "terrain_lod1.glb")
export_variant(1400, "terrain_lod2.glb")
print("LOD files produced. Please inspect UV seams, rocks, and material before game use.")
