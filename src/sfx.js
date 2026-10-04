// All sounds are synthesized live, so the page needs no audio files.
export class Sfx {
  constructor(on = true) {
    this.on = on;
    this.ctx = null;
    this.volume = 0.7;
  }
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { this.ctx = new AC(); } catch (e) { return null; }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = this.volume;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(c.destination);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }
  tone(f, dur, { type = 'sine', v = 0.25, t = 0, to = null, a = 0.006, lp = null } = {}) {
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (to) o.frequency.exponentialRampToValueAtTime(to, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(v, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = o;
    if (lp) { const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(this.master);
    o.start(now); o.stop(now + dur + 0.05);
  }
  noise(dur, { v = 0.25, t = 0, f = 2000, q = 1, type = 'bandpass' } = {}) {
    const c = this.ctx, now = c.currentTime + t;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(v, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master);
    s.start(now, Math.random() * 0.5); s.stop(now + dur + 0.02);
  }
  play(name, arg) {
    if (!this.on) return;
    if (!this.ensure()) return;
    try { const fn = this['_' + name]; if (fn) fn.call(this, arg); } catch (e) { /* audio is best-effort */ }
  }
  _tap() { this.tone(660, 0.06, { type: 'triangle', v: 0.06 }); }
  _open() { this.noise(0.12, { f: 1400, q: 0.6, v: 0.08 }); this.tone(440, 0.12, { type: 'sine', v: 0.05, to: 660 }); }
  _deal(n = 1) {
    for (let i = 0; i < n; i++) {
      const t = i * 0.11;
      this.noise(0.08, { f: 3400, q: 0.7, v: 0.22, t });
      this.tone(170, 0.07, { v: 0.07, t });
    }
  }
  _chip() {
    this.noise(0.03, { f: 6000, q: 1.5, v: 0.12 });
    this.tone(2093, 0.14, { v: 0.1 });
    this.tone(2794, 0.2, { v: 0.07, t: 0.045 });
    this.tone(320, 0.08, { v: 0.08, t: 0.01 });
  }
  _turn() {
    this.tone(659, 0.45, { v: 0.14 });
    this.tone(988, 0.6, { v: 0.11, t: 0.13 });
  }
  _liar() {
    this.noise(0.35, { f: 380, type: 'lowpass', v: 0.5 });
    this.tone(196, 0.45, { type: 'sawtooth', v: 0.16, to: 92, lp: 900 });
    this.tone(147, 0.55, { type: 'square', v: 0.06, t: 0.06, to: 70, lp: 600 });
    this.tone(98, 0.6, { type: 'sine', v: 0.25, t: 0.02 });
  }
  _flip() { this.noise(0.045, { f: 4800, type: 'highpass', v: 0.12 }); }
  _good() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.32, { type: 'triangle', v: 0.13, t: i * 0.08 })); }
  _bad() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.38, { type: 'triangle', v: 0.14, t: i * 0.14, lp: 1600 })); }
  _verdict() { this.tone(440, 0.4, { type: 'triangle', v: 0.12 }); this.tone(660, 0.5, { type: 'triangle', v: 0.1, t: 0.1 }); }
  _out() { this.tone(110, 1.0, { v: 0.3, to: 46 }); this.noise(0.6, { f: 220, type: 'lowpass', v: 0.25, t: 0.05 }); }
  _error() { this.tone(180, 0.08, { type: 'square', v: 0.06, lp: 800 }); this.tone(150, 0.1, { type: 'square', v: 0.06, t: 0.1, lp: 800 }); }
  _join() { this.tone(880, 0.14, { v: 0.1 }); this.tone(1175, 0.2, { v: 0.09, t: 0.08 }); }
  _fanfare() {
    const chords = [[523, 659, 784], [587, 740, 880], [784, 988, 1175, 1568]];
    chords.forEach((ch, i) => ch.forEach((f) => this.tone(f, i === 2 ? 1.1 : 0.22, { type: 'sawtooth', v: 0.05, t: i * 0.19, lp: 2200 })));
    this.noise(0.5, { f: 7000, type: 'highpass', v: 0.05, t: 0.38 });
  }
}
