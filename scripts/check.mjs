// Check the standalone publishing boundary, local links, viewer data and social metadata.
import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {worldColours} from '../src/world-colours.js';
import {placementRotation} from '../src/map3d.js';
import {Vector3} from 'three';
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
// Known original six-bit headers guard against 32-bit truncation, reversed
// sky/ground channels and colour leakage when returning to generated layouts.
const colourCases=[
 ['whtsands',[239,251,211],[60,32,247]],
 ['dusk',[60,65,0],[48,52,97]],
 ['other-exp',[77,56,60],[203,105,20]],
 ['other-iceworld',[170,239,227],[69,81,251]],
 ['other-quari',[255,231,0],[8,247,174]],
 ['other-default',[0,170,0],[85,255,255]],
 ['training',[0,170,0],[85,255,255]],
 ['slalom',[0,170,0],[85,255,255]]
];
for(const [id,ground,sky]of colourCases)assert.deepEqual(worldColours(await read('world-'+id+'.json'),[0,0]),{ground,sky},id);
const whiteSands=await read('world-whtsands.json'),dusk=await read('world-dusk.json');
const mixed={...whiteSands,tiles:whiteSands.tiles.map(t=>t.x===1&&t.y===2?{...t,opaque_header_tail:dusk.tiles[0].opaque_header_tail}:t)};
const boundary=[mixed.origin_cm+mixed.tile_size_cm,mixed.origin_cm+2*mixed.tile_size_cm];
assert.deepEqual(worldColours(mixed,boundary),{ground:[60,65,0],sky:[48,52,97]});
assert.deepEqual(worldColours(mixed,[boundary[0]-1,boundary[1]]),{ground:[239,251,211],sky:[60,32,247]});
assert.deepEqual(worldColours(mixed,[-1e10,1e10]),{ground:[239,251,211],sky:[60,32,247]});
// Both Atkinsville aircraft have the same gentle tail-down pitch. Only their
// headings differ: the spare is parked diagonally, not tipped 45 degrees up.
const atkinsville=await read('world-morning.json');
const parked=atkinsville.objects.filter(o=>o.type===2);
assert.equal(parked.length,2);
for(const object of parked){
 const forward=new Vector3(1,0,0).applyEuler(placementRotation(object));
 assert.ok(Math.abs(forward.z-0.14673047445536175)<1e-12);
 if(object.index===173)assert.ok(Math.abs(forward.x+forward.y)<1e-12&&forward.x>0&&forward.y<0);
}
assert.deepEqual(placementRotation({angles_u16:[57344,64000,0]}).toArray(),placementRotation(parked[1]).toArray());
if(errors.length)throw Error([...new Set(errors)].join('\n'));
console.log(`Checked ${list.length} publishing files, ${links} local links, ${catalog.banks.length} model collections and ${catalog.worlds.length} worlds.`);
