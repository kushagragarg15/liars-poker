# Liar's Poker

**Play:** https://kushagragarg.me/liars-poker/

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

Every push to `main` builds the game and publishes `dist/` to GitHub Pages via `.github/workflows/deploy.yml`.
