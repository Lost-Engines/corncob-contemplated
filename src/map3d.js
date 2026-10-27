import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {load,entries} from './data.js';
import {corncobEgaPalette as palette,corncobModelColourValues as colourValues,corncobColourProfile as colourProfile} from './model-engine.js';
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
  this.groups=[];this.ray=new THREE.Raycaster();this.pointer=new THREE.Vector2();let origin;
  host.addEventListener('pointerdown',this.down=e=>origin=[e.clientX,e.clientY]);host.addEventListener('pointerup',this.up=e=>{if(!origin||Math.hypot(e.clientX-origin[0],e.clientY-origin[1])>5)return;const r=host.getBoundingClientRect();this.pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(this.pointer,this.camera);const hit=this.ray.intersectObjects(this.groups,true).find(h=>{let n=h.object;while(n&&!n.userData.object)n=n.parent;return n?.visible;});if(hit){let n=hit.object;while(n&&!n.userData.object)n=n.parent;if(n)pick(n.userData.object);}});
  this.resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();});this.resize.observe(host);
 }
 async world(world,catalog){
  this.worldData=world;const bank=await load(catalog.banks.find(b=>b.id===world.bank).file),native=world.bank==='source_variants'?await load('models-deluxe_dnk.json'):bank;
  if(this.disposed)return;
  const appearances=new Map([...entries(native,catalog.types),...entries(bank,catalog.types)].map(o=>[o.id,o]));
  for(const object of world.objects){
   const id=object.type===2&&(object.flags&0x2000)?'experimental-aircraft':object.model_id||String(object.type),appearance=appearances.get(id);if(!appearance)continue;
   const model=bank.models[appearance.model_variants[0]]||native.models[appearance.model_variants[0]];if(!model)continue;
   const group=new THREE.Group();group.scale.setScalar(2);group.userData.object=object;const p=object.position_cm;group.position.set(p[0]/100000,p[1]/100000,p[2]/100000);
   const angles=object.angles_u16||object.angles_u8?.map(v=>v*256)||[0,0,0];group.rotation.set(angles[2]*Math.PI/32768,angles[0]*Math.PI/32768,angles[1]*Math.PI/32768,'ZYX');
   const rules=colourProfile(bank,appearance),values=rules?colourValues(rules,0,(object.flags>>>12)&7,appearance):new Map();
   const colour=c=>c.indirect?(values.get(c.word)??c.index)&15:c.index&15;
   for(const key of new Set(model.octants.flat().map(c=>c.primitive))){const primitive=bank.primitives[key]||native.primitives[key];if(!primitive)continue;
    if(primitive.vertices?.length>=3){const points=[];for(let i=1;i+1<primitive.vertices.length;i++)for(const p of [primitive.vertices[0],primitive.vertices[i],primitive.vertices[i+1]])points.push(...p.map(v=>v/100000));const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));group.add(new THREE.Mesh(geo,this.materials[colour(primitive.colour)]));}
    for(const line of primitive.lines||[]){const geo=new THREE.BufferGeometry().setFromPoints(line.segments.flat().map(p=>new THREE.Vector3(...p.map(v=>v/100000))));group.add(new THREE.LineSegments(geo,this.lines[colour(line.colour)]));}
    for(const point of primitive.points||[]){const sprite=new THREE.Sprite(this.sprites[colour(point.colour)]);sprite.position.set(...point.position.map(v=>v/100000));const diameter=Math.max(.00002,(point.diameter||80)/100000);sprite.scale.set(diameter,diameter,1);group.add(sprite);}
   }
   this.scene.add(group);this.groups.push(group);
  }
  const size=world.tile_size_cm*8/100000;const ground=new THREE.Mesh(new THREE.PlaneGeometry(size,size),this.materials[2]);ground.position.z=-.0001;this.scene.add(ground);
  this.position((world.objects.find(o=>o.type===6)||world.objects.find(o=>o.type===2)||world.objects[0]).position_cm);
 }
 active(value){if(this.disposed)return;this.running=value;if(value&&!this.frame)this.tick();else if(!value&&this.frame){cancelAnimationFrame(this.frame);this.frame=0;}}
 tick=()=>{this.frame=0;if(!this.running)return;this.controls.update();this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.tick);};
 filter(type){for(const group of this.groups)group.visible=!type||String(group.userData.object.type)===type;}
 position(position){const p=new THREE.Vector3(...position.map(v=>v/100000));this.controls.target.copy(p);this.camera.position.copy(p).add(new THREE.Vector3(.65,-.8,.25));this.controls.update();}
 focus(object){const group=this.groups.find(g=>g.userData.object===object);if(!group){this.position(object.position_cm);return;}const box=new THREE.Box3().setFromObject(group),centre=box.getCenter(new THREE.Vector3()),distance=Math.max(.008,box.getSize(new THREE.Vector3()).length()*2.5);this.controls.target.copy(centre);this.camera.position.copy(centre).add(new THREE.Vector3(distance*.5,-distance*.8,distance*.45));this.controls.update();this.select(object);}
 select(object){if(this.selection){this.scene.remove(this.selection);this.selection.geometry.dispose();this.selection.material.dispose();}const group=this.groups.find(g=>g.userData.object===object);if(group){this.selection=new THREE.BoxHelper(group,0xffffaa);this.scene.add(this.selection);}}
 overview(){const groups=this.groups.filter(g=>g.userData.object.type!==31),box=new THREE.Box3();groups.forEach(g=>box.expandByObject(g));const centre=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3()).length();this.controls.target.copy(centre);this.camera.position.copy(centre).add(new THREE.Vector3(extent*.35,-extent*.55,extent*.6));this.controls.update();}
 zoom(factor){this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update();}
 dispose(){this.active(false);this.disposed=true;this.resize.disconnect();this.controls.dispose();this.host.removeEventListener('pointerdown',this.down);this.host.removeEventListener('pointerup',this.up);this.scene.traverse(o=>o.geometry?.dispose());[...this.materials,...this.lines,...this.sprites].forEach(m=>m.dispose());this.selection?.material.dispose();this.texture.dispose();this.renderer.dispose();this.renderer.forceContextLoss();this.host.replaceChildren();}
}
