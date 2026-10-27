#!/usr/bin/env python3
"""Render the shared Corncob social card from HTML and original model geometry.

Requires Python Playwright and Chromium. The browser draws the same geometry
used by the model gallery.
"""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
import shutil
from threading import Thread

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'public/images/social-preview.jpg')
args = parser.parse_args()
if os.environ.get('PLAYWRIGHT_DRIVER_CLI'):
    import playwright._impl._transport as transport
    transport.compute_driver_executable = lambda: (shutil.which('node'), os.environ['PLAYWRIGHT_DRIVER_CLI'])


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=shutil.which('chromium'), headless=True,
                                   args=['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'])
        page = browser.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/scripts/social-card.html')
        page.wait_for_function('window.socialReady || window.socialError')
        assert not errors, errors
        assert page.evaluate('window.socialReady'), page.evaluate('window.socialError')
        page.screenshot(path=str(args.output), type='jpeg', quality=95)
        browser.close()
finally:
    server.shutdown()
    server.server_close()
print(args.output)
