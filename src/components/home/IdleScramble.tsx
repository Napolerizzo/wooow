'use client';

import { useEffect, useRef } from 'react';

const CYRILLIC = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const LATIN_NOISE = 'XZQWVJK∆∑∂∫';

function scrambleChar(c: string) {
  if (!c.trim()) return c;
  const src = Math.random() < 0.6 ? CYRILLIC : LATIN_NOISE;
  return src[Math.floor(Math.random() * src.length)];
}

export default function IdleScramble() {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrambleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalTexts = useRef<Map<Element, string>>(new Map());
  const active = useRef(false);

  useEffect(() => {
    function resetIdle() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (active.current) restore();
      idleTimer.current = setTimeout(startScrambling, 45000);
    }

    function startScrambling() {
      active.current = true;
      scheduleNext();
    }

    function scheduleNext() {
      const delay = 3000 + Math.random() * 5000;
      scrambleTimer.current = setTimeout(() => {
        if (!active.current) return;
        doScramble();
        scheduleNext();
      }, delay);
    }

    function doScramble() {
      const candidates = document.querySelectorAll('h1, h2, p, a, .cta-text');
      const el = candidates[Math.floor(Math.random() * candidates.length)];
      if (!el) return;
      const orig = el.textContent || '';
      if (!originalTexts.current.has(el)) originalTexts.current.set(el, orig);

      let frame = 0;
      const steps = 12;
      const id = setInterval(() => {
        frame++;
        if (frame >= steps) {
          el.textContent = originalTexts.current.get(el) ?? orig;
          clearInterval(id);
          return;
        }
        el.textContent = orig.split('').map((c) =>
          c.trim() && Math.random() < 0.5 ? scrambleChar(c) : c
        ).join('');
      }, 50);
    }

    function restore() {
      active.current = false;
      if (scrambleTimer.current) clearTimeout(scrambleTimer.current);
      originalTexts.current.forEach((text, el) => { el.textContent = text; });
      originalTexts.current.clear();
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (scrambleTimer.current) clearTimeout(scrambleTimer.current);
      restore();
    };
  }, []);

  return null;
}
