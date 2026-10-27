// Selection is a single, unmodified primary-button tap. Once a gesture moves,
// it stays a drag even if the pointer returns to its starting position.
export function onPointerTap(element,select){
 const pointers=new Set(),document=element.ownerDocument,window=document.defaultView;
 let tap=null;
 const modified=e=>e.altKey||e.ctrlKey||e.metaKey||e.shiftKey;
 const down=e=>{
  tap=pointers.size===0&&e.button===0&&!modified(e)?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
  pointers.add(e.pointerId);
 };
 const move=e=>{
  if(!tap||e.pointerId!==tap.id)return;
  if(modified(e)||(e.pointerType!=='touch'&&e.buttons!==1)){tap=null;return;}
  for(const point of [...(e.getCoalescedEvents?.()||[]),e])if(Math.hypot(point.clientX-tap.x,point.clientY-tap.y)>4){tap=null;break;}
 };
 const up=e=>{
  const candidate=tap;tap=null;pointers.delete(e.pointerId);
  if(!candidate||candidate.id!==e.pointerId||pointers.size||e.button!==0||modified(e)||Math.hypot(e.clientX-candidate.x,e.clientY-candidate.y)>4)return;
  const r=element.getBoundingClientRect();
  if(e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom)select(e);
 };
 const cancel=e=>{pointers.delete(e.pointerId);tap=null;};
 const clear=()=>{pointers.clear();tap=null;};
 const wheel=()=>{tap=null;};
 const blur=e=>{if(e.target===window)clear();};
 // Document capture also sees motion/release outside the canvas. It runs before
 // controls release pointer capture, without taking capture away from them.
 const listeners=[[element,'pointerdown',down],[document,'pointermove',move],[document,'pointerup',up],[document,'pointercancel',cancel],[element,'lostpointercapture',cancel],[element,'wheel',wheel],[window,'blur',blur]];
 for(const [target,type,handler]of listeners)target.addEventListener(type,handler,{capture:true,passive:true});
 return ()=>{for(const [target,type,handler]of listeners)target.removeEventListener(type,handler,true);clear();};
}
