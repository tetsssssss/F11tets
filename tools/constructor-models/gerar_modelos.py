#!/usr/bin/env python3
"""F1 Universe 2029: gera 16 monopostos originais glTF/GLB para Babylon.js.
Requer: python -m pip install trimesh numpy pillow
Coordenadas: eixo Y vertical, frente do carro +Z, escala aproximadamente em metros.
Os GLBs podem ser editados no Blender (File > Import > glTF 2.0).
"""
from __future__ import annotations
import json, math, re, zipfile, hashlib
from pathlib import Path
import numpy as np
import trimesh as tm
from PIL import Image, ImageDraw, ImageFont

BASE=Path(__file__).resolve().parent
INPUT=BASE/'FONTE_ANTERIOR_OPCIONAL.zip'  # usa equipes_2029.json por padrão
DATA=BASE/'equipes_2029.json'

def teams_from_zip():
    if not INPUT.exists(): return json.loads(DATA.read_text('utf-8'))
    with zipfile.ZipFile(INPUT) as z:
        src=next(n for n in z.namelist() if n.endswith('src/data/teams.ts'))
        text=z.read(src).decode('utf-8')
    pattern=r"\[\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'(#[A-Fa-f0-9]{6})'\s*,\s*'(#[A-Fa-f0-9]{6})'"
    result=[{'id':id,'name':name,'short':short,'color':color,'secondary':secondary} for id,name,short,color,secondary in re.findall(pattern,text)]
    if len(result)!=16: raise ValueError(f'Se esperavam 16 construtoras; extraídas {len(result)}')
    DATA.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result

def hexrgb(h): return [int(h[i:i+2],16) for i in (1,3,5)]
def darken(h,factor):return '#'+''.join(f'{int(v*factor):02x}' for v in hexrgb(h))

def loft(sections,steps=14):
    """Sections: (z,x_center,y_center,x_radius,y_radius), smooth nose/body mesh."""
    verts=[]
    for z,cx,cy,rx,ry in sections:
        for j in range(steps):
            a=j*2*math.pi/steps
            verts.append([cx+rx*math.cos(a), cy+ry*math.sin(a), z])
    faces=[]
    for i in range(len(sections)-1):
        for j in range(steps):
            a=i*steps+j;b=i*steps+(j+1)%steps;c=(i+1)*steps+j;d=(i+1)*steps+(j+1)%steps
            faces.extend([[a,b,d],[a,d,c]])
    for j in range(1,steps-1):faces.append([0,j+1,j]);faces.append([(len(sections)-1)*steps, (len(sections)-1)*steps+j,(len(sections)-1)*steps+j+1])
    return tm.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=False)

def panel(coords,thickness=.034):
    coords=np.array(coords,dtype=float)
    # Extrude a convex planar mesh between two slightly offset Y layers
    n=len(coords);verts=np.vstack((coords+np.array([0,-thickness/2,0]),coords+np.array([0,thickness/2,0])))
    faces=[]
    for i in range(1,n-1):faces.append([0,i+1,i]);faces.append([n,n+i,n+i+1])
    for i in range(n):a=i;b=(i+1)%n;faces.extend([[a,b,b+n],[a,b+n,a+n]])
    return tm.Trimesh(vertices=verts,faces=faces,process=False)

def box(w,h,l,x,y,z):
    m=tm.creation.box(extents=[w,h,l]);m.apply_translation([x,y,z]);return m

def rod(a,b,r=.025,steps=10):
    a=np.asarray(a,dtype=float);b=np.asarray(b,dtype=float);vec=b-a
    mesh=tm.creation.cylinder(radius=r,height=float(np.linalg.norm(vec)),sections=steps)
    mesh.apply_transform(tm.geometry.align_vectors([0,0,1],vec))
    mesh.apply_translation((a+b)/2)
    return mesh

def tire(cx,cy,cz,width,diam,steps=24):
    # Curved slick tyre sidewall, cylindrical profile with bevelled shoulders
    xprofile=[(-.5,.77),(-.43,.94),(-.32,1.0),(.32,1.0),(.43,.94),(.5,.77)]
    verts=[]
    for xx,rr in xprofile:
        for j in range(steps):
            a=j*math.pi*2/steps
            verts.append([cx+xx*width,cy+math.sin(a)*diam*.5*rr,cz+math.cos(a)*diam*.5*rr])
    faces=[]
    for k in range(len(xprofile)-1):
        for j in range(steps):
            v=k*steps+j;vn=k*steps+(j+1)%steps;w=(k+1)*steps+j;wn=(k+1)*steps+(j+1)%steps
            faces.extend([[v,wn,vn],[v,w,wn]])
    for j in range(1,steps-1):faces.append([0,j,j+1]);off=(len(xprofile)-1)*steps;faces.append([off,off+j+1,off+j])
    return tm.Trimesh(vertices=verts,faces=faces,process=False)

def rim(cx,cy,cz,width,radius,steps=24):
    # rim surface with outer lip and dished inner profile
    sections=[(cx-.5*width,radius*.89),(cx-.5*width-.01,radius),(cx-.5*width-.035,radius*.79),
              (cx-.5*width-.04,radius*.50),(cx+.5*width+.04,radius*.50),(cx+.5*width+.035,radius*.79),
              (cx+.5*width+.01,radius),(cx+.5*width,radius*.89)]
    verts=[]
    for x,r in sections:
        for j in range(steps):
            a=j*math.pi*2/steps;verts.append([x,cy+r*math.sin(a),cz+r*math.cos(a)])
    faces=[]
    for k in range(len(sections)-1):
        for j in range(steps):
            a=k*steps+j;b=k*steps+(j+1)%steps;c=(k+1)*steps+j;d=(k+1)*steps+(j+1)%steps
            faces.extend([[a,b,d],[a,d,c]])
    for j in range(1,steps-1):faces.append([0,j+1,j]);off=(len(sections)-1)*steps;faces.append([off,off+j,off+j+1])
    return tm.Trimesh(vertices=verts,faces=faces,process=False)

def sphere(radius,x,y,z,subdivisions=1,scale=(1,1,1)):
    m=tm.creation.icosphere(subdivisions=subdivisions,radius=radius);m.apply_scale(scale);m.apply_translation([x,y,z]);return m

class Builder:
    def __init__(self,team,index,mobile):
        self.team=team;self.index=index;self.mobile=mobile
        self.groups={};self.meshes=0
        self.config={'nose':2.73+(index%4)*.045,'pod':.37+(index%3)*.025,'front_span':2.23+(index%5)*.04,'rear_span':1.48+(index%3)*.07}
        self.mats={
            'paint':team['color'],'accent':team['secondary'],'paint_dark':darken(team['color'],.48),
            'rubber':'#10141a','metal':'#a9b4bf','carbon':'#222c34',
            'visor':'#091923','helmet':'#f4f3ec','trim':'#d7c3a0','brake':'#494d50'}
    def add(self,mesh,material,name=None):
        if mesh is None:return
        key=(material,name or 'BODY')
        self.groups.setdefault(key,[]).append(mesh)
        self.meshes+=1
    def chassis(self):
        c=self.config;steps=9 if self.mobile else 18
        self.add(loft([
            (-1.85,0,.56,.12,.18),(-1.52,0,.57,.40,.27),(-.90,0,.64,.50,.31),
            (-.42,0,.66,.51,.33),(.22,0,.65,.42,.26),(.86,0,.54,.32,.18),
            (1.50,0,.44,.21,.135),(2.10,0,.36,.15,.095),(c['nose'],0,.32,.10,.07)],steps),'paint')
        # Engine hump, sculpted rather than cubic silhouette
        self.add(loft([(-1.70,0,.99,.20,.13),(-1.28,0,1.10,.27,.27),(-.76,0,1.12,.28,.23),(-.12,0,.98,.22,.12)],steps),'paint_dark')
        # Sidepods left/right, differentiated per constructor
        for s in (-1,1):
            x=s*(.52+c['pod']*.4)
            self.add(loft([(-1.52,x,.58,.13,.15),(-1.22,x,.63,c['pod'],.24),
                           (-.58,x,.64,c['pod']*1.08,.27),(.15,x,.66,c['pod']*.83,.21),
                           (.67,x,.61,.16,.13)],steps),'paint')
            # air intake black groove and secondary accent stripe
            self.add(box(.34,.055,.085,s*(.72+c['pod']*.2),.86,-.37),'carbon')
            self.add(box(.18,.035,1.12,s*(.70+c['pod']*.32),.88,-.53),'accent')
            # Sidepod floor canoe
            self.add(box(.55,.07,2.05,s*.76,.30,-.39),'carbon')
        # Monocoque overhang and sidepods details
        self.add(box(1.90,.055,3.10,0,.20,-.19),'carbon')
        self.add(box(.40,.06,1.20,0,.80,1.08),'accent')
        self.add(box(.20,.045,1.10,0,.43,1.97),'accent')
    def aerodynamics(self):
        c=self.config
        # Multi-element front wing, distinct multi-tier profiles
        for j,span in enumerate([c['front_span'],c['front_span']-.22,c['front_span']-.45]):
            y=.24+j*.09;z=2.48-j*.28
            self.add(panel([[-span/2,y,z-.16],[span/2,y,z-.16],[span/2,y+.035,z+.25],[-span/2,y+.035,z+.25]],.04),'accent' if j==1 else 'carbon')
            self.add(box(span,.025,.045,0,y+.08,z+.18),'paint')
        for s in (-1,1):
            span=c['front_span']*.5
            self.add(panel([[s*span,.23,2.20],[s*span,.23,2.90],[s*(span-.03),.57,2.79],[s*(span-.04),.57,2.28]],.035),'paint')
            self.add(rod([s*.42,.33,1.8],[s*.42,.25,2.57],.042),'carbon')
        # Rear wing supports and blades
        for s in (-1,1):
            self.add(rod([s*.27,.64,-1.37],[s*.27,1.43,-1.73],.045),'carbon')
            self.add(panel([[s*.75,1.02,-1.86],[s*.75,1.80,-1.86],[s*.75,1.80,-1.20],[s*.75,1.05,-1.24]],.06),'paint')
        self.add(box(c['rear_span'],.13,.28,0,1.64,-1.59),'accent')
        self.add(box(c['rear_span']*.88,.065,.23,0,1.45,-1.48),'carbon')
        self.add(box(1.50,.13,.15,0,.44,-1.88),'carbon')
        # Rear diffuser fins
        for xx in (-.46,-.23,0,.23,.46):
            self.add(box(.035,.20,.62,xx,.22,-1.67),'carbon')
    def cockpit(self):
        steps=10 if self.mobile else 16
        self.add(loft([(-.66,0,.94,.32,.125),(-.52,0,.95,.33,.18),(-.18,0,.95,.32,.17),(.25,0,.87,.23,.09)],steps),'carbon')
        self.add(sphere(.29,0,1.23,-.44,subdivisions=1 if self.mobile else 2,scale=(.84,1,.92)),'helmet')
        self.add(panel([[-.245,1.25,-.30],[.245,1.25,-.30],[.19,1.34,-.56],[-.19,1.34,-.56]],.017),'visor')
        # Halo ring around driver
        self.add(rod([-.34,1.03,-.67],[-.36,1.43,-.38],.056),'carbon')
        self.add(rod([.34,1.03,-.67],[.36,1.43,-.38],.056),'carbon')
        self.add(rod([-.36,1.43,-.38],[.36,1.43,-.38],.061),'carbon')
        self.add(rod([0,1.45,-.35],[0,1.04,.40],.053),'carbon')
        self.add(box(.11,.17,.13,0,1.24,-1.21),'accent') # camera pod
        for s in [-1,1]:
            self.add(rod([s*.46,.96,-.18],[s*.75,1.06,.18],.03),'carbon')
            self.add(box(.16,.065,.13,s*.77,1.09,.20),'accent')
    def suspension_wheels(self):
        wheel_steps=12 if self.mobile else 26
        for front,z in [(True,1.46),(False,-1.25)]:
            for s in (-1,1):
                # Wheel spinning components named, so Babylon can access and rotate
                width=.34 if front else .47
                cx=s*(1.10 if front else 1.06)
                cy=.51 if front else .55
                rad=.58 if front else .61
                name=('Front' if front else 'Rear')+('Left' if s<0 else 'Right')
                self.add(tire(cx,cy,z,width,rad*2,wheel_steps),'rubber',name+'Wheel')
                self.add(rim(cx,cy,z,width*.75,rad*.58,wheel_steps),'metal',name+'Rim')
                self.add(rim(cx,cy,z,width*.50,rad*.26,wheel_steps),'carbon',name+'Hub')
                self.add(rim(cx,cy,z,width*.25,rad*.08,12),'accent',name+'Lock')
                for k in [-1,1]:
                    zdelta=.25*k
                    self.add(rod([s*.37,.50,z+.07*k],[cx-s*.15,cy-.13,z+zdelta],.034 if self.mobile else .026),'carbon')
                    self.add(rod([s*.42,.70,z],[cx-s*.08,cy+.12,z+zdelta],.025),'metal')
                self.add(rod([s*.37,.47,z-.10],[cx,cy,z+.1],.045),'carbon')
    def assemble(self):
        self.chassis();self.aerodynamics();self.cockpit();self.suspension_wheels()
        scene=tm.Scene(); node_count=0
        for (material,name),parts in sorted(self.groups.items(),key=lambda x:(x[0][1],x[0][0])):
            if not parts:continue
            m=tm.util.concatenate(parts)
            rgba=(*hexrgb(self.mats[material]),255)
            rough={'paint':.34,'accent':.32,'rubber':.94,'metal':.28,'carbon':.69,'paint_dark':.50,'visor':.16,'helmet':.4,'trim':.43,'brake':.73}.get(material,.53)
            metallic=0.4 if material in ('paint','accent','metal') else .0
            mat=tm.visual.material.PBRMaterial(name=f'{self.team["short"]}_{material}',baseColorFactor=list(rgba),metallicFactor=metallic,roughnessFactor=rough,alphaMode='OPAQUE',doubleSided=True)
            m.visual=tm.visual.TextureVisuals(material=mat)
            # Wheel centres are real pivot origins, ready for rotation/steering in Babylon.
            pivot=np.eye(4)
            match=re.match(r'^(Front|Rear)(Left|Right)(Wheel|Rim|Hub|Lock)$',name)
            if match:
                front=match.group(1)=='Front';side=-1 if match.group(2)=='Left' else 1
                cx=side*(1.10 if front else 1.06);cy=.51 if front else .55;cz=1.46 if front else -1.25
                m.apply_translation([-cx,-cy,-cz]);pivot[:3,3]=[cx,cy,cz]
            scene.add_geometry(m,node_name=name+'_'+material,geom_name=f'{name}_{material}',transform=pivot,metadata={'teamId':self.team['id'],'part':name,'material':material})
            node_count+=1
        return scene,node_count

def preview_glb(glb_path,team,out_path,w=650,h=390):
    """Software preview, shaded triangle raster from actual GLB without Blender/WebGL."""
    scene=tm.load(glb_path,force='scene')
    image=Image.new('RGB',(w,h),(19,30,42));draw=ImageDraw.Draw(image)
    for j in range(0,h,22):draw.line((0,j,w,j),fill=(24,37,51),width=1)
    # world projection: car longitudinal axis from bottom-left to upper-right, y points upward
    fw=np.array([.89,-.48,.12]); fw=fw/np.linalg.norm(fw)
    right=np.array([-.18,.04,.98]);right=right/np.linalg.norm(right)
    # pseudo 3D camera projection
    def project(p):return np.array([w*.51+62*p[:,0]+62*p[:,2],h*.66+24*p[:,0]-36*p[:,2]-84*p[:,1]]).T
    polys=[]
    for node_name in scene.graph.nodes_geometry:
        mat=scene.geometry[scene.graph[node_name][1]]
        trans,_=scene.graph[node_name]
        verts=tm.transform_points(mat.vertices,trans)
        p=project(verts)
        color=np.array(mat.visual.material.baseColorFactor[:3],dtype=float)
        for f in mat.faces:
            p3=verts[f];normal=np.cross(p3[1]-p3[0],p3[2]-p3[0]); l=np.linalg.norm(normal)
            if l<1e-12:continue
            normal=normal/l
            shade=.59+.28*max(0,np.dot(normal,np.array([-.47,.77,.44])))
            clr=tuple(int(max(0,min(255,v*shade))) for v in color)
            poly=[tuple(float(n) for n in q) for q in p[f]]
            # Painter order using camera direction
            distance=np.dot(p3.mean(axis=0),np.array([.6,.45,.78]))
            polys.append((distance,poly,clr))
    for _,poly,color in sorted(polys,key=lambda q:q[0]):draw.polygon(poly,fill=color)
    d=ImageDraw.Draw(image);d.text((22,20),team['name'],fill=(235,241,246));d.text((22,h-34),f"F1 UNIVERSE 2029  /  {team['short']}  /  GLB",fill=(168,186,201))
    image.save(out_path)

def main():
    (BASE/'glb').mkdir(parents=True,exist_ok=True);(BASE/'preview').mkdir(parents=True,exist_ok=True)
    teams=teams_from_zip();report=[]
    for idx,t in enumerate(teams):
        row={'teamId':t['id'],'name':t['name'],'short':t['short'],'primaryColor':t['color'],'secondaryColor':t['secondary'],'models':{}}
        for mobile in (False,True):
            scene,nodes=Builder(t,idx,mobile).assemble()
            f=BASE/'glb'/f"{t['id']}_{'mobile' if mobile else 'high'}.glb"
            scene.export(file_obj=str(f),file_type='glb')
            # round-trip load and assert bounds
            reread=tm.load(f,force='scene')
            assert len(reread.geometry)>=10, (f,len(reread.geometry))
            assert np.all(np.isfinite(reread.bounds))
            row['models']['mobile' if mobile else 'high']={'file':'glb/'+f.name,'bytes':f.stat().st_size,'nodes':nodes,'meshes':len(reread.geometry),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
        try:preview_glb(BASE/'glb'/f"{t['id']}_high.glb",t,BASE/'preview'/f"{t['id']}.png")
        except Exception as ex:print('Preview err',t['id'],repr(ex))
        report.append(row)
        print(f"{idx+1:02d}/16 {t['name']}: high {row['models']['high']['bytes']/1024:.1f} KB, mobile {row['models']['mobile']['bytes']/1024:.1f} KB",flush=True)
    (BASE/'manifest.json').write_text(json.dumps({'version':'56000','source':'src/data/teams.ts, F1 Universe 2029 Marco 55000','units':'meters approx','upAxis':'Y','frontAxis':'+Z','teams':report},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    previews=[Image.open(BASE/'preview'/f'{t["id"]}.png').convert('RGB') for t in teams]
    cw,ch=540,350
    contact=Image.new('RGB',(cw*4,ch*4),(11,21,31))
    for i,im in enumerate(previews):contact.paste(im.resize((cw,ch)),((i%4)*cw,(i//4)*ch))
    contact.save(BASE/'CATALOGO_16_CONSTRUTORAS.png',optimize=True)
    print('OK 16 equipes, 32 GLBs, 16 prévias, manifest JSON')
if __name__=='__main__':main()
