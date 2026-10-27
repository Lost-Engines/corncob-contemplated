// Check the standalone publishing boundary, local links, viewer data and social metadata.
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist'),errors=[];
async function files(dir){const result=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);result.push(...e.isDirectory()?await files(p):[p]);}return result;}
const list=await files(root);let links=0;
for(const file of list){
 if(/\.(exe|sav|dat|cct|def|zip|bin|asm)$/i.test(file))errors.push(`Raw game/source file in public exhibit: ${file}`);
 if(!/\.(html|css)$/.test(file))continue;
 const text=await readFile(file,'utf8'),refs=file.endsWith('.css')?[...text.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)].map(m=>m[1]):[...text.matchAll(/\b(?:href|src|poster)="([^"]+)"/g)].map(m=>m[1]);
 for(let value of refs){value=value.replaceAll('&amp;','&');if(/^(https?:|data:|mailto:|#)/.test(value))continue;const url=new URL(value,`https://local/${path.relative(root,file)}`);let target=path.join(root,decodeURIComponent(url.pathname));try{if((await stat(target)).isDirectory())target=path.join(target,'index.html');await stat(target);if(url.hash&&target.endsWith('.html')){const page=await readFile(target,'utf8');if(!page.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`))errors.push(`Missing anchor ${value} in ${file}`);}links++;}catch{errors.push(`Missing local link ${value} in ${file}`);}}
 if(file.endsWith('index.html')&&!text.includes('og:image:width'))errors.push(`Missing social metadata: ${file}`);
}
const read=async name=>JSON.parse(await readFile(path.join(root,'data',name),'utf8')),catalog=await read('catalog.json');
for(const collection of catalog.banks){const bank=await read(collection.file);for(const object of [...bank.objects,...(bank.runtime_variants||[])])for(const pose of object.states?.length?object.states:[object])for(const id of pose.model_variants){if(!bank.models[id])errors.push(`${collection.id}: absent model ${id}`);}for(const [id,model]of Object.entries(bank.models))for(const list of model.octants)for(const command of list)if(!bank.primitives[command.primitive])errors.push(`${collection.id}/${id}: missing primitive ${command.primitive}`);}
for(const item of catalog.worlds){const world=await read(item.file);if(world.objects.length!==item.objects)errors.push(`Incorrect placement count for ${item.id}`);for(const object of world.objects)if(object.position_cm.length!==3||!object.position_cm.every(Number.isFinite))errors.push(`Invalid position in ${item.id}`);}
for(const file of list.filter(f=>f.endsWith('.html'))){const text=await readFile(file,'utf8');for(const m of text.matchAll(/href="#([^"]+)"/g))if(!text.includes(`id="${m[1]}"`))errors.push(`Missing same-page fragment #${m[1]} in ${file}`);}
if(errors.length)throw Error([...new Set(errors)].join('\n'));
console.log(`Checked ${list.length} publishing files, ${links} local links, ${catalog.banks.length} model collections and ${catalog.worlds.length} worlds.`);
