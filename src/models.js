import {$,load,options,entries,category,modelNote,escape,permalink} from './data.js';
import {corncobModelRenderer as renderer,corncobModelGeometry as geometry,corncobColourProfile as profile,corncobModelColourValues as values,corncobApplyModelColours as colours,corncobModelHasAvailableColourVariants as variants,corncobRuntimeFrame as runtime} from './model-engine.js';
const query=new URLSearchParams(location.search),pageSize=24;
let catalog,bank,all=[],filtered=[],selected,main,thumb,tiles=[],frame=0,revision=0,token=0,time=0,last=0,cache=new Map();
const state={id:query.get('model')||'7',pose:query.get('state')||'normal',page:0,yaw:.65,pitch:-.25,zoom:1.2};
function report(message){$('viewer-status').textContent=message;}
function make(object,animated=false){
 let choice=object.id===state.id?state.pose:object.states?.[0]?.id;
 if(choice==='cycle'&&object.state_animation)choice=object.state_animation.states[Math.floor(time*object.state_animation.preview_steps_per_second)%object.state_animation.states.length];
 const pose=object.states?.find(s=>s.id===choice)||object.states?.[0]||{},key=[object.id,choice,$('detail').value,$('neutral').checked].join(':');
 let model=cache.get(key);
 if(!model){model=geometry(bank,{...object,...pose},+$('detail').value,$('neutral').checked?'neutral':'ega');cache.set(key,model);}
 if(animated&&bank.runtime_animation&&$('motion').checked){
  const updated=runtime(bank,time),effective={...object,...pose},ticks=Math.floor(time*1193182/1024);
  if(effective.type===3)effective.heading_u16=ticks*4&65535;
  if(effective.type===29)effective.roll_u16=-ticks*20&65535;
  if(effective.type===3||effective.type===29||model.model.octants.flat().some(c=>updated.changed.has(c.primitive)))model=geometry(updated.data,effective,+$('detail').value,$('neutral').checked?'neutral':'ega',model);
 }
 const rules=profile(bank,object);
 if(!$('neutral').checked&&rules)colours(model,values(rules,$('flash').checked?time:0,object.id===state.id?+$('quality').value:0,{...object,...pose}));
 return model;
}
function draw(now=performance.now()){
 frame=0;const elapsed=last?Math.min((now-last)/1000,.1):0;last=now;
 if(document.hidden)return;
 if($('motion').checked||$('flash').checked)time+=elapsed;
 if(selected&&main){const ratio=Math.min(devicePixelRatio||1,2);main.draw(make(selected,true),Math.max(1,Math.round($('model-canvas').clientWidth*ratio)),Math.max(1,Math.round($('model-canvas').clientHeight*ratio)),state.yaw,state.pitch,state.zoom);}
 for(const tile of tiles){if(tile.revision===revision)continue;const model=make(tile.object);thumb.draw(model,320,230,state.yaw,state.pitch,1.1);tile.canvas.getContext('2d').drawImage(thumb.canvas,0,0,320,230);tile.revision=revision;}
 if($('motion').checked||$('flash').checked)frame=requestAnimationFrame(draw);
}
function redraw(){if(!frame)frame=requestAnimationFrame(draw);}
function choose(id,keepPose=false){
 const previous=selected?.id;selected=all.find(o=>o.id===id);if(!selected)return;
 if(id==='sun'&&previous!=='sun'){state.yaw=0;state.pitch=1.5;}else if(previous==='sun'&&id!=='sun'){state.yaw=.65;state.pitch=-.25;}
 state.id=id;if(!keepPose)state.pose=selected.states?.[0]?.id||'normal';
 $('model').value=id;
 const poses=(selected.states||[]).map(p=>[p.id,p.name]);if(selected.state_animation)poses.push(['cycle','Cycle stages']);
 options($('pose'),poses.length?poses:[['normal','Single appearance']]);$('pose').disabled=poses.length<2;
 if([...$('pose').options].some(p=>p.value===state.pose))$('pose').value=state.pose;else state.pose=$('pose').value;
 $('quality').disabled=!variants(bank,selected);if(!keepPose)$('quality').value='0';
 $('model-name').textContent=selected.name;$('model-note').textContent=modelNote(selected);
 $('model-tags').innerHTML=`<span>${escape(category(selected))}</span><span>${selected.states?.length||1} appearance${selected.states?.length>1?'s':''}</span>${selected.source_only?'<span>Source experiment</span>':''}`;
 permalink({bank:$('bank').value,model:id,state:state.pose==='normal'?null:state.pose});
 document.querySelectorAll('.model-tile').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));revision++;redraw();
}
function gallery(){
 const needle=$('search').value.trim().toLowerCase(),group=$('category').value;
 filtered=all.filter(o=>(!group||category(o)===group)&&(!needle||`${o.name} ${o.source_symbol||''} ${modelNote(o)}`.toLowerCase().includes(needle)));
 options($('model'),filtered.map(o=>[o.id,o.name]));
 if(!filtered.some(o=>o.id===state.id)&&filtered.length)choose(filtered[0].id);else $('model').value=state.id;
 state.page=Math.min(state.page,Math.max(0,Math.ceil(filtered.length/pageSize)-1));tiles=[];$('gallery').replaceChildren();
 for(const object of filtered.slice(state.page*pageSize,(state.page+1)*pageSize)){
  const button=document.createElement('button');button.className='model-tile';button.dataset.id=object.id;button.setAttribute('aria-pressed',String(object.id===state.id));
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=230;canvas.setAttribute('aria-hidden','true');
  const name=document.createElement('strong');name.textContent=object.name;
  const badges=document.createElement('span');badges.className='tile-badges';
  if(object.states?.length>1)badges.textContent=`${object.states.length} appearances`;
  if(variants(bank,object))badges.textContent+=(badges.textContent?' · ':'')+'Colour variants';
  button.append(canvas,name,badges);button.onclick=()=>choose(object.id);$('gallery').append(button);tiles.push({object,canvas,revision:-1});
 }
 $('gallery-count').textContent=filtered.length?`${state.page*pageSize+1}–${Math.min(filtered.length,(state.page+1)*pageSize)} of ${filtered.length} models`:'No models match. Try another name or category.';
 $('previous').disabled=state.page===0;$('next').disabled=(state.page+1)*pageSize>=filtered.length;
 revision++;redraw();
}
async function collection(){const request=++token;$('model-stage').setAttribute('aria-busy','true');report('Loading models…');try{const result=await load(catalog.banks.find(b=>b.id===$('bank').value).file);if(request!==token)return;bank=result;cache.clear();all=entries(bank,catalog.types);if(!all.some(o=>o.id===state.id))state.id=all[0].id;choose(state.id,true);gallery();report('Drag to rotate · scroll to zoom. Original geometry and painter lists; modern projection.');}catch(e){report(e.message);}finally{if(request===token)$('model-stage').setAttribute('aria-busy','false');}}
async function start(){
 catalog=await load('catalog.json');options($('bank'),catalog.banks.map(b=>[b.id,b.name]));$('bank').value=catalog.banks.some(b=>b.id===query.get('bank'))?query.get('bank'):'deluxe_dnk';
 options($('quality'),Array.from({length:8},(_,i)=>[String(i),`Variant ${i+1}`]));
 main=renderer($('model-canvas'));const offscreen=document.createElement('canvas');thumb=renderer(offscreen);if(thumb)thumb.canvas=offscreen;
 if(!main||!thumb){$('model-stage').hidden=true;$('webgl-fallback').hidden=false;report('The illustrated investigation remains available without WebGL.');return;}
 $('bank').onchange=()=>{state.page=0;collection();};$('model').onchange=()=>choose($('model').value);
 for(const id of ['search','category'])$(id).addEventListener(id==='search'?'input':'change',()=>{state.page=0;gallery();});
 $('pose').onchange=()=>{state.pose=$('pose').value;choose(state.id,true);};
 for(const id of ['detail','quality','neutral','flash','motion'])$(id).onchange=()=>{revision++;redraw();};
 $('previous').onclick=()=>{state.page--;gallery();};$('next').onclick=()=>{state.page++;gallery();};
 $('reset').onclick=()=>{state.yaw=selected?.id==='sun'?0:.65;state.pitch=selected?.id==='sun'?1.5:-.25;state.zoom=1.2;revision++;redraw();};
 $('zoom-in').onclick=()=>{state.zoom=Math.min(4,state.zoom*1.2);redraw();};$('zoom-out').onclick=()=>{state.zoom=Math.max(.3,state.zoom/1.2);redraw();};
 let drag;const canvas=$('model-canvas');canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
 canvas.onpointermove=e=>{if(!drag)return;state.yaw+=(e.clientX-drag.x)*.008;state.pitch=Math.max(-1.5,Math.min(1.5,state.pitch+(e.clientY-drag.y)*.008));drag={x:e.clientX,y:e.clientY};revision++;redraw();};
 canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')state.yaw-=.15;if(e.key==='ArrowRight')state.yaw+=.15;if(e.key==='ArrowUp')state.pitch=Math.max(-1.5,state.pitch-.1);if(e.key==='ArrowDown')state.pitch=Math.min(1.5,state.pitch+.1);if(e.key==='+'||e.key==='=')state.zoom=Math.min(4,state.zoom*1.2);if(e.key==='-')state.zoom=Math.max(.3,state.zoom/1.2);revision++;redraw();};
 canvas.onwheel=e=>{e.preventDefault();state.zoom=Math.max(.3,Math.min(4,state.zoom*Math.exp(-e.deltaY*.001)));redraw();};
 new ResizeObserver(redraw).observe(canvas);document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)redraw();});
 await collection();
}
start().catch(e=>report(e.message));
