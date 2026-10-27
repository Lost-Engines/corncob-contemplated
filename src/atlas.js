import {$,load,options,escape,permalink} from './data.js';
const query=new URLSearchParams(location.search),canvas=$('map-canvas'),ctx=canvas.getContext('2d');
let catalog,world,selected=null,selectedStart=null,scene=null,mode=query.get('view')==='2d'?'2d':'3d',token=0,ready=false;
let camera={x:0,y:0,scale:1},pointers=new Map(),gesture=null;
const colours={0:'#ffcf6d',1:'#e9a1f3',2:'#89adff',6:'#faf2cd',7:'#d99a55',11:'#e67977',12:'#d3b58f',13:'#e67977',23:'#e67977',24:'#a1b2f5',27:'#d0c783',31:'#617466',48:'#e8e8de',50:'#f696db',51:'#ec91cb',52:'#d8b4f6',53:'#ffbf66',57:'#a5d9ae',58:'#91e9d5'};
const visible=()=>world.objects.filter(o=>!$('type').value||String(o.type)===$('type').value);
function status(message){$('map-status').textContent=message;}
function xy(p){return[(p[0]-camera.x)*camera.scale+canvas.clientWidth/2,canvas.clientHeight/2-(p[1]-camera.y)*camera.scale];}
function fit(points=world.objects.filter(o=>o.type!==31).map(o=>o.position_cm)){
 if(!points.length)points=[[0,0]];
 const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);camera.x=(Math.min(...xs)+Math.max(...xs))/2;camera.y=(Math.min(...ys)+Math.max(...ys))/2;
 const width=canvas.clientWidth||$('atlas-stage').clientWidth,height=canvas.clientHeight||$('atlas-stage').clientHeight;
 camera.scale=.83*Math.min(width/Math.max(120000,Math.max(...xs)-Math.min(...xs)),height/Math.max(120000,Math.max(...ys)-Math.min(...ys)));draw();
}
function draw(){
 if(!world||mode!=='2d')return;const width=canvas.clientWidth,height=canvas.clientHeight,ratio=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#10251d';ctx.fillRect(0,0,width,height);
 ctx.strokeStyle='#254334';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<=8;i++){const [x,y]=xy([world.origin_cm+i*world.tile_size_cm,world.origin_cm+i*world.tile_size_cm]);ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();
 for(const o of visible()){
  const [x,y]=xy(o.position_cm);if(x<-10||y<-10||x>width+10||y>height+10)continue;
  ctx.fillStyle=colours[o.type]||'#a4ba9c';ctx.beginPath();ctx.arc(x,y,o.type===31?1.3:o.type===6?4:2.6,0,Math.PI*2);ctx.fill();
  if($('objectives').checked&&o.objective){ctx.strokeStyle='#ffcf6d';ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.stroke();}
  if(o===selected){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;}
 }
 if($('objectives').checked)for(const s of world.starts){const [x,y]=xy(s.position_cm);ctx.strokeStyle='#f6e6c4';ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.moveTo(x,y-5);ctx.lineTo(x,y+5);ctx.stroke();}
 if(world.slalom){ctx.font='12px system-ui';ctx.fillStyle='#f1c0fb';for(const p of world.slalom.checkpoints){const [x,y]=xy(p.position_cm);ctx.fillText(`${p.number+1} ${p.pass_side==='+Y'?'↑':'↓'}`,x+8,y-9);}}
 const target=100/camera.scale/100000,km=10**Math.floor(Math.log10(Math.max(target,.001))),pixels=km*100000*camera.scale;
 ctx.strokeStyle='#b9d5c4';ctx.beginPath();ctx.moveTo(20,height-30);ctx.lineTo(20+pixels,height-30);ctx.stroke();ctx.fillStyle='#b9d5c4';ctx.font='12px system-ui';ctx.fillText(km<1?`${Math.round(km*1000)} m`:`${km} km`,20,height-38);ctx.fillText('+Y ↑  ·  +X →',width-130,height-18);
}
function inspect(object,focus=false){
 if(!object)return;selected=object;selectedStart=null;$('mission-briefing').hidden=true;for(const b of $('missions').querySelectorAll('button'))b.setAttribute('aria-pressed','false');
 $('place-name').textContent=object.name;$('place-note').textContent=object.objective?.rule||'A stored placement in the original world. Live motion, spawning and mission progress are not simulated here.';
 const p=object.position_cm;$('place-position').textContent=`X ${(p[0]/100000).toFixed(2)} km · Y ${(p[1]/100000).toFixed(2)} km · height ${(p[2]/100).toFixed(0)} m`;
 const model=object.model_id||String(object.type),bank=world.bank==='source_variants'&&!model.startsWith('source-')?'deluxe_dnk':world.bank;
 $('place-model').href=`../models/?bank=${encodeURIComponent(bank)}&model=${encodeURIComponent(model)}`;$('place-model').hidden=false;
 if(focus){$('type').value='';camera.x=p[0];camera.y=p[1];camera.scale=Math.max(camera.scale,.001);scene?.filter('');scene?.focus(object);}
 scene?.select(object);permalink({world:world.id,object:object.index,view:mode,start:selectedStart});draw();
}
function chooseStart(index){
 const mission=world.starts[index];if(!mission)return;
 selected=null;selectedStart=index;scene?.select(null);camera.x=mission.position_cm[0];camera.y=mission.position_cm[1];camera.scale=Math.max(camera.scale,.00025);draw();scene?.position(mission.position_cm);
 $('place-name').textContent=mission.name;$('place-note').textContent='Recorded mission starting position';$('place-position').textContent=`X ${(mission.position_cm[0]/100000).toFixed(2)} km · Y ${(mission.position_cm[1]/100000).toFixed(2)} km · height ${(mission.position_cm[2]/100).toFixed(0)} m`;$('place-model').hidden=true;
 $('mission-note').textContent='Original briefing; selecting this start does not run the mission.';
 const host=$('mission-briefing');host.replaceChildren();host.hidden=false;
 const title=document.createElement('h3');title.textContent=mission.name;host.append(title);
 const meta=document.createElement('p');meta.className='mission-meta';meta.textContent=['direction','distance','difficulty'].filter(k=>mission[k]).map(k=>`${k[0].toUpperCase()+k.slice(1)}: ${mission[k]}`).join(' · ');host.append(meta);
 if(mission.named===false){const note=document.createElement('p');note.className='mission-meta';note.textContent='This mission has no title in the original briefing.';host.append(note);}
 for(const paragraph of (mission.briefing||'No separate briefing text is recorded for this starting position.').split(/\n\s*\n/)){const p=document.createElement('p');p.textContent=paragraph.replace(/\s*\n\s*/g,' ');host.append(p);}
 for(const b of $('missions').querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.dataset.start)===index));
 permalink({world:world.id,view:mode,start:index});
}
async function view(next){
 mode=next;$('view-2d').setAttribute('aria-pressed',String(mode==='2d'));$('view-3d').setAttribute('aria-pressed',String(mode==='3d'));
 canvas.hidden=mode!=='2d';$('map3d').hidden=mode!=='3d';
 if(mode==='3d'){
  try{if(!scene){status('Opening the 3D view…');const {MapScene}=await import('./map3d.js');scene=new MapScene($('map3d'),object=>inspect(object));scene.setColourCycling($('cycle-colours').checked);await scene.world(world,catalog);scene.filter($('type').value);}scene.active(true);if(selected)scene.focus(selected);else if(selectedStart!==null)scene.position(world.starts[selectedStart].position_cm);}catch(e){status(`${e.message} The 2D atlas remains available.`);mode='2d';canvas.hidden=false;$('map3d').hidden=true;$('view-2d').setAttribute('aria-pressed','true');$('view-3d').setAttribute('aria-pressed','false');}
 }else{scene?.active(false);draw();}
 $('cycle-colours').disabled=mode!=='3d';$('objectives').disabled=mode!=='2d';$('objectives').title=mode==='2d'?'Show objective rings and mission-start crosses on the atlas.':'These markers are available in the 2D atlas.';
 permalink({world:world.id,object:selected?.index,view:mode,start:selectedStart});
 if(mode==='3d')status('Static placements and original shapes in a modern 3D view. Drag to orbit · right-drag to pan · scroll to zoom.');
 else status(`${world.objects.length} stored placements · ${world.starts.length} mission starts. Drag to pan · scroll or pinch to zoom · select a dot.`);
}
async function change(){
 const request=++token;$('atlas-stage').setAttribute('aria-busy','true');status('Loading world…');scene?.dispose();scene=null;selected=null;selectedStart=null;
 try{
  const value=await load(catalog.worlds.find(w=>w.id===$('world').value).file);if(request!==token)return;world=value;
  $('world-name').textContent=world.name;$('world-intro').textContent=world.introduction||'A generated arrangement reconstructed from the original placement rules.';
  $('place-name').textContent='Pick something on the map';$('place-note').textContent='Try an aircraft, a ground crew member or a generator orb. Mission starts are marked with crosses in the 2D atlas.';$('place-position').textContent='';$('place-model').hidden=true;$('mission-briefing').hidden=true;$('mission-note').textContent='';
  const counts=new Map();for(const o of world.objects)counts.set(o.type,(counts.get(o.type)||0)+1);
  options($('type'),[['','All objects'],...[...counts.keys()].sort((a,b)=>a-b).map(t=>[String(t),`${world.type_names?.[t]||catalog.types[t].name} (${counts.get(t)})`])]);
  const landmarks=world.objects.filter(o=>[0,1,2,6,7,48,58].includes(o.type));
  options($('landmark'),[['','Visit a landmark…'],...landmarks.map(o=>[String(o.index),`${o.name} · ${o.index+1}`])]);
  $('missions').replaceChildren();for(const [index,mission] of world.starts.entries()){const button=document.createElement('button');button.textContent=mission.name;button.dataset.start=index;button.setAttribute('aria-pressed','false');button.onclick=()=>chooseStart(index);$('missions').append(button);}
  if(!world.starts.length)$('missions').textContent=world.slalom?'A six-crossing course, recovered from the source. The two rows are at different heights.':'No named starting positions are stored for this definition.';
  fit();if(!ready&&query.get('object'))selected=world.objects.find(o=>String(o.index)===query.get('object'));
  await view(mode);if(!ready&&query.has('start')&&/^\d+$/.test(query.get('start'))&&world.starts[Number(query.get('start'))])chooseStart(Number(query.get('start')));else if(selected)inspect(selected,true);ready=true;
 }catch(e){status(e.message);}finally{if(request===token)$('atlas-stage').setAttribute('aria-busy','false');}
}
async function start(){
 $('cycle-colours').checked=!matchMedia('(prefers-reduced-motion: reduce)').matches;
 $('cycle-colours').onchange=()=>scene?.setColourCycling($('cycle-colours').checked);
 catalog=await load('catalog.json');$('world').replaceChildren();for(const group of [...new Set(catalog.worlds.map(w=>w.group))]){const opt=document.createElement('optgroup');opt.label=group;for(const w of catalog.worlds.filter(w=>w.group===group))opt.append(new Option(w.name,w.id));$('world').append(opt);}
 $('world').value=catalog.worlds.some(w=>w.id===query.get('world'))?query.get('world'):'training';$('world').onchange=change;
 $('view-2d').onclick=()=>view('2d');$('view-3d').onclick=()=>view('3d');$('type').onchange=()=>{draw();scene?.filter($('type').value);};$('objectives').onchange=draw;
 $('landmark').onchange=()=>inspect(world.objects.find(o=>String(o.index)===$('landmark').value),true);
 $('fit').onclick=()=>{selected=null;fit();scene?.overview();};$('airfield').onclick=()=>inspect(world.objects.find(o=>o.type===6)||world.objects.find(o=>o.type===2),true);
 $('map-zoom-in').onclick=()=>{camera.scale*=1.4;draw();scene?.zoom(.8);};$('map-zoom-out').onclick=()=>{camera.scale/=1.4;draw();scene?.zoom(1.25);};
 function zoom(factor,x=canvas.clientWidth/2,y=canvas.clientHeight/2){const wx=camera.x+(x-canvas.clientWidth/2)/camera.scale,wy=camera.y-(y-canvas.clientHeight/2)/camera.scale;camera.scale=Math.max(1e-7,Math.min(.03,camera.scale*factor));camera.x=wx-(x-canvas.clientWidth/2)/camera.scale;camera.y=wy+(y-canvas.clientHeight/2)/camera.scale;draw();}
 canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();const distance=canvas.clientWidth*.1/camera.scale;if(e.key==='ArrowLeft')camera.x-=distance;if(e.key==='ArrowRight')camera.x+=distance;if(e.key==='ArrowUp')camera.y+=distance;if(e.key==='ArrowDown')camera.y-=distance;if(e.key==='+'||e.key==='=')zoom(1.4);if(e.key==='-')zoom(1/1.4);draw();};
 canvas.onwheel=e=>{e.preventDefault();const r=canvas.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.001),e.clientX-r.left,e.clientY-r.top);};
 canvas.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);gesture={x:e.clientX,y:e.clientY,moved:false};};
 canvas.onpointermove=e=>{if(!pointers.has(e.pointerId))return;const previous=pointers.get(e.pointerId),others=[...pointers].filter(([id])=>id!==e.pointerId);if(others.length){const p=others[0][1],before=Math.hypot(previous.x-p.x,previous.y-p.y),after=Math.hypot(e.clientX-p.x,e.clientY-p.y);if(before>0)zoom(after/before);gesture.moved=true;}else{camera.x-=(e.clientX-previous.x)/camera.scale;camera.y+=(e.clientY-previous.y)/camera.scale;if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>4)gesture.moved=true;}pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});draw();};
 canvas.onpointerup=e=>{pointers.delete(e.pointerId);if(gesture&&!gesture.moved){const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let best=null,distance=144;for(const o of visible()){const p=xy(o.position_cm),d=(p[0]-x)**2+(p[1]-y)**2;if(d<distance){distance=d;best=o;}}if(best)inspect(best);}gesture=null;};canvas.onpointercancel=e=>{pointers.delete(e.pointerId);gesture=null;};
 new ResizeObserver(()=>{if(world)draw();}).observe(canvas);await change();
}
start().catch(e=>status(e.message));
