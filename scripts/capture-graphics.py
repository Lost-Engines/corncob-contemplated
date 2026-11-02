#!/usr/bin/env python3
"""Capture the article's world-palette comparison from a locally served atlas."""
import argparse
import os
from pathlib import Path
import shutil
from playwright.sync_api import sync_playwright

if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
    import playwright._impl._transport as transport
    transport.compute_driver_executable = lambda: (shutil.which('node'), os.environ['PLAYWRIGHT_DRIVER_CLI'])

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:4187/corncob-contemplated/')
args = parser.parse_args()
output = Path(__file__).resolve().parents[1] / 'public/images/graphics'
output.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=shutil.which('chromium'), args=[
        '--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1200}, reduced_motion='reduce')
    for world, name in [('whtsands', 'world-white-sands'), ('other-quari', 'world-quari')]:
        page.goto(args.url.rstrip('/') + '/atlas/?world=' + world)
        page.wait_for_function("document.querySelector('#atlas-stage').getAttribute('aria-busy')==='false'")
        page.wait_for_selector('#map3d canvas')
        page.uncheck('#cycle-colours')
        page.add_style_tag(content='.viewport-buttons {visibility:hidden}')
        page.locator('#map3d').scroll_into_view_if_needed()
        page.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
        page.locator('#map3d').screenshot(path=str(output / (name + '.png')))
        print('Captured', name)
    browser.close()
