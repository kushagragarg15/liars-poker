import { Engine, engineView, cardStr, normalizeBid } from './engine.js';
import { peerRoom } from './peerroom.js';

// ---------- crypto: each player's hand is encrypted for that player only ----------
const b64 = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const subtle = () => (window.crypto && window.crypto.subtle) || null;

async function makeKeys() {
  try {
    if (!subtle()) return null;
    const kp = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
    const raw = await subtle().exportKey('raw', kp.publicKey);
    return { kp, pub: b64(raw) };
  } catch (e) { return null; }
}
async function deriveAes(keys, pubB64) {
  if (!keys || !pubB64) return null;
  const pub = await subtle().importKey('raw', unb64(pubB64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  return subtle().deriveKey({ name: 'ECDH', public: pub }, keys.kp.privateKey, { name: 'AES-GCM', length: 128 }, false, ['encrypt', 'decrypt']);
}
async function enc(key, text) {
  if (!key) return ['', text];
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
  return [b64(iv), b64(ct)];
}
async function dec(key, h) {
  if (h[0] === '') return h[1];
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(h[0]) }, key, unb64(h[1]));
  return new TextDecoder().decode(pt);
}

export function cleanName(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').trim().slice(0, 14) || 'Player';
}

// ---------- wire format (fits comfortably inside the 4 KiB presence budget) ----------
function encodeState(G, hands) {
  const idx = (id) => G.players.findIndex((p) => p.id === id);
  const wb = (b) => (b ? [b.type, b.rank1 || 0, b.rank2 || 0, b.suit || '', idx(b.bidderId)] : 0);
  const r = G.reveal;
  return {
    s: G.status[0], n: G.round, k: G.seq, ln: G.logN,
    ps: G.players.map((p) => [p.id, p.name, (p.bot ? 1 : 0) | (p.elim ? 2 : 0) | (p.left ? 4 : 0), p.count, p.elimOrder, p.hand.length]),
    a: G.starter, t: G.turn,
    b: wb(G.bid),
    lg: G.log.slice(-12).map((e) => (e.call ? [idx(e.pid)] : [idx(e.pid), ...wb(e.bid).slice(0, 4)])),
    h: hands,
    rv: r ? {
      b: wb(r.bid), c: idx(r.challengerId), d: idx(r.bidderId), l: idx(r.loserId), o: r.ok ? 1 : 0,
      x: String(r.text).slice(0, 300), u: r.used.join(' '), e: r.eliminated ? 1 : 0, f: r.final ? 1 : 0,
      hs: G.players.map((p) => (r.hands[p.id] || []).join(' ')),
    } : 0,
    rd: G.ready.map(idx),
    w: G.winnerId ? idx(G.winnerId) : -1,
  };
}

function decodeState(st, myId, myHand) {
  const S = { L: 'LOBBY', P: 'PLAYING', R: 'RESULT', O: 'OVER' }[st.s];
  const ids = st.ps.map((p) => String(p[0]));
  const rb = (a) => (a ? normalizeBid({ type: a[0], rank1: a[1], rank2: a[2], suit: a[3] || null, bidderId: ids[a[4]] }) : null);
  const players = st.ps.map((p) => ({
    id: String(p[0]), name: cleanName(p[1]), bot: !!(p[2] & 1), elim: !!(p[2] & 2), left: !!(p[2] & 4),
    count: +p[3] || 0, elimOrder: +p[4] || 0, handLen: +p[5] || 0,
    hand: String(p[0]) === myId ? myHand : null,
  }));
  let reveal = null;
  if (st.rv) {
    const hands = {};
    ids.forEach((id, i) => { hands[id] = String(st.rv.hs[i] || '').split(' ').filter(Boolean); });
    reveal = {
      bid: rb(st.rv.b), challengerId: ids[st.rv.c], bidderId: ids[st.rv.d], loserId: ids[st.rv.l],
      ok: !!st.rv.o, text: String(st.rv.x || ''), used: String(st.rv.u || '').split(' ').filter(Boolean),
      eliminated: !!st.rv.e, final: !!st.rv.f, hands,
    };
  }
  return {
    status: S, round: st.n, seq: st.k,
    starterId: ids[st.a] || null,
    turnId: S === 'PLAYING' ? ids[st.t] || null : null,
    players,
    bid: rb(st.b),
    log: (st.lg || []).map((e) => (e.length === 1 ? { pid: ids[e[0]], call: true, bid: null } : { pid: ids[e[0]], call: false, bid: rb([e[1], e[2], e[3], e[4], e[0]]) })),
    logN: st.ln || 0,
    reveal,
    ready: (st.rd || []).map((i) => ids[i]),
    winnerId: st.w >= 0 ? ids[st.w] : null,
  };
}

// Inside Claude use the artifact `room` capability; everywhere else fall back to PeerJS.
export async function getRoom() {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const r = await window.claude.use('room');
      if (r) return r;
    }
  } catch (e) {}
  return typeof RTCPeerConnection === 'function' ? peerRoom : null;
}

export function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
const roomName = (code) => 'lp-' + code.toLowerCase();

// ---------- Session ----------
// mode: 'solo' | 'host' | 'client'
export class Session {
  constructor({ mode, name, code, bots = 0, onView, onToast, onFatal }) {
    Object.assign(this, { mode, name, code, bots, onView, onToast, onFatal });
    this.myId = mode === 'client' ? null : 'me';
    this.closed = false;
  }

  get isHost() { return this.mode !== 'client'; }

  async start() {
    if (this.isHost) {
      this.engine = new Engine((G) => this.onEngine(G));
      this.engine.addPlayer('me', this.name);
      if (this.mode === 'solo') {
        for (let i = 0; i < this.bots; i++) this.engine.addBot();
        this.engine.start();
        return;
      }
      const room = await getRoom();
      if (!room) throw new Error('Multiplayer is not supported in this browser.');
      this.keys = await makeKeys();
      this.aes = new Map(); this.pkSeen = new Map(); this.lastQ = new Map(); this.encCache = new Map();
      this.kicked = new Set();
      this.r = await room.join(roomName(this.code));
      this.unsub = this.r.onPeers((ch) => this.hostPeers(ch));
      this.engine.addBot();
      this.pushState();
    } else {
      const room = await getRoom();
      if (!room) throw new Error('Multiplayer is not supported in this browser.');
      this.keys = await makeKeys();
      this.q = 0;
      this.r = await room.join(roomName(this.code));
      await this.r.presence({ role: 'player', name: this.name, pk: this.keys ? this.keys.pub : '' });
      this.unsub = this.r.onPeers((ch) => this.clientPeers(ch));
      this.hostTimer = setTimeout(() => {
        if (!this.hostPeer && !this.closed) this.onFatal('No table is open with code ' + this.code + '. Check the code and try again.');
      }, 9000);
    }
  }

  // ----- host side -----
  onEngine(G) {
    if (this.closed) return;
    this.onView(engineView(G, 'me'));
    if (this.r) this.pushState();
  }

  async pushState() {
    if (!this.r || this.closed) return;
    const tok = (this.pushTok = (this.pushTok || 0) + 1);
    const G = this.engine.G;
    const hands = await Promise.all(G.players.map(async (p) => {
      if (G.status !== 'PLAYING' || p.bot || p.id === 'me' || !p.hand.length) return 0;
      if (!this.aes.has(p.id)) return 0; // wait until we share a key with this player
      const key = this.aes.get(p.id);
      const txt = p.hand.map(cardStr).join(' ');
      const ck = G.round + '|' + txt;
      const c = this.encCache.get(p.id);
      if (c && c.ck === ck) return c.v;
      const v = await enc(key, txt);
      this.encCache.set(p.id, { ck, v });
      return v;
    }));
    if (tok !== this.pushTok || this.closed) return;
    this.r.presence({ role: 'host', pk: this.keys ? this.keys.pub : '', st: encodeState(G, hands) })
      .catch((e) => console.warn('presence', e && e.code));
  }

  hostPeers(ch) {
    const E = this.engine, G = E.G;
    for (const p of ch.peers) {
      if (p.sameTab) continue;
      const pr = p.presence || {};
      if (pr.role !== 'player' || this.kicked.has(p.peer)) continue;
      const id = p.peer;
      const name = cleanName(pr.name);
      const pl = E.get(id);
      if (!pl) {
        if (G.status === 'LOBBY' && G.players.length < 6 && pr.name) {
          if (E.addPlayer(id, name)) this.onToast(name + ' sat down');
        }
      } else if (G.status === 'LOBBY') E.rename(id, name);
      if (!pr.pk && !this.aes.has(id)) { this.aes.set(id, null); this.pushState(); }
      if (pr.pk && this.pkSeen.get(id) !== pr.pk) {
        this.pkSeen.set(id, pr.pk);
        deriveAes(this.keys, pr.pk).then((k) => { this.aes.set(id, k); this.encCache.delete(id); this.pushState(); })
          .catch(() => { this.aes.set(id, null); this.pushState(); });
      }
      const act = pr.act;
      if (act && typeof act.q === 'number' && act.q > (this.lastQ.get(id) || 0)) {
        this.lastQ.set(id, act.q);
        if (E.get(id)) this.applyAct(id, act);
      }
    }
    for (const p of ch.left) {
      const pl = E.get(p.peer);
      if (pl && !pl.bot) {
        this.onToast(pl.name + (G.status === 'LOBBY' ? ' left' : ' left, a bot takes over'));
        E.playerLeft(p.peer);
      }
    }
  }

  applyAct(id, act) {
    const E = this.engine;
    if (act.k === 'bid' && Array.isArray(act.b)) E.bid(id, { type: +act.b[0], rank1: +act.b[1], rank2: +act.b[2], suit: act.b[3] || null });
    else if (act.k === 'call') E.call(id);
    else if (act.k === 'ready') E.setReady(id);
  }

  // ----- client side -----
  clientPeers(ch) {
    const me = ch.peers.find((p) => p.sameTab);
    if (me) this.myId = me.peer;
    if (this.hostPeer && ch.left.some((p) => p.peer === this.hostPeer)) {
      this.onFatal('The host closed the table.');
      return;
    }
    const host = ch.peers.find((p) => !p.sameTab && p.presence && p.presence.role === 'host' && p.presence.st);
    if (!host) return;
    this.hostPeer = host.peer;
    clearTimeout(this.hostTimer);
    if (host.presence.st !== this.lastSt || this.myId !== this.lastMyId) {
      this.lastSt = host.presence.st;
      this.lastMyId = this.myId;
      this.decode(host.presence);
    }
  }

  async decode(pr) {
    const tok = (this.decTok = (this.decTok || 0) + 1);
    const st = pr.st;
    let myHand = null;
    try {
      const i = st.ps.findIndex((p) => p[0] === this.myId);
      if (i >= 0 && st.h && st.h[i]) {
        if (this.hostPk !== pr.pk) { this.hostPk = pr.pk; this.hostKey = await deriveAes(this.keys, pr.pk); }
        const txt = await dec(this.hostKey, st.h[i]);
        myHand = txt.split(' ').filter(Boolean);
      }
    } catch (e) { myHand = null; }
    if (tok !== this.decTok || this.closed) return;
    try { this.onView(decodeState(st, this.myId, myHand)); } catch (e) { console.warn('decode', e); }
  }

  sendAct(k, b) {
    if (!this.r) return;
    this.q++;
    this.r.presence({ act: { q: this.q, k, b: b || 0 } }).catch(() => this.onToast('Connection hiccup, try again'));
  }

  // ----- actions (same API for every mode) -----
  bid(b) {
    if (this.isHost) return this.engine.bid('me', b);
    this.sendAct('bid', [b.type, b.rank1 || 0, b.rank2 || 0, b.suit || '']);
    return true;
  }
  call() { if (this.isHost) this.engine.call('me'); else this.sendAct('call'); }
  ready() { if (this.isHost) this.engine.setReady('me'); else this.sendAct('ready'); }
  startGame() { if (this.isHost) return this.engine.start(); }
  addBot() { if (this.isHost) this.engine.addBot(); }
  kick(id) { if (this.isHost) { this.kicked && this.kicked.add(id); this.engine.removePlayer(id); } }
  again() {
    if (!this.isHost) return;
    this.engine.backToLobby();
    if (this.mode === 'solo') this.engine.start();
  }
  setBotPace(pace) {
    if (!this.engine) return;
    this.engine.botDelay = pace === 'quick' ? [700, 1300] : pace === 'relaxed' ? [2400, 3800] : [1500, 2600];
  }
  leave() {
    this.closed = true;
    clearTimeout(this.hostTimer);
    if (this.engine) this.engine.destroy();
    try { this.unsub && this.unsub(); } catch (e) {}
    if (this.r) this.r.leave().catch(() => {});
  }
}
