import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {load,entries} from './data.js';
import {worldColours} from './world-colours.js';
import {corncobEgaPalette as palette,corncobModelColourValues as colourValues,corncobColourProfile as colourProfile} from './model-engine.js';
// Compact world records store heading, pitch, roll, in that order. NCALCMAT
// maps local +X forward / +Z up into the world with Rz(heading) Ry(pitch) Rx(roll).
export function placementRotation(object){
 const angles=object.angles_u16||object.angles_u8?.map(v=>v*256)||[0,0,0];
 return new THREE.Euler(angles[2]*Math.PI/32768,angles[1]*Math.PI/32768,angles[0]*Math.PI/32768,'ZYX');
}
export class MapScene {
 constructor(host,pick){
  this.host=host;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#55ffff');
  this.camera=new THREE.PerspectiveCamera(50,1,.00005,2000);this.camera.up.set(0,0,1);
  this.renderer=new THREE.WebGLRenderer({antialias:false,logarithmicDepthBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));this.renderer.setClearColor('#55ffff');host.replaceChildren(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=.005;this.controls.maxDistance=400;this.controls.maxPolarAngle=Math.PI*.495;
  this.materials=palette.map(rgb=>new THREE.MeshBasicMaterial({color:new THREE.Color(`rgb(${rgb.join(',')})`),side:THREE.DoubleSide}));
  this.lines=palette.map(rgb=>new THREE.LineBasicMaterial({color:new THREE.Color(`rgb(${rgb.join(',')})`)}));
  const disk=document.createElement('canvas');disk.width=disk.height=64;const ctx=disk.getContext('2d');ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(32,32,31,0,Math.PI*2);ctx.fill();this.texture=new THREE.CanvasTexture(disk);this.texture.magFilter=THREE.NearestFilter;this.texture.minFilter=THREE.LinearFilter;
  this.sprites=palette.map(rgb=>new THREE.SpriteMaterial({map:this.texture,color:new THREE.Color(`rgb(${rgb.join(',')})`),alphaTest:.5}));
  this.controls.addEventListener('change',()=>this.updateWorldColours());
  this.decals=new Map();this.groups=[];this.colouredObjects=[];this.colourTime=0;this.colourCycling=true;this.lastTime=null;
  this.visibility=()=>{this.lastTime=null;};document.addEventListener('visibilitychange',this.visibility);
  this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();let origin;
  host.addEventListener('pointerdown',this.down=e=>origin=[e.clientX,e.clientY]);host.addEventListener('pointerup',this.up=e=>{if(!origin||Math.hypot(e.clientX-origin[0],e.clientY-origin[1])>5)return;const r=host.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.groups,true).find(h=>{let n=h.object;while(n&&!n.userData.object)n=n.parent;return n?.visible;});if(hit){let n=hit.object;while(n&&!n.userData.object)n=n.parent;if(n)pick(n.userData.object);}});
  this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();});this.resize.observe(host);
 }
 async world(world,catalog){
  this.worldData=world;this.homingTowers=world.objects.filter(o=>o.type===6&&(o.flags&1)).map(o=>new THREE.Vector3(...o.position_cm.map(v=>v/100000)));const bank=await load(catalog.banks.find(b=>b.id===world.bank).file),native=world.bank==='source_variants'?await load('models-deluxe_dnk.json'):bank;
  if(this.disposed)return;
  const appearances=new Map([...entries(native,catalog.types),...entries(bank,catalog.types)].map(o=>[o.id,o]));
  for(const object of world.objects){
   const id=object.type===2&&(object.flags&0x2000)?'experimental-aircraft':object.model_id||String(object.type),appearance=appearances.get(id);if(!appearance)continue;
   const modelData=bank.models[appearance.model_variants[0]]?bank:native,model=modelData.models[appearance.model_variants[0]];if(!model)continue;
   const group=new THREE.Group();group.scale.setScalar(2);group.userData.object=object;const p=object.position_cm;group.position.set(p[0]/100000,p[1]/100000,p[2]/100000);
   group.rotation.copy(placementRotation(object));
   const effective={...appearance,...object},quality=(effective.flags>>>12)&7,rules=colourProfile(effective.source_only?bank:native,effective);
   const values=rules?colourValues(rules,0,quality,effective):new Map();
   const record={group,object:effective,quality,rules,timerMask:rules?.rules.reduce((mask,r)=>mask|(r.mask||0),0)||0,bindings:[]};
   const bind=(target,source,materials,side=null)=>{
    group.add(target);
    if(source.indirect&&values.has(source.word))record.bindings.push({target,address:source.word,index:colour(source),materials,side});
   };
   const colour=c=>c.indirect?(values.get(c.word)??c.index)&15:c.index&15;
   for(const key of new Set(model.octants.flat().map(c=>c.primitive))){const primitive=modelData.primitives[key];if(!primitive)continue;
    if(primitive.vertices?.length>=3){
     const points=[];for(let i=1;i+1<primitive.vertices.length;i++)for(const p of [primitive.vertices[0],primitive.vertices[i],primitive.vertices[i+1]])points.push(...p.map(v=>v/100000));
     const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
     const index=colour(primitive.colour),marking=[5,35,36].includes(object.type)&&index!==0&&primitive.vertices.every(p=>p[2]===0);
     const door=object.type===34;
     const mesh=new THREE.Mesh(geo,marking||door?this.decalMaterial(index,door?THREE.FrontSide:THREE.DoubleSide):this.materials[index]);if(marking||door)mesh.renderOrder=1;bind(mesh,primitive.colour,this.materials,marking||door?(door?THREE.FrontSide:THREE.DoubleSide):null);
    }
    for(const line of primitive.lines||[]){const geo=new THREE.BufferGeometry().setFromPoints(line.segments.flat().map(p=>new THREE.Vector3(...p.map(v=>v/100000))));bind(new THREE.LineSegments(geo,this.lines[colour(line.colour)]),line.colour,this.lines);}
    for(const point of primitive.points||[]){const sprite=new THREE.Sprite(this.sprites[colour(point.colour)]);sprite.position.set(...point.position.map(v=>v/100000));const diameter=Math.max(.00002,(point.diameter||80)/100000);sprite.scale.set(diameter,diameter,1);bind(sprite,point.colour,this.sprites);}
   }
   this.scene.add(group);this.groups.push(group);if(record.bindings.length)this.colouredObjects.push(record);
  }
  const size=world.tile_size_cm*8/100000;const ground=new THREE.Mesh(new THREE.PlaneGeometry(size,size),this.materials[2]);ground.position.z=-.0001;this.scene.add(ground);
  this.position((world.objects.find(o=>o.type===6)||world.objects.find(o=>o.type===2)||world.objects[0]).position_cm);
  this.updateWorldColours();this.updateModelColours(this.colourTime);
 }
 decalMaterial(index,side){
  const key=`${index}:${side}`;
  if(!this.decals.has(key)){
   const material=this.materials[index].clone();material.color=this.materials[index].color;material.side=side;
   // Stripes and the doorway are coplanar with their supporting surfaces.
   // The door faces outward, so it cannot appear through the back of its tower.
   // Apply slope-scaled bias to the final logarithmic depth (with a four-step
   // 24-bit minimum). polygonOffset alone cannot reliably bias shader-written
   // depth; the slope term also covers rasterization error at shallow angles.
   material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <logdepthbuf_fragment>',`#include <logdepthbuf_fragment>
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
 gl_FragDepth = max(0.0, gl_FragDepth - max(fwidth(gl_FragDepth), 4.0 / 16777216.0));
#endif`);};
   material.customProgramCacheKey=()=> 'surface-detail-depth';this.decals.set(key,material);
  }
  return this.decals.get(key);
 }
 updateWorldColours(){
  if(!this.worldData)return;
  const colours=worldColours(this.worldData,[this.camera.position.x*100000,this.camera.position.y*100000]);
  const key=[...colours.ground,...colours.sky].join(',');if(key===this.colourKey)return;this.colourKey=key;
  for(const [index,rgb] of [[2,colours.ground],[11,colours.sky]]){
   const colour=new THREE.Color(`rgb(${rgb.join(',')})`);
   for(const materials of [this.materials,this.lines,this.sprites])materials[index].color.copy(colour);
  }
  this.scene.background.copy(this.materials[11].color);this.renderer.setClearColor(this.materials[11].color);
 }
 setColourCycling(value){this.colourCycling=value;this.lastTime=null;}
 updateModelColours(seconds){
  // The native homing beacon is active within 5,200 units of 64 cm of a tower.
  // Use the inspection camera as the observer, without running mission logic.
  const radarActive=this.homingTowers?.some(p=>this.camera.position.distanceToSquared(p)<=3.328**2)||false;
  for(const record of this.colouredObjects){
   const {rules,object,quality,bindings}=record;
   const frame=Math.floor(seconds*rules.preview_frames_per_second),ticks=Math.floor(seconds*rules.clock_hz/rules.timer_divisor);
   const key=`${frame}:${ticks&record.timerMask}:${radarActive}`;if(key===record.lastKey)continue;record.lastKey=key;
   const values=colourValues(rules,seconds,quality,{...object,radar_active:radarActive});
   for(const binding of bindings){
    const index=values.get(binding.address)&15;if(index===binding.index)continue;binding.index=index;
    binding.target.material=binding.side===null?binding.materials[index]:this.decalMaterial(index,binding.side);
   }
  }
 }
 active(value){if(this.disposed)return;this.running=value;this.lastTime=null;if(value&&!this.frame)this.tick();else if(!value&&this.frame){cancelAnimationFrame(this.frame);this.frame=0;}}
 tick=(now=performance.now())=>{
  this.frame=0;if(!this.running)return;
  if(!document.hidden){
   if(this.colourCycling&&this.lastTime!==null)this.colourTime+=Math.max(0,(now-this.lastTime)/1000);
   this.lastTime=now;this.controls.update();this.updateModelColours(this.colourTime);this.renderer.render(this.scene,this.camera);
  }else this.lastTime=null;
  this.frame=requestAnimationFrame(this.tick);
 };
 filter(type){for(const group of this.groups)group.visible=!type||String(group.userData.object.type)===type;}
 position(position){const p=new THREE.Vector3(...position.map(v=>v/100000));this.controls.target.copy(p);this.camera.position.copy(p).add(new THREE.Vector3(.65,-.8,.25));this.controls.update();}
 focus(object){const group=this.groups.find(g=>g.userData.object===object);if(!group){this.position(object.position_cm);return;}const box=new THREE.Box3().setFromObject(group),centre=box.getCenter(new THREE.Vector3()),distance=Math.max(.008,box.getSize(new THREE.Vector3()).length()*2.5);this.controls.target.copy(centre);this.camera.position.copy(centre).add(new THREE.Vector3(distance*.5,-distance*.8,distance*.45));this.controls.update();this.select(object);}
 select(object){if(this.selection){this.scene.remove(this.selection);this.selection.geometry.dispose();this.selection.material.dispose();}const group=this.groups.find(g=>g.userData.object===object);if(group){this.selection=new THREE.BoxHelper(group,0xffffaa);this.scene.add(this.selection);}}
 overview(){const groups=this.groups.filter(g=>g.userData.object.type!==31),box=new THREE.Box3();groups.forEach(g=>box.expandByObject(g));const centre=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3()).length();this.controls.target.copy(centre);this.camera.position.copy(centre).add(new THREE.Vector3(extent*.35,-extent*.55,extent*.6));this.controls.update();}
 zoom(factor){this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update();}
 dispose(){this.active(false);this.disposed=true;this.resize.disconnect();this.controls.dispose();document.removeEventListener('visibilitychange',this.visibility);this.host.removeEventListener('pointerdown',this.down);this.host.removeEventListener('pointerup',this.up);this.scene.traverse(o=>o.geometry?.dispose());[...this.materials,...this.lines,...this.sprites,...this.decals.values()].forEach(m=>m.dispose());this.selection?.material.dispose();this.texture.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.host.replaceChildren();}
}
