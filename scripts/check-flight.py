#!/usr/bin/env python3
"""Check the flight article's controls, native-data readouts and reading fallbacks."""
import argparse,json,os,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
    import playwright._impl._transport as transport
    transport.compute_driver_executable=lambda:(shutil.which('node'),os.environ['PLAYWRIGHT_DRIVER_CLI'])
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:4187/corncob-contemplated/')
parser.add_argument('--screenshots',type=Path)
args=parser.parse_args()
errors=[]
widths=(360,390,760,1024,1280,1321,1440)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1050})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:errors.append(str(r.status)+' '+r.url) if r.status>=400 else None)
    assert page.goto(args.url+'flight/').ok
    page.wait_for_selector('[data-demo=landing] .graphics-live svg')
    assert page.locator('meta[property="og:type"]').get_attribute('content')=='article'
    assert page.locator('link[rel=canonical]').get_attribute('href').endswith('/corncob-contemplated/flight/')
    assert page.locator('.graphics-live svg').count()==4
    assert page.locator('.contents a').count()==16
    assert page.locator('article').inner_text().count(' ')>4000
    def set_value(id,value):
        page.locator('#'+id).evaluate('(e,v)=>{e.value=String(v);e.dispatchEvent(new Event("input",{bubbles:true}));}',value)
    def key(id,key):
        page.locator('#'+id).focus();page.keyboard.press(key)
    key('lift-angle','Home')
    assert page.locator('#lift-result').inner_text().count('0.00 ×')==2
    key('lift-angle','End')
    assert page.locator('#lift-result').inner_text().count(', stalled.')==2
    set_value('lift-angle',20)
    assert ', stalled.' in page.locator('#lift-result').inner_text()
    assert ', not stalled.' in page.locator('#lift-result').inner_text()
    key('air-height','Home');assert '92.7%' in page.locator('#air-result').inner_text()
    set_value('air-height',2000);assert '100.0%' in page.locator('#air-result').inner_text()
    key('air-height','End');assert page.locator('#air-result').inner_text().count('0.0%')==2
    key('control-speed','Home');assert page.locator('#control-result').inner_text().count('0.0%')==2
    key('control-speed','End')
    assert '100.0%' in page.locator('#control-result').inner_text()
    assert '50.0%' in page.locator('#control-result').inner_text()
    set_value('gear-roll',0);set_value('gear-height',3)
    assert page.locator('#gear-result').inner_text().startswith('Gear contact.')
    page.select_option('#gear-surface','grass')
    assert page.locator('#gear-result').inner_text().startswith('Crash landing.')
    set_value('gear-height',2)
    assert page.locator('#gear-result').inner_text().startswith('Fatal contact.')
    key('gear-height','End')
    assert page.locator('#gear-result').inner_text().startswith('Airborne.')
    key('gear-roll','Home');assert '-50°' in page.locator('#gear-roll-value').inner_text()
    key('gear-roll','End');assert '50°' in page.locator('#gear-roll-value').inner_text()
    for id,val in [('lift-angle',12),('air-height',2000),('control-speed',4800),('gear-height',10),('gear-roll',10)]:
        set_value(id,val)
    page.select_option('#gear-surface','runway')
    if args.screenshots:
        args.screenshots.mkdir(parents=True,exist_ok=True)
        page.evaluate('scrollTo(0,0)');page.screenshot(path=str(args.screenshots/'desktop.png'))
        for name in ('lift','atmosphere','controls','landing'):
            page.locator('[data-demo='+name+']').screenshot(path=str(args.screenshots/(name+'.png')))
    for width in widths:
        page.set_viewport_size({'width':width,'height':950});page.wait_for_timeout(120)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Page overflow {width}'
        clipped=page.locator('.graphics-live svg').evaluate_all("""svgs=>svgs.flatMap(svg=>{
          const box=svg.viewBox.baseVal;
          return Array.from(svg.querySelectorAll('text')).filter(t=>{
            const r=t.getBBox();return r.x<0||r.x+r.width>box.width+1||r.y<0||r.y+r.height>box.height+1;
          }).map(t=>t.textContent);
        })""")
        assert not clipped,(width,clipped)
        if args.screenshots and width==390:
            page.evaluate('scrollTo(0,0)');page.screenshot(path=str(args.screenshots/'mobile.png'))
            for name in ('lift','atmosphere','controls','landing'):
                page.locator('[data-demo='+name+']').screenshot(path=str(args.screenshots/(name+'-mobile.png')))
    page.emulate_media(color_scheme='dark');page.set_viewport_size({'width':390,'height':950})
    if args.screenshots:
        page.evaluate('scrollTo(0,0)');page.screenshot(path=str(args.screenshots/'mobile-dark.png'))
    page.emulate_media(media='print')
    assert page.locator('.graphics-fallback:visible').count()==4
    assert page.locator('.graphics-live:visible').count()==0
    assert page.locator('.graphics-controls:visible').count()==0
    if args.screenshots:page.pdf(path=str(args.screenshots/'article.pdf'),format='A4',print_background=True)
    fallback=browser.new_page(java_script_enabled=False,viewport={'width':390,'height':844})
    assert fallback.goto(args.url+'flight/').ok
    assert fallback.locator('.graphics-fallback:visible').count()==4
    assert fallback.locator('.graphics-controls:visible').count()==0
    assert fallback.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    for image in fallback.locator('article img').all():
        image.scroll_into_view_if_needed();image.evaluate('e=>e.loading="eager"')
    fallback.wait_for_function('Array.from(document.querySelectorAll("article img")).every(i=>i.complete&&i.naturalWidth>0)')
    missing=browser.new_page()
    missing.route('**/data/flight-samples.json',lambda route:route.abort())
    missing.goto(args.url+'flight/');missing.wait_for_timeout(250)
    assert missing.locator('.graphics-fallback:visible').count()==4
    assert missing.locator('.graphics-controls:visible').count()==0
    page.emulate_media(media='screen',color_scheme='light')
    page.set_viewport_size({'width':1440,'height':950})
    page.goto(args.url)
    assert page.get_by_role('link',name='Read the flight-physics article ↗').is_visible()
    page.get_by_role('link',name='Flight physics',exact=True).click()
    assert page.url.endswith('/flight/')
    assert not errors,errors
    browser.close()
print(json.dumps({'interactive_diagrams':4,'native_readouts_and_keyboard':'passed','responsive_widths':widths,'static_print_and_failed_fetch':'passed','errors':errors},indent=2))
