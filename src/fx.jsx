// Motion components modeled on React Bits (reactbits.dev), rewritten dependency-free
// so the page stays one self-contained file.
import React, { useEffect, useRef, useState } from 'react';

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// React Bits: SplitText -- letters rise in one by one
export function SplitText({ text, className = '', delay = 32, from = 0, as: Tag = 'span' }) {
  let i = 0;
  const words = String(text).split(' ');
  return (
    <Tag className={'split ' + className} aria-label={text}>
      {words.map((w, wi) => (
        <span className="split-word" aria-hidden="true" key={wi}>
          {[...w].map((ch) => {
            const d = from + i++ * delay;
            return <span className="split-ch" key={i} style={{ animationDelay: d + 'ms' }}>{ch}</span>;
          })}
          {wi < words.length - 1 ? <span className="split-space"> </span> : null}
        </span>
      ))}
    </Tag>
  );
}

// React Bits: DecryptedText -- scrambles through card glyphs, then resolves left to right
const GLYPHS = '♠♥♦♣AKQJ1098765432';
export function DecryptedText({ text, speed = 26, className = '' }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reducedMotion()) { setOut(text); return; }
    let i = 0;
    const id = setInterval(() => {
      i++;
      const revealed = Math.floor(i / 1.6);
      if (revealed >= text.length) { setOut(text); clearInterval(id); return; }
      setOut(text.split('').map((c, k) => (k < revealed || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''));
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return <span className={'decrypt ' + className} aria-label={text}><span aria-hidden="true">{out}</span></span>;
}

// React Bits: ShinyText -- a light sweep across the letters
export function ShinyText({ text, className = '' }) {
  return <span className={'shiny ' + className}>{text}</span>;
}

// React Bits: CountUp
export function CountUp({ value, duration = 650 }) {
  const [v, setV] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current, to = value;
    prev.current = value;
    if (from === to || reducedMotion()) { setV(to); return; }
    let raf;
    const st = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - st) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      setV(Math.round(from + (to - from) * e));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="tnum">{v}</span>;
}

// React Bits: ClickSpark -- brass sparks wherever you tap
export function ClickSpark({ color = '#E9C873', count = 8, size = 11, radius = 20, duration = 430 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let sparks = [], raf = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const draw = (now) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      sparks = sparks.filter((s) => {
        const t = (now - s.start) / duration;
        if (t >= 1) return false;
        const e = t * (2 - t);
        const dist = e * radius, len = size * (1 - e);
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
        ctx.globalAlpha = 1 - t * 0.6;
        ctx.beginPath();
        ctx.moveTo(s.x + dist * Math.cos(s.a), s.y + dist * Math.sin(s.a));
        ctx.lineTo(s.x + (dist + len) * Math.cos(s.a), s.y + (dist + len) * Math.sin(s.a));
        ctx.stroke();
        return true;
      });
      ctx.globalAlpha = 1;
      raf = sparks.length ? requestAnimationFrame(draw) : 0;
    };
    const down = (e) => {
      if (reducedMotion()) return;
      const now = performance.now();
      for (let i = 0; i < count; i++) sparks.push({ x: e.clientX, y: e.clientY, a: (2 * Math.PI * i) / count + 0.2, start: now });
      if (!raf) raf = requestAnimationFrame(draw);
    };
    addEventListener('resize', resize);
    addEventListener('pointerdown', down, { passive: true });
    return () => { removeEventListener('resize', resize); removeEventListener('pointerdown', down); cancelAnimationFrame(raf); };
  }, [color, count, size, radius, duration]);
  return <canvas ref={ref} className="spark-canvas" aria-hidden="true" />;
}

// React Bits: TiltedCard -- 3D tilt following the pointer (mouse only)
export function Tilt({ children, max = 14, className = '' }) {
  const ref = useRef(null);
  const move = (e) => {
    if (e.pointerType !== 'mouse' || reducedMotion()) return;
    const el = ref.current, r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(600px) rotateX(${-y * max}deg) rotateY(${x * max}deg) translateY(-6px) scale(1.06)`;
    el.style.setProperty('--gx', (x + 0.5) * 100 + '%');
    el.style.setProperty('--gy', (y + 0.5) * 100 + '%');
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  return <div ref={ref} className={'tilt ' + className} onPointerMove={move} onPointerLeave={leave}>{children}</div>;
}

// React Bits: Particles, recast as slowly drifting card suits
export function SuitField({ density = 26 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    let w, h, raf, items;
    const syms = ['♠', '♥', '♦', '♣'];
    const init = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      items = Array.from({ length: density }, () => ({
        x: Math.random() * w, y: Math.random() * h, s: 12 + Math.random() * 34,
        v: 0.12 + Math.random() * 0.35, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.006,
        g: syms[Math.floor(Math.random() * 4)], a: 0.04 + Math.random() * 0.09,
      }));
    };
    const frame = () => {
      ctx.clearRect(0, 0, w, h);
      for (const it of items) {
        it.y -= it.v; it.r += it.vr;
        if (it.y < -40) { it.y = h + 40; it.x = Math.random() * w; }
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.r);
        ctx.globalAlpha = it.a; ctx.fillStyle = '#D9B866';
        ctx.font = `${it.s}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.g + '\uFE0E', 0, 0);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    init();
    if (reducedMotion()) { frame(); cancelAnimationFrame(raf); } else frame();
    addEventListener('resize', init);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', init); };
  }, [density]);
  return <canvas ref={ref} className="suit-field" aria-hidden="true" />;
}
