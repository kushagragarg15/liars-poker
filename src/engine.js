// ---------- Cards ----------
export const SUITS = ['S', 'H', 'D', 'C'];
const VS = '\uFE0E'; // force text (non-emoji) suit glyphs
export const SUIT_SYM = { S: '♠' + VS, H: '♥' + VS, D: '♦' + VS, C: '♣' + VS };
export const SUIT_NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
export const SUIT_ORDER = { C: 0, D: 1, H: 2, S: 3 };
export const isRed = (s) => s === 'H' || s === 'D';

const RC = '23456789TJQKA';
export const rankLabel = (r) => (r === 10 ? '10' : RC[r - 2]);
const ONE = { 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const MANY = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
export const rankOne = (r) => ONE[r];
export const rankMany = (r) => MANY[r];

export const HAND_TYPES = {
  1: 'High card', 2: 'Pair', 3: 'Two pair', 4: 'Three of a kind', 5: 'Straight',
  6: 'Flush', 7: 'Full house', 8: 'Four of a kind', 9: 'Straight flush', 10: 'Royal flush',
};

export const cardStr = (c) => RC[c.r - 2] + c.s;
export const parseCard = (s) => ({ r: RC.indexOf(s[0]) + 2, s: s[1] });
export const FULL_DECK = SUITS.flatMap((s) => Array.from({ length: 13 }, (_, i) => ({ r: i + 2, s })));

export function startingCards(n) {
  return n === 2 ? 3 : n >= 5 ? 1 : 2;
}
export const MAX_CARDS = 5;

// ---------- Bids ----------
export function normalizeBid(b) {
  const t = +b.type, r1 = +b.rank1, r2 = +b.rank2;
  const o = { type: t, rank1: null, rank2: null, suit: null, bidderId: b.bidderId ?? null };
  if ([1, 2, 4, 5, 8].includes(t)) o.rank1 = r1;
  else if (t === 3) { o.rank1 = Math.max(r1, r2); o.rank2 = Math.min(r1, r2); }
  else if (t === 7) { o.rank1 = r1; o.rank2 = r2; }
  else if (t === 10) o.suit = b.suit;
  else if (t === 6 || t === 9) { o.rank1 = r1; o.suit = b.suit; }
  return o;
}

export function validateBid(b) {
  if (!b || !Number.isInteger(b.type) || b.type < 1 || b.type > 10) return false;
  const rk = (x) => Number.isInteger(x) && x >= 2 && x <= 14;
  const st = (x) => typeof x === 'string' && x in SUIT_ORDER;
  switch (b.type) {
    case 1: return rk(b.rank1) && b.rank1 >= HIGH_MIN;
    case 2: case 4: case 8: return rk(b.rank1);
    case 3: return rk(b.rank1) && rk(b.rank2) && b.rank1 > b.rank2;
    case 7: return rk(b.rank1) && rk(b.rank2) && b.rank1 !== b.rank2;
    case 5: return rk(b.rank1) && b.rank1 >= 5;
    case 6: return rk(b.rank1) && b.rank1 >= 6 && st(b.suit);
    case 10: return st(b.suit);
    case 9: return rk(b.rank1) && b.rank1 >= 5 && b.rank1 <= 13 && st(b.suit);
  }
  return false;
}

const bidKey = (b) => [b.type, b.rank1 || 0, b.rank2 || 0, b.suit ? SUIT_ORDER[b.suit] : 0];
export function isBidHigher(n, c) {
  if (!c) return true;
  const a = bidKey(n), d = bidKey(c);
  for (let i = 0; i < 4; i++) if (a[i] !== d[i]) return a[i] > d[i];
  return false;
}
export const sameBid = (a, b) => !!a && !!b && bidKey(a).join() === bidKey(b).join();

export function bidText(b) {
  if (!b) return '';
  switch (b.type) {
    case 1: return `${rankOne(b.rank1)} high`;
    case 2: return `Pair of ${rankMany(b.rank1)}`;
    case 3: return `Two pair, ${rankMany(b.rank1)} and ${rankMany(b.rank2)}`;
    case 4: return `Three ${rankMany(b.rank1)}`;
    case 5: return `${rankOne(b.rank1)}-high straight`;
    case 6: return `${rankOne(b.rank1)}-high flush in ${SUIT_NAME[b.suit]}`;
    case 7: return `${rankMany(b.rank1)} full of ${rankMany(b.rank2)}`;
    case 8: return `Four ${rankMany(b.rank1)}`;
    case 9: return `${rankOne(b.rank1)}-high straight flush in ${SUIT_NAME[b.suit]}`;
    case 10: return `Royal flush in ${SUIT_NAME[b.suit]}`;
  }
  return HAND_TYPES[b.type] || '';
}

export const straightRanks = (hi) => [0, 1, 2, 3, 4].map((k) => (hi - k === 1 ? 14 : hi - k));

// "X high" is a real poker high-card hand: X plus four lower cards, all of different ranks, that
// don't make a straight or a flush. Below 7 that's impossible (6-5-4-3-2 is a straight).
export const HIGH_MIN = 7;
const SUIT_BIT = { C: 1, D: 2, H: 4, S: 8 };
const isRun = (rs) => rs[0] - rs[4] === 4 || (rs[0] === 14 && rs[1] === 5 && rs[4] === 2);
// rc: count per rank, sr: bitmask of suits present per rank, n: cards on the table
function highRanks(rc, sr, n, x) {
  if (x < HIGH_MIN || !rc[x]) return null;
  const lower = [];
  for (let r = x - 1; r >= 2; r--) if (rc[r]) lower.push(r);
  const need = Math.min(4, n - 1);
  if (lower.length < need) return null;
  if (need < 4) return [x, ...lower.slice(0, need)];
  const L = lower.length;
  for (let a = 0; a < L; a++) for (let b = a + 1; b < L; b++) for (let c = b + 1; c < L; c++) for (let d = c + 1; d < L; d++) {
    const rs = [x, lower[a], lower[b], lower[c], lower[d]];
    if (isRun(rs)) continue;
    const s0 = sr[x];
    if (!(s0 & (s0 - 1)) && rs.every((r) => sr[r] === s0)) continue; // every card is the same single suit: a flush
    return rs;
  }
  return null;
}

// Boolean check used by bots and odds
export const holds = (pool, bid) => holdsFast(stats(pool), bid);

// Full check with an explanation and the cards that make (or partly make) the hand
export function check(pool, bid) {
  const byRank = {}, bySuit = { S: [], H: [], D: [], C: [] };
  pool.forEach((c) => { (byRank[c.r] = byRank[c.r] || []).push(c); bySuit[c.s].push(c); });
  const cnt = (r) => (byRank[r] || []).length;
  const take = (r, n) => (byRank[r] || []).slice(0, n);
  let ok = false, used = [], text = '';
  const r1 = bid.rank1, r2 = bid.rank2;
  switch (bid.type) {
    case 1: {
      const st = stats(pool);
      const rs = highRanks(st.rc, st.sr, pool.length, r1);
      const need = Math.min(4, pool.length - 1);
      let lowRanks = 0;
      for (let r = r1 - 1; r >= 2; r--) if (cnt(r)) lowRanks++;
      ok = !!rs;
      if (rs) {
        used = rs.map((r) => byRank[r][0]);
        // if those picks happen to share a suit, swap one for another suit so it isn't a flush
        if (used.length === 5 && used.every((c) => c.s === used[0].s)) {
          const i = rs.findIndex((r) => byRank[r].some((c) => c.s !== used[0].s));
          used[i] = byRank[rs[i]].find((c) => c.s !== used[0].s);
        }
      } else used = take(r1, 1);
      text = r1 < HIGH_MIN ? `${rankOne(r1)} high can't exist: there aren't four lower ranks that avoid a straight.`
        : !cnt(r1) ? `No ${rankOne(r1)} anywhere on the table.`
          : ok ? `${rankOne(r1)} with ${need} lower cards of different ranks, no pair, straight or flush.`
            : lowRanks < need ? `${rankOne(r1)} found, but only ${lowRanks} different lower ${lowRanks === 1 ? 'rank' : 'ranks'} (needed ${need}). Pairs don't count twice.`
              : `${rankOne(r1)} found, but every five cards it could make form a straight or a flush.`;
      break;
    }
    case 2: case 4: case 8: {
      const n = { 2: 2, 4: 3, 8: 4 }[bid.type];
      ok = cnt(r1) >= n; used = take(r1, n);
      text = `Needed ${n} ${rankMany(r1)}, found ${cnt(r1)}.`;
      break;
    }
    case 3:
      ok = cnt(r1) >= 2 && cnt(r2) >= 2; used = [...take(r1, 2), ...take(r2, 2)];
      text = `Needed two ${rankMany(r1)} and two ${rankMany(r2)}, found ${cnt(r1)} and ${cnt(r2)}.`;
      break;
    case 7:
      ok = cnt(r1) >= 3 && cnt(r2) >= 2; used = [...take(r1, 3), ...take(r2, 2)];
      text = `Needed three ${rankMany(r1)} and two ${rankMany(r2)}, found ${cnt(r1)} and ${cnt(r2)}.`;
      break;
    case 5: {
      const rs = straightRanks(r1);
      const missing = rs.filter((r) => !cnt(r));
      ok = !missing.length; used = rs.flatMap((r) => take(r, 1));
      text = ok ? 'Every card of the straight is on the table.' : `Missing: ${missing.map(rankOne).join(', ')}.`;
      break;
    }
    case 6: {
      const top = bySuit[bid.suit].find((c) => c.r === r1);
      const low = bySuit[bid.suit].filter((c) => c.r < r1).sort((a, b) => b.r - a.r);
      ok = !!top && low.length >= 4;
      used = [...(top ? [top] : []), ...low.slice(0, 4)];
      const nm = `${rankOne(r1)} of ${SUIT_NAME[bid.suit]}`;
      text = !top ? `No ${nm} on the table.`
        : ok ? `${rankOne(r1)} of ${SUIT_NAME[bid.suit]} with four lower ${SUIT_NAME[bid.suit]} under it.`
          : `${nm} found, but only ${low.length} lower ${SUIT_NAME[bid.suit]} (needed 4).`;
      break;
    }
    case 9: case 10: {
      const rs = bid.type === 10 ? [14, 13, 12, 11, 10] : straightRanks(r1);
      const found = rs.map((r) => pool.find((c) => c.r === r && c.s === bid.suit)).filter(Boolean);
      ok = found.length === 5; used = found;
      const miss = rs.filter((r) => !pool.some((c) => c.r === r && c.s === bid.suit));
      text = ok ? 'Every card is there. Remarkable.' : `Missing: ${miss.map((r) => rankLabel(r) + SUIT_SYM[bid.suit]).join(' ')}.`;
      break;
    }
  }
  return { ok, used: used.map(cardStr), text };
}

let ALL = null;
export function allBids() {
  if (ALL) return ALL;
  const out = [], R = [], S = Object.keys(SUIT_ORDER);
  for (let r = 2; r <= 14; r++) R.push(r);
  R.forEach((a) => {
    if (a >= HIGH_MIN) out.push({ type: 1, rank1: a });
    out.push({ type: 2, rank1: a }, { type: 4, rank1: a }, { type: 8, rank1: a });
    R.forEach((b) => {
      if (a > b) out.push({ type: 3, rank1: a, rank2: b });
      if (a !== b) out.push({ type: 7, rank1: a, rank2: b });
    });
    if (a >= 5) out.push({ type: 5, rank1: a });
    if (a >= 6) S.forEach((s) => out.push({ type: 6, rank1: a, suit: s }));
    if (a >= 5 && a <= 13) S.forEach((s) => out.push({ type: 9, rank1: a, suit: s }));
  });
  S.forEach((s) => out.push({ type: 10, suit: s }));
  ALL = out.map(normalizeBid).sort((x, y) => (isBidHigher(x, y) ? 1 : -1));
  return ALL;
}
export const minRaise = (cur) => allBids().find((b) => isBidHigher(b, cur)) || null;

export function bestInHand(hand) {
  if (!hand || !hand.length) return null;
  const list = allBids();
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (b.type === 1) continue; // high card is meaningless with few cards
    if (holds(hand, b)) return b;
  }
  return null;
}

// Monte Carlo probability that the bid exists, from the point of view of someone holding `hand`
export function estP(hand, bid, poolSize, n = 150) {
  const unk = FULL_DECK.filter((c) => !hand.some((h) => h.r === c.r && h.s === c.s));
  const need = Math.max(0, Math.min(poolSize - hand.length, unk.length));
  if (!need) return holds(hand, bid) ? 1 : 0;
  const pool = new Array(hand.length + need);
  for (let i = 0; i < hand.length; i++) pool[i] = hand[i];
  let ok = 0;
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(Math.random() * (unk.length - k));
      const tmp = unk[k]; unk[k] = unk[j]; unk[j] = tmp;
      pool[hand.length + k] = unk[k];
    }
    if (holds(pool, bid)) ok++;
  }
  return ok / n;
}

// ---------- Bot brain ----------
// Which cards a claim is about: someone who bids it is more likely to hold some of them
function relevant(bid) {
  const r1 = bid.rank1, r2 = bid.rank2, s = bid.suit;
  switch (bid.type) {
    case 1: case 2: case 4: case 8: return (c) => c.r === r1;
    case 3: case 7: return (c) => c.r === r1 || c.r === r2;
    case 5: { const rs = straightRanks(r1); return (c) => rs.includes(c.r); }
    case 6: return (c) => c.s === s && c.r <= r1;
    case 9: { const rs = straightRanks(r1); return (c) => c.s === s && rs.includes(c.r); }
    case 10: return (c) => c.s === s && c.r >= 10;
  }
  return () => false;
}
// How much more likely a bid is when the bidder holds 0, 1, 2+ of its cards (bids are often bluffs)
const READ = [1, 1.9, 2.6];

// Deal the unseen cards to each opponent many times, weighting each deal by how well it explains
// what those opponents have bid this round.
export function sampleTables(hand, others, n = 360, READ_W = READ) {
  const unk = FULL_DECK.filter((c) => !hand.some((h) => h.r === c.r && h.s === c.s));
  const sizes = others.map((o) => o.n);
  const need = Math.min(unk.length, sizes.reduce((a, x) => a + x, 0));
  const tests = others.map((o) => (o.bids || []).map(relevant));
  const out = [];
  for (let t = 0; t < n; t++) {
    for (let k = 0; k < need; k++) {
      const j = k + Math.floor(Math.random() * (unk.length - k));
      const tmp = unk[k]; unk[k] = unk[j]; unk[j] = tmp;
    }
    let w = 1, at = 0;
    for (let i = 0; i < others.length; i++) {
      const h = unk.slice(at, at + sizes[i]); at += sizes[i];
      for (const f of tests[i]) {
        let m = 0;
        for (const c of h) if (f(c)) m++;
        w *= READ_W[Math.min(m, 2)];
      }
    }
    out.push({ st: stats(hand.concat(unk.slice(0, need))), w });
  }
  return out;
}

// Rank counts and per-suit rank bitmasks, so checking a bid against a table is a few integer ops
function stats(pool) {
  const rc = new Array(15).fill(0), sr = new Array(15).fill(0), m = { S: 0, H: 0, D: 0, C: 0 };
  for (const c of pool) { rc[c.r]++; sr[c.r] |= SUIT_BIT[c.s]; m[c.s] |= 1 << c.r; }
  return { rc, sr, m, n: pool.length };
}
const bits = (x) => { let k = 0; while (x) { x &= x - 1; k++; } return k; };
const runMask = (rs) => rs.reduce((a, r) => a | (1 << r), 0);
function holdsFast(st, bid) {
  const { rc, m } = st, r1 = bid.rank1;
  switch (bid.type) {
    case 1: return !!highRanks(rc, st.sr, st.n, r1);
    case 2: return rc[r1] >= 2;
    case 3: return rc[r1] >= 2 && rc[bid.rank2] >= 2;
    case 4: return rc[r1] >= 3;
    case 5: return straightRanks(r1).every((r) => rc[r] > 0);
    case 6: return !!(m[bid.suit] & (1 << r1)) && bits(m[bid.suit] & ((1 << r1) - 1)) >= 4;
    case 7: return rc[r1] >= 3 && rc[bid.rank2] >= 2;
    case 8: return rc[r1] >= 4;
    case 9: case 10: {
      const want = runMask(bid.type === 10 ? [14, 13, 12, 11, 10] : straightRanks(r1));
      return (m[bid.suit] & want) === want;
    }
  }
  return false;
}
export function tableP(tables, bid) {
  let ok = 0, all = 0;
  for (const t of tables) { all += t.w; if (holdsFast(t.st, bid)) ok += t.w; }
  return all ? ok / all : 0;
}

// Tunable knobs, fitted by self-play (tests/arena.mjs)
export const BRAIN = { K: 14, delay: 0.22, temp: 0.015, read: [1, 4, 7], n: 400 };

// others: [{ n: cards held, bids: [their bids this round] }] for every other live player, in turn
// order starting with whoever acts next. myBids: what this bot has already claimed this round.
//
// Every option is scored by its expected result for the bot (+1 the other side takes the card,
// -1 we take it):
// - calling wins when the claim is false
// - a raise is judged mostly by the next player: they call claims that look unlikely *to them*
//   (they can't see our cards), so the best raises are ones we know are true but look shaky.
//   A raise that won't be called just passes the turn on and keeps a little risk (`delay`), which
//   is why creeping up one rank at a time is never worth it on its own.
export function botDecide(hand, cur, poolSize, others, myBids = [], P = BRAIN) {
  if (!others || !others.length) others = [{ n: Math.max(0, poolSize - hand.length), bids: [] }];
  const mine = sampleTables(hand, others, P.n, P.read);
  const seen = sampleTables([], [{ n: hand.length, bids: myBids }, ...others], P.n, P.read);
  const opts = [];
  if (cur) opts.push({ call: true, eu: 1 - 2 * tableP(mine, cur) });
  for (const b of allBids()) {
    if (!isBidHigher(b, cur)) continue;
    const pm = tableP(mine, b), pp = tableP(seen, b);
    const c = 1 / (1 + Math.exp((pp - 0.5) * 2 * P.K));
    opts.push({ bid: b, eu: c * (2 * pm - 1) - (1 - c) * P.delay });
  }
  if (!opts.length) return { call: true };
  // pick the best, with a little noise among near-equal options so bots aren't predictable
  const best = Math.max(...opts.map((o) => o.eu));
  const ws = opts.map((o) => Math.exp((o.eu - best) / P.temp));
  let r = Math.random() * ws.reduce((a, w) => a + w, 0);
  for (let i = 0; i < opts.length; i++) if ((r -= ws[i]) <= 0) return opts[i].call ? { call: true } : { bid: opts[i].bid };
  return opts[0].call ? { call: true } : { bid: opts[0].bid };
}

// ---------- Reactions ----------
export const REACTIONS = ['😂', '😮', '🤔', '😏', '😱', '👏', '🔥', '🤡', '😎', '🤦', '😤', '🙏'];
const RX = (s) => REACTIONS.indexOf(s);
const BOT_RX = {
  lost: ['😱', '🤦', '😤', '🙏'].map(RX),
  won: ['😎', '😏', '👏', '🔥'].map(RX),
  watch: ['😂', '😮', '👏', '🤡'].map(RX),
  bold: ['😮', '🤔', '😱', '🔥'].map(RX),
};
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
const bidIndex = (b) => allBids().findIndex((x) => sameBid(x, b));

// ---------- Engine (runs on the host / solo device) ----------
const BOT_NAMES = ['Dutch', 'Mabel', 'Silas', 'Opal', 'Rook', 'Vera', 'Jasper', 'Ines', 'Monty', 'Faye'];

export class Engine {
  constructor(onChange) {
    this.onChange = onChange;
    this.botTimer = null;
    this.readyTimer = null;
    this.botDelay = [1500, 2600];
    this.fxTimers = new Set();
    this.lastReact = new Map();
    this.G = {
      status: 'LOBBY', round: 0, players: [], starter: 0, turn: 0, bid: null,
      log: [], logN: 0, reveal: null, ready: [], winnerId: null, seq: 0, elimCount: 0,
      reacts: [], reactN: 0,
    };
  }

  // anyone seated can react at any time; a short cooldown keeps it from being spammed
  react(pid, e) {
    const G = this.G, now = Date.now();
    if (!this.get(pid) || !Number.isInteger(e) || e < 0 || e >= REACTIONS.length) return false;
    if (now - (this.lastReact.get(pid) || 0) < 600) return false;
    this.lastReact.set(pid, now);
    G.reacts.push({ n: ++G.reactN, pid, e });
    if (G.reacts.length > 6) G.reacts.shift();
    this.changed();
    return true;
  }
  later(ms, f) {
    const t = setTimeout(() => { this.fxTimers.delete(t); f(); }, ms);
    this.fxTimers.add(t);
  }
  botReact(p, set, chance, delay) {
    if (!p || !p.bot || p.left || Math.random() >= chance) return;
    this.later(delay + Math.random() * 1200, () => this.react(p.id, pickOf(set)));
  }
  changed() { this.G.seq++; this.onChange(this.G); }
  get(id) { return this.G.players.find((p) => p.id === id); }
  active() { return this.G.players.filter((p) => !p.elim); }
  poolSize() { return this.active().reduce((a, p) => a + p.hand.length, 0); }

  addPlayer(id, name, bot = false) {
    const G = this.G;
    if (G.status !== 'LOBBY' || G.players.length >= 6 || this.get(id)) return false;
    G.players.push({ id, name, bot, left: false, count: 2, elim: false, hand: [], elimOrder: 0 });
    this.changed();
    return true;
  }
  addBot() {
    const used = new Set(this.G.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot ' + (this.G.players.length + 1);
    return this.addPlayer('b' + Math.random().toString(36).slice(2, 8), name, true);
  }
  removePlayer(id) {
    if (this.G.status !== 'LOBBY') return;
    this.G.players = this.G.players.filter((p) => p.id !== id);
    this.changed();
  }
  rename(id, name) {
    const p = this.get(id);
    if (p && p.name !== name) { p.name = name; this.changed(); }
  }

  start() {
    const G = this.G, n = G.players.length;
    if (n < 2) return false;
    const c = startingCards(n);
    G.players.forEach((p) => { p.count = c; p.elim = false; p.hand = []; p.elimOrder = 0; });
    G.elimCount = 0; G.round = 0; G.winnerId = null;
    G.starter = Math.floor(Math.random() * n);
    this.newRound();
    return true;
  }

  newRound() {
    const G = this.G;
    clearTimeout(this.readyTimer);
    G.round++;
    G.status = 'PLAYING'; G.bid = null; G.log = []; G.logN = 0; G.reveal = null; G.ready = [];
    const deck = FULL_DECK.map((c) => ({ ...c }));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const n = G.players.length;
    G.players.forEach((p) => { p.hand = []; });
    for (let k = 0; k < MAX_CARDS; k++) {
      for (let s = 0; s < n; s++) {
        const p = G.players[(G.starter + s) % n];
        if (!p.elim && p.hand.length < p.count && deck.length) p.hand.push(deck.pop());
      }
    }
    G.players.forEach((p) => p.hand.sort((a, b) => b.r - a.r || SUIT_ORDER[b.s] - SUIT_ORDER[a.s]));
    G.turn = G.starter;
    this.changed();
    this.scheduleBot(900);
  }

  advance() {
    const G = this.G, n = G.players.length;
    let i = (G.turn + 1) % n, guard = 0;
    while (G.players[i].elim && guard++ < n) i = (i + 1) % n;
    G.turn = i;
  }

  bid(pid, raw) {
    const G = this.G, cur = G.players[G.turn];
    if (G.status !== 'PLAYING' || !cur || cur.id !== pid || cur.elim) return false;
    const b = normalizeBid({ ...raw, bidderId: pid });
    if (!validateBid(b) || !isBidHigher(b, G.bid)) return false;
    // a big jump or a monster hand gets a raised eyebrow from one of the bots
    const jump = bidIndex(b) - bidIndex(minRaise(G.bid));
    if (jump >= 30 || b.type >= 7) {
      const watchers = this.active().filter((o) => o.bot && o.id !== pid);
      if (watchers.length) this.botReact(pickOf(watchers), BOT_RX.bold, 0.45, 500);
    }
    G.bid = b;
    G.log.push({ pid, bid: b }); G.logN++;
    if (G.log.length > 40) G.log.shift();
    this.advance();
    this.changed();
    this.scheduleBot();
    return true;
  }

  call(pid) {
    const G = this.G, bid = G.bid, cur = G.players[G.turn];
    if (G.status !== 'PLAYING' || !bid || !cur || cur.id !== pid || cur.elim) return false;
    clearTimeout(this.botTimer);
    const pool = this.active().flatMap((p) => p.hand);
    const res = check(pool, bid);
    const loserId = res.ok ? pid : bid.bidderId;
    const loser = this.get(loserId);
    if (loser) {
      loser.count++;
      if (loser.count > MAX_CARDS) { loser.elim = true; loser.elimOrder = ++G.elimCount; }
    }
    G.log.push({ pid, call: true }); G.logN++;
    const hands = {};
    G.players.forEach((p) => { hands[p.id] = p.hand.map(cardStr); });
    const act = this.active();
    const final = act.length <= 1 || !act.some((p) => !p.bot);
    if (act.length <= 1) G.winnerId = act[0] ? act[0].id : null;
    G.reveal = {
      bid, challengerId: pid, bidderId: bid.bidderId, loserId, ok: res.ok, text: res.text,
      used: res.used, eliminated: !!(loser && loser.elim), hands, final,
    };
    // the caller opens the next round (skipping anyone who is out)
    const n = G.players.length;
    G.starter = G.turn;
    let guard = 0;
    while (G.players[G.starter].elim && guard++ < n) G.starter = (G.starter + 1) % n;
    G.status = 'RESULT';
    G.ready = [];
    // bots react once the verdict shows (cards flip one by one before that)
    const verdictAt = 1450 + pool.length * 90;
    const winnerId = loserId === pid ? bid.bidderId : pid;
    G.players.forEach((p) => {
      if (p.id === loserId) this.botReact(p, BOT_RX.lost, 0.7, verdictAt);
      else if (p.id === winnerId) this.botReact(p, BOT_RX.won, 0.55, verdictAt);
      else this.botReact(p, BOT_RX.watch, 0.2, verdictAt + 500);
    });
    this.changed();
    this.checkReady();
    return true;
  }

  needReady() {
    const G = this.G, lid = G.reveal ? G.reveal.loserId : null;
    return G.players.filter((p) => !p.bot && (!p.elim || p.id === lid));
  }
  setReady(pid) {
    const G = this.G;
    if (G.status !== 'RESULT') return;
    if (!G.ready.includes(pid)) G.ready.push(pid);
    if (!this.checkReady()) this.changed();
  }
  checkReady() {
    const G = this.G;
    if (G.status !== 'RESULT') return false;
    const need = this.needReady();
    if (!need.length) {
      clearTimeout(this.readyTimer);
      const r = G.round;
      this.readyTimer = setTimeout(() => { if (G.status === 'RESULT' && G.round === r) this.afterResult(); }, 6000);
      return false;
    }
    if (!need.every((p) => G.ready.includes(p.id))) return false;
    this.afterResult();
    return true;
  }
  afterResult() {
    const G = this.G;
    const act = this.active();
    if (act.length <= 1 || !act.some((p) => !p.bot)) {
      if (!G.winnerId) G.winnerId = [...act].sort((a, b) => a.count - b.count)[0]?.id || null;
      G.status = 'OVER';
      this.changed();
    } else this.newRound();
  }

  playerLeft(id) {
    const G = this.G, p = this.get(id);
    if (!p) return;
    if (G.status === 'LOBBY') G.players = G.players.filter((x) => x !== p);
    else { p.bot = true; p.left = true; }
    this.changed();
    this.scheduleBot();
    this.checkReady();
  }

  backToLobby() {
    const G = this.G;
    clearTimeout(this.botTimer); clearTimeout(this.readyTimer);
    G.players = G.players.filter((p) => !p.left);
    G.players.forEach((p) => { p.hand = []; p.elim = false; p.count = 2; p.elimOrder = 0; });
    Object.assign(G, { status: 'LOBBY', bid: null, log: [], logN: 0, reveal: null, ready: [], winnerId: null });
    this.changed();
  }

  scheduleBot(extra = 0) {
    clearTimeout(this.botTimer);
    const G = this.G;
    if (G.status !== 'PLAYING') return;
    const p = G.players[G.turn];
    if (!p || !p.bot || p.elim) return;
    const [a, b] = this.botDelay;
    this.botTimer = setTimeout(() => this.botMove(p.id), extra + a + Math.random() * (b - a));
  }
  botMove(id) {
    const G = this.G, p = G.players[G.turn];
    if (G.status !== 'PLAYING' || !p || p.id !== id) return;
    const bidsOf = (id) => G.log.filter((e) => e.pid === id && e.bid).map((e) => e.bid);
    // everyone else, in turn order starting with the next player
    const n = G.players.length, others = [];
    for (let k = 1; k < n; k++) {
      const o = G.players[(G.turn + k) % n];
      if (!o.elim) others.push({ n: o.hand.length, bids: bidsOf(o.id) });
    }
    const d = botDecide(p.hand, G.bid, this.poolSize(), others, bidsOf(p.id));
    if (d.call && G.bid) this.call(id);
    else if (!this.bid(id, d.bid || minRaise(G.bid))) this.call(id);
  }
  destroy() {
    clearTimeout(this.botTimer); clearTimeout(this.readyTimer);
    this.fxTimers.forEach(clearTimeout); this.fxTimers.clear();
    this.onChange = () => {};
  }
}

// The view a given seat is allowed to see
export function engineView(G, myId) {
  return {
    status: G.status, round: G.round, seq: G.seq,
    starterId: G.players[G.starter] ? G.players[G.starter].id : null,
    turnId: G.status === 'PLAYING' && G.players[G.turn] ? G.players[G.turn].id : null,
    players: G.players.map((p) => ({
      id: p.id, name: p.name, bot: p.bot, left: !!p.left, count: p.count, elim: p.elim,
      elimOrder: p.elimOrder, handLen: p.hand.length,
      hand: p.id === myId ? p.hand.map(cardStr) : null,
    })),
    bid: G.bid,
    log: G.log.slice(-12).map((e) => ({ pid: e.pid, call: !!e.call, bid: e.bid || null })),
    logN: G.logN,
    reveal: G.reveal,
    ready: [...G.ready],
    winnerId: G.winnerId,
    reacts: G.reacts.map((r) => ({ ...r })),
  };
}
