# Liar's Poker

**Play:** https://liars-poker-usi.vercel.app/

A multiplayer poker-hand bluffing game built with React, bundled into a single self-contained HTML file.

## Build

```
npm ci
npm run build
```

Output: `dist/index.html` (also copied to `dist/liars-poker.html`) (React, styles and sounds all inlined).

## Structure

- `src/engine.js` – rules, bid ordering, hand checking, bot AI, reactions, game state machine
- `src/net.js` – solo / host / client sessions over a `room` (Claude's artifact `room` capability when available, otherwise PeerJS); hands are encrypted per player (ECDH + AES-GCM)
- `src/peerroom.js` – PeerJS stand-in for the `room` capability: the first tab in a table claims its PeerJS id and relays presence to everyone else (WebRTC, free PeerJS cloud broker)
- `src/sfx.js` – Web Audio synthesized sound effects
- `src/fx.jsx` – React Bits–style animation components (SplitText, DecryptedText, ShinyText, CountUp, ClickSpark, TiltedCard, Particles)
- `src/app.jsx` – UI: home, lobby, table, bid sheet, reveal, game over
- `src/styles.css` – theme tokens, responsive layouts, animations
- `api/turn.js` – Vercel function that returns TURN relay credentials (Metered or Cloudflare) so players on different networks can connect
- `tests/arena.mjs` – headless bot self-play for tuning the bot brain (`node tests/arena.mjs 1000 4 '{"read":[1,6,12]}' '{}'`)
- `tests/` – Playwright scripts (`play.py` solo, `mp.py` multiplayer with `mock.js`, a fake `room` capability; `peer.py` a full two-browser game over PeerJS)

## Notes

**High card** follows real poker: "Nine high" needs a Nine plus four lower cards of *different* ranks that don't form a straight or flush, so a pair can't stand in for two cards. The lowest possible claim is Seven high (7-5-4-3-2).

**Bots** score every move (call, or any legal raise) by expected outcome: how likely the claim is given their cards and what everyone has bid, and how likely the next player is to call it given how believable it looks without seeing the bot's cards. Cheap one-step raises gain nothing, so they jump to claims their cards back up and call shaky ones. In 2,000-game self-play they beat the previous bots clearly (see `tests/arena.mjs`).

**Reactions**: everyone, bots included, can send emoji reactions at any time, including during the reveal.

Multiplayer works anywhere: inside Claude it uses the artifact `room` capability, elsewhere it falls back to PeerJS. Over PeerJS the host's tab is the table, so it must stay open; players on very strict networks may fail to connect.

## Deploy

Hosted on Vercel. `vercel.json` sets the build (`npm run build`) and output (`dist/`), so importing the repo needs no extra settings; every push to `main` redeploys.

### Multiplayer across networks (TURN relay)

Players on different networks (mobile data, most home routers) need a TURN relay. Add one provider's keys under Vercel → Project → Settings → Environment Variables, then redeploy:

| Provider | Variables |
| --- | --- |
| [Metered](https://www.metered.ca/stun-turn) (free tier) | `METERED_APP` (the `<app>` in `<app>.metered.live`), `METERED_API_KEY` |
| [Cloudflare Realtime TURN](https://developers.cloudflare.com/realtime/turn/) (free tier) | `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` |

Check it at `/api/turn`: it should return a JSON list of `iceServers`.
