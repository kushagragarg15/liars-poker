# Two isolated browser contexts play a full game over PeerJS (no Claude room, no mock).
# Usage: python tests/peer.py [url]  (default: serve dist/ on :8765 first)
import sys, time, random
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/index.html'
with sync_playwright() as p:
    b = p.chromium.launch()
    logs = []
    def page(nm, w, h):
        ctx = b.new_context(viewport={'width': w, 'height': h})
        ctx.add_init_script("localStorage.setItem('lp.pace', JSON.stringify('quick'))")
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: logs.append(nm + ' ERR ' + str(e)))
        pg.on('console', lambda m: logs.append(nm + ' ' + m.text) if m.type in ('error', 'warning') else None)
        pg.goto(URL); pg.wait_for_timeout(800)
        return pg
    host, cli = page('host', 1100, 760), page('cli', 390, 844)
    host.fill('input[placeholder="What the table calls you"]', 'Hosty')
    host.click('text=Host a table'); host.wait_for_selector('.code', timeout=15000)
    code = host.locator('.code').get_attribute('aria-label').replace(' ', '')
    print('code', code)
    cli.fill('input[placeholder="What the table calls you"]', 'Cleo')
    cli.fill('input[aria-label="Table code"]', code); cli.click('text=Join')
    host.wait_for_selector('text=Cleo', timeout=20000); print('client seated')
    host.click('text=Start game'); host.wait_for_timeout(2000)
    print('cli hand', cli.locator('.my-cards .card.face').count())
    t0 = time.time(); rounds = 0; done = False
    while time.time() - t0 < 150 and not done:
        for nm, pg in (('host', host), ('cli', cli)):
            pg.wait_for_timeout(250)
            if pg.locator('.gameover').count(): done = True; continue
            if pg.locator('.reveal').count():
                btn = pg.locator('.reveal .btn.primary')
                if btn.is_enabled(): btn.click(); rounds += 1
                continue
            liar = pg.locator('.btn.liar.act'); r = pg.locator('.btn.primary.act')
            if r.is_enabled():
                if liar.is_enabled() and random.random() < 0.45: liar.click(); continue
                r.click(); pg.wait_for_timeout(250); pg.locator('.bid-actions .btn.ghost').click(); pg.locator('.bid-actions .btn.primary').click()
    print('gameover', done, 'ready clicks', rounds)
    cli.screenshot(path='peer-end-cli.png'); host.screenshot(path='peer-end-host.png')
    cli.context.close(); host.wait_for_timeout(15000)
    print('host toast after client left:', host.locator('.toast').all_inner_texts())
    print('\n'.join(logs[:15]))
    b.close()
