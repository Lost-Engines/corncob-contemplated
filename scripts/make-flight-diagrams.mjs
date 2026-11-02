import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import * as figures from '../src/flight-diagrams.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const data=JSON.parse(await readFile(path.join(root,'public/data/flight-samples.json'),'utf8'));
const dir=path.join(root,'public/images/flight');
await mkdir(dir,{recursive:true});
for(const [name,fn] of Object.entries({lift:figures.liftDiagram,atmosphere:figures.atmosphereDiagram,controls:figures.controlsDiagram,landing:figures.landingDiagram,thrust:figures.thrustDiagram,airflow:(_,w)=>figures.airflowDiagram(w),bank:(_,w)=>figures.bankDiagram(w)})) {
  for(const [suffix,width]of [['',820],['-compact',360]])await writeFile(path.join(dir,name+suffix+'.svg'),fn(data,width)+'\n');
}
console.log('Wrote seven flight diagrams in two layouts.');
