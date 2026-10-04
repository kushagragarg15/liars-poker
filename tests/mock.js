(() => {
  const myPeer = Math.random().toString(36).slice(2, 10) + 'x';
  const rooms = {};
  function makeRoom(name) {
    const bc = new BroadcastChannel('mock-' + name);
    const peers = new Map(); // peer -> {presence}
    let mine = {}; const handlers = [];
    const snapshot = () => Object.freeze([...peers.entries()].map(([peer, v]) => v.obj));
    const mk = (peer, presence) => Object.freeze({ peer, by: null, isMe: peer === myPeer, sameTab: peer === myPeer, kind: 'viewer', guest: false, presence, updatedAt: Date.now() });
    peers.set(myPeer, { obj: mk(myPeer, {}) });
    const emitChange = (joined = [], left = [], updated = []) => { const ps = snapshot(); setTimeout(() => handlers.forEach(h => h({ peers: ps, joined, left, updated })), 0); };
    bc.onmessage = (e) => {
      const m = e.data;
      if (m.t === 'p') { const had = peers.has(m.peer); const o = mk(m.peer, m.presence); peers.set(m.peer, { obj: o }); emitChange(had ? [] : [o], [], had ? [o] : []); if (!had) bc.postMessage({ t: 'p', peer: myPeer, presence: mine }); }
      if (m.t === 'hello') bc.postMessage({ t: 'p', peer: myPeer, presence: mine });
      if (m.t === 'bye') { const o = peers.get(m.peer); if (o) { peers.delete(m.peer); emitChange([], [o.obj], []); } }
    };
    bc.postMessage({ t: 'hello' });
    addEventListener('beforeunload', () => bc.postMessage({ t: 'bye', peer: myPeer }));
    return {
      name,
      presence: async (patch) => { mine = { ...mine, ...patch }; for (const k in mine) if (mine[k] === null) delete mine[k];
        const s = JSON.stringify(mine).length; if (s > 4096) throw { code: 'invalid_argument', message: 'too big ' + s };
        window.__maxPresence = Math.max(window.__maxPresence || 0, s);
        const o = mk(myPeer, JSON.parse(JSON.stringify(mine))); peers.set(myPeer, { obj: o }); emitChange([], [], [o]); bc.postMessage({ t: 'p', peer: myPeer, presence: mine }); },
      onPeers: (h) => { handlers.push(h); setTimeout(() => h({ peers: snapshot(), joined: snapshot(), left: [], updated: [] }), 0); return () => {}; },
      peers: snapshot, connected: () => true, onConnection: () => () => {},
      leave: async () => { bc.postMessage({ t: 'bye', peer: myPeer }); bc.close(); },
    };
  }
  const room = { join: async (n) => (rooms[n] = rooms[n] || makeRoom(n)) };
  window.claude = { use: async (n) => (n === 'room' ? room : null) };
})();
