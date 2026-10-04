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
- `src/net.js` – solo / host / client sessions over a `room` (Claude's artifact `room` capability when available, otherwise PeerJS); hands are encrypted per player (ECDH + AES-GCM)
- `src/peerroom.js` – PeerJS stand-in for the `room` capability: the first tab in a table claims its PeerJS id and relays presence to everyone else (WebRTC, free PeerJS cloud broker)
- `src/sfx.js` – Web Audio synthesized sound effects
- `src/fx.jsx` – React Bits–style animation components (SplitText, DecryptedText, ShinyText, CountUp, ClickSpark, TiltedCard, Particles)
- `src/app.jsx` – UI: home, lobby, table, bid sheet, reveal, game over
- `src/styles.css` – theme tokens, responsive layouts, animations
- `tests/` – Playwright scripts (`play.py` solo, `mp.py` multiplayer with `mock.js`, a fake `room` capability; `peer.py` a full two-browser game over PeerJS)

## Notes

Multiplayer works anywhere: inside Claude it uses the artifact `room` capability, elsewhere it falls back to PeerJS. Over PeerJS the host's tab is the table, so it must stay open; players on very strict networks may fail to connect.

## Deploy

Hosted on Vercel. `vercel.json` sets the build (`npm run build`) and output (`dist/`), so importing the repo needs no extra settings; every push to `main` redeploys.
