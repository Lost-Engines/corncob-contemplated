#!/usr/bin/env python3
"""Exercise the renderer article at a Pages subpath, including static fallbacks."""
import argparse, json, os, shutil
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
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1050})
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.on('response',lambda response:errors.append(str(response.status)+' '+response.url) if response.status>=400 else None)
    assert page.goto(args.url+'graphics/').ok
    page.wait_for_selector('[data-demo=painter] .graphics-live svg')
    assert page.locator('meta[property="og:type"]').get_attribute('content')=='article'
    assert page.locator('link[rel=canonical]').get_attribute('href').endswith('/corncob-contemplated/graphics/')
    assert page.locator('.graphics-live svg').count()==4
    assert page.locator('.contents a').count()==14
    assert page.locator('.graphics-article').inner_text().count(' ')>3500
    page.locator('#clip-depth').focus();page.keyboard.press('Home')
    assert 'X = 301' in page.locator('#clip-result').inner_text()
    page.keyboard.press('End');assert 'whole edge survives' in page.locator('#clip-result').inner_text()
    page.locator('#scan-row').focus();page.keyboard.press('End')
    assert 'outside' in page.locator('#scan-result').inner_text()
    page.locator('#plane-colour').focus();page.keyboard.press('End')
    assert '1111' in page.locator('#plane-result').inner_text()
    for model in ('7','2','6'):
        page.select_option('#painter-model',model)
        for octant in map(str,range(8)):
            page.select_option('#painter-octant',octant)
            assert f'List {octant} ' in page.locator('#painter-result').inner_text()
            step=page.locator('#painter-step');step.focus();page.keyboard.press('Home')
            assert '0 of' in page.locator('#painter-result').inner_text()
            page.keyboard.press('End');assert int(step.input_value())==int(step.get_attribute('max'))
    page.select_option('#painter-model','7');page.select_option('#painter-octant','7')
    page.locator('#clip-depth').evaluate("e=>{e.value='100';e.dispatchEvent(new Event('input',{bubbles:true}))}")
    page.locator('#scan-row').evaluate("e=>{e.value='9';e.dispatchEvent(new Event('input',{bubbles:true}))}")
    page.locator('#plane-colour').evaluate("e=>{e.value='14';e.dispatchEvent(new Event('input',{bubbles:true}))}")
    if args.screenshots:
        args.screenshots.mkdir(parents=True,exist_ok=True)
        page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(args.screenshots/'desktop.png'))
        for name in ('near','painter','scan','planes'):
            page.locator(f'[data-demo={name}]').screenshot(path=str(args.screenshots/(name+'.png')))
    for width in (360,390,760,1024,1280):
        page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Overflow at {width}'
        for name in ('near','painter','scan','planes'):
            assert page.locator(f'[data-demo={name}] svg').is_visible()
        if args.screenshots and width==390:
            page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(args.screenshots/'mobile.png'))
            page.locator('[data-demo=painter]').screenshot(path=str(args.screenshots/'painter-mobile.png'))
    page.set_viewport_size({'width':390,'height':900})
    page.emulate_media(color_scheme='dark')
    if args.screenshots:
        page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(args.screenshots/'mobile-dark.png'))
    page.emulate_media(media='print')
    assert page.locator('.graphics-fallback:visible').count()==4
    assert page.locator('.graphics-live:visible').count()==0
    fallback=browser.new_page(java_script_enabled=False,viewport={'width':390,'height':844})
    assert fallback.goto(args.url+'graphics/').ok
    assert fallback.locator('.graphics-fallback:visible').count()==4
    assert fallback.locator('.graphics-controls:visible').count()==0
    assert fallback.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    for image in fallback.locator('article img').all():
        image.scroll_into_view_if_needed();image.evaluate('e=>e.loading="eager"')
    fallback.wait_for_function('Array.from(document.querySelectorAll("article img")).every(i=>i.complete&&i.naturalWidth>0)')
    assert not errors,errors
    browser.close()
print(json.dumps({'interactive_diagrams':4,'model_views_checked':24,'responsive_widths':[360,390,760,1024,1280],'static_and_print_fallbacks':'passed','errors':errors},indent=2))
