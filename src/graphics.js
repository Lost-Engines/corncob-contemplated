import {nearDiagram,clipExample,scanDiagram,scanInterval,planeDiagram,painterDiagram,modelCommands} from './graphics-diagrams.mjs';
const get=id=>document.getElementById(id);
const width=figure=>Math.max(280,Math.round(figure.getBoundingClientRect().width));
function mount(name,draw,controls){
  const figure=document.querySelector(`[data-demo="${name}"]`);
  const live=figure.querySelector('.graphics-live');
  const update=()=>{live.innerHTML=draw(width(figure));};
  // Only replace the accessible static illustration after a successful render.
  update();live.hidden=false;figure.querySelector('.graphics-fallback').hidden=true;
  figure.querySelector('.graphics-controls').hidden=false;
  for(const control of controls) get(control).addEventListener('input',update);
  const observer=new ResizeObserver(update);observer.observe(figure);
}
mount('near',w=>{
  const depth=Number(get('clip-depth').value),hit=clipExample(depth);
  get('clip-value').value=String(depth);get('clip-depth').setAttribute('aria-valuetext',`Depth ${depth}`);
  get('clip-result').textContent=hit?`New endpoint: X = ${hit.depth}, Y = ${hit.lateral}. Its projected horizontal position is ${hit.screenX}. The nudge puts it just beyond depth 300.`:
    'Both endpoints are beyond the near plane; the whole edge survives.';
  return nearDiagram(w,depth);
},['clip-depth']);
mount('scan',w=>{
  const row=Number(get('scan-row').value),hits=scanInterval(row+.5);get('scan-value').value=String(row);
  get('scan-result').textContent=hits.length===2?`Row ${row}: the edges meet this slice at X = ${hits[0].toFixed(2)} and ${hits[1].toFixed(2)}. Fill the interval between them.`:`Row ${row} is outside the polygon.`;
  return scanDiagram(w,row);
},['scan-row']);
mount('planes',w=>{
  const pixel=Number(get('plane-pixel').value),colour=Number(get('plane-colour').value);
  get('plane-pixel-value').value=String(pixel);get('plane-value').value=String(colour);
  get('plane-result').textContent=`Pixel ${pixel}: index ${colour} = ${colour.toString(2).padStart(4,'0')} in binary (bits 3 to 0). Each plane changes only its own bit.`;
  return planeDiagram(w,pixel,colour);
},['plane-pixel','plane-colour']);
try{
  const response=await fetch(new URL('../data/graphics-models.json',import.meta.url));
  if(!response.ok)throw Error('Model data unavailable');
  const bank=await response.json();
  let previous='';
  mount('painter',w=>{
    const type=Number(get('painter-model').value),octant=Number(get('painter-octant').value),commands=modelCommands(bank,type,octant),key=`${type}:${octant}`;
    if(key!==previous){get('painter-step').max=String(commands.length);get('painter-step').value=String(commands.length);previous=key;}
    const step=Number(get('painter-step').value);get('painter-value').value=String(step);
    get('painter-result').textContent=`List ${octant} (${octant.toString(2).padStart(3,'0')}): ${step} of ${commands.length} commands drawn. The camera position selects the signs of the opposite, object-minus-observer vector.`;
    return painterDiagram(bank,w,type,octant,step);
  },['painter-model','painter-octant','painter-step']);
}catch{
  get('painter-result').textContent='The interactive model could not load. The original-list illustration above remains available.';
}
