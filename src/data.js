const root = new URL('../data/', import.meta.url);
const cache = new Map();
export const $ = id => document.getElementById(id);
export const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function load(file) {
  if (!cache.has(file)) cache.set(file,fetch(new URL(file,root)).then(r=>{if(!r.ok)throw Error('This collection could not be loaded. Please try again.');return r.json();}).catch(e=>{cache.delete(file);throw e;}));
  return cache.get(file);
}
export function options(select,values) { select.replaceChildren(...values.map(([id,label])=>new Option(label,id))); }
export function entries(bank,types) {
  return [...bank.objects.map(o=>({...o,...types[o.type],id:String(o.type)})),...(bank.runtime_variants||[]).filter(o=>!o.id.startsWith('stored-')&&(!o.source_only||bank.objects.length===0)).map(o=>({...bank.objects[o.type],...types[o.type],...o,name:o.name.replace(' (earlier geometry)','')}))];
}
export function category(object) {
  if(object.source_only)return 'experiments';
  if(object.id==='sun')return 'sky';
  if(object.id==='experimental-aircraft'||[2,28,29].includes(object.type))return 'aircraft';
  if([7,12,48,57].includes(object.type))return 'people';
  if([0,1,11,13,23,24,40,41,42,49,50,51,52,53,58].includes(object.type))return 'aliens';
  if([8,9,10,18,19,20,21,22,25,26,30,32].includes(object.type))return 'effects';
  return 'scenery';
}
const notes={
  '7':'Approach on foot and the ground crew raise a finger. It stays raised after you leave. The three poses are separate arrangements, not a smooth animation.',
  '2':'The ordinary propeller aircraft. Other flags select the reserve and experimental variants; those are not a collection of unrelated flight models.',
  '0':'A generator orb powers the forcefields around its installation. Its cycling colours are part of the model’s runtime palette rules.',
  '1':'A mindbender distorts the view as you approach. Some sites require a planted charge rather than an ordinary attack from the air.',
  '3':'The dish rotates during play. Its wreck is a separate appearance even though the game reuses the destroyed fuel-dump object type.',
  '6':'The tower leads to the intelligence reader. In the DOS game its doorway can show through the back; that was an original drawing-order quirk.',
  '12':'These small wheeled vehicles chase a pilot on foot. Close up, the wireframe construction has a definite shopping-trolley quality.',
  '19':'The explosion changes through three stored colour stages. Choose “Cycle stages” and enable movement to preview them.',
  '31':'A survey marker: a yellow pad with a black cross. The training generator leaves them at distant corners too. They are not generator sites.',
  '49':'A shell can conceal an alien. The source-only slalom configuration reuses the same object slot for a tree, with different behaviour.',
  'experimental-aircraft':'The angular black aircraft parked at White Sands. Its faster travel comes from moving four times as far at the same internal velocity. It still shares the propeller cockpit.',
  'sun':'The sun is geometry too. Early builds switch to its face-and-rays model when the ground crew make their rude gesture; later builds retain the face without a confirmed trigger.',
  'source-farm':'The slalom barn replaces a saucer. When destroyed it becomes the ordinary fuel-dump wreck and throws off fragments; there is no separate collapsed-barn model.',
  'source-tree':'The slalom source replaces the shell with a tree. Its far model economises on the trunk.',
  'source-blue_crater':'The source reuses crater geometry, makes it much larger and fixes the colour to blue. A pond is the likely intention.',
  'source-traffic-aircraft':'Three of these fly straight over the slalom course. They reuse the saucer-site slot and cannot be boarded. Traffic is our interpretation of their role.'
};
export const modelNote = o => notes[o.id] || 'Recovered from the original model definitions. The gallery uses the game’s colours and ordered drawing lists with modern projection.';
export function permalink(values) { const url=new URL(location.href);url.search='';for(const [k,v]of Object.entries(values))if(v!==null&&v!==undefined&&v!=='')url.searchParams.set(k,v);history.replaceState(null,'',url); }
