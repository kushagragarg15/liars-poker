from playwright.sync_api import sync_playwright
import random, time
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':1280,'height':800})
    logs=[]
    pg.on('pageerror', lambda e: logs.append('ERR '+str(e)))
    pg.on('console', lambda m: logs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
    pg.goto('file:///mnt/user-data/outputs/liars-poker.html')
    pg.evaluate("localStorage.setItem('lp.pace', JSON.stringify('quick'))")
    pg.reload(); pg.wait_for_timeout(800)
    pg.click('text=Deal me in')
    shots={'bid':0,'reveal':0,'over':0}
    t0=time.time(); rounds=0
    while time.time()-t0<150:
        pg.wait_for_timeout(400)
        if pg.locator('.gameover').count():
            if not shots['over']: pg.wait_for_timeout(1200); pg.screenshot(path='over.png'); shots['over']=1
            print('game over'); break
        if pg.locator('.reveal').count():
            btn=pg.locator('.reveal .btn.primary')
            if btn.is_enabled():
                if shots['reveal']<2: pg.screenshot(path=f"reveal{shots['reveal']}.png"); shots['reveal']+=1
                btn.click(); rounds+=1
            continue
        liar=pg.locator('.btn.liar.act'); raise_=pg.locator('.btn.primary.act')
        if raise_.is_enabled():
            if liar.is_enabled() and random.random()<0.5:
                liar.click(); continue
            raise_.click(); pg.wait_for_timeout(300)
            if shots['bid']<1: pg.screenshot(path='bid.png'); shots['bid']+=1
            pg.locator('.bid-actions .btn.primary').click()
    print('rounds', rounds)
    print(logs[:10])
    b.close()
