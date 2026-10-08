// Headless bot self-play, for tuning BRAIN in src/engine.js.
// Usage: node tests/arena.mjs <games> <players> '<brain A overrides JSON>' '<brain B overrides JSON>'
// e.g.   node tests/arena.mjs 1000 4 '{"read":[1,6,12]}' '{}'
// Seats alternate A/B; prints how often an A bot wins (an even match is 0.5).
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import os from 'os';
import * as E from '../src/engine.js';

function playGame(brains) {
  const n = brains.length;
  const ps = brains.map((brain, i) => ({ i, brain, count: E.startingCards(n), elim: false, hand: [] }));
  let starter = Math.floor(Math.random() * n), rounds = 0;
  for (let guard = 0; guard < 200; guard++) {
    const act = ps.filter((p) => !p.elim);
    if (act.length <= 1) return { winner: act[0].brain.tag, rounds };
    rounds++;
    const deck = E.FULL_DECK.map((c) => ({ ...c }));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    ps.forEach((p) => { p.hand = p.elim ? [] : deck.splice(0, p.count); });
    const pool = act.flatMap((p) => p.hand);
    let turn = starter, cur = null;
    const log = [];
    for (let t = 0; t < 300; t++) {
      const p = ps[turn];
      const bidsOf = (q) => log.filter((e) => e.pid === q.i).map((e) => e.bid);
      const others = [];
      for (let k = 1; k < n; k++) { const o = ps[(turn + k) % n]; if (!o.elim) others.push({ n: o.hand.length, bids: bidsOf(o) }); }
      const d = E.botDecide(p.hand, cur, pool.length, others, bidsOf(p), p.brain);
      let bid = d.bid ? E.normalizeBid(d.bid) : null;
      if (!d.call && !(bid && E.validateBid(bid) && E.isBidHigher(bid, cur))) bid = E.minRaise(cur);
      if ((d.call && cur) || !bid) {
        const loser = E.check(pool, cur).ok ? p : ps[cur.bidderId];
        if (++loser.count > E.MAX_CARDS) loser.elim = true;
        starter = turn;
        let g = 0;
        while (ps[starter].elim && g++ < n) starter = (starter + 1) % n;
        break;
      }
      bid.bidderId = p.i; cur = bid; log.push({ pid: p.i, bid });
      do { turn = (turn + 1) % n; } while (ps[turn].elim);
    }
  }
  return { winner: null, rounds };
}

if (isMainThread) {
  const games = +(process.argv[2] || 200), players = +(process.argv[3] || 4);
  const A = { ...E.BRAIN, ...JSON.parse(process.argv[4] || '{}'), tag: 'A' };
  const B = { ...E.BRAIN, ...JSON.parse(process.argv[5] || '{}'), tag: 'B' };
  const W = Math.max(1, os.cpus().length - 1), per = Math.ceil(games / W);
  const res = await Promise.all(Array.from({ length: W }, (_, w) => new Promise((ok, bad) => {
    const wk = new Worker(new URL(import.meta.url), { workerData: { games: per, players, A, B, seed: w } });
    wk.on('message', ok); wk.on('error', bad);
  })));
  const tot = res.reduce((t, r) => ({ A: t.A + r.A, games: t.games + r.games, rounds: t.rounds + r.rounds }), { A: 0, games: 0, rounds: 0 });
  console.log({ games: tot.games, players, aWinRate: +(tot.A / tot.games).toFixed(3), roundsPerGame: +(tot.rounds / tot.games).toFixed(1) });
} else {
  const { games, players, A, B, seed } = workerData;
  const out = { A: 0, games: 0, rounds: 0 };
  for (let g = 0; g < games; g++) {
    const r = playGame(Array.from({ length: players }, (_, i) => ((i + g + seed) % 2 ? A : B)));
    out.games++; out.rounds += r.rounds;
    if (r.winner === 'A') out.A++;
  }
  parentPort.postMessage(out);
}
