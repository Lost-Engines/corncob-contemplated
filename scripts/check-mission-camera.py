#!/usr/bin/env python3
"""Check ground-centred mission framing and actual mouse navigation in Chromium."""
import argparse
import json
import os
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
    import playwright._impl._transport as transport
    transport.compute_driver_executable=lambda:(shutil.which('node'),os.environ['PLAYWRIGHT_DRIVER_CLI'])
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4187/')
parser.add_argument('--screenshots',type=Path)
args=parser.parse_args()
if args.screenshots:args.screenshots.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1050},reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(args.url.rstrip('/')+'/atlas/')
    ready=lambda:page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
    ready()
    # Capture the actual UI's scene without shipping a test-only public API.
    page.evaluate(r'''async()=>{
      const url=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/map3d-[^/]+\.js/.test(n));
      const module=await import(url),original=module.MapScene.prototype.missionStart;
      module.MapScene.prototype.missionStart=function(...args){window.missionScene=this;return original.apply(this,args);};
    }''')
    checked=[]
    for width in (1440,390):
        page.set_viewport_size({'width':width,'height':1050})
        for world,index,objects in [('other-tundra',0,[163,189]),('other-tundra',1,[5,6,7]),('wastelnd',1,[19,20]),('slalom',0,[])]:
            page.select_option('#world',world);ready()
            page.select_option('#type','2')  # Choosing a start must reveal its scenery.
            page.locator('#missions button').nth(index).click()
            page.wait_for_timeout(180)
            assert page.locator('#type').input_value()==''
            state=page.evaluate('''ids=>{
              const s=window.missionScene;
              const project=p=>s.camera.position.clone().set(...p.map(v=>v/100000)).project(s.camera).toArray();
              return {pivot:s.controls.target.toArray(),eye:s.camera.position.toArray(),distance:s.camera.position.distanceTo(s.controls.target),points:ids.map(id=>project(s.worldData.objects.find(o=>o.index===id).position_cm)),pan:s.controls.screenSpacePanning};
            }''',objects)
            assert state['pivot'][2]==0 and state['eye'][2]>0 and not state['pan'],state
            assert all(abs(v[0])<.92 and abs(v[1])<.92 and -1<v[2]<1 for v in state['points']),state
            page.locator('#map3d').scroll_into_view_if_needed()
            if args.screenshots and width==1440:page.locator('#map3d canvas').screenshot(path=str(args.screenshots/f'{world}-{index}.png'))
            page.click('#map-zoom-in');page.wait_for_timeout(80)
            assert page.evaluate('missionScene.controls.target.z')==0
            assert page.evaluate('missionScene.camera.position.distanceTo(missionScene.controls.target)')<state['distance']
            rect=page.locator('#map3d canvas').bounding_box();x=rect['x']+rect['width']*.5;y=rect['y']+rect['height']*.5
            page.mouse.move(x,y);before=page.evaluate('missionScene.camera.position.distanceTo(missionScene.controls.target)')
            page.mouse.wheel(0,-300);page.wait_for_timeout(100)
            assert page.evaluate('missionScene.camera.position.distanceTo(missionScene.controls.target)')<before
            target=page.evaluate('missionScene.controls.target.toArray()')
            page.mouse.down(button='right');page.mouse.move(x+60,y+40,steps=6);page.mouse.up(button='right');page.wait_for_timeout(120)
            after=page.evaluate('missionScene.controls.target.toArray()')
            assert abs(after[2])<1e-10 and after[:2]!=target[:2],after
            page.click('#view-2d');page.click('#view-3d');page.wait_for_timeout(180)
            assert page.evaluate('missionScene.controls.target.z')==0
            checked.append([width,world,index])
    # Regular framing commands must not restore an elevated orbit centre either.
    page.click('#fit');assert page.evaluate('missionScene.controls.target.z')==0
    page.click('#airfield');assert page.evaluate('missionScene.controls.target.z')>0
    assert not errors,errors
    print(json.dumps({'cases':checked,'checks':'Target framing, ground pivots, button/wheel zoom, ground-plane panning, 2D/3D, filters and landmark/world framing passed','errors':errors},indent=2))
    browser.close()
