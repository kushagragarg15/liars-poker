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
  else if (t === 6 || t === 10) o.suit = b.suit;
  else if (t === 9) { o.rank1 = r1; o.suit = b.suit; }
  return o;
}

export function validateBid(b) {
  if (!b || !Number.isInteger(b.type) || b.type < 1 || b.type > 10) return false;
  const rk = (x) => Number.isInteger(x) && x >= 2 && x <= 14;
  const st = (x) => typeof x === 'string' && x in SUIT_ORDER;
  switch (b.type) {
    case 1: case 2: case 4: case 8: return rk(b.rank1);
    case 3: return rk(b.rank1) && rk(b.rank2) && b.rank1 > b.rank2;
    case 7: return rk(b.rank1) && rk(b.rank2) && b.rank1 !== b.rank2;
    case 5: return rk(b.rank1) && b.rank1 >= 5;
    case 6: case 10: return st(b.suit);
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
    case 6: return `Flush in ${SUIT_NAME[b.suit]}`;
    case 7: return `${rankMany(b.rank1)} full of ${rankMany(b.rank2)}`;
    case 8: return `Four ${rankMany(b.rank1)}`;
    case 9: return `${rankOne(b.rank1)}-high straight flush in ${SUIT_NAME[b.suit]}`;
    case 10: return `Royal flush in ${SUIT_NAME[b.suit]}`;
  }
  return HAND_TYPES[b.type] || '';
}

export const straightRanks = (hi) => [0, 1, 2, 3, 4].map((k) => (hi - k === 1 ? 14 : hi - k));

// Fast boolean check used by bots / odds
export function holds(pool, bid) {
  const rc = new Array(15).fill(0);
  const sc = { S: 0, H: 0, D: 0, C: 0 };
  for (const c of pool) { rc[c.r]++; sc[c.s]++; }
  switch (bid.type) {
    case 1: {
      if (!rc[bid.rank1]) return false;
      let low = 0;
      for (let r = 2; r <= bid.rank1; r++) low += rc[r];
      return low >= Math.min(5, pool.length);
    }
    case 2: return rc[bid.rank1] >= 2;
    case 3: return rc[bid.rank1] >= 2 && rc[bid.rank2] >= 2;
    case 4: return rc[bid.rank1] >= 3;
    case 5: return straightRanks(bid.rank1).every((r) => rc[r] > 0);
    case 6: return sc[bid.suit] >= 5;
    case 7: return rc[bid.rank1] >= 3 && rc[bid.rank2] >= 2;
    case 8: return rc[bid.rank1] >= 4;
    case 9: case 10: {
      const rs = bid.type === 10 ? [14, 13, 12, 11, 10] : straightRanks(bid.rank1);
      return rs.every((r) => pool.some((c) => c.r === r && c.s === bid.suit));
    }
  }
  return false;
}

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
      const low = pool.filter((c) => c.r <= r1).length;
      const need = Math.min(5, pool.length);
      ok = cnt(r1) >= 1 && low >= need;
      used = take(r1, 1);
      text = !cnt(r1)
        ? `No ${rankOne(r1)} anywhere on the table.`
        : ok ? `${rankOne(r1)} found, with enough lower cards to build the hand around it.`
          : `Only ${low} cards at ${rankOne(r1)} or below, so any five-card hand has something higher.`;
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
      const n = bySuit[bid.suit].length;
      ok = n >= 5; used = bySuit[bid.suit].slice(0, 5);
      text = `Needed five ${SUIT_NAME[bid.suit]}, found ${n}.`;
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
    out.push({ type: 1, rank1: a }, { type: 2, rank1: a }, { type: 4, rank1: a }, { type: 8, rank1: a });
    R.forEach((b) => {
      if (a > b) out.push({ type: 3, rank1: a, rank2: b });
      if (a !== b) out.push({ type: 7, rank1: a, rank2: b });
    });
    if (a >= 5) out.push({ type: 5, rank1: a });
    if (a >= 5 && a <= 13) S.forEach((s) => out.push({ type: 9, rank1: a, suit: s }));
  });
  S.forEach((s) => out.push({ type: 6, suit: s }, { type: 10, suit: s }));
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

export function botDecide(hand, cur, poolSize) {
  if (cur) {
    const p = estP(hand, cur, poolSize, 240);
    if (p < 0.27 + Math.random() * 0.06) return { call: true };
  }
  const th = 0.32 + Math.random() * 0.22;
  const cands = allBids().filter((b) => isBidHigher(b, cur));
  let best = null, bestP = -1;
  for (let i = 0; i < cands.length; i++) {
    const p = estP(hand, cands[i], poolSize, 90);
    if (p > bestP) { bestP = p; best = cands[i]; }
    if (p >= th) {
      // occasionally push a little harder than needed
      if (Math.random() < 0.15 && cands[i + 1] && estP(hand, cands[i + 1], poolSize, 60) > th * 0.8) return { bid: cands[i + 1] };
      return { bid: cands[i] };
    }
  }
  if (cur) return { call: true };
  return { bid: best || cands[0] };
}

// ---------- Engine (runs on the host / solo device) ----------
const BOT_NAMES = ['Dutch', 'Mabel', 'Silas', 'Opal', 'Rook', 'Vera', 'Jasper', 'Ines', 'Monty', 'Faye'];

export class Engine {
  constructor(onChange) {
    this.onChange = onChange;
    this.botTimer = null;
    this.readyTimer = null;
    this.botDelay = [1500, 2600];
    this.G = {
      status: 'LOBBY', round: 0, players: [], starter: 0, turn: 0, bid: null,
      log: [], logN: 0, reveal: null, ready: [], winnerId: null, seq: 0, elimCount: 0,
    };
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
    const d = botDecide(p.hand, G.bid, this.poolSize());
    if (d.call && G.bid) this.call(id);
    else if (!this.bid(id, d.bid || minRaise(G.bid))) this.call(id);
  }
  destroy() {
    clearTimeout(this.botTimer); clearTimeout(this.readyTimer);
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
  };
}
