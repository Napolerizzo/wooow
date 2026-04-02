'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

/*
  Entry sequence timing:
  0ms    → page loads, pure black, grain + vignette visible immediately
  600ms  → cross lines draw in (stroke-dashoffset, 0.8s)
  1800ms → MARKZO stamps in (scale 1.4→1, opacity 0→1, 0.5s)
  2600ms → tagline fades in
  3100ms → action links fade in staggered
*/

export default function LandingPage() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1800);
    const t3 = setTimeout(() => setPhase(3), 2600);
    const t4 = setTimeout(() => setPhase(4), 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, []);

  return (
    <main style={styles.root}>
      <div style={styles.centerStack}>

        {/* Center cross — draws in as part of entry sequence */}
        <div style={styles.crossWrap} aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
            <motion.line
              x1="36" y1="4" x2="36" y2="68"
              stroke="#f0ece4" strokeWidth="1" strokeOpacity="0.3"
              strokeDasharray="64"
              initial={{ strokeDashoffset: 64 }}
              animate={{ strokeDashoffset: phase >= 1 ? 0 : 64 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            />
            <motion.line
              x1="4" y1="36" x2="68" y2="36"
              stroke="#f0ece4" strokeWidth="1" strokeOpacity="0.3"
              strokeDasharray="64"
              initial={{ strokeDashoffset: 64 }}
              animate={{ strokeDashoffset: phase >= 1 ? 0 : 64 }}
              transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.15 }}
            />
          </svg>
        </div>

        {/* MARKZO — stamps in from scale 1.4 */}
        <motion.h1
          style={styles.wordmark}
          className="chroma-text"
          initial={{ scale: 1.4, opacity: 0 }}
          animate={phase >= 2 ? { scale: 1, opacity: 1 } : { scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          MARKZO
        </motion.h1>

        {/* Tagline */}
        <motion.p
          style={styles.tagline}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 3 ? 1 : 0 }}
          transition={{ duration: 0.7 }}
        >
          the last marksheet your EB will ever build in excel.
        </motion.p>

        {/* Action lines */}
        <div style={styles.actions}>
          {[
            { label: 'START A CONFERENCE  →', href: '/signup', delay: 0 },
            { label: 'ENTER COMMITTEE  →',    href: '/login',  delay: 0.13 },
          ].map(({ label, href, delay }) => (
            <motion.div
              key={href}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: phase >= 4 ? 1 : 0, y: phase >= 4 ? 0 : 10 }}
              transition={{ duration: 0.5, delay }}
            >
              <Link href={href} style={styles.actionLink} className="link-underline">
                {label}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
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
  },
  centerStack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    textAlign: 'center',
    padding: '2rem',
    userSelect: 'none',
  },
  crossWrap: {
    marginBottom: '-12px',
  },
  wordmark: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(64px, 10vw, 120px)',
    color: '#f0ece4',
    lineHeight: 1,
    letterSpacing: '-0.01em',
  },
  tagline: {
    fontFamily: 'var(--font-caveat)',
    fontSize: '20px',
    color: '#555',
    fontStyle: 'italic',
    marginTop: '28px',
    letterSpacing: '0.02em',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '44px',
    alignItems: 'center',
  },
  actionLink: {
    fontFamily: 'var(--font-body)',
    fontSize: '17px',
    color: '#666',
    letterSpacing: '0.05em',
    display: 'inline-block',
    transition: 'color 0.2s',
  },
};
