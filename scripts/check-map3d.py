#!/usr/bin/env python3
"""Check runway and doorway pixels at varied angles, including occlusion.

Requires Python Playwright, Chromium and a served site build.
"""
import argparse,asyncio,json,os,shutil
from pathlib import Path
from playwright.async_api import async_playwright
if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
 import playwright._impl._transport as transport
 transport.compute_driver_executable=lambda:(shutil.which('node'),os.environ['PLAYWRIGHT_DRIVER_CLI'])
args=argparse.ArgumentParser();args.add_argument('--url',default='http://127.0.0.1:4176/corncob-contemplated/');args.add_argument('--world',choices=['training','morning'],default='training');args.add_argument('--output');args.add_argument('--screenshot');args=args.parse_args()
async def main():
 async with async_playwright() as p:
  launch={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']}
  if shutil.which('chromium'):launch['executable_path']=shutil.which('chromium')
  browser=await p.chromium.launch(**launch)
  page=await browser.new_page(viewport={'width':1440,'height':1050});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.goto(args.url+'atlas/'+('?world=morning&object=173' if args.world=='morning' else ''))
  await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
  assert await page.locator('#world').input_value()==args.world
  if args.screenshot:await page.locator('#map3d canvas').screenshot(path=args.screenshot)
  result=await page.evaluate(r'''async worldId=>{
   const module=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/map3d-[^/]+\.js/.test(n));
   const {MapScene}=await import(module);
   const [catalog,world]=await Promise.all(['catalog.json','world-'+worldId+'.json'].map(n=>fetch(new URL('../data/'+n,module)).then(r=>r.json())));
   const host=document.createElement('div');host.style='width:512px;height:512px';document.body.append(host);
   const scene=new MapScene(host,()=>{});await scene.world(world,catalog);scene.controls.enableDamping=false;
   scene.renderer.setPixelRatio(1);scene.renderer.setSize(512,512,false);scene.camera.aspect=1;scene.camera.updateProjectionMatrix();
   scene.scene.background.copy(scene.materials[0].color);
   const depthBits=scene.renderer.getContext().getParameter(scene.renderer.getContext().DEPTH_BITS);

   for(const child of scene.scene.children)child.visible=false;
   const image=document.createElement('canvas');image.width=image.height=512;const ctx=image.getContext('2d',{willReadFrequently:true});
   function pixels(){scene.renderer.render(scene.scene,scene.camera);ctx.drawImage(scene.renderer.domElement,0,0);return ctx.getImageData(0,0,512,512).data;}
   let cases=0,litPixels=0;const types=[];
   for(const type of [5,35,36]){
    const group=scene.groups.find(g=>g.userData.object.type===type);if(!group)throw Error('Missing runway type '+type);types.push(type);group.visible=true;
    const base=group.children.find(c=>c.material===scene.materials[0]);if(!base)throw Error('No runway base');
    for(const distance of [.35,1,5])for(const tilt of [.06,.35,1])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/4){
     scene.camera.position.copy(group.position).add(group.position.clone().set(Math.cos(angle)*distance,Math.sin(angle)*distance,distance*tilt));scene.camera.lookAt(group.position);
     base.visible=true;const actual=pixels();base.visible=false;const expected=pixels();base.visible=true;
     let difference=0;for(let i=0;i<actual.length;i+=4){if(expected[i]||expected[i+1]||expected[i+2])litPixels++;if(actual[i]!==expected[i]||actual[i+1]!==expected[i+1]||actual[i+2]!==expected[i+2])difference++;}
     if(difference)throw Error(`Stripe occlusion: type=${type} distance=${distance} tilt=${tilt} angle=${angle} pixels=${difference}`);cases++;
    }
    group.visible=false;
   }
   if(!cases||!litPixels)throw Error('No markings tested');
   // A large surface above a stripe must still occlude it, even though stripes
   // are drawn later. A depth-test-disabled decal would fail this check.
   const group=scene.groups.find(g=>g.userData.object.type===5);group.visible=true;
   const base=group.children.find(c=>c.material===scene.materials[0]);
   const blocker=base.clone();blocker.material=scene.materials[1];blocker.position.z=.005;group.add(blocker);
   scene.camera.position.copy(group.position).add(group.position.clone().set(0,0,.4));scene.camera.lookAt(group.position);
   const occluded=pixels();const markings=group.children.filter(c=>c.renderOrder===1);for(const m of markings)m.visible=false;
   const noMarkings=pixels();if(occluded.some((v,i)=>v!==noMarkings[i]))throw Error('Markings show through occluder');
   group.visible=false;
   const door=scene.groups.find(g=>g.userData.object.type===34),tower=scene.groups.find(g=>g.userData.object.type===6);
   if(!door||!tower)throw Error('Missing doorway or tower');
   scene.scene.background.copy(scene.materials[7].color);door.visible=true;
   const centre=door.position.clone();centre.z+=.006;
   let doorCases=0,doorPixels=0;
   for(const distance of [.04,.15,.5])for(const side of [-4,-1,0,1,4]){
    scene.camera.position.copy(centre).add(centre.clone().set(side*distance,-distance,distance*.05));scene.camera.lookAt(centre);
    tower.visible=false;const isolated=pixels();tower.visible=true;const onWall=pixels();
    for(let i=0;i<isolated.length;i+=4)if(isolated[i]===0&&isolated[i+1]===0&&isolated[i+2]===0){
     if(onWall[i]||onWall[i+1]||onWall[i+2])throw Error(`Door lost against wall: distance=${distance} side=${side}`);doorPixels++;
    }
    // From behind, removing the door must make no difference to the picture.
    scene.camera.position.copy(centre).add(centre.clone().set(side*distance,distance,distance*.05));scene.camera.lookAt(centre);
    const behind=pixels();door.visible=false;const withoutDoor=pixels();door.visible=true;
    if(behind.some((v,i)=>v!==withoutDoor[i]))throw Error('Door visible through rear tower wall');doorCases++;
   }
   if(!doorPixels)throw Error('No visible door pixels tested');
   scene.dispose();host.remove();return {world:worldId,cases,types,litPixels,depthBits,doorCases,doorPixels,occlusion:'passed'};
  }''',args.world)
  assert not errors,errors
  if args.output:Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
  print(json.dumps(result,indent=2));await browser.close()
asyncio.run(main())
