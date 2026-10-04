# Liar's Poker

**Play:** https://liars-poker.vercel.app/

A multiplayer poker-hand bluffing game built with React, bundled into a single self-contained HTML file.

## Build

```
npm ci
npm run build
```

Output: `dist/index.html` (also copied to `dist/liars-poker.html`) (React, styles and sounds all inlined).

## Structure

- `src/engine.js` – rules, bid ordering, hand checking, bot AI, game state machine
- `src/net.js` – solo / host / client sessions over the Claude artifact `room` capability; hands are encrypted per player (ECDH + AES-GCM)
- `src/sfx.js` – Web Audio synthesized sound effects
- `src/fx.jsx` – React Bits–style animation components (SplitText, DecryptedText, ShinyText, CountUp, ClickSpark, TiltedCard, Particles)
- `src/app.jsx` – UI: home, lobby, table, bid sheet, reveal, game over
- `src/styles.css` – theme tokens, responsive layouts, animations
- `tests/` – Playwright scripts (`play.py` solo, `mp.py` multiplayer) and `mock.js`, a fake `room` capability for local testing

## Notes

Multiplayer only works when the page is opened inside Claude (it relies on `window.claude.use("room")`). Playing against bots works anywhere.

## Deploy

Hosted on Vercel. `vercel.json` sets the build (`npm run build`) and output (`dist/`), so importing the repo needs no extra settings; every push to `main` redeploys.
