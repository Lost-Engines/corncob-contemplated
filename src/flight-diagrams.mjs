// Native measurements are supplied as data. Only presentation geometry lives here.
const C = {bg:'#10231d',ink:'#edf2dd',muted:'#bbccbd',grid:'#345044',green:'#a3d4ae',gold:'#f0cd82',red:'#f0a195'};
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (s,x,y,fill=C.muted,size=14,anchor='start') => '<text x="'+x+'" y="'+y+'" fill="'+fill+'" font-size="'+size+'" text-anchor="'+anchor+'">'+esc(s)+'</text>';
const line = (x1,y1,x2,y2,c=C.grid,width=1,extra='') => '<path d="M'+x1+','+y1+'L'+x2+','+y2+'" fill="none" stroke="'+c+'" stroke-width="'+width+'" '+extra+'/>';
const dot = (x,y,c=C.gold,r=4) => '<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="'+c+'"/>';
const svg = (w,h,title,b) => '<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(title)+'"><rect width="'+w+'" height="'+h+'" rx="4" fill="'+C.bg+'"/><g font-family="ui-sans-serif,system-ui,sans-serif">'+b+'</g></svg>';
const curve = (points,x,y,c,dashed=false) => '<path d="'+points.map(([a,b],i)=>(i?'L':'M')+x(a).toFixed(2)+','+y(b).toFixed(2)).join(' ')+'" fill="none" stroke="'+c+'" stroke-width="2.5" '+(dashed?'stroke-dasharray="7 4"':'')+'/>';
const arrow = (a,b,c=C.gold) => {
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),r=9;
  return line(...a,...b,c,2.5)+'<path d="M'+(b[0]-r*Math.cos(angle-.45))+','+(b[1]-r*Math.sin(angle-.45))+'L'+b.join(',')+'L'+(b[0]-r*Math.cos(angle+.45))+','+(b[1]-r*Math.sin(angle+.45))+'" fill="none" stroke="'+c+'" stroke-width="2.5"/>';
};
function plot(w,title,xmax,ymax,xticks,yticks,xlabel,ylabel,legends) {
  const top=110,bottom=320,h=385,left=48,right=w-23;
  const x=v=>left+v/xmax*(right-left),y=v=>bottom-v/ymax*(bottom-top);
  let body=text(title,18,29,C.ink,w<500?17:21)+text(ylabel,18,98,C.muted,12);
  legends.forEach(([s,c,dash],i)=>{
    const yy=52+i*20; body+=line(18,yy-4,43,yy-4,c,2.5,dash?'stroke-dasharray="6 3"':'')+text(s,51,yy,C.muted,13);
  });
  for(const v of yticks)body+=line(left,y(v),right,y(v))+text(v,left-10,y(v)+4,C.muted,12,'end');
  for(const v of xticks)body+=line(x(v),top,x(v),bottom)+text(v,x(v),bottom+22,C.muted,12,'middle');
  body+=text(xlabel,w/2,h-15,C.muted,w<500?12:14,'middle');
  return {x,y,h,body};
}
export const liftPeak = data => Math.max(...data.lift.map(r=>r.clean.force));
export function liftDiagram(data,w=820,angle=12) {
  const scale=liftPeak(data),p=plot(w,'Lift, then a sharp drop',30,4,[0,5,10,15,20,25,30],[0,1,2,3,4],'Angle of attack (degrees)','Relative to the clean peak',[['Flaps down',C.gold],['Flaps up',C.green,true]]);
  let b=p.body;
  for(const a of [16,21.3])b+=line(p.x(a),110,p.x(a),320,C.muted,1,'stroke-dasharray="2 5"');
  for(const key of ['flaps','clean'])b+=curve(data.lift.map(r=>[r.degrees,r[key].force/scale]),p.x,p.y,key==='clean'?C.green:C.gold,key==='clean');
  const row=data.lift[Math.round(angle*4)];
  b+=line(p.x(row.degrees),110,p.x(row.degrees),320,C.ink,1);
  for(const key of ['flaps','clean'])b+=dot(p.x(row.degrees),p.y(row[key].force/scale),key==='clean'?C.green:C.gold,5);
  return svg(w,p.h,'Lift samples from original Corncob, with and without flaps',b);
}
export function atmosphereDiagram(data,w=820,metres=2000) {
  const p=plot(w,'The air runs out',16,110,[0,4,8,12,16],[0,25,50,75,100],'Height above world zero (km)','Percent of reference maximum',[['Engine power factor',C.gold],['Air density',C.green,true]]);
  let b=p.body;
  b+=curve(data.atmosphere.map(r=>[r.metres/1000,r.power/65535*100]),p.x,p.y,C.gold);
  b+=curve(data.atmosphere.map(r=>[r.metres/1000,r.density/5957*100]),p.x,p.y,C.green,true);
  const row=data.atmosphere[Math.round(metres/250)];
  b+=line(p.x(row.metres/1000),110,p.x(row.metres/1000),320,C.ink,1);
  for(const [key,div,c] of [['power',65535,C.gold],['density',5957,C.green]])b+=dot(p.x(row.metres/1000),p.y(row[key]/div*100),c,5);
  return svg(w,p.h,'Original engine power factor and air density at different altitudes',b);
}
export function controlsDiagram(data,w=820,speed=4800) {
  const max=Math.max(...data.control_speed.map(r=>r.sea)),p=plot(w,'More speed, up to a point',2,110,[0,.5,1,1.5,2],[0,25,50,75,100],'Forward airflow / control cap','Initial roll response (%)',[['Sea-level density',C.gold],['About half that density',C.green,true]]);
  let b=p.body;
  for(const [key,c,dash]of [['sea',C.gold,false],['thin',C.green,true]])b+=curve(data.control_speed.map(r=>[r.speed/4800,r[key]/max*100]),p.x,p.y,c,dash);
  const row=data.control_speed[Math.round(speed/200)];
  b+=line(p.x(row.speed/4800),110,p.x(row.speed/4800),320,C.ink,1);
  for(const [key,c]of [['sea',C.gold],['thin',C.green]])b+=dot(p.x(row.speed/4800),p.y(row[key]/max*100),c,5);
  return svg(w,p.h,'Native first-pass roll response reaches a speed cap',b);
}
export function thrustDiagram(data,w=820) {
  const max=data.thrust_speed[0].thrust,p=plot(w,'Power divided by speed',3,110,[0,1,2,3],[0,25,50,75,100],'Forward speed / divisor floor','Full-power thrust (%)',[['Thrust alone; identical drag subtracted',C.gold]]);
  return svg(w,p.h,'Native thrust has a low-speed plateau and then falls as speed rises',p.body+curve(data.thrust_speed.map(r=>[r.speed/4800,r.thrust/max*100]),p.x,p.y,C.gold));
}
export function contact(data,roll,height,surface) {
  const row=data.wheels[roll+50],compression=row.clearance+90-Math.round(height*100);
  const crash=surface==='runway'?540:270,fatal=crash*2;
  return {row,compression,crash,fatal,state:compression>=fatal?'Fatal contact':compression>=crash?'Crash landing':compression>=0?'Gear contact':'Airborne'};
}
export function landingDiagram(data,w=820,roll=10,height=10,surface='runway') {
  const result=contact(data,roll,height,surface),cx=w/2,ground=283,scale=5.5,cy=ground-height*scale,rad=roll*Math.PI/180;
  const project=(a,z)=>[cx+a*scale,cy-z*scale];
  const wing=side=>project(side*18*Math.cos(rad),side*18*Math.sin(rad));
  let b=text('Two wheels decide the landing',18,29,C.ink,w<500?16:21);
  b+=text('Front view · fixed level pitch',18,53,C.muted,13);
  b+='<rect x="18" y="'+ground+'" width="'+(w-36)+'" height="100" fill="#294735"/>';
  b+=line(18,ground,w-18,ground,C.green,2);
  b+=line(...wing(-1),...wing(1),C.ink,5)+dot(cx,cy,C.ink,7);
  for(let i=0;i<2;i++){
    const side=i===0?1:-1,localY=side*15.6,localZ=-7.2;
    const lateral=localY*Math.cos(rad)-localZ*Math.sin(rad),z=-result.row.wheels[i]/100;
    const foot=project(lateral,z),root=project(localY*.5*Math.cos(rad),localY*.5*Math.sin(rad));
    b+=line(...root,...foot,C.muted,3)+dot(...foot,foot[1]>=ground?C.gold:C.ink,5);
  }
  const c=result.state==='Fatal contact'||result.state==='Crash landing'?C.red:C.gold;
  b+=text(result.state,cx,410,c,20,'middle');
  b+=text('Compression: '+(result.compression/100).toFixed(2)+' m',cx,436,C.muted,14,'middle');
  b+=text(surface==='runway'?'Runway / supporting surface':'Grass',24,ground+24,C.green,13);
  b+=text('Geometry is schematic; heights come from the native routine.',cx,470,C.muted,w<500?10:13,'middle');
  return svg(w,487,'Landing-gear contact for roll '+roll+' degrees and height '+height+' metres: '+result.state,b);
}
export function airflowDiagram(w=820) {
  const cx=w*.40,cy=152,len=Math.min(205,w*.36),a=18*Math.PI/180;
  let b=text('Pointing and travelling',18,29,C.ink,w<500?18:21);
  b+=arrow([cx-len*.65,cy],[cx+len,cy],C.green);
  b+=arrow([cx-len*.65*Math.cos(a),cy+len*.65*Math.sin(a)],[cx+len*Math.cos(a),cy-len*Math.sin(a)],C.gold);
  b+=dot(cx,cy,C.ink,5);
  b+=text('Nose / body X',cx+len*Math.cos(a)-4,cy-len*Math.sin(a)-16,C.gold,14,'end');
  b+=text('Velocity',cx+len,cy+27,C.green,14,'end');
  b+='<path d="M'+(cx+60)+','+cy+'A60,60 0 0,0 '+(cx+60*Math.cos(a))+','+(cy-60*Math.sin(a))+'" fill="none" stroke="'+C.ink+'" stroke-width="1.5"/>';
  b+=text('α',cx+75,cy-8,C.ink,18);
  b+=text('Relative airflow comes from the opposite direction.',w/2,238,C.muted,w<500?12:15,'middle');
  b+=text('This angle is not the nose’s angle to the horizon.',w/2,262,C.muted,w<500?12:15,'middle');
  return svg(w,283,'The angle of attack is between the aircraft axis and its motion through the air',b);
}
export function bankDiagram(w=820) {
  const compact=w<550,h=compact?450:300;
  let b=text('Lift turns with the aircraft',18,29,C.ink,compact?18:21);
  for(const [i,deg]of [0,45].entries()) {
    const cx=compact?w/2:w*(i?.74:.26),cy=compact?142+i*200:195,r=deg*Math.PI/180,L=100;
    b+=line(cx-75*Math.cos(r),cy+75*Math.sin(r),cx+75*Math.cos(r),cy-75*Math.sin(r),C.ink,4);
    b+=arrow([cx,cy],[cx-L*Math.sin(r),cy-L*Math.cos(r)],C.gold);
    if(deg){b+=arrow([cx,cy],[cx,cy-L*Math.cos(r)],C.green)+line(cx-L*Math.sin(r),cy-L*Math.cos(r),cx,cy-L*Math.cos(r),C.muted,1,'stroke-dasharray="4 4"');}
    b+=text(deg?'45° bank: 71% vertical':'Wings level: all vertical',cx,cy+57,C.muted,compact?13:15,'middle');
  }
  return svg(w,h,'At 45 degrees of bank the same lift has only 71 percent of its original vertical component',b);
}
