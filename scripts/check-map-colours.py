#!/usr/bin/env python3
"""Check world colour bindings, shared phases, instance flags and pause controls.

Requires Python Playwright, Chromium and a served site build.
"""
import argparse,asyncio,json,os,shutil
from pathlib import Path
from playwright.async_api import async_playwright
if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
 import playwright._impl._transport as transport
 transport.compute_driver_executable=lambda:(shutil.which('node'),os.environ['PLAYWRIGHT_DRIVER_CLI'])
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:4176/corncob-contemplated/');parser.add_argument('--output');args=parser.parse_args()
async def main():
 async with async_playwright() as p:
  launch={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']}
  if shutil.which('chromium'):launch['executable_path']=shutil.which('chromium')
  browser=await p.chromium.launch(**launch);page=await browser.new_page(viewport={'width':1440,'height':1000});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(args.url+'atlas/?world=training&object=54')
  await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
  assert await page.locator('#cycle-colours').is_checked()
  # Freeze after orbit damping has settled; pausing must preserve the current
  # colour, and the real canvas must change again when cycling resumes.
  await page.wait_for_timeout(500);await page.uncheck('#cycle-colours');await page.wait_for_timeout(200)
  canvas=page.locator('#map3d canvas');frozen=await canvas.screenshot();await page.wait_for_timeout(200)
  assert frozen==await canvas.screenshot(),'Paused colour frame changed'
  await page.check('#cycle-colours');changed=False
  for _ in range(4):
   await page.wait_for_timeout(100)
   if frozen!=await canvas.screenshot():changed=True;break
  assert changed,'Cycling did not change rendered orb pixels'
  await page.uncheck('#cycle-colours');await page.click('#view-2d');assert await page.locator('#cycle-colours').is_disabled()
  await page.click('#view-3d');assert not await page.locator('#cycle-colours').is_checked()
  result=await page.evaluate(r'''async ()=>{
   const require=(value,message)=>{if(!value)throw Error(message);};
   const module=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/map3d-[^/]+\.js/.test(n));
   const {MapScene}=await import(module),read=n=>fetch(new URL('../data/'+n,module)).then(r=>r.json()),catalog=await read('catalog.json');
   const results={};
   for(const id of ['training','morning','other-exp','slalom']){
    const world=await read('world-'+id+'.json'),host=document.createElement('div');host.style='width:512px;height:512px';document.body.append(host);
    const scene=new MapScene(host,()=>{});await scene.world(world,catalog);
    const records=scene.colouredObjects,geometries=scene.groups.flatMap(g=>g.children.map(c=>c.geometry));
    let randomBindings=0;
    for(const [frame,expected]of [3,14,11,4,12,3,3,5,2,4].entries()){
     scene.updateModelColours((frame+.01)/30);
     for(const record of records)for(const b of record.bindings){
      const rule=record.rules.rules.find(r=>r.address===b.address&&(!r.types||r.types.includes(record.object.type)));
      const random=rule.kind==='random'||rule.random_types?.includes(record.object.type);
      if(random){require(b.index===expected,id+' shared colour mismatch');require(b.target.material===b.materials[expected],id+' material not updated');randomBindings++;}
     }
    }
    require(randomBindings>0,id+' had no random colour bindings');
    // The same PRNG phase is shared, but quality/paint belongs to each placement.
    const sites=records.filter(r=>r.object.type===13),paint=[7,7,7,7,3,3,3,15];
    for(const site of sites)for(const b of site.bindings)require(b.index===paint[(site.object.flags>>>12)&7],id+' incorrect site paint');
    if(id==='morning'){
     const vehicle=records.find(r=>r.object.type===12),antenna=vehicle.bindings.find(b=>b.address===0x601e);
     require(vehicle.object.flags===0x7819,'Vehicle lost its placed flags');
     scene.updateModelColours(.5);require(antenna.index===15,'Special vehicle antenna did not blink');
     scene.updateModelColours(0);require(antenna.index===0,'Vehicle antenna did not go dark');
     const ring=records.find(r=>r.object.index===34).bindings.find(b=>b.address===0x31b8);
     scene.updateModelColours(.5);require(ring.index===0,'Unflagged orb incorrectly blinked');
    }
    const radar=records.find(r=>r.object.type===3);require(radar,'Missing radar bindings in '+id);
    scene.camera.position.copy(scene.homingTowers[0]);scene.updateModelColours(1);
    require(radar.bindings.every(b=>b.index===15),'Active radar did not flash in '+id);
    scene.camera.position.set(1000,1000,1000);scene.updateModelColours(1);
    require(radar.bindings.every(b=>b.index===0),'Radar flashed outside homing range in '+id);
    if(id==='slalom')require(radar.rules.rules.some(r=>r.kind==='radar'),'Slalom native model lost native colour rules');
    const after=scene.groups.flatMap(g=>g.children.map(c=>c.geometry));require(after.every((g,i)=>g===geometries[i]),'Cycling rebuilt geometry');
    // Drive the real animation clock with deterministic timestamps.
    const step=t=>{scene.tick(t);cancelAnimationFrame(scene.frame);scene.frame=0;};
    scene.running=true;scene.lastTime=null;step(0);step(100);require(Math.abs(scene.colourTime-.1)<1e-9,'Clock did not advance');
    scene.setColourCycling(false);step(1000);step(2000);require(Math.abs(scene.colourTime-.1)<1e-9,'Paused clock advanced');
    scene.setColourCycling(true);step(3000);step(3100);require(Math.abs(scene.colourTime-.2)<1e-9,'Resume jumped over paused time');
    scene.active(false);step(4000);require(Math.abs(scene.colourTime-.2)<1e-9,'Inactive scene advanced');
    scene.running=true;step(5000);require(Math.abs(scene.colourTime-.2)<1e-9,'Inactive interval leaked into clock');
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});step(6000);delete document.hidden;
    step(7000);require(Math.abs(scene.colourTime-.2)<1e-9,'Hidden tab interval leaked into clock');
    results[id]={colouredObjects:records.length,randomBindings,paintVariants:sites.length,radar:'passed',clock:'passed'};
    scene.dispose();host.remove();
   }
   return results;
  }''')
  # A visitor who requests reduced motion starts paused, but can opt in.
  reduced=await browser.new_page(reduced_motion='reduce');await reduced.goto(args.url+'atlas/')
  await reduced.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
  assert not await reduced.locator('#cycle-colours').is_checked()
  assert not errors,errors;await browser.close()
  result['controls']='canvas animation, pause/resume, 2D retention and reduced motion passed'
  if args.output:Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
  print(json.dumps(result,indent=2))
asyncio.run(main())
