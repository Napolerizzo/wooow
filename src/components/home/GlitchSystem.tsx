'use client';

import { useEffect, useRef } from 'react';

const UNICODE_SCRAMBLE = ['░', '▒', '▓', '█', '╳', '⌬', '⊗', '⊘', '⌀', '⌖', '⍉', '⍥', '◈', '▣', '⊞', '⊟'];
const CYRILLIC = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';

function randomChar() {
  return Math.random() < 0.5
    ? UNICODE_SCRAMBLE[Math.floor(Math.random() * UNICODE_SCRAMBLE.length)]
    : CYRILLIC[Math.floor(Math.random() * CYRILLIC.length)];
}

function audioGlitch() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80 + Math.random() * 200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => ctx.close();
  } catch {
    // Web Audio not available
  }
}

function scrambleText(el: Element) {
  const original = el.textContent || '';
  let frame = 0;
  const steps = 8;
  const id = setInterval(() => {
    frame++;
    if (frame >= steps) {
      el.textContent = original;
      clearInterval(id);
      return;
    }
    el.textContent = original
      .split('')
      .map((c) => (c.trim() && Math.random() < 0.6 ? randomChar() : c))
      .join('');
  }, 40);
}

export default function GlitchSystem() {
  const cooldownRef = useRef(false);

  useEffect(() => {
    const zones: { el: HTMLDivElement; x: number; y: number }[] = [];

    function repositionZones() {
      zones.forEach(({ el }) => {
        const x = Math.random() * (window.innerWidth - 80);
        const y = Math.random() * (window.innerHeight - 80);
        el.style.left = `${x}px`;
        el.style.top  = `${y}px`;
      });
    }

    // Create 3 invisible trigger zones
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: fixed;
        width: 80px; height: 80px;
        z-index: 0;
        pointer-events: none;
      `;
      document.body.appendChild(el);
      zones.push({ el, x: 0, y: 0 });
    }
    repositionZones();

    const reposInterval = setInterval(() => {
      repositionZones();
    }, (15 + Math.random() * 15) * 1000);

    function triggerGlitch(x: number, y: number) {
      if (cooldownRef.current) return;
      // Check proximity to any zone
      const hit = zones.some(({ el }) => {
        const rect = el.getBoundingClientRect();
        const dx = x - (rect.left + rect.width / 2);
        const dy = y - (rect.top + rect.height / 2);
        return Math.sqrt(dx * dx + dy * dy) < 60;
      });
      if (!hit) return;

      cooldownRef.current = true;
      audioGlitch();

      // Body shake
      document.body.classList.add('glitch-active');
      setTimeout(() => document.body.classList.remove('glitch-active'), 420);

      // Invert overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        background: white; mix-blend-mode: difference;
        pointer-events: none; animation: none;
      `;
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 80);

      // Scramble nearby text
      const els = document.querySelectorAll('h1, h2, p, a, button, span');
      const nearby = Array.from(els).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }).slice(0, 6);
      nearby.forEach((el) => scrambleText(el));

      setTimeout(() => { cooldownRef.current = false; }, 8000);
    }

    function onMouseMove(e: MouseEvent) {
      triggerGlitch(e.clientX, e.clientY);
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      clearInterval(reposInterval);
      zones.forEach(({ el }) => el.remove());
    };
  }, []);

  return null;
}
