'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PendulumCTA({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fast, setFast] = useState(false);
  const [fallen, setFallen] = useState(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!wrapRef.current || fallen) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2);
      setFast(dist < 120);
    }
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [fallen]);

  function handleClick() {
    if (fallen) return;
    setFallen(true);
    setTimeout(() => router.push(href), 600);
  }

  return (
    <div
      ref={wrapRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        cursor: 'pointer',
        userSelect: 'none',
        transformOrigin: 'top center',
      }}
      onClick={handleClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      aria-label={label}
    >
      {/* String */}
      <div
        style={{
          width: '1px',
          height: '48px',
          background: 'rgba(240,236,228,0.25)',
          transformOrigin: 'top center',
          animation: fallen
            ? 'pendulum-fast 0.15s ease-in 0s 1 forwards'
            : fast
              ? 'pendulum-fast 0.6s ease-in-out infinite'
              : 'pendulum 2.5s ease-in-out infinite',
          transition: fallen ? 'none' : undefined,
        }}
        aria-hidden="true"
      />
      {/* Label */}
      <div
        className="cta-text"
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 700,
          fontSize: '13px',
          color: fast ? '#f0ece4' : '#666',
          letterSpacing: '0.08em',
          transition: 'color 0.2s, transform 0.5s',
          transform: fallen ? 'translateY(40px) rotate(12deg)' : undefined,
          opacity: fallen ? 0 : 1,
        }}
      >
        {label} →
      </div>
    </div>
  );
}
