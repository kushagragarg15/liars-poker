// PeerJS stand-in for the Claude `room` capability, used when the page runs outside Claude.
// Star topology: the first tab to join a room claims the PeerJS id derived from the room name
// and becomes the hub; everyone else connects to it. The hub relays every presence change, so
// each tab sees the same { peer, sameTab, presence } list the Claude room would give it.
import { Peer } from 'peerjs';

const ID_PREFIX = 'liars-poker-v1-';
const PING_MS = 3000;
const DEAD_MS = 12000;
const OPEN_TIMEOUT_MS = 10000;

const randId = () => ID_PREFIX + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

// PeerJS's built-in TURN servers are gone, so players on different networks (mobile data, most
// home routers) need relay credentials from our /api/turn function. Without them only direct
// connections work.
const STUN = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
let iceServersP;
function iceServers() {
  if (!iceServersP) {
    iceServersP = (async () => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 5000);
        const r = await fetch('/api/turn', { signal: ctl.signal, cache: 'no-store' });
        clearTimeout(t);
        const j = r.ok ? await r.json() : null;
        if (j && Array.isArray(j.iceServers) && j.iceServers.length) return [...STUN, ...j.iceServers];
      } catch (e) {}
      console.warn('No TURN relay configured; players on different networks may not connect.');
      return STUN;
    })();
  }
  return iceServersP;
}

async function openPeer(id) {
  const config = { iceServers: await iceServers() };
  return new Promise((resolve, reject) => {
    const p = new Peer(id || randId(), { debug: 0, config });
    const t = setTimeout(() => { p.destroy(); reject(Object.assign(new Error('timeout'), { type: 'timeout' })); }, OPEN_TIMEOUT_MS);
    p.once('open', () => { clearTimeout(t); resolve(p); });
    p.once('error', (e) => { clearTimeout(t); p.destroy(); reject(e); });
  });
}

function makeRoom(name, peer, hubConn) {
  const isHub = !hubConn;
  const myPeer = peer.id;
  const peers = new Map(); // peer id -> presence
  const conns = new Map(); // hub only: peer id -> DataConnection
  const lastSeen = new Map();
  const handlers = new Set();
  let mine = {};
  let closed = false;
  let hubSeen = Date.now();

  const entry = (id) => ({ peer: id, by: null, isMe: id === myPeer, sameTab: id === myPeer, kind: 'viewer', guest: false, presence: peers.get(id) || {}, updatedAt: Date.now() });
  const snapshot = () => [...peers.keys()].map(entry);
  const emit = (joined = [], left = [], updated = []) => {
    const ch = { peers: snapshot(), joined, left, updated };
    setTimeout(() => handlers.forEach((h) => { try { h(ch); } catch (e) { console.warn('room handler', e); } }), 0);
  };
  const setPeer = (id, presence) => {
    const had = peers.has(id);
    peers.set(id, presence);
    const e = entry(id);
    emit(had ? [] : [e], [], had ? [e] : []);
  };
  const dropPeer = (id) => {
    if (!peers.has(id)) return;
    const e = entry(id);
    peers.delete(id);
    emit([], [e], []);
  };
  const send = (c, m) => { try { if (c.open) c.send(m); } catch (e) {} };
  const broadcast = (m, except) => conns.forEach((c, id) => { if (id !== except) send(c, m); });

  peers.set(myPeer, {});

  let timer;
  if (isHub) {
    const dropSpoke = (id) => {
      const c = conns.get(id);
      conns.delete(id); lastSeen.delete(id);
      try { c && c.close(); } catch (e) {}
      if (peers.has(id)) { dropPeer(id); broadcast({ t: 'left', peer: id }); }
    };
    peer.on('connection', (c) => {
      const id = c.peer;
      c.on('open', () => {
        conns.set(id, c); lastSeen.set(id, Date.now());
        send(c, { t: 'snap', peers: [...peers.entries()] });
      });
      c.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        lastSeen.set(id, Date.now());
        if (m.t === 'p' && m.presence && typeof m.presence === 'object') {
          setPeer(id, m.presence);
          broadcast({ t: 'p', peer: id, presence: m.presence }, id);
        } else if (m.t === 'bye') dropSpoke(id);
      });
      c.on('close', () => dropSpoke(id));
      c.on('error', () => dropSpoke(id));
    });
    // Keep accepting new players if the signalling socket drops; open data channels are unaffected.
    peer.on('disconnected', () => { if (!closed) try { peer.reconnect(); } catch (e) {} });
    timer = setInterval(() => {
      broadcast({ t: 'ping' });
      const now = Date.now();
      lastSeen.forEach((ts, id) => { if (now - ts > DEAD_MS) dropSpoke(id); });
    }, PING_MS);
  } else {
    const hubLost = () => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      const left = snapshot().filter((e) => !e.sameTab);
      for (const e of left) peers.delete(e.peer);
      if (left.length) emit([], left, []);
      peer.destroy();
    };
    hubConn.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      hubSeen = Date.now();
      if (m.t === 'snap') {
        for (const [id, pr] of m.peers) if (id !== myPeer) setPeer(id, pr);
      } else if (m.t === 'p' && m.peer !== myPeer) setPeer(m.peer, m.presence || {});
      else if (m.t === 'left') dropPeer(m.peer);
    });
    hubConn.on('close', hubLost);
    hubConn.on('error', hubLost);
    timer = setInterval(() => {
      send(hubConn, { t: 'ping' });
      if (Date.now() - hubSeen > DEAD_MS) hubLost();
    }, PING_MS);
  }

  const onUnload = () => { if (isHub) broadcast({ t: 'left', peer: myPeer }); else send(hubConn, { t: 'bye' }); };
  addEventListener('pagehide', onUnload);

  return {
    name,
    presence: async (patch) => {
      if (closed) throw { code: 'closed', message: 'room closed' };
      mine = { ...mine, ...patch };
      for (const k in mine) if (mine[k] === null) delete mine[k];
      const pr = JSON.parse(JSON.stringify(mine));
      setPeer(myPeer, pr);
      if (isHub) broadcast({ t: 'p', peer: myPeer, presence: pr });
      else send(hubConn, { t: 'p', presence: pr });
    },
    onPeers: (h) => {
      handlers.add(h);
      setTimeout(() => { if (handlers.has(h)) { const ps = snapshot(); h({ peers: ps, joined: ps, left: [], updated: [] }); } }, 0);
      return () => handlers.delete(h);
    },
    peers: snapshot,
    connected: () => !closed,
    onConnection: () => () => {},
    leave: async () => {
      if (closed && peer.destroyed) return;
      onUnload();
      closed = true;
      clearInterval(timer);
      removeEventListener('pagehide', onUnload);
      handlers.clear();
      setTimeout(() => peer.destroy(), 150); // let the goodbye flush
    },
  };
}

async function join(name) {
  const hubId = ID_PREFIX + name.replace(/[^a-z0-9-]/gi, '').toLowerCase();
  try {
    return makeRoom(name, await openPeer(hubId), null);
  } catch (e) {
    if (e.type !== 'unavailable-id') throw e;
  }
  // Someone already holds the room: connect to them.
  const peer = await openPeer(null);
  const conn = await new Promise((resolve, reject) => {
    const c = peer.connect(hubId, { reliable: true, serialization: 'json' });
    const t = setTimeout(() => { peer.destroy(); reject(new Error('Could not reach the table. Try again.')); }, OPEN_TIMEOUT_MS);
    c.once('open', () => { clearTimeout(t); resolve(c); });
    peer.once('error', (e) => { clearTimeout(t); peer.destroy(); reject(e); });
  });
  return makeRoom(name, peer, conn);
}

export const peerRoom = { join };
