'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import FontCycleText from '@/components/FontCycleText';
import ZoomTransition, { type ZoomTransitionHandle } from '@/components/home/ZoomTransition';
import PendulumCTA from '@/components/home/PendulumCTA';

// Heavy effects — load only on desktop, skip SSR
const PhysicsHero  = dynamic(() => import('@/components/home/PhysicsHero'),  { ssr: false });
const BlackHoleCursor = dynamic(() => import('@/components/home/BlackHoleCursor'), { ssr: false });
const GlitchSystem = dynamic(() => import('@/components/home/GlitchSystem'), { ssr: false });
const IdleScramble = dynamic(() => import('@/components/home/IdleScramble'), { ssr: false });
const DatamoshScroll = dynamic(() => import('@/components/home/DatamoshScroll'), { ssr: false });

/*
  Entry phases:
  0 black → 1 corners → 2 rule → 3 cross → 4 wordmark → 5 tagline → 6 CTAs
*/

export default function LandingPage() {
  const [phase, setPhase] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const zoomRef = useRef<ZoomTransitionHandle>(null);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
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

  function handleCtaClick(e: React.MouseEvent, href: string) {
    if (isMobile) return; // let default navigation proceed
    e.preventDefault();
    zoomRef.current?.trigger(e.clientX, e.clientY, href);
  }

  return (
    <main style={styles.root}>

      {/* ── Physics letters (desktop only, behind everything) ──────────── */}
      {!isMobile && <PhysicsHero />}

      {/* ── Three.js cursor vortex (desktop only) ──────────────────────── */}
      {!isMobile && <BlackHoleCursor />}

      {/* ── Datamosh scroll overlay (desktop only) ─────────────────────── */}
      {!isMobile && <DatamoshScroll />}

      {/* ── Glitch system (desktop only) ───────────────────────────────── */}
      {!isMobile && <GlitchSystem />}

      {/* ── Idle scramble (desktop only) ───────────────────────────────── */}
      {!isMobile && <IdleScramble />}

      {/* ── Zoom transition overlay ─────────────────────────────────────── */}
      <ZoomTransition ref={zoomRef} />

      {/* ── Corner registration marks ───────────────────────────────────── */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <CornerMark key={corner} corner={corner} visible={phase >= 1} />
      ))}

      {/* ── Horizontal rule ─────────────────────────────────────────────── */}
      <motion.div
        aria-hidden="true"
        style={styles.rule}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: phase >= 2 ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* ── Center stack ────────────────────────────────────────────────── */}
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
            <motion.circle
              cx="28" cy="28" r="1.5"
              fill="#f0ece4" fillOpacity="0.5"
              initial={{ scale: 0 }}
              animate={{ scale: phase >= 3 ? 1 : 0 }}
              transition={{ duration: 0.3, delay: 0.6 }}
            />
          </svg>
        </div>

        {/* MARKZO wordmark — letter-by-letter stagger entry + font cycling */}
        <div style={styles.wordmarkWrap} aria-label="MARKZO" role="heading" aria-level={1}>
          {'MARKZO'.split('').map((letter, i) => (
            <motion.span
              key={i}
              style={styles.wordmarkLetter}
              initial={{ y: 60, opacity: 0, rotateX: -90, skewX: -20 }}
              animate={phase >= 4
                ? { y: 0, opacity: 1, rotateX: 0, skewX: 0 }
                : { y: 60, opacity: 0, rotateX: -90, skewX: -20 }}
              transition={{
                duration: 0.7,
                delay: i * 0.07,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <FontCycleText
                interval={2800 + i * 400}
                style={{
                  ...styles.wordmark,
                  textShadow: '-3px 0 rgba(255,0,0,0.5), 3px 0 rgba(0,255,255,0.5)',
                }}
              >
                {letter}
              </FontCycleText>
            </motion.span>
          ))}
        </div>

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
        <motion.div
          style={styles.actions}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: phase >= 6 ? 1 : 0, y: phase >= 6 ? 0 : 8 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {isMobile ? (
            // Mobile: big touch-friendly buttons
            <>
              <a
                href="/signup"
                style={styles.mobileCta}
              >
                START A CONFERENCE →
              </a>
              <a
                href="/login"
                style={{ ...styles.mobileCta, ...styles.mobileCtaSecondary }}
              >
                ENTER COMMITTEE
              </a>
            </>
          ) : (
            // Desktop: pendulum CTAs
            <>
              <PendulumCTA
                href="/signup"
                label="START A CONFERENCE"
              />
              <div style={{ marginTop: '8px' }}>
                <a
                  href="/login"
                  onClick={(e) => handleCtaClick(e, '/login')}
                  className="link-underline cta-text"
                  style={styles.secondaryCta}
                >
                  ENTER COMMITTEE →
                </a>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Version tag ─────────────────────────────────────────────────── */}
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

/* ── Corner registration mark component ──────────────────────────────────── */
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
      <motion.line
        x1={isRight ? size : 0} y1={isBottom ? size : 0}
        x2={isRight ? size - size : size} y2={isBottom ? size : 0}
        stroke="#f0ece4" strokeWidth="0.8" strokeOpacity="0.2"
        strokeDasharray={String(size)}
        initial={{ strokeDashoffset: size }}
        animate={{ strokeDashoffset: visible ? 0 : size }}
        transition={{ duration: 0.4, delay: 0.05 }}
      />
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
    zIndex: 5,
  },
  crossWrap: {
    marginBottom: '-8px',
  },
  wordmarkWrap: {
    display: 'flex',
    alignItems: 'baseline',
    perspective: '600px',
    userSelect: 'none',
  },
  wordmarkLetter: {
    display: 'inline-block',
    transformOrigin: 'bottom center',
  },
  wordmark: {
    fontWeight: 800,
    fontSize: 'clamp(64px, 10vw, 120px)',
    color: '#f0ece4',
    lineHeight: 1,
    letterSpacing: '-0.01em',
    display: 'inline-block',
    transition: 'font-family 0s',
  },
  tagline: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    color: '#555',
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
  secondaryCta: {
    fontFamily: 'var(--font-heading)',
    fontWeight: 700,
    fontSize: '13px',
    color: '#555',
    letterSpacing: '0.06em',
    transition: 'color 0.2s',
  },
  mobileCta: {
    display: 'block',
    fontFamily: 'var(--font-heading)',
    fontWeight: 700,
    fontSize: '16px',
    color: '#f0ece4',
    letterSpacing: '0.06em',
    border: '1px solid rgba(240,236,228,0.2)',
    padding: '16px 32px',
    minHeight: '52px',
    textAlign: 'center',
    textDecoration: 'none',
  },
  mobileCtaSecondary: {
    color: '#888',
    border: '1px solid rgba(240,236,228,0.1)',
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
