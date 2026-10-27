#!/usr/bin/env python3
"""Check that map drags/pinches never become object clicks, in either site."""
import argparse
import json
import os
import shutil
from playwright.sync_api import sync_playwright
if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
    import playwright._impl._transport as transport
    transport.compute_driver_executable=lambda:(shutil.which('node'),os.environ['PLAYWRIGHT_DRIVER_CLI'])
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',default='http://127.0.0.1:4187/')
p.add_argument('--analysis',action='store_true',help='URL points to the full analysis resource index.html')
args=p.parse_args()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1200},has_touch=True,reduced_motion='reduce')
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(args.url+'#worlds' if args.analysis else args.url.rstrip('/')+'/atlas/')
    if args.analysis:
        page.wait_for_function("document.querySelector('#worldStatus')?.textContent.startsWith('Drag')")
        page.evaluate("window.testScene=document.querySelector('#view').corncobWorldScene")
    else:
        page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
        page.evaluate(r'''async()=>{
          const url=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/map3d-[^/]+\.js/.test(n));
          const {MapScene}=await import(url),world=MapScene.prototype.world;
          MapScene.prototype.world=function(...args){window.testScene=this;return world.apply(this,args);};
        }''')
        page.select_option('#world','whtsands')
        page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
    # Guarantee a release over a selectable object, even while the camera is
    # moving. Only hit-testing is stubbed; pointer input and controls are real.
    page.evaluate('''()=>{
      testScene.ray.intersectObjects=()=>[{object:testScene.groups[0]}];
      const replace=history.replaceState.bind(history);window.selections=0;
      history.replaceState=(...args)=>{window.selections++;return replace(...args);};
      document.addEventListener('pointerdown',e=>window.lastPointer=e.pointerId,true);
    }''')
    cdp=page.context.new_cdp_session(page)
    results={}
    for mode in ('3d','2d'):
        canvas='#map3d canvas' if mode=='3d' else ('#map' if args.analysis else '#map-canvas')
        if mode=='2d':page.click('#view2d' if args.analysis else '#view-2d')
        def centre():
            if mode=='2d':
                selector='#landmark';value=page.locator(selector+' option').nth(1).get_attribute('value')
                page.select_option(selector,value)
            page.locator(canvas).scroll_into_view_if_needed()
            box=page.locator(canvas).bounding_box()
            return box['x']+box['width']/2,box['y']+box['height']/2
        x,y=centre();page.evaluate('selections=0');page.mouse.click(x,y)
        assert page.evaluate('selections')==1,(mode,'ordinary click')
        passed=['ordinary click']
        for case in ('returning drag','right button','middle button','modified click','cancel','lost capture','blur','wheel during drag'):
            x,y=centre();page.evaluate('selections=0');page.mouse.move(x,y)
            button='right' if case=='right button' else 'middle' if case=='middle button' else 'left'
            if case=='modified click':page.keyboard.down('Control')
            page.mouse.down(button=button)
            if case=='returning drag':
                page.mouse.move(x+60,y+30,steps=8);page.mouse.move(x,y,steps=8)
            elif case=='cancel':page.locator(canvas).evaluate("c=>c.dispatchEvent(new PointerEvent('pointercancel',{pointerId:lastPointer,bubbles:true}))")
            elif case=='lost capture':
                page.mouse.move(x+1,y);page.locator(canvas).evaluate('c=>c.releasePointerCapture(lastPointer)');page.mouse.move(x,y);page.wait_for_timeout(40)
            elif case=='blur':page.evaluate("window.dispatchEvent(new Event('blur'))")
            elif case=='wheel during drag':page.mouse.wheel(0,-100)
            page.mouse.up(button=button)
            if case=='modified click':page.keyboard.up('Control')
            page.wait_for_timeout(60)
            assert page.evaluate('selections')==0,(mode,case)
            passed.append(case)
        x,y=centre();page.evaluate('selections=0')
        a={'x':x-20,'y':y,'id':1};b={'x':x+20,'y':y,'id':2}
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a,b]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[dict(a,x=x-40),dict(b,x=x+40)]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[b]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[dict(b,x=x+50)]})
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        assert page.evaluate('selections')==0,(mode,'pinch then one-finger drag')
        passed.append('pinch then one-finger drag')
        x,y=centre();page.evaluate('selections=0');page.touchscreen.tap(x,y)
        assert page.evaluate('selections')==1,(mode,'fresh touch tap')
        passed.append('fresh touch tap')
        results[mode]=passed
    assert not errors,errors
    print(json.dumps({'viewer':'analysis' if args.analysis else 'public','gestures':results,'errors':errors},indent=2))
    browser.close()
