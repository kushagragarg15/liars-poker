from playwright.sync_api import sync_playwright
import time, random
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context()
    ctx.add_init_script(path='/home/claude/lp/mock.js')
    ctx.add_init_script("localStorage.setItem('lp.pace', JSON.stringify('quick'))")
    host = ctx.new_page(); host.set_viewport_size({'width':1100,'height':760}); cli = ctx.new_page(); cli.set_viewport_size({'width':390,'height':844})
    logs=[]
    for nm,pg in (('host',host),('cli',cli)):
        pg.on('pageerror', lambda e, nm=nm: logs.append(nm+' ERR '+str(e)))
        pg.on('console', lambda m, nm=nm: logs.append(nm+' '+m.text) if m.type in ('error','warning') and '403' not in m.text else None)
        pg.goto('http://localhost:8765/index.html')
    host.wait_for_timeout(800)
    host.fill('input[placeholder="What the table calls you"]','Hosty')
    host.click('text=Host a table'); host.wait_for_timeout(1200)
    code = host.locator('.code').get_attribute('aria-label').replace(' ','')
    print('code', code)
    cli.fill('input[placeholder="What the table calls you"]','Cleo')
    cli.fill('input[aria-label="Table code"]', code); cli.click('text=Join'); cli.wait_for_timeout(1500)
    host.screenshot(path='mp-lobby-host.png'); cli.screenshot(path='mp-lobby-cli.png')
    host.click('text=Start game'); host.wait_for_timeout(1500)
    cli.screenshot(path='mp-game-cli.png')
    t0=time.time(); shots=0; rounds=0
    while time.time()-t0<120:
        done=False
        for nm,pg in (('host',host),('cli',cli)):
            pg.wait_for_timeout(250)
            if pg.locator('.gameover').count(): done=True; continue
            if pg.locator('.reveal').count():
                btn=pg.locator('.reveal .btn.primary')
                if btn.is_enabled():
                    if shots<1 and nm=='cli': pg.screenshot(path='mp-reveal-cli.png'); shots+=1
                    btn.click(); rounds+=1
                continue
            liar=pg.locator('.btn.liar.act'); r=pg.locator('.btn.primary.act')
            if r.is_enabled():
                if liar.is_enabled() and random.random()<0.45: liar.click(); continue
                r.click(); pg.wait_for_timeout(250); pg.locator('.bid-actions .btn.ghost').click(); pg.locator('.bid-actions .btn.primary').click()
        if done: break
    host.wait_for_timeout(1000)
    cli.screenshot(path='mp-end-cli.png'); host.screenshot(path='mp-end-host.png')
    print('rounds', rounds, 'maxPresence', host.evaluate('window.__maxPresence'))
    print('cli hand', cli.locator('.my-cards .card.face').count())
    print(logs[:10])
    b.close()
