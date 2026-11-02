// Regenerate committed diagrams from the site's existing model snapshot.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {corncobModelColourValues} from '../src/model-engine.js';
import {nearDiagram,scanDiagram,planeDiagram,painterDiagram,primitiveDiagram,transformDiagram,discDiagram} from '../src/graphics-diagrams.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
const bank=await read('public/data/models-deluxe_dnk.json');
const objects=bank.objects.filter(o=>[2,6,7].includes(o.type));
const models=Object.fromEntries(objects.map(o=>[o.model_variants[0],bank.models[o.model_variants[0]]]));
const keys=[...new Set(Object.values(models).flatMap(m=>m.octants.flat().map(c=>c.primitive)))];
const subset={objects:objects.map(({type,model_variants})=>({type,model_variants:[model_variants[0]]})),models,
  primitives:Object.fromEntries(keys.map(k=>[k,bank.primitives[k]])),
  colours:Object.fromEntries(objects.map(o=>[o.type,Object.fromEntries(corncobModelColourValues(bank.runtime_colours,0,0,o))]))};
await writeFile(path.join(root,'public/data/graphics-models.json'),JSON.stringify(subset)+'\n');
const masks=await read('content/graphics-disc-masks.json');
const output=path.join(root,'public/images/graphics');await mkdir(output,{recursive:true});
for(const [name,draw]of Object.entries({near:nearDiagram,scan:scanDiagram,planes:planeDiagram,painter:w=>painterDiagram(subset,w),primitives:primitiveDiagram,transforms:transformDiagram,discs:w=>discDiagram(masks,w)})){
 for(const [suffix,w]of [['',820],['-compact',360]])await writeFile(path.join(output,name+suffix+'.svg'),draw(w)+'\n');
}
console.log('Generated seven graphics diagrams, their compact layouts and the three-model illustration snapshot.');
