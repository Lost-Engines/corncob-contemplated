import {liftDiagram,liftPeak,atmosphereDiagram,controlsDiagram,landingDiagram,contact} from './flight-diagrams.mjs';
const get=id=>document.getElementById(id);
function mount(name,draw,controls) {
  const figure=document.querySelector('[data-demo="'+name+'"]'),live=figure.querySelector('.graphics-live');
  const update=()=>{live.innerHTML=draw(Math.max(280,Math.round(figure.getBoundingClientRect().width)));};
  update();live.hidden=false;figure.querySelector('.graphics-fallback').hidden=true;figure.querySelector('.graphics-controls').hidden=false;
  controls.forEach(id=>get(id).addEventListener('input',update));
  new ResizeObserver(update).observe(figure);
}
try {
  const response=await fetch(new URL('../data/flight-samples.json',import.meta.url));
  if(!response.ok)throw Error('Flight measurements unavailable');
  const data=await response.json(),peak=liftPeak(data);
  mount('lift',w=>{
    const angle=Number(get('lift-angle').value),row=data.lift[Math.round(angle*4)];
    get('lift-value').value=angle.toFixed(2)+'°';
    get('lift-result').textContent=['clean','flaps'].map(key=>(key==='clean'?'Flaps up':'Flaps down')+': '+(row[key].force/peak).toFixed(2)+' × clean peak, '+(row[key].stalled?'stalled':'not stalled')+'.').join(' ');
    return liftDiagram(data,w,angle);
  },['lift-angle']);
  mount('atmosphere',w=>{
    const metres=Number(get('air-height').value),row=data.atmosphere[Math.round(metres/250)];
    get('air-value').value=(metres/1000).toFixed(2)+' km';
    get('air-result').textContent='Air density: '+(row.density/5957*100).toFixed(1)+'% of sea level. Engine power factor: '+(row.power/65535*100).toFixed(1)+'% of its maximum. These are steady-altitude samples.';
    return atmosphereDiagram(data,w,metres);
  },['air-height']);
  mount('controls',w=>{
    const speed=Number(get('control-speed').value),row=data.control_speed[Math.round(speed/200)];
    get('control-value').value=(speed/4800).toFixed(2)+' × cap';
    get('control-result').textContent='Same roll input, initially no rotation: sea-level response '+(row.sea/2880000*100).toFixed(1)+'%; thinner-air response '+(row.thin/2880000*100).toFixed(1)+'%. This is one control pass, not a sustained roll rate.';
    return controlsDiagram(data,w,speed);
  },['control-speed']);
  mount('landing',w=>{
    const roll=Number(get('gear-roll').value),height=Number(get('gear-height').value),surface=get('gear-surface').value,result=contact(data,roll,height,surface);
    get('gear-roll-value').value=roll+'°';get('gear-height-value').value=height.toFixed(1)+' m';
    get('gear-result').textContent=result.state+'. At this attitude, the lower wheel is '+(result.row.clearance/100).toFixed(2)+' m below the aircraft origin. Crash / fatal compression thresholds: '+result.crash/100+' / '+result.fatal/100+' m. The contact test includes a 0.90 m margin.';
    return landingDiagram(data,w,roll,height,surface);
  },['gear-roll','gear-height','gear-surface']);
} catch(error) {
  // Preserve the readable article and all static figures if fetching fails.
  console.warn('Using static flight illustrations:',error);
}
