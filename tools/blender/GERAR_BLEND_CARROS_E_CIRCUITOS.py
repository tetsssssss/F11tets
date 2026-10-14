"""F1 Universe Marco 57000: convert the authored GLB files into editable .blend projects.

Requires Blender 4.x installed locally. From the extracted project root run:
    blender --background --python tools/blender/GERAR_BLEND_CARROS_E_CIRCUITOS.py

Generates 16 constructor .blend and 35 circuit .blend files in tools/blender/blend_output.
The model tracks are derived from the provisional procedural game maps, NOT official surveys.
"""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'public'/'assets'/'f1-3d'
OUTPUT=ROOT/'tools'/'blender'/'blend_output'
OUTPUT.mkdir(parents=True,exist_ok=True)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def project(name, group, glb):
    reset()
    bpy.ops.import_scene.gltf(filepath=str(glb))
    for obj in bpy.data.objects:
        obj['f1_universe_asset']=name
        obj['original_glb']=str(glb.relative_to(ROOT))
        obj['game_release']='Marco 57000'
        if group=='circuits':
            obj['source_geometry']='provisional circuitGeometry() map; visual width +15%'
    bpy.context.scene['project_name']=name
    bpy.context.scene['asset_group']=group
    bpy.context.scene['export_target']='Babylon.js glTF 2.0'
    path=OUTPUT/(name+'.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    print('BLEND SAVED',path)

for f in sorted((BASE/'cars').glob('*_high.glb')):
    project('car_'+f.stem.removesuffix('_high'),'cars',f)
for f in sorted((BASE/'tracks').glob('gp-*.glb')):
    project('circuit_'+f.stem,'circuits',f)
print('COMPLETE 16 cars + 35 circuits')
