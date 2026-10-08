import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import confettiLib from 'canvas-confetti';
import {
  HAND_TYPES, SUIT_SYM, SUIT_NAME, isRed, rankLabel, parseCard, bidText, normalizeBid, validateBid,
  isBidHigher, allBids, minRaise, bestInHand, estP, startingCards, MAX_CARDS, REACTIONS, HIGH_MIN,
} from './engine.js';
import { Session, getRoom, makeCode, cleanName } from './net.js';
import { Sfx } from './sfx.js';
import { SplitText, DecryptedText, ShinyText, CountUp, ClickSpark, Tilt, SuitField, reducedMotion } from './fx.jsx';

// ---------- helpers ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('lp.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lp.' + k, JSON.stringify(v)); } catch (e) { /* storage is optional */ } },
};
const sfx = new Sfx(store.get('sound', true));

let confettiFire = null;
function fireConfetti(opts = {}) {
  if (reducedMotion()) return;
  try {
    if (!confettiFire) {
      const cv = document.createElement('canvas');
      cv.className = 'confetti-canvas';
      document.body.appendChild(cv);
      confettiFire = confettiLib.create(cv, { resize: true, useWorker: false });
    }
    confettiFire({ particleCount: 110, spread: 75, startVelocity: 42, origin: { y: 0.65 }, colors: ['#C9A24B', '#F0D58C', '#7A1E26', '#F8F3E6', '#1F6B53'], ...opts });
  } catch (e) { /* decorative */ }
}

const AVATAR_COLORS = ['#C9A24B', '#8FB8A8', '#D98C6A', '#9AA7D6', '#C77D9B', '#B9C27A', '#E0A458'];
const colorFor = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function useViewport() {
  const [s, setS] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const f = () => setS({ w: window.innerWidth, h: window.innerHeight });
    addEventListener('resize', f); addEventListener('orientationchange', f);
    return () => { removeEventListener('resize', f); removeEventListener('orientationchange', f); };
  }, []);
  return s;
}

// ---------- icons ----------
const PATHS = {
  sound: <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" /><path d="M15.5 9.2a4 4 0 0 1 0 5.6" /><path d="M18.2 6.6a7.8 7.8 0 0 1 0 10.8" /></>,
  mute: <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" /><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2.2" /><path d="M5 15V6.2A2.2 2.2 0 0 1 7.2 4H15" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4" /><path d="M12 16.8v.2" /></>,
  sliders: <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /><path d="M4 4l16 16" /></>,
  bot: <><rect x="5" y="8.5" width="14" height="10.5" rx="3" /><path d="M12 5v3.5" /><circle cx="12" cy="4.5" r="1" /><path d="M9.5 13.2v.6M14.5 13.2v.6" /></>,
  crown: <path d="M3.5 8.5l4.2 3.8L12 5.5l4.3 6.8 4.2-3.8-1.8 10H5.3l-1.8-10z" />,
  door: <><path d="M10 4.5H5.5v15H10" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
};
function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

// ---------- cards ----------
function Card({ code, size = 'md', faceDown = false }) {
  if (faceDown || !code) return <div className={`card back ${size}`} aria-label="Face-down card" />;
  const c = parseCard(code);
  return (
    <div className={`card face ${size} ${isRed(c.s) ? 'red' : ''}`} role="img" aria-label={`${rankLabel(c.r)} of ${SUIT_NAME[c.s]}`}>
      <span className="corner tl"><b>{rankLabel(c.r)}</b><i>{SUIT_SYM[c.s]}</i></span>
      <span className="pip">{SUIT_SYM[c.s]}</span>
      <span className="corner br"><b>{rankLabel(c.r)}</b><i>{SUIT_SYM[c.s]}</i></span>
    </div>
  );
}
function FlipCard({ code, delay, mark }) {
  return (
    <div className={`flip ${mark || ''}`}>
      <div className="flip-inner" style={{ animationDelay: delay + 'ms' }}>
        <div className="flip-face"><Card code={code} size="sm" /></div>
        <div className="flip-back"><Card faceDown size="sm" /></div>
      </div>
    </div>
  );
}
function MiniBacks({ n, round }) {
  return (
    <div className="minis" aria-label={plural(n, 'card')}>
      {Array.from({ length: n }, (_, i) => <span key={round + '-' + i} className="mini" style={{ animationDelay: i * 110 + 'ms' }} />)}
    </div>
  );
}
function Avatar({ name, size = 30 }) {
  return <span className="avatar" style={{ background: colorFor(name), width: size, height: size }} aria-hidden="true">{(name || '?').trim()[0].toUpperCase()}</span>;
}

// ---------- generic sheet ----------
function Sheet({ title, onClose, children, className = '', bottom = true, labelId }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    const el = ref.current && ref.current.querySelector('button, [href], input, select, [tabindex]:not([tabindex="-1"])');
    if (el) el.focus({ preventScroll: true });
    return () => removeEventListener('keydown', k);
  }, []);
  const id = labelId || 'sheet-title';
  return (
    <div className={`overlay ${bottom ? 'bottom' : ''}`} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-labelledby={id}>
        <div className="grabber" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={id}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, label, hint }) {
  return (
    <button className="toggle-row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <span className="toggle-text"><span>{label}</span>{hint && <small>{hint}</small>}</span>
      <span className={`toggle ${on ? 'on' : ''}`} aria-hidden="true"><span /></span>
    </button>
  );
}

function RulesSheet({ onClose }) {
  return (
    <Sheet title="How to play" onClose={onClose} className="rules">
      <div className="rules-body">
        <p>Everyone is dealt a few cards face down. Together, all the cards on the table form one shared pool that nobody can fully see.</p>
        <p>On your turn, either <strong>raise</strong>: claim a poker hand exists somewhere in that pool, or <strong>call liar</strong> on the last claim.</p>
        <p>Every raise must beat the last one: a better hand type, or the same type with higher cards. A flush names its top card and suit (e.g. King-high flush in hearts): higher top card wins, and with the same top card it goes by suit, clubs lowest and spades highest.</p>
        <p>When someone calls liar, every card is turned over. If the hand is there, the caller was wrong and takes the penalty. If it isn't, the bidder was bluffing and takes it.</p>
        <p>The penalty is one extra card next round. Anyone holding more than {MAX_CARDS} cards is out. The last player at the table wins.</p>
        <p>Starting hands: 3 cards each with 2 players, 2 cards with 3 or 4 players, 1 card with 5 or 6.</p>
        <p><strong>High card</strong> works like real poker: the named card plus four lower cards, all different ranks, with no straight or flush. A pair doesn't count as two cards. So the lowest possible is Seven high (7-5-4-3-2).</p>
        <p className="muted">On a keyboard, press B to raise and L to call liar.</p>
      </div>
    </Sheet>
  );
}

function SettingsSheet({ settings, setSettings, onClose, inGame, onLeave, isHost }) {
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  return (
    <Sheet title="Settings" onClose={onClose} className="settings">
      <div className="settings-body">
        <Toggle on={settings.sound} onChange={(v) => { set('sound', v); if (v) setTimeout(() => sfx.play('chip'), 30); }} label="Sound effects" hint="Deals, bids, calls and verdicts" />
        <Toggle on={settings.odds} onChange={(v) => set('odds', v)} label="Show odds while bidding" hint="Estimated from the cards you hold" />
        <div className="seg-row">
          <span>Bot speed{inGame && !isHost ? <small>Set by the host</small> : null}</span>
          <div className="seg" role="radiogroup" aria-label="Bot speed">
            {['relaxed', 'normal', 'quick'].map((p) => (
              <button key={p} role="radio" aria-checked={settings.pace === p} className={settings.pace === p ? 'on' : ''} onClick={() => set('pace', p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {inGame && <button className="btn ghost wide danger-text" onClick={onLeave}><Icon name="door" /> Leave table</button>}
      </div>
    </Sheet>
  );
}

// ---------- home ----------
function Home({ roomOk, error, onSolo, onHost, onJoin, openRules, openSettings }) {
  const [name, setName] = useState(() => store.get('name', ''));
  const [bots, setBots] = useState(() => store.get('bots', 3));
  const [code, setCode] = useState('');
  const nm = cleanName(name || 'You');
  useEffect(() => { store.set('bots', bots); }, [bots]);
  const join = () => { if (code.length === 4) onJoin({ name: nm, code }); };
  return (
    <main className="home">
      <SuitField />
      <div className="home-inner">
        <header className="hero">
          <div className="fan" aria-hidden="true">
            <div style={{ '--r': '-18deg', animationDelay: '80ms' }} className="fan-card"><Card code="QS" size="hero" /></div>
            <div style={{ '--r': '0deg', animationDelay: '180ms' }} className="fan-card"><Card faceDown size="hero" /></div>
            <div style={{ '--r': '18deg', animationDelay: '280ms' }} className="fan-card"><Card code="AH" size="hero" /></div>
          </div>
          <h1 className="title"><SplitText text="Liar's Poker" delay={45} from={350} /></h1>
          <p className="tagline">Bid poker hands on cards nobody can see. Call the bluff, or get called.</p>
        </header>

        {error && <div className="banner" role="alert">{error}</div>}

        <section className="panel home-panel" aria-label="Start a game">
          <label className="field">
            <span>Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={14} placeholder="What the table calls you" autoComplete="off" spellCheck="false" />
          </label>

          <div className="solo-row">
            <div className="stepper" role="group" aria-label="Number of bot opponents">
              <span>Bots</span>
              <button onClick={() => setBots((b) => Math.max(1, b - 1))} aria-label="Fewer bots" disabled={bots <= 1}>−</button>
              <b aria-live="polite">{bots}</b>
              <button onClick={() => setBots((b) => Math.min(5, b + 1))} aria-label="More bots" disabled={bots >= 5}>+</button>
            </div>
            <button className="btn primary big" onClick={() => onSolo({ name: nm, bots })}>Deal me in</button>
          </div>

          <div className="divider"><span>Play with friends</span></div>

          <div className="mp-row">
            <button className="btn ghost" disabled={!roomOk} onClick={() => onHost({ name: nm })}>Host a table</button>
            <div className="join">
              <input
                value={code} disabled={!roomOk} aria-label="Table code" placeholder="CODE" inputMode="text" autoCapitalize="characters"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
              />
              <button className="btn ghost" disabled={!roomOk || code.length !== 4} onClick={join}>Join</button>
            </div>
          </div>
          {roomOk === false && <p className="hint">This browser can't open tables with friends. Bots are always ready to play.</p>}
          {roomOk === null && <p className="hint">Checking for multiplayer…</p>}
        </section>

        <nav className="home-links">
          <button className="link" onClick={openRules}>How to play</button>
          <button className="link" onClick={openSettings}>Settings</button>
        </nav>
      </div>
    </main>
  );
}

function Connecting({ mode, code, onCancel }) {
  return (
    <main className="center-screen">
      <div className="panel connecting">
        <div className="shuffle" aria-hidden="true"><Card faceDown size="md" /><Card faceDown size="md" /><Card faceDown size="md" /></div>
        <p>{mode === 'client' ? `Looking for table ${code}…` : 'Setting up your table…'}</p>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </main>
  );
}

// ---------- lobby ----------
function WaitingRoom({ view, isHost, code, session, myId, onLeave, toast }) {
  const ps = view.players;
  const slots = Array.from({ length: 6 }, (_, i) => ps[i] || null);
  const copy = () => {
    const done = () => toast('Table code copied');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done).catch(() => toast('Table code: ' + code));
    else toast('Table code: ' + code);
  };
  const inGame = ps.some((p) => p.id === myId);
  return (
    <main className="center-screen">
      <div className="panel waiting">
        <div className="code-block">
          <span className="code-label">Table code</span>
          <div className="code" aria-label={code.split('').join(' ')}>
            {code.split('').map((ch, i) => <span key={i} style={{ animationDelay: i * 90 + 'ms' }}>{ch}</span>)}
          </div>
          <button className="btn small ghost" onClick={copy}><Icon name="copy" size={18} /> Copy code</button>
        </div>
        <p className="hint center">Friends join by opening this page in Claude and entering the code.</p>

        <ul className="seat-list">
          {slots.map((p, i) => p ? (
            <li className="seat-item" key={p.id}>
              <Avatar name={p.name} />
              <span className="seat-item-name">{p.name}</span>
              {p.id === myId && <em className="tag">you</em>}
              {p.bot && <em className="tag">bot</em>}
              {isHost && p.id !== 'me' && (
                <button className="icon-btn small" onClick={() => session.kick(p.id)} aria-label={`Remove ${p.name}`}><Icon name="x" size={16} /></button>
              )}
            </li>
          ) : <li className="seat-item empty" key={'e' + i}>Open seat</li>)}
        </ul>

        {isHost ? (
          <div className="row">
            <button className="btn ghost" disabled={ps.length >= 6} onClick={() => session.addBot()}><Icon name="bot" /> Add a bot</button>
            <button className="btn primary" disabled={ps.length < 2} onClick={() => session.startGame()}>Start game</button>
          </div>
        ) : (
          <p className="waiting-note">{inGame ? <>Waiting for the host to start<span className="dots" /></> : 'This table is full or already playing.'}</p>
        )}
        <p className="small center">Up to 6 players. With {ps.length}, everyone starts with {plural(startingCards(Math.max(2, ps.length)), 'card')}.</p>
        <button className="link center" onClick={onLeave}>Leave table</button>
      </div>
    </main>
  );
}

// ---------- table ----------
function Seat({ p, isTurn, last, view, isStarter }) {
  return (
    <div className={`seat ${isTurn ? 'turn' : ''} ${p.elim ? 'out' : ''}`} aria-label={`${p.name}${isTurn ? ', thinking' : ''}`}>
      <div className="seat-head">
        <Avatar name={p.name} size={28} />
        <div className="seat-id">
          <span className="seat-name">{p.name}</span>
          <span className="seat-meta">
            <span className="nowrap">{p.elim ? 'Out' : plural(p.count, 'card')}</span>
            {p.bot && <em className="tag tiny">{p.left ? 'left' : 'bot'}</em>}
            {isStarter && !view.bid && !p.elim && <em className="tag tiny gold">opens</em>}
          </span>
        </div>
      </div>
      {!p.elim && view.status === 'PLAYING' && <MiniBacks n={p.handLen} round={view.round} />}
      {last && (
        <div key={last.k} className={`seat-chip ${last.call ? 'liar' : ''}`}>{last.call ? 'Liar!' : bidText(last.bid)}</div>
      )}
    </div>
  );
}

function Plaque({ view, nameOf, showLog, myId }) {
  const b = view.bid;
  const log = view.log.slice(-5).reverse();
  return (
    <div className="plaque">
      <span className="plaque-label">{b ? 'Bid to beat' : `Round ${view.round}`}</span>
      {b ? (
        <div className="plaque-bid" key={view.logN}><DecryptedText text={bidText(b)} /></div>
      ) : (
        <div className="plaque-bid quiet">{view.starterId === myId ? 'You open the bidding' : `${nameOf(view.starterId)} opens the bidding`}</div>
      )}
      {b && <span className="plaque-by">claimed by {b.bidderId === myId ? 'you' : nameOf(b.bidderId)}</span>}
      {showLog && log.length > 1 && (
        <ol className="bid-log" aria-label="Recent bids">
          {log.slice(1).map((e, i) => (
            <li key={view.logN - i - 1}><b>{nameOf(e.pid)}</b> {e.call ? 'called liar' : bidText(e.bid)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MyHand({ me, view, myTurn, hideCards, setHideCards }) {
  const cards = me.hand;
  const key = cards ? cards.join() : '';
  const best = useMemo(() => (cards ? bestInHand(cards.map(parseCard)) : null), [key]);
  const info = me.elim ? 'You are out. Watching the rest.' : hideCards ? 'Cards hidden' : !cards ? 'Cards on the way…' : best ? `Your cards alone: ${bidText(best)}` : 'No pair in your cards';
  return (
    <div className={`my-hand ${myTurn ? 'turn' : ''} ${me.elim ? 'out' : ''}`}>
      {!me.elim && (
        <div className="my-cards">
          {cards
            ? cards.map((c, i) => (
              <Tilt key={view.round + '-' + i + c}>
                <div className="deal-in" style={{ animationDelay: i * 110 + 'ms' }}><Card code={c} size="lg" faceDown={hideCards} /></div>
              </Tilt>
            ))
            : Array.from({ length: me.handLen }, (_, i) => <Card key={i} faceDown size="lg" />)}
        </div>
      )}
      <div className="my-info">
        <Avatar name={me.name} size={22} />
        <span className="my-name">{me.name}</span>
        <span className="my-best">{info}</span>
        {!me.elim && (
          <button className="icon-btn small" onClick={() => setHideCards(!hideCards)} aria-label={hideCards ? 'Show my cards' : 'Hide my cards'} aria-pressed={hideCards}>
            <Icon name={hideCards ? 'eyeOff' : 'eye'} size={18} />
          </button>
        )}
      </div>
    </div>
  );
}

function Table({ view, myId, layout, compact, hideCards, setHideCards, nameOf }) {
  const ps = view.players, n = ps.length;
  const meIdx = ps.findIndex((p) => p.id === myId);
  const me = meIdx >= 0 ? ps[meIdx] : null;
  const others = me ? Array.from({ length: n - 1 }, (_, k) => ps[(meIdx + k + 1) % n]) : ps;
  const myTurn = view.status === 'PLAYING' && me && view.turnId === me.id;
  const lastBy = useMemo(() => {
    const m = {};
    view.log.forEach((e, i) => { m[e.pid] = { ...e, k: view.logN - view.log.length + i }; });
    return m;
  }, [view.logN, view.round]);
  const seat = (p) => <Seat key={p.id} p={p} view={view} isTurn={view.turnId === p.id} last={lastBy[p.id]} isStarter={view.starterId === p.id} />;
  const plaque = <Plaque view={view} nameOf={nameOf} myId={myId} showLog={layout === 'ring' && !compact} />;
  const hand = me && <MyHand me={me} view={view} myTurn={myTurn} hideCards={hideCards} setHideCards={setHideCards} />;

  if (layout === 'stack') {
    return (
      <section className="felt stack" aria-label="Table">
        <div className="opp-row">{others.map(seat)}</div>
        {plaque}
        {hand || <div />}
      </section>
    );
  }
  const m = others.length + (me ? 1 : 0);
  const step = 360 / Math.max(1, m);
  return (
    <section className="felt ring" aria-label="Table">
      <div className="ring-track">
        {others.map((p, k) => {
          const deg = me ? 90 + (k + 1) * step : 90 + (k + 0.5) * step;
          const a = (deg * Math.PI) / 180;
          return (
            <div className="seat-pos" key={p.id} style={{ left: 50 + 50 * Math.cos(a) + '%', top: 50 + 50 * Math.sin(a) + '%' }}>
              {seat(p)}
            </div>
          );
        })}
      </div>
      <div className="plaque-pos">{plaque}</div>
      {hand && <div className="my-pos">{hand}</div>}
    </section>
  );
}

// ---------- bidding ----------
const RANKS_DESC = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

function BidSheet({ view, me, poolSize, settings, onClose, onPlace }) {
  const cur = view.bid;
  const myCards = useMemo(() => (me.hand || []).map(parseCard), [me.hand && me.hand.join()]);
  const [sel, setSel] = useState(() => {
    if (!cur && myCards.length) {
      const best = bestInHand(myCards);
      const top = Math.max(...myCards.map((c) => c.r));
      return { ...(best || { type: 1, rank1: Math.max(top, HIGH_MIN) }) };
    }
    return { ...(minRaise(cur) || { type: 10, suit: 'S' }) };
  });
  const bid = normalizeBid(sel);
  const ok = (b) => validateBid(b) && isBidHigher(b, cur);
  const valid = ok(bid);
  const key = [bid.type, bid.rank1, bid.rank2, bid.suit].join();
  const odds = useMemo(() => (settings.odds && valid && myCards.length ? estP(myCards, bid, poolSize, 600) : null), [key, valid, settings.odds, poolSize]);

  const typeOk = (t) => allBids().some((b) => b.type === t && isBidHigher(b, cur));
  const pickType = (t) => {
    const b = allBids().find((x) => x.type === t && isBidHigher(x, cur));
    if (b) { setSel({ ...b }); sfx.play('tap'); }
  };
  const fixTwoPair = (r1, r2) => (r2 < r1 ? r2 : r1 - 1);
  const candidate = (patch) => {
    const s = { ...sel, ...patch };
    if (s.type === 3 && 'rank1' in patch) s.rank2 = fixTwoPair(s.rank1, s.rank2);
    if (s.type === 7 && 'rank1' in patch && s.rank1 === s.rank2) s.rank2 = s.rank1 === 2 ? 3 : 2;
    return s;
  };
  const choose = (patch) => {
    let s = candidate(patch);
    if (s.type === 7 && 'rank1' in patch && !ok(normalizeBid(s))) {
      const alt = RANKS_DESC.slice().reverse().find((r) => r !== s.rank1 && ok(normalizeBid({ ...s, rank2: r })));
      if (alt) s = { ...s, rank2: alt };
    }
    if (s.type === 3 && 'rank1' in patch && !ok(normalizeBid(s))) {
      const alt = RANKS_DESC.slice().reverse().find((r) => r < s.rank1 && ok(normalizeBid({ ...s, rank2: r })));
      if (alt) s = { ...s, rank2: alt };
    }
    if ((s.type === 6 || s.type === 9) && 'rank1' in patch && !ok(normalizeBid(s))) {
      const alt = ['C', 'D', 'H', 'S'].find((x) => ok(normalizeBid({ ...s, suit: x })));
      if (alt) s = { ...s, suit: alt };
    }
    setSel(s); sfx.play('tap');
  };
  const chipOk = (patch) => {
    const s = candidate(patch);
    if (!validateBid(normalizeBid(s))) return false;
    if (ok(normalizeBid(s))) return true;
    // for two-part hands, a different second rank might still make it a raise
    if (s.type === 3 && 'rank1' in patch) return RANKS_DESC.some((r) => r < s.rank1 && ok(normalizeBid({ ...s, rank2: r })));
    if (s.type === 7 && 'rank1' in patch) return RANKS_DESC.some((r) => r !== s.rank1 && ok(normalizeBid({ ...s, rank2: r })));
    if ((s.type === 6 || s.type === 9) && 'rank1' in patch) return ['C', 'D', 'H', 'S'].some((x) => ok(normalizeBid({ ...s, suit: x })));
    return false;
  };

  const rankRow = (label, field, ranks, extraDisabled = () => false) => (
    <div className="pick">
      <span className="pick-label">{label}</span>
      <div className="chips" role="radiogroup" aria-label={label}>
        {ranks.map((r) => {
          const dis = extraDisabled(r) || !chipOk({ [field]: r });
          const on = sel[field] === r;
          return (
            <button key={r} role="radio" aria-checked={on} className={`chip ${on ? 'on' : ''}`} disabled={dis} onClick={() => choose({ [field]: r })}>
              {rankLabel(r)}
            </button>
          );
        })}
      </div>
    </div>
  );
  const suitRow = (label = 'Suit') => (
    <div className="pick">
      <span className="pick-label">{label}</span>
      <div className="chips suits" role="radiogroup" aria-label={label}>
        {['C', 'D', 'H', 'S'].map((s) => {
          const on = sel.suit === s;
          return (
            <button key={s} role="radio" aria-checked={on} className={`chip suit ${isRed(s) ? 'red' : ''} ${on ? 'on' : ''}`} disabled={!chipOk({ suit: s })} onClick={() => choose({ suit: s })}>
              <span className="suit-sym">{SUIT_SYM[s]}</span><span className="suit-name">{SUIT_NAME[s]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  let picks = null;
  switch (sel.type) {
    case 1: picks = rankRow('Top card', 'rank1', RANKS_DESC.filter((r) => r >= HIGH_MIN)); break;
    case 2: case 4: case 8: picks = rankRow('Rank', 'rank1', RANKS_DESC); break;
    case 3: picks = <>{rankRow('Higher pair', 'rank1', RANKS_DESC.slice(0, 12))}{rankRow('Lower pair', 'rank2', RANKS_DESC.slice(1), (r) => r >= sel.rank1)}</>; break;
    case 5: picks = rankRow('Top card', 'rank1', RANKS_DESC.slice(0, 10)); break;
    case 6: picks = <>{rankRow('Top card', 'rank1', RANKS_DESC.slice(0, 9))}{suitRow()}</>; break;
    case 7: picks = <>{rankRow('Three of', 'rank1', RANKS_DESC)}{rankRow('Pair of', 'rank2', RANKS_DESC, (r) => r === sel.rank1)}</>; break;
    case 9: picks = <>{rankRow('Top card', 'rank1', RANKS_DESC.slice(1, 10))}{suitRow()}</>; break;
    case 10: picks = <>{suitRow()}<p className="royal-note">Ace, King, Queen, Jack and Ten of one suit. The highest claim there is.</p></>; break;
  }

  const place = () => { if (valid) onPlace(bid); else sfx.play('error'); };
  useEffect(() => {
    const k = (e) => { if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON')) place(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  return (
    <Sheet title={cur ? 'Raise the bid' : 'Open the bidding'} onClose={onClose} className="bid-sheet" labelId="bid-title">
      <div className="bid-body">
        <div className="bid-context">
          <div className="bid-hand">{(me.hand || []).map((c, i) => <Card key={i} code={c} size="xs" />)}</div>
          <span className="bid-cur">{cur ? <>To beat: <b>{bidText(cur)}</b></> : <>{plural(poolSize, 'card')} on the table</>}</span>
        </div>

        <div className="type-grid" role="radiogroup" aria-label="Hand type">
          {Object.keys(HAND_TYPES).map((k) => {
            const t = +k, on = sel.type === t, can = typeOk(t);
            return (
              <button key={t} role="radio" aria-checked={on} disabled={!can} onClick={() => pickType(t)} className={`type-btn ${on ? 'on' : ''} ${t === 10 ? 'royal' : ''}`}>
                {t === 10 && <Icon name="crown" size={15} />}{HAND_TYPES[t]}
              </button>
            );
          })}
        </div>

        <div className="picks">{picks}</div>
      </div>

      <div className="bid-foot">
        <div className="bid-preview">
          <span className="bid-preview-label">Your claim</span>
          <span className={`bid-preview-text ${valid ? '' : 'bad'}`}>{bidText(bid)}</span>
          {!valid && cur && <span className="bid-warn">Must beat {bidText(cur)}</span>}
          {odds != null && (
            <span className="odds" title="Estimated by simulating the unseen cards">
              <span className="odds-bar"><span style={{ width: Math.round(odds * 100) + '%' }} /></span>
              {Math.round(odds * 100)}% likely, given your cards
            </span>
          )}
        </div>
        <div className="bid-actions">
          <button className="btn ghost" onClick={() => { const m = minRaise(cur); if (m) { setSel({ ...m }); sfx.play('tap'); } }}>Lowest raise</button>
          <button className="btn primary" disabled={!valid} onClick={place}>Place bid</button>
        </div>
      </div>
    </Sheet>
  );
}

// ---------- reactions ----------
// Floating emoji with the sender's name, above everything (including the reveal)
function ReactionLayer({ reacts, nameOf, myId }) {
  const seen = useRef(Math.max(0, ...(reacts || []).map((r) => r.n)));
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fresh = (reacts || []).filter((r) => r.n > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map((r) => r.n));
    const add = fresh.map((r) => ({ key: r.n, e: REACTIONS[r.e], name: r.pid === myId ? 'You' : nameOf(r.pid), x: Math.round(Math.random() * 64) }));
    setItems((it) => [...it.slice(-10), ...add]);
    add.forEach((a) => setTimeout(() => setItems((it) => it.filter((x) => x.key !== a.key)), 2900));
  }, [reacts]);
  return (
    <div className="react-layer" aria-live="polite">
      {items.map((it) => (
        <div className="react-float" key={it.key} style={{ right: 14 + it.x + 'px' }}>
          <span className="react-emoji" role="img" aria-label={`${it.name} reacted ${it.e}`}>{it.e}</span>
          <span className="react-name">{it.name}</span>
        </div>
      ))}
    </div>
  );
}

function useReactCooldown(onReact) {
  const [cool, setCool] = useState(false);
  const send = (i) => {
    if (cool) return;
    onReact(i); sfx.play('tap');
    setCool(true); setTimeout(() => setCool(false), 650);
  };
  return [cool, send];
}

function ReactStrip({ onReact, className = '' }) {
  const [cool, send] = useReactCooldown(onReact);
  return (
    <div className={`react-strip ${className}`} role="group" aria-label="React">
      {REACTIONS.map((e, i) => (
        <button key={i} className="react-btn" disabled={cool} onClick={() => send(i)} aria-label={`React ${e}`}>{e}</button>
      ))}
    </div>
  );
}

function ReactButton({ onReact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('pointerdown', away); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', away); removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="react-wrap" ref={ref}>
      <button className={`icon-btn react-toggle ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} aria-label="React with an emoji" aria-expanded={open}>
        <span aria-hidden="true">😀</span>
      </button>
      {open && <div className="react-pop"><ReactStrip onReact={onReact} /></div>}
    </div>
  );
}

// ---------- reveal ----------
function Reveal({ view, myId, nameOf, onReady, onReact }) {
  const rv = view.reveal;
  const order = view.players.filter((p) => (rv.hands[p.id] || []).length);
  const total = order.reduce((a, p) => a + rv.hands[p.id].length, 0);
  const FLIP0 = 700, GAP = 90;
  const verdictAt = FLIP0 + total * GAP + 450;
  const [stage, setStage] = useState(reducedMotion() ? 2 : 0);
  const iLost = rv.loserId === myId;

  useEffect(() => {
    const ts = [];
    sfx.play('liar');
    if (!reducedMotion()) {
      for (let i = 0; i < total; i++) ts.push(setTimeout(() => sfx.play('flip'), FLIP0 + i * GAP + 120));
      ts.push(setTimeout(() => setStage(2), verdictAt));
    }
    return () => ts.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (stage !== 2) return;
    if (iLost) sfx.play(rv.eliminated ? 'out' : 'bad');
    else if (myId === rv.challengerId || myId === rv.bidderId) sfx.play('good');
    else sfx.play('verdict');
  }, [stage]);

  const used = new Set(rv.used);
  const loser = nameOf(rv.loserId);
  let loserLine = iLost
    ? (rv.eliminated ? `That's more than ${MAX_CARDS} cards. You're out.` : 'You take an extra card next round.')
    : (rv.eliminated ? `${loser} is out of the game.` : `${loser} takes an extra card next round.`);
  if (rv.final && view.winnerId) loserLine += ` ${view.winnerId === myId ? 'You win' : nameOf(view.winnerId) + ' wins'} the game.`;

  const need = view.players.filter((p) => !p.bot && (!p.elim || p.id === rv.loserId));
  const iNeed = need.some((p) => p.id === myId);
  const iReady = view.ready.includes(myId);
  const readyN = need.filter((p) => view.ready.includes(p.id)).length;
  const count = need.length > 1 ? ` (${readyN}/${need.length} ready)` : '';
  const label = !need.length ? 'Next round starting soon…'
    : !iNeed ? `Waiting for the others${count}`
      : iReady ? `Waiting for the others${count}`
        : (rv.final ? 'See final standings' : 'Next round') + count;

  let idx = 0;
  return (
    <div className="overlay reveal-overlay">
      <div className="reveal" role="dialog" aria-modal="true" aria-labelledby="rv-title">
        <h2 id="rv-title" className="reveal-title"><SplitText text="Liar!" delay={80} /></h2>
        <p className="reveal-sub">{nameOf(rv.challengerId)} doesn't believe {nameOf(rv.bidderId)}</p>
        <div className="reveal-bid">{bidText(rv.bid)}</div>

        <div className="reveal-hands">
          {order.map((p) => (
            <div className="rh-row" key={p.id}>
              <span className="rh-name"><Avatar name={p.name} size={22} />{p.name}{p.id === myId && p.name !== 'You' ? ' (you)' : ''}</span>
              <div className="rh-cards">
                {rv.hands[p.id].map((c) => {
                  const d = FLIP0 + idx++ * GAP;
                  const mark = stage >= 2 ? (used.has(c) ? (rv.ok ? 'hit' : 'partial') : 'dim') : '';
                  return <FlipCard key={c} code={c} delay={d} mark={mark} />;
                })}
              </div>
            </div>
          ))}
        </div>

        <div className={`verdict ${stage >= 2 ? 'show' : ''} ${rv.ok ? 'held' : 'bluff'}`} aria-live="polite">
          {stage >= 2 && (
            <>
              <div className="verdict-head"><DecryptedText text={rv.ok ? 'The bid holds up' : 'It was a bluff'} /></div>
              <p className="verdict-text">{rv.text}</p>
              <p className="verdict-loser">{loserLine}</p>
            </>
          )}
        </div>

        {onReact && <ReactStrip onReact={onReact} className="in-reveal" />}

        <button className="btn primary wide" disabled={stage < 2 || !iNeed || iReady} onClick={() => { sfx.play('tap'); onReady(); }}>{label}</button>
      </div>
    </div>
  );
}

// ---------- game over ----------
function GameOver({ view, myId, isHost, mode, onAgain, onLeave }) {
  const winner = view.players.find((p) => p.id === view.winnerId);
  const standings = [...view.players].sort((a, b) => (a.elim - b.elim) || (a.elim ? b.elimOrder - a.elimOrder : a.count - b.count));
  const iWon = view.winnerId && view.winnerId === myId;
  useEffect(() => {
    if (iWon) {
      sfx.play('fanfare');
      fireConfetti();
      setTimeout(() => fireConfetti({ angle: 60, origin: { x: 0, y: 0.75 } }), 260);
      setTimeout(() => fireConfetti({ angle: 120, origin: { x: 1, y: 0.75 } }), 420);
    } else sfx.play('verdict');
  }, []);
  const decisive = view.players.filter((p) => !p.elim).length <= 1;
  const meP = view.players.find((p) => p.id === myId);
  const title = !winner ? 'Game over'
    : iWon ? 'You win the table'
      : decisive ? `${winner.name} wins the table`
        : meP && meP.elim ? "You're out" : 'Game over';
  const sub = !winner ? '' : iWon ? 'Nobody saw through you.' : decisive ? 'Last one standing.' : `${winner.name} was leading with ${plural(winner.count, 'card')}.`;
  return (
    <div className="overlay">
      <div className="gameover" role="dialog" aria-modal="true" aria-labelledby="go-title">
        <span className="go-crown" aria-hidden="true"><Icon name="crown" size={38} /></span>
        <h2 id="go-title"><SplitText text={title} delay={34} /></h2>
        {sub && <p className="go-sub"><ShinyText text={sub} /></p>}
        <ol className="standings">
          {standings.map((p, i) => (
            <li key={p.id} className={p.id === view.winnerId ? 'first' : ''} style={{ animationDelay: 300 + i * 90 + 'ms' }}>
              <span className="place">{i + 1}</span>
              <Avatar name={p.name} size={26} />
              <span className="st-name">{p.name}{p.id === myId && p.name !== 'You' ? ' (you)' : ''}</span>
              <span className="st-meta">{p.elim ? 'Out' : plural(p.count, 'card')}</span>
            </li>
          ))}
        </ol>
        {isHost
          ? <button className="btn primary wide" onClick={onAgain}>{mode === 'solo' ? 'Deal a new game' : 'Back to the lobby'}</button>
          : <p className="waiting-note">Waiting for the host<span className="dots" /></p>}
        <button className="btn ghost wide" onClick={onLeave}><Icon name="door" /> Leave table</button>
      </div>
    </div>
  );
}

// ---------- game screen ----------
function GameScreen({ view, myId, isHost, mode, code, session, settings, layout, compact, openRules, openSettings, onLeave, toast }) {
  const [bidOpen, setBidOpen] = useState(false);
  const [hideCards, setHideCards] = useState(false);
  const me = view.players.find((p) => p.id === myId) || null;
  const myTurn = view.status === 'PLAYING' && !!me && !me.elim && view.turnId === myId;
  const nameOf = useCallback((id) => { const p = view.players.find((x) => x.id === id); return p ? p.name : 'Someone'; }, [view.players]);
  const pool = view.players.filter((p) => !p.elim).reduce((a, p) => a + p.handLen, 0);

  useEffect(() => { if (!myTurn) setBidOpen(false); }, [myTurn]);

  const openBid = () => { if (myTurn) { sfx.play('open'); setBidOpen(true); } };
  const call = () => { if (myTurn && view.bid) session.call(); };
  const place = (b) => {
    setBidOpen(false);
    session.bid(b);
  };

  useEffect(() => {
    const k = (e) => {
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (bidOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'b' || e.key === 'B') openBid();
      if ((e.key === 'l' || e.key === 'L') && view.bid) call();
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  const status = !me ? 'You are watching this game'
    : me.elim ? 'You are out. Watching the rest.'
      : view.status !== 'PLAYING' ? 'Cards are on the table'
        : myTurn ? (view.bid ? 'Your turn. Raise, or call liar.' : 'Your turn. Open the bidding.')
          : `${nameOf(view.turnId)} is thinking`;

  const copy = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => toast('Table code copied')).catch(() => toast('Table code: ' + code));
    else toast('Table code: ' + code);
  };

  return (
    <div className="game">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" aria-hidden="true">{SUIT_SYM.S}</span><span className="brand-name">Liar's Poker</span></div>
        <div className="stats">
          <span>Round <b>{view.round}</b></span>
          <span><b><CountUp value={pool} /></b> in play</span>
          {mode !== 'solo' && <button className="code-chip" onClick={copy} aria-label={`Table code ${code}, copy`}>{code}</button>}
        </div>
        <div className="tools">
          <button className="icon-btn" onClick={() => openSettings('sound')} aria-label={settings.sound ? 'Mute sound' : 'Turn sound on'}><Icon name={settings.sound ? 'sound' : 'mute'} /></button>
          <button className="icon-btn" onClick={openRules} aria-label="How to play"><Icon name="help" /></button>
          <button className="icon-btn" onClick={() => openSettings()} aria-label="Settings"><Icon name="sliders" /></button>
        </div>
      </header>

      <Table view={view} myId={myId} layout={layout} compact={compact} hideCards={hideCards} setHideCards={setHideCards} nameOf={nameOf} />

      <footer className="actionbar">
        <div className={`status ${myTurn ? 'mine' : ''}`} aria-live="polite">
          {myTurn ? <ShinyText text={status} /> : <span>{status}{view.status === 'PLAYING' && me && !me.elim ? <span className="dots" /> : null}</span>}
        </div>
        {me && <ReactButton onReact={(i) => session.react(i)} />}
        <div className="actions">
          <button className="btn primary act" disabled={!myTurn} onClick={openBid}>{view.bid ? 'Raise' : 'Open bidding'}</button>
          <button className={`btn liar act ${myTurn && view.bid ? 'armed' : ''}`} disabled={!myTurn || !view.bid} onClick={call}>Call liar</button>
        </div>
      </footer>

      {bidOpen && me && <BidSheet view={view} me={me} poolSize={pool} settings={settings} onClose={() => setBidOpen(false)} onPlace={place} />}
      {view.status === 'RESULT' && view.reveal && <Reveal key={view.round} view={view} myId={myId} nameOf={nameOf} onReady={() => session.ready()} onReact={me ? (i) => session.react(i) : null} />}
      <ReactionLayer reacts={view.reacts} nameOf={nameOf} myId={myId} />
      {view.status === 'OVER' && <GameOver key={'go' + view.round} view={view} myId={myId} isHost={isHost} mode={mode} onAgain={() => session.again()} onLeave={onLeave} />}
    </div>
  );
}

// ---------- app ----------
function App() {
  const [screen, setScreen] = useState('home');
  const [view, setView] = useState(null);
  const [mode, setMode] = useState(null);
  const [code, setCode] = useState('');
  const [toasts, setToasts] = useState([]);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);
  const [roomOk, setRoomOk] = useState(null);
  const [settings, setSettings] = useState(() => ({ sound: store.get('sound', true), odds: store.get('odds', true), pace: store.get('pace', 'normal') }));
  const sessRef = useRef(null);
  const vp = useViewport();
  const layout = vp.w < 720 && vp.h > vp.w ? 'stack' : 'ring';
  const compact = vp.h < 640 || (layout === 'ring' && vp.w < 900);

  useEffect(() => {
    let alive = true;
    getRoom().then((r) => { if (alive) setRoomOk(!!r); });
    const unlock = () => sfx.ensure();
    addEventListener('pointerdown', unlock, { once: true });
    return () => { alive = false; removeEventListener('pointerdown', unlock); };
  }, []);

  useEffect(() => {
    store.set('sound', settings.sound); store.set('odds', settings.odds); store.set('pace', settings.pace);
    sfx.on = settings.sound;
    if (sessRef.current) sessRef.current.setBotPace(settings.pace);
  }, [settings]);

  const toast = useCallback((msg) => {
    const id = Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const leave = useCallback(() => {
    if (sessRef.current) sessRef.current.leave();
    sessRef.current = null;
    setView(null); setSheet(null); setScreen('home'); setMode(null);
  }, []);

  const begin = async (m, { name, code: c, bots }) => {
    store.set('name', name === 'You' ? '' : name);
    if (sessRef.current) sessRef.current.leave();
    setError(''); setView(null); setMode(m);
    const cc = m === 'host' ? makeCode() : (c || '').toUpperCase();
    setCode(cc);
    const s = new Session({
      mode: m, name, code: cc, bots,
      onView: (v) => { if (sessRef.current === s) setView(v); },
      onToast: (msg) => { if (sessRef.current === s) toast(msg); },
      onFatal: (msg) => {
        if (sessRef.current !== s) return;
        s.leave(); sessRef.current = null;
        setView(null); setScreen('home'); setError(msg);
      },
    });
    sessRef.current = s;
    s.setBotPace(settings.pace);
    setScreen(m === 'solo' ? 'game' : 'connecting');
    try {
      await s.start();
      if (sessRef.current === s) setScreen('game');
    } catch (e) {
      if (sessRef.current === s) { s.leave(); sessRef.current = null; setScreen('home'); setError(e && e.message ? e.message : 'Could not open the table.'); }
    }
  };

  const myId = sessRef.current ? sessRef.current.myId : null;
  const isHost = mode === 'solo' || mode === 'host';

  // sound + confetti cues driven by state changes
  const prevRef = useRef(null);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = view;
    if (!view || !prev) return;
    const me = view.players.find((p) => p.id === myId);
    if (view.status === 'PLAYING' && (prev.round !== view.round || prev.status !== 'PLAYING')) {
      sfx.play('deal', me ? me.handLen : 2);
      if (view.turnId === myId) setTimeout(() => sfx.play('turn'), 700);
      return;
    }
    if (view.status === 'PLAYING' && view.logN > prev.logN) {
      const last = view.log[view.log.length - 1];
      if (last && !last.call) {
        sfx.play('chip');
        if (last.bid && last.bid.type === 10) { setTimeout(() => sfx.play('fanfare'), 150); fireConfetti({ particleCount: 70, spread: 60 }); }
      }
      if (view.turnId === myId && prev.turnId !== myId) setTimeout(() => sfx.play('turn'), 260);
    }
    if (view.status === 'LOBBY' && view.players.length > prev.players.length) sfx.play('join');
  }, [view]);

  // a light, non-blocking way back to the lobby screen when the game ends for a client
  const content = (() => {
    if (screen === 'home') {
      return <Home roomOk={roomOk} error={error} onSolo={(o) => begin('solo', o)} onHost={(o) => begin('host', o)} onJoin={(o) => begin('client', o)} openRules={() => setSheet('rules')} openSettings={() => setSheet('settings')} />;
    }
    if (screen === 'connecting' || !view) return <Connecting mode={mode} code={code} onCancel={leave} />;
    if (view.status === 'LOBBY') return <WaitingRoom view={view} isHost={isHost} code={code} session={sessRef.current} myId={myId} onLeave={leave} toast={toast} />;
    return (
      <GameScreen
        view={view} myId={myId} isHost={isHost} mode={mode} code={code} session={sessRef.current} settings={settings}
        layout={layout} compact={compact} toast={toast}
        openRules={() => setSheet('rules')}
        openSettings={(what) => { if (what === 'sound') setSettings((s) => ({ ...s, sound: !s.sound })); else setSheet('settings'); }}
        onLeave={leave}
      />
    );
  })();

  return (
    <div className={`app lay-${layout} ${compact ? 'compact' : ''}`}>
      <ClickSpark />
      {content}
      {sheet === 'rules' && <RulesSheet onClose={() => setSheet(null)} />}
      {sheet === 'settings' && (
        <SettingsSheet settings={settings} setSettings={setSettings} onClose={() => setSheet(null)} inGame={screen !== 'home'} isHost={isHost} onLeave={leave} />
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div className="toast" key={t.id}>{t.msg}</div>)}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
