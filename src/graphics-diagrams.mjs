// Explanatory SVG diagrams. The painter uses recovered model data; the other
// diagrams use deliberately small inputs rather than claiming native frames.
import {corncobEgaPalette} from './model-engine.js';
const C={bg:'#10231d',ink:'#edf2dd',muted:'#bbccbd',grid:'#345044',green:'#a3d4ae',gold:'#f0cd82',red:'#f0a195'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(s,x,y,fill=C.muted,size=15,extra='')=>`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" ${extra}>${esc(s)}</text>`;
const line=(a,b,colour=C.grid,width=1,extra='')=>`<path d="M${a.join(',')}L${b.join(',')}" fill="none" stroke="${colour}" stroke-width="${width}" ${extra}/>`;
const rect=(x,y,w,h,fill,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const dot=(x,y,fill=C.gold,r=4)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const svg=(w,h,title,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}"><rect width="${w}" height="${h}" rx="4" fill="${C.bg}"/><g font-family="ui-sans-serif,system-ui,sans-serif">${body}</g></svg>`;
const rgb=index=>`rgb(${corncobEgaPalette[index&15].join(',')})`;

export function clipExample(depth){
  if(depth>300)return null;
  const lateral=-180+Math.trunc(400*(300-depth)/(1600-depth));
  return {depth:301,lateral,screenX:319-Math.trunc(300*lateral/301)};
}
export function nearDiagram(w=820,depth=100){
  const x=d=>34+(d+200)/1800*(w-68),y=n=>162-n*.32,hit=clipExample(depth);
  let b=text('Clip before the perspective divide',18,29,C.ink,w<500?16:20);
  b+=rect(x(-200),48,x(300)-x(-200),211,'#382f25');
  b+=line([x(-200),y(0)],[x(1600),y(0)],C.grid)+line([x(300),51],[x(300),261],C.gold,2);
  b+=text('X = 300',x(300)+6,67,C.gold,13);
  b+=line([x(depth),y(-180)],[x(1600),y(220)],C.red,2,'stroke-dasharray="5 5"');
  if(hit){b+=line([x(300),y(hit.lateral)],[x(1600),y(220)],C.green,3)+dot(x(300),y(hit.lateral));}
  else b+=line([x(depth),y(-180)],[x(1600),y(220)],C.green,3);
  b+=dot(x(depth),y(-180),hit?C.red:C.green)+dot(x(1600),y(220),C.green);
  b+=text('A',x(depth)-6,y(-180)+22,C.ink)+text('B',x(1600)-5,y(220)-13,C.ink);
  b+=dot(x(0),y(0),C.ink,3)+text('Eye',x(0)-10,y(0)-12,C.ink,12);
  for(const d of [-200,0,800,1600])b+=text(d,x(d),284,C.muted,12,'text-anchor="middle"');
  b+=text('Depth X →',w/2,308,C.muted,13,'text-anchor="middle"');
  return svg(w,325,'A crossing edge clipped at camera depth 300',b);
}
const ring=[[3,4],[23,2],[29,14],[8,18]];
export function scanInterval(row){
  const hits=[];
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    if(row>=Math.min(a[1],b[1])&&row<Math.max(a[1],b[1]))hits.push(a[0]+(row-a[1])*(b[0]-a[0])/(b[1]-a[1]));
  }
  return hits.sort((a,b)=>a-b);
}
export function scanDiagram(w=820,row=9){
  const cell=Math.min((w-28)/32,13),ox=(w-32*cell)/2,oy=55,h=oy+20*cell+35;
  let b=text('Two edges, one span per row',18,29,C.ink,w<500?17:20);
  for(let y=0;y<=row;y++){
    const [left,right]=scanInterval(y+.5);
    if(left===undefined)continue;
    for(let x=Math.ceil(left-.5);x<right-.5;x++)b+=rect(ox+x*cell,oy+y*cell,cell,cell,y===row?C.gold:'#457959');
  }
  for(let x=0;x<=32;x++)b+=line([ox+x*cell,oy],[ox+x*cell,oy+20*cell]);
  for(let y=0;y<=20;y++)b+=line([ox,oy+y*cell],[ox+32*cell,oy+y*cell]);
  b+=`<polygon points="${ring.map(([x,y])=>[ox+x*cell,oy+y*cell].join(',')).join(' ')}" fill="none" stroke="${C.ink}" stroke-width="2"/>`;
  const hit=scanInterval(row+.5);
  if(hit.length===2){for(const x of hit)b+=dot(ox+x*cell,oy+(row+.5)*cell);}
  b+=text('Filled rows above; current span in gold',w/2,h-12,C.muted,w<500?12:14,'text-anchor="middle"');
  return svg(w,h,'Polygon edge walkers and successive scanlines',b);
}
export function planeDiagram(w=820,pixel=3,colour=14){
  const values=[0,1,2,14,4,6,7,15];values[pixel]=colour;
  const x0=w<500?59:150,cell=Math.min((w-x0-20)/8,60),cy=67;
  let b=text('One byte in each plane = eight pixels',18,28,C.ink,w<500?15:20);
  for(let bit=0;bit<4;bit++){
    const y=cy+bit*44;b+=text(`Bit ${bit}`,x0-48,y+23,C.muted,14);
    for(let i=0;i<8;i++){
      const one=(values[i]>>bit)&1;
      b+=rect(x0+i*cell,y,cell-2,32,one?'#42664e':'#1b3428');
      b+=text(one,x0+(i+.5)*cell-1,y+23,i===pixel?C.gold:C.ink,16,'text-anchor="middle"');
    }
  }
  b+=rect(x0+pixel*cell-2,cy-8,cell+2,181,'none',`stroke="${C.gold}" stroke-width="2"`);
  for(let i=0;i<8;i++){
    b+=rect(x0+i*cell,259,cell-2,32,rgb(values[i]));
    b+=text(values[i],x0+(i+.5)*cell-1,314,C.ink,13,'text-anchor="middle"');
  }
  b+=text('Index',x0-48,281,C.muted,13);
  return svg(w,335,'Four bit planes combine into eight palette indices',b);
}
export function modelCommands(bank,type,octant){
  const object=bank.objects.find(o=>o.type===Number(type));
  return bank.models[object.model_variants[0]].octants[octant];
}
export function painterDiagram(bank,w=820,type=7,octant=7,step=Infinity){
  const object=bank.objects.find(o=>o.type===Number(type)),model=bank.models[object.model_variants[0]],commands=model.octants[octant];
  step=Math.min(commands.length,step);
  const primitives=[...new Set(model.octants.flat().map(c=>c.primitive))].map(k=>bank.primitives[k]);
  const positions=primitives.flatMap(p=>[...(p.vertices||[]),...(p.points||[]).map(q=>q.position),...(p.lines||[]).flatMap(l=>l.segments.flat())]);
  const centre=[0,1,2].map(i=>(Math.min(...positions.map(v=>v[i]))+Math.max(...positions.map(v=>v[i])))/2);
  const extent=Math.max(...positions.map(p=>Math.hypot(...p.map((v,i)=>v-centre[i]))));
  const eye=[octant&4?1:-1,octant&2?1:-1,octant&1?.65:-.65],len=Math.hypot(...eye);
  const e=eye.map(v=>v/len),hor=Math.hypot(e[0],e[1]);
  const right=[e[1]/hor,-e[0]/hor,0],up=[-e[2]*e[0]/hor,-e[2]*e[1]/hor,hor];
  const compact=w<600,sceneWidth=compact?w:w*.62,height=compact?495:355,scale=Math.min(sceneWidth*.40,128)/extent;
  const project=p=>{const d=p.map((v,i)=>v-centre[i]);return [sceneWidth/2+d.reduce((s,v,i)=>s+v*right[i],0)*scale,179-d.reduce((s,v,i)=>s+v*up[i],0)*scale];};
  const palette=c=>rgb(c.indirect?(bank.colours[type]?.[c.word]??c.index):c.index);
  let b=text(`${{7:'Ground crew',2:'Aircraft',6:'Control tower'}[type]} · list ${octant}`,18,29,C.ink,20);
  for(const command of commands.slice(0,step)){
    const p=bank.primitives[command.primitive];
    if(p.kind===8)b+=`<polygon points="${p.vertices.map(v=>project(v).join(',')).join(' ')}" fill="${palette(p.colour)}"/>`;
    for(const l of p.lines||[])for(const [a,c] of l.segments)b+=line(project(a),project(c),palette(l.colour),1.8);
    for(const q of p.points||[]){const [x,y]=project(q.position);b+=dot(x,y,palette(q.colour),q.diameter?q.diameter*scale/2:1.5);}
  }
  const kind=k=>({0:'empty',2:'lines',4:'points',6:'discs',8:'polygon'}[k]);
  const labels=compact?6:4,x0=compact?18:sceneWidth+10,y0=compact?339:66,space=(compact?w-36:w-x0-15)/labels;
  b+=text('Drawing order',x0,y0-17,C.muted,14);
  commands.forEach((c,i)=>{
    const x=x0+(i%labels)*space,y=y0+Math.floor(i/labels)*32;
    b+=rect(x,y,space-5,25,i<step?'#42664e':'#1b3428',i===step-1?`stroke="${C.gold}"`:'');
    b+=text(i+1,x+(space-5)/2,y+18,i<step?C.ink:C.muted,13,'text-anchor="middle"');
  });
  const last=commands[step-1];
  b+=text(last?`${step}/${commands.length}: ${kind(last.kind)} ${last.primitive.split(':')[1]}`:`0/${commands.length}: empty view`,x0,compact?height-13:height-39,C.gold,14);
  if(!compact)b+=text('Later commands paint over earlier ones.',18,height-14,C.muted,13);
  return svg(w,height,'Original model command list drawn in order',b);
}
export function primitiveDiagram(w=820){
  const small=w<600,cols=small?2:4,cell=(w-28)/cols,h=small?480:290;
  let b=text('A small vocabulary',18,29,C.ink,20);
  for(let i=0;i<4;i++){
    const x=14+(i%cols)*cell,y=58+Math.floor(i/cols)*210,cx=x+cell/2;
    if(i===0)b+=`<polygon points="${[[x+18,y+95],[cx+20,y+20],[x+cell-18,y+100],[cx-20,y+135]].map(p=>p.join(',')).join(' ')}" fill="${C.green}"/>`;
    if(i===1)b+=`<polyline points="${[[x+14,y+110],[cx-15,y+25],[cx+33,y+85],[x+cell-17,y+40]].map(p=>p.join(',')).join(' ')}" stroke="${C.green}" stroke-width="3" fill="none"/>`;
    if(i===2)for(let n=0;n<22;n++)b+=rect(x+18+(n*37)%(cell-36),y+22+(n*19)%112,3,3,C.green);
    if(i===3)for(const [dx,dy,r]of [[-21,98,24],[22,60,16],[-24,23,8]])b+=dot(cx+dx,y+dy,C.green,r);
    b+=text(['Filled polygon','Connected lines','Points','Discs'][i],cx,y+172,C.ink,15,'text-anchor="middle"');
    b+=text(['bodywork','mouth, antenna','ground detail','head, wheel, blast'][i],cx,y+194,C.muted,13,'text-anchor="middle"');
  }
  return svg(w,h,'The four visible primitive kinds',b);
}
export function transformDiagram(w=820){
  const compact=w<600,labels=[['Model','Local vertices'],['Object → world','Object attitude'],['World → view','Observer + camera'],['View → screen','Clip, then divide']];
  let b=text('From a vertex to a pixel',18,29,C.ink,20);
  for(let i=0;i<4;i++){
    const x=compact?28:16+i*(w/4),y=compact?57+i*92:82,bw=compact?w-56:w/4-24;
    b+=rect(x,y,bw,64,'#294735',`rx="5"`)+text(labels[i][0],x+bw/2,y+24,C.ink,15,'text-anchor="middle"')+text(labels[i][1],x+bw/2,y+47,C.muted,12,'text-anchor="middle"');
    if(i<3)b+=text(compact?'↓':'→',compact?w/2:x+bw+5,compact?y+84:y+39,C.gold,22,compact?'text-anchor="middle"':'');
  }
  if(!compact){b+=text('Rotation matrices are combined for reuse.',w/2,211,C.green,16,'text-anchor="middle"');b+=text('Distance scaling keeps the integer coordinates in range.',w/2,243,C.muted,15,'text-anchor="middle"');}
  return svg(w,compact?430:280,'Model, world, camera and screen coordinate transforms',b);
}
export function discDiagram(masks,w=820){
  const compact=w<600,cols=compact?3:6,sizes=[1,3,5,8,12,16],cw=(w-24)/cols,cell=compact?5:6,height=compact?320:210;
  let b=text('Small-disc masks',18,29,C.ink,20);
  sizes.forEach((d,i)=>{
    const x=12+(i%cols)*cw+cw/2,y=compact?98+Math.floor(i/cols)*143:108;
    for(const row of masks[d])for(let bit=0;bit<16;bit++)if(row.mask&(1<<bit))b+=rect(x+(7-bit)*cell,y+row.y*cell,cell,cell,C.gold,'shape-rendering="crispEdges"');
    b+=text(`Diameter ${d}`,x,y+64,C.muted,13,'text-anchor="middle"');
  });
  return svg(w,height,'Original small-disc raster masks enlarged to show individual pixels',b);
}
