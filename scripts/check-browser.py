#!/usr/bin/env python3
"""Optional Chromium integration checks; requires Python Playwright and a served build."""
import argparse,asyncio,json,os,shutil
from pathlib import Path
from playwright.async_api import async_playwright
if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
 import playwright._impl._transport as transport
 transport.compute_driver_executable=lambda:(shutil.which('node'),os.environ['PLAYWRIGHT_DRIVER_CLI'])
args=argparse.ArgumentParser();args.add_argument('--url',default='http://127.0.0.1:4176/corncob-contemplated/');args.add_argument('--output');args=args.parse_args()
async def main():
 result={'model_collections':{},'worlds':0,'mobile_pages':[],'console_errors':[]}
 async with async_playwright() as p:
  launch={'headless':True,'args':['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']}
  if shutil.which('chromium'):launch['executable_path']=shutil.which('chromium')
  browser=await p.chromium.launch(**launch);page=await browser.new_page(viewport={'width':1440,'height':1000})
  page.on('pageerror',lambda e:result['console_errors'].append(str(e)))
  await page.goto(args.url+'models/');await page.wait_for_selector('#gallery canvas')
  banks=await page.locator('#bank option').evaluate_all('(items)=>items.map(x=>x.value)')
  for bank in banks:
   await page.select_option('#bank',bank);await page.wait_for_function("document.querySelector('#model-stage').getAttribute('aria-busy')==='false'")
   ids=await page.locator('#model option').evaluate_all('(items)=>items.map(x=>x.value)')
   for id in ids:
    await page.select_option('#model',id)
    await page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    assert await page.locator('#model-name').inner_text(),(bank,id)
   result['model_collections'][bank]=len(ids)
  await page.select_option('#bank','deluxe_dnk');await page.wait_for_function("document.querySelector('#model-stage').getAttribute('aria-busy')==='false'")
  await page.select_option('#model','7');await page.select_option('#pose','gesture');assert 'state=gesture' in page.url
  assert await page.locator('#quality').is_disabled()
  await page.select_option('#model','3');before=await page.locator('#model-canvas').screenshot();await page.check('#motion');await page.wait_for_timeout(400);after=await page.locator('#model-canvas').screenshot();assert before!=after,'Radar motion did not change the rendered frame';await page.uncheck('#motion')
  await page.select_option('#category','people');await page.fill('#search','crew');assert await page.locator('.model-tile').count()==1
  await page.fill('#search','');await page.select_option('#category','');await page.click('#next');assert await page.locator('#previous').is_enabled();await page.click('#previous')
  await page.goto(args.url+'atlas/');await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
  assert await page.locator('#map3d canvas').is_visible()
  assert await page.locator('#world').input_value()=='training'
  await page.click('#view-2d');assert 'view=2d' in page.url
  await page.reload();await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
  assert await page.locator('#map-canvas').is_visible()
  worlds=await page.locator('#world option').evaluate_all('(items)=>items.map(x=>x.value)')
  for world in worlds:
   await page.select_option('#world',world);await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'");assert 'could not' not in (await page.locator('#map-status').inner_text());result['worlds']+=1
  await page.select_option('#world','whtsands');await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
  await page.click('#view-3d');await page.wait_for_selector('#map3d canvas');await page.wait_for_timeout(300);await page.click('#airfield');await page.select_option('#world','slalom');await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'");await page.click('#view-2d');assert await page.locator('#map-canvas').is_visible()
  assert await page.locator('#map-canvas').evaluate('(c)=>c.width>0&&c.height>0')
  await page.select_option('#world','other-flatland');await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'");await page.click('#view-3d');await page.wait_for_selector('#map3d canvas');await page.wait_for_timeout(300)
  result['three_dimensional_worlds']=['whtsands','slalom','other-flatland']
  await page.goto(args.url+'atlas/?world=other-tundra&start=0&view=2d')
  await page.wait_for_selector('#mission-briefing',state='visible')
  assert 'caps lock' in await page.locator('#mission-briefing').inner_text()
  assert await page.locator('#objectives').is_enabled()
  await page.click('#view-3d');await page.wait_for_function("document.querySelector('#objectives').disabled")
  await page.reload();await page.wait_for_selector('#mission-briefing',state='visible')
  assert 'Radio Ace' in await page.locator('#mission-briefing').inner_text()
  await page.locator('#missions button').nth(5).click()
  assert 'suspended tofu' in await page.locator('#mission-briefing').inner_text()
  assert 'caps lock' not in await page.locator('#mission-briefing').inner_text()
  await page.click('#airfield');assert await page.locator('#mission-briefing').is_visible()
  assert await page.locator('#missions [aria-pressed=true]').count()==1
  assert 'start=5' in page.url and 'object=' in page.url
  await page.reload();await page.wait_for_selector('#mission-briefing',state='visible')
  assert 'suspended tofu' in await page.locator('#mission-briefing').inner_text()
  assert await page.locator('#place-model').is_visible()
  await page.select_option('#world','other-iceworld');await page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
  assert await page.locator('#mission-briefing').is_hidden()
  await page.locator('#missions button').nth(4).click()
  assert 'no title in the original' in await page.locator('#mission-briefing').inner_text()
  assert "Hornet's Nest" not in await page.locator('#mission-briefing').inner_text()
  result['mission_briefings']=True
  await page.goto(args.url+'music/');assert await page.locator('audio').count()==6;assert await page.locator('audio').evaluate_all('(items)=>items.every(a=>a.paused)')
  await page.locator('audio').nth(0).evaluate('(a)=>a.play()');await page.wait_for_timeout(300);await page.locator('audio').nth(1).evaluate('(a)=>a.play()');assert await page.locator('audio').nth(0).evaluate('(a)=>a.paused');assert await page.locator('audio').nth(1).evaluate('(a)=>a.currentTime>=0&&!a.paused');result['audio_playback_and_exclusion']=True
  mobile=await browser.new_page(viewport={'width':390,'height':844},color_scheme='dark',is_mobile=True,has_touch=True)
  mobile.on('pageerror',lambda e:result['console_errors'].append(str(e)))
  for route in ['', 'story/', 'models/', 'atlas/', 'atlas/?world=other-tundra&start=0', 'music/']:
   await mobile.goto(args.url+route);await mobile.wait_for_timeout(300)
   assert await mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),f'Mobile overflow on {route}'
   result['mobile_pages'].append(route or 'home')
  await mobile.goto(args.url);await mobile.click('[data-menu]');assert await mobile.locator('#navigation').is_visible();await mobile.get_by_role('link',name='Model gallery',exact=True).click();assert '/models/' in mobile.url
  fallback=await browser.new_page();await fallback.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2')return null;return original.call(this,type,...args);}")
  await fallback.goto(args.url+'models/');await fallback.wait_for_selector('#webgl-fallback',state='visible');result['webgl_fallback']=True
  assert not result['console_errors'],result['console_errors'];await browser.close()
 if args.output:Path(args.output).write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
asyncio.run(main())
