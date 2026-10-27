#!/usr/bin/env python3
"""Exercise real geometry picking and elevated-object zoom in both world viewers."""
import argparse
import json
import os
import shutil
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright
if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
    import playwright._impl._transport as transport
    transport.compute_driver_executable=lambda:(shutil.which('node'),os.environ['PLAYWRIGHT_DRIVER_CLI'])
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--url',default='http://127.0.0.1:4187/')
p.add_argument('--analysis',action='store_true')
args=p.parse_args()
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
    for width,height,ratio in [(1440,1000,1),(1000,850,2)]:
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=ratio,reduced_motion='reduce')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(args.url+'#worlds' if args.analysis else args.url.rstrip('/')+'/atlas/')
        def ready():
            page.wait_for_function("document.querySelector('#worldStatus')?.textContent.startsWith('Drag')" if args.analysis else "document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
        ready()
        if args.analysis:
            wid=page.locator('#worldSelect option').evaluate_all("xs=>xs.find(x=>x.textContent.toLowerCase().includes('dusk')).value")
            page.select_option('#worldSelect',wid);ready()
            page.evaluate("window.s=document.querySelector('#view').corncobWorldScene")
        else:
            page.evaluate(r'''async()=>{
              const url=performance.getEntriesByType('resource').map(r=>r.name).find(n=>/\/map3d-[^/]+\.js/.test(n));
              const {MapScene}=await import(url),world=MapScene.prototype.world;
              MapScene.prototype.world=function(...args){window.s=this;return world.apply(this,args);};
            }''')
            page.select_option('#world','dusk');ready()
        page.get_by_role('button',name='Overnight Express',exact=True).click()
        canvas=page.locator('#map3d canvas');canvas.scroll_into_view_if_needed()
        briefing=page.locator('#missionBriefing' if args.analysis else '#mission-briefing')
        original=briefing.inner_text()
        assert '10,000 feet' in original
        # Test coordinates come from original placements, never from the picker.
        # No hit-testing is replaced or stubbed in this test.
        page.evaluate('''()=>{
          s.active(false);window.project=p=>{
            s.renderer.render(s.scene,s.camera);const r=s.renderer.domElement.getBoundingClientRect(),v=p.clone().project(s.camera);
            return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};
          };
          window.group=id=>s.groups.find(g=>g.userData.object.index===id);
        }''')
        for oid in [90,95,99]:
            point=page.evaluate('''id=>{
              s.missionStart(s.worldData.starts.find(m=>m.name==='Overnight Express'));
              window.offset=s.camera.position.clone().sub(s.controls.target);
              return project(group(id).position);
            }''',oid)
            page.mouse.click(**point)
            page.wait_for_function('id=>new URLSearchParams(location.search).get("object")===String(id)',arg=oid)
            assert parse_qs(urlsplit(page.url).query)['object']==[str(oid)],(oid,page.url)
            assert page.evaluate('''()=>{
              s.selection.geometry.computeBoundingBox();const c=s.selection.geometry.boundingBox.getCenter(s.camera.position.clone());
              return s.controls.target.distanceTo(c)<1e-5&&s.controls.target.z>2.9&&s.camera.position.clone().sub(s.controls.target).distanceTo(offset)<1e-8;
            }'''),('object altitude / viewing angle',oid)
            assert briefing.inner_text()==original and briefing.is_visible()
        # Actual wheel events must converge on the floating platform, not on
        # an invisible pivot somewhere beneath it.
        page.evaluate('s.active(true)')
        before=page.evaluate('s.camera.position.distanceTo(s.controls.target)')
        box=canvas.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
        for _ in range(24):
            page.mouse.wheel(0,-500);page.wait_for_timeout(100)
            if page.evaluate('s.camera.position.distanceTo(s.controls.target)')<before*.05:break
        page.wait_for_timeout(200)
        after=page.evaluate('s.camera.position.distanceTo(s.controls.target)')
        assert after<before*.05,(before,after)
        assert page.evaluate('s.controls.target.z')>2.9
        canvas.screenshot(path=f'/tmp/corncob-airstrip-{args.analysis}-{ratio}.png')
        # Isolate the existing wireframe Tet for pixel-tolerance tests. Check a
        # line midpoint and an empty point at least 12 CSS pixels beside the model.
        for distance in [.3,3,30]:
            points=page.evaluate('''distance=>{
              s.active(false);for(const g of s.groups)g.visible=g===group(100);
              s.focus(group(100).userData.object);
              s.camera.position.sub(s.controls.target).setLength(distance).add(s.controls.target);s.controls.update();
              s.renderer.render(s.scene,s.camera);
              const segments=[];for(const child of group(100).children){
                if(!child.isLine)continue;const a=child.geometry.attributes.position;
                for(let i=0;i<a.count;i+=2){const v=j=>s.camera.position.clone().fromBufferAttribute(a,j).applyMatrix4(child.matrixWorld);segments.push([project(v(i)),project(v(i+1))]);}
              }
              segments.sort((a,b)=>Math.hypot(b[1].x-b[0].x,b[1].y-b[0].y)-Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y));
              const [a,b]=segments[0],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
              const distances=p=>segments.map(([a,b])=>{const x=b.x-a.x,y=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);});
              const misses=[12,24,48].flatMap(offset=>[-1,1].map(sign=>({x:mid.x+sign*offset*dy/len,y:mid.y-sign*offset*dx/len})));
              const miss=misses.sort((a,b)=>Math.min(...distances(b))-Math.min(...distances(a)))[0];
              if(Math.min(...distances(miss))<7)throw Error('No isolated off-line test point');
              return {hit:mid,miss,near:{x:mid.x+dy/len,y:mid.y-dx/len}};
            }''',distance)
            assert page.evaluate('p=>s.objectAt(p.hit.x,p.hit.y)?.index',points)==100,(distance,'line centre')
            assert page.evaluate('p=>s.objectAt(p.near.x,p.near.y)?.index',points)==100,(distance,'one pixel tolerance')
            assert page.evaluate('p=>s.objectAt(p.miss.x,p.miss.y)',points) is None,(distance,'off line')
            # A real click on empty space must leave selection and camera alone.
            old_url=page.url;old_target=page.evaluate('s.controls.target.toArray()')
            page.mouse.click(**points['miss'])
            assert page.url==old_url and page.evaluate('s.controls.target.toArray()')==old_target
            page.mouse.click(**points['hit'])
            page.wait_for_function('new URLSearchParams(location.search).get("object")==="100"')
            assert parse_qs(urlsplit(page.url).query)['object']==['100']
        # The ground crew's head is a circular sprite; its transparent corners
        # must not behave like square geometry. Keep the original sprite/texture.
        points=page.evaluate('''()=>{
          for(const g of s.groups)g.visible=g===group(104);
          s.focus(group(104).userData.object);s.renderer.render(s.scene,s.camera);
          const sprites=group(104).children.filter(c=>c.isSprite).sort((a,b)=>b.scale.x-a.scale.x),head=sprites[0];
          for(const child of group(104).children)child.visible=child===head;
          const centre=head.getWorldPosition(s.camera.position.clone()),scale=head.getWorldScale(s.camera.position.clone());
          const v=centre.clone().applyMatrix4(s.camera.matrixWorldInverse);v.x+=scale.x*.44;v.y+=scale.y*.44;
          return {hit:project(centre),miss:project(v.applyMatrix4(s.camera.matrixWorld))};
        }''')
        assert page.evaluate('p=>s.objectAt(p.hit.x,p.hit.y)?.index',points)==104
        assert page.evaluate('p=>s.objectAt(p.miss.x,p.miss.y)',points) is None
        page.mouse.click(**points['hit']);page.wait_for_function('new URLSearchParams(location.search).get("object")==="104"');assert parse_qs(urlsplit(page.url).query)['object']==['104']
        assert briefing.inner_text()==original and briefing.is_visible()
        assert not errors,errors
        results.append({'viewport':[width,height],'pixel_ratio':ratio,'runway_clicks':3,'line_zoom_levels':3,'sprite_mask':True,'wheel_distance':[before,after],'briefing_retained':True})
        page.close()
    browser.close()
print(json.dumps({'viewer':'analysis' if args.analysis else 'public','real_picking':results},indent=2))
