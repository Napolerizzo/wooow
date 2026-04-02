'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

/*
  6-step entry sequence:
  Phase 0  (0ms)    — pure black, grain + vignette only
  Phase 1  (250ms)  — corner registration marks draw in
  Phase 2  (700ms)  — horizontal rule slides in
  Phase 3  (1300ms) — cross reticle draws
  Phase 4  (2000ms) — MARKZO stamps (scale 1.3→1)
  Phase 5  (2800ms) — tagline reveals
  Phase 6  (3300ms) — CTAs stagger up
*/

export default function LandingPage() {
  const [phase, setPhase] = useState(0);
  const [ctaHover, setCtaHover] = useState<string | null>(null);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 250),
      setTimeout(() => setPhase(2), 700),
      setTimeout(() => setPhase(3), 1300),
      setTimeout(() => setPhase(4), 2000),
      setTimeout(() => setPhase(5), 2800),
      setTimeout(() => setPhase(6), 3300),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <main style={styles.root}>

      {/* ── Corner registration marks ───────────────────────────────── */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <CornerMark key={corner} corner={corner} visible={phase >= 1} />
      ))}

      {/* ── Horizontal rule ─────────────────────────────────────────── */}
      <motion.div
        aria-hidden="true"
        style={styles.rule}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: phase >= 2 ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* ── Center stack ────────────────────────────────────────────── */}
      <div style={styles.centerStack}>

        {/* Cross reticle */}
        <div style={styles.crossWrap} aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <motion.line
              x1="28" y1="4" x2="28" y2="52"
              stroke="#f0ece4" strokeWidth="0.8" strokeOpacity="0.35"
              strokeDasharray="48"
              initial={{ strokeDashoffset: 48 }}
              animate={{ strokeDashoffset: phase >= 3 ? 0 : 48 }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            />
            <motion.line
              x1="4" y1="28" x2="52" y2="28"
              stroke="#f0ece4" strokeWidth="0.8" strokeOpacity="0.35"
              strokeDasharray="48"
              initial={{ strokeDashoffset: 48 }}
              animate={{ strokeDashoffset: phase >= 3 ? 0 : 48 }}
              transition={{ duration: 0.7, ease: 'easeInOut', delay: 0.12 }}
            />
            {/* Center dot */}
            <motion.circle
              cx="28" cy="28" r="1.5"
              fill="#f0ece4" fillOpacity="0.5"
              initial={{ scale: 0 }}
              animate={{ scale: phase >= 3 ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            />
          </svg>
        </div>

        {/* MARKZO wordmark */}
        <motion.h1
          style={styles.wordmark}
          className="chroma-text"
          initial={{ scale: 1.3, opacity: 0 }}
          animate={phase >= 4 ? { scale: 1, opacity: 1 } : { scale: 1.3, opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          MARKZO
        </motion.h1>

        {/* Tagline */}
        <motion.p
          style={styles.tagline}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 5 ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        >
          the last marksheet your EB will ever build.
        </motion.p>

        {/* CTAs */}
        <div style={styles.actions}>
          {[
            { label: 'START A CONFERENCE', href: '/signup', delay: 0 },
            { label: 'ENTER COMMITTEE',    href: '/login',  delay: 0.1 },
          ].map(({ label, href, delay }) => (
            <motion.div
              key={href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: phase >= 6 ? 1 : 0, y: phase >= 6 ? 0 : 8 }}
              transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={href}
                style={{
                  ...styles.cta,
                  color: ctaHover === href ? '#f0ece4' : '#555',
                  letterSpacing: ctaHover === href ? '0.12em' : '0.06em',
                }}
                onMouseEnter={() => setCtaHover(href)}
                onMouseLeave={() => setCtaHover(null)}
                className="link-underline"
              >
                {label} <span style={styles.ctaArrow}>→</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Version tag ────────────────────────────────────────────── */}
      <motion.span
        style={styles.version}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase >= 6 ? 1 : 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        aria-hidden="true"
      >
        v1
      </motion.span>
    </main>
  );
}

/* ── Corner registration mark component ─────────────────────────────────── */
function CornerMark({ corner, visible }: { corner: 'tl' | 'tr' | 'bl' | 'br'; visible: boolean }) {
  const isRight  = corner === 'tr' || corner === 'br';
  const isBottom = corner === 'bl' || corner === 'br';
  const size = 20;
  const gap  = 28;

  return (
    <motion.svg
      aria-hidden="true"
      width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none"
      style={{
        position: 'absolute',
        top:    isBottom ? undefined : gap,
        bottom: isBottom ? gap : undefined,
        left:   isRight  ? undefined : gap,
        right:  isRight  ? gap : undefined,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* horizontal arm */}
      <motion.line
        x1={isRight ? size : 0} y1={isBottom ? size : 0}
        x2={isRight ? size - size : size} y2={isBottom ? size : 0}
        stroke="#f0ece4" strokeWidth="0.8" strokeOpacity="0.2"
        strokeDasharray={String(size)}
        initial={{ strokeDashoffset: size }}
        animate={{ strokeDashoffset: visible ? 0 : size }}
        transition={{ duration: 0.4, delay: 0.05 }}
      />
      {/* vertical arm */}
      <motion.line
        x1={isRight ? size : 0} y1={isBottom ? size : 0}
        x2={isRight ? size : 0} y2={isBottom ? size - size : size}
        stroke="#f0ece4" strokeWidth="0.8" strokeOpacity="0.2"
        strokeDasharray={String(size)}
        initial={{ strokeDashoffset: size }}
        animate={{ strokeDashoffset: visible ? 0 : size }}
        transition={{ duration: 0.4, delay: 0.1 }}
      />
    </motion.svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 10,
    overflow: 'hidden',
  },
  rule: {
    position: 'absolute',
    top: '50%',
    left: 0,
    width: '100%',
    height: '1px',
    background: 'rgba(240,236,228,0.04)',
    transformOrigin: 'left center',
    pointerEvents: 'none',
  },
  centerStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    textAlign: 'center',
    padding: '2rem',
    userSelect: 'none',
    position: 'relative',
    zIndex: 2,
  },
  crossWrap: {
    marginBottom: '-8px',
  },
  wordmark: {
    fontFamily: 'var(--font-wordmark)',
    fontWeight: 800,
    fontSize: 'clamp(64px, 10vw, 120px)',
    color: '#f0ece4',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  tagline: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    color: '#444',
    marginTop: '24px',
    letterSpacing: '0.04em',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '40px',
    alignItems: 'center',
  },
  cta: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 700,
    fontSize: '15px',
    display: 'inline-block',
    transition: 'color 0.2s, letter-spacing 0.3s',
  },
  ctaArrow: {
    display: 'inline-block',
    marginLeft: '6px',
    opacity: 0.6,
  },
  version: {
    position: 'absolute',
    bottom: '28px',
    right: '28px',
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: '#252525',
    letterSpacing: '0.08em',
  },
};
