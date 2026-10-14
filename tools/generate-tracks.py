"""Export provisionally mapped tracks as lightweight glTF meshes (no Blender runtime required).
Usage: python generate_tracks.py <maps-directory> <output-directory>
Blender sources are created separately by blender/CONVERTER_CIRCUITOS.py.
All track coordinates are derived from the game's circuitGeometry() map, not surveyed GIS.
"""
import sys,json,math,hashlib
from pathlib import Path
import numpy as np, trimesh
maps=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
W=1.36*1.15  # half width, game used 1.36
PAL={'road':[53,62,69,255],'white':[224,226,212,255],'red':[206,57,65,255], 'pit':[55,61,68,255], 'wall':[164,173,178,255], 'accent':[53,101,123,255], 'finish':[237,240,240,255], 'stand':[90,110,124,255], 'roof':[41,59,72,255]}
def mesher(scene,name,verts,faces,color):
  vertices=np.asarray(verts,dtype=float);faces=np.asarray(faces,dtype=np.int64)
  if len(vertices)==0 or len(faces)==0:return
  mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=False)
  mesh.visual.vertex_colors=np.tile(np.asarray(color,dtype=np.uint8),(len(vertices),1))
  scene.add_geometry(mesh,geom_name=name,node_name=name)
def strip(scene,points,halfwidth,height,color,name,closed=True,step=1):
  pts=np.asarray(points,dtype=float)[::step];count=len(pts)
  if count<2:return
  tang=np.roll(pts,-1,axis=0)-np.roll(pts,1,axis=0) if closed else np.vstack([pts[1]-pts[0],pts[2:]-pts[:-2],pts[-1]-pts[-2]])
  length=np.linalg.norm(tang,axis=1);tang=tang/np.maximum(length[:,None],1e-9)
  normal=np.column_stack([-tang[:,1],tang[:,0]])
  l=pts+normal*halfwidth;r=pts-normal*halfwidth
  verts=np.column_stack([np.vstack([l,r]),np.full((count*2,),height)])[:,[0,2,1]]
  faces=[]
  for i in range(count if closed else count-1):
    j=(i+1)%count
    faces.extend([[i,j,count+i],[j,count+j,count+i]])
  mesher(scene,name,verts,faces,PAL[color]);return pts,normal

def cube(scene,name,center,size,color,yaw=0):
  geom=trimesh.creation.box(extents=size)
  ca,sa=math.cos(yaw),math.sin(yaw)
  # Y-up Blender-GLB coordinates
  rot=np.array([[ca,0,sa,0],[0,1,0,0],[-sa,0,ca,0],[0,0,1,0]],dtype=float)
  rot[:3,3]=center
  geom.apply_transform(rot);geom.visual.vertex_colors=np.tile(PAL[color],(len(geom.vertices),1));scene.add_geometry(geom,geom_name=name,node_name=name)
allmetadata=[]
for f in sorted(maps.glob('gp-*.json'),key=lambda p:int(p.stem.split('-')[-1])):
 info=json.loads(f.read_text());points=np.asarray(info['points'],dtype=float);pit=np.asarray(info['pitLane'],dtype=float)
 # geometryStatus from game's generator is provisional. No claim of geographical accuracy.
 scene=trimesh.Scene()
 rr=strip(scene,points,W,.095,'road','asphalt',True,step=3)
 pp=strip(scene,pit,.46,.10,'pit','pit_lane',False,step=1)
 # Independent curb stripes every fourth sample. Widening is only a visual mesh decision.
 pts,n=rr;total=len(pts)
 for i in range(0,total,4):
  j=(i+3)%total
  if j<=i and j!=0:continue
  a=pts[i];b=pts[j];d=b-a;ln=np.linalg.norm(d)
  if ln<.02:continue
  for side in [-1,1]:
   na=n[i]*side;nb=n[j]*side
   edge=np.vstack([a+na*(W-.10),a+na*(W+.25),b+nb*(W-.10),b+nb*(W+.25)])
   vert=np.column_stack([edge[:,0],np.full((4,),.112),edge[:,1]])
   mesher(scene,f'curb_{i}_{side}',vert,[[0,1,2],[1,3,2]],PAL['red' if i//4%2 else 'white'])
 # bar/crossing for start line
 p=points[0];q=points[3];dt=q-p;dt/=max(np.linalg.norm(dt),1e-6);normal=np.array([-dt[1],dt[0]])
 for k in range(14):
  across=(k-6.5)*(W*2/14)
  center=p+normal*across
  cube(scene,'start_finish_'+str(k),[center[0],.12,center[1]], [W*2/14,.015,.35],'finish' if k%2 else 'roof',yaw=math.atan2(dt[0],dt[1]))
 # Safety barriers in short representative segments to reduce draw calls/mobile load.
 # Use 24 paired sections (decorative, not collision geometry).
 for i in range(0,total,max(1,total//24)):
  v=pts[i];t=pts[(i+1)%total]-pts[(i-1)%total];t=t/max(np.linalg.norm(t),1e-6)
  nn=np.array([-t[1],t[0]])
  yaw=math.atan2(t[0],t[1]);
  for side in (-1,1):
   p=v+nn*side*(W+1.55)
   cube(scene,f'barrier_{i}_{side}',[p[0],.55,p[1]],[.24,1.1,2.8],'wall',yaw=yaw)
 # Pit garages placed relative to actual mapped pit lane; no fictitious fixed global coordinate.
 j=len(pit)//2;mid=pit[j];t=pit[j+1]-pit[j-1];t=t/max(np.linalg.norm(t),1e-6);nn=np.array([-t[1],t[0]]);yaw=math.atan2(t[0],t[1]);
 for k in range(6):
  base=mid+t*(k-2.5)*4.9+nn*4.0
  cube(scene,f'pit_building_{k}',[base[0],1.25,base[1]],[4.0,2.4,4.8],'stand',yaw=yaw)
  cube(scene,f'pit_roof_{k}',[base[0],2.55,base[1]],[4.3,.18,5.2],'roof',yaw=yaw)
 # A few stands on the outside of the actual map without inventing an actual city layout.
 for k in range(6):
  i=int((k+.3)/6*total)%total;v=pts[i];t=pts[(i+1)%total]-pts[(i-1)%total];t=t/max(np.linalg.norm(t),1e-6);nn=np.array([-t[1],t[0]]);q=v+nn*(W+5.5);yaw=math.atan2(t[0],t[1]);
  cube(scene,f'grandstand_{k}',[q[0],1.1,q[1]],[4.8,2.1,6.5],'stand',yaw)
  cube(scene,f'grandstand_roof_{k}',[q[0],2.3,q[1]],[5.1,.16,6.8],'roof',yaw)
 name=f.stem+'.glb';blob=scene.export(file_type='glb');(out/name).write_bytes(blob)
 allmetadata.append({'id':info['id'],'name':info['name'],'sourceStatus':'provisional','roadVisualFactor':1.15,'glb':name,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()})
print('GENERATED',len(allmetadata),'TOTAL_BYTES',sum(m['bytes'] for m in allmetadata));(out/'manifest.json').write_text(json.dumps(allmetadata,indent=2,ensure_ascii=False))
