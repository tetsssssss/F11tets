"""Isolated Chromium smoke test when HTTP navigation is blocked by admin policy.
Requires Python Playwright, Chromium and the static build already generated.
Tests component render and a quick race opening, NOT real routing, browser storage or hosting.
Usage: python scripts/qa-isolated-browser.py /path/to/static-dir
"""
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

assets = Path(sys.argv[1]).resolve() / 'assets'
css = (assets / 'source-updates.css').read_text()
vendor = (assets / 'vendor-runtime.js').read_text()
app = (assets / 'latest-app.js').read_text()
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for route in ['/', '/corrida-rapida', '/fim-de-semana', '/formula-2', '/formula-3', '/pilotos']:
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        errors = []
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        page.set_content('<html><body><div id="root"></div></body></html>')
        page.add_style_tag(content=css)
        page.add_script_tag(content=vendor, type='module')
        page.wait_for_timeout(200)
        # Only in this isolated harness: synthetic pathname avoids blocked HTTP navigation.
        isolated = app.replace('() => location.pathname', "() => '" + route + "'")
        page.add_script_tag(content=isolated)
        page.wait_for_timeout(400)
        if not page.locator('main').count() or errors:
            raise AssertionError(f'{route}: missing main or JavaScript error: {errors[:2]}')
        if route == '/corrida-rapida':
            page.get_by_role('button', name='Iniciar corrida rápida').click()
            page.wait_for_timeout(350)
            if not page.locator('.race-hud').count() or not page.locator('.pitwall-live').count():
                raise AssertionError('Quick race or engineering panel failed to initialize')
        print('ISOLATED_ROUTE_OK', route)
        page.close()
    browser.close()
