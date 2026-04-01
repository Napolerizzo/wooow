'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

// ─── Parallax Card config ──────────────────────────────────────────────────
const CARDS = [
  { label: 'DELEGATE',   w: 90,  h: 120, x: 5,   y: 8,   rot: -12, depth: 0.02, opacity: 0.28 },
  { label: 'GAVEL',      w: 140, h: 180, x: 80,  y: 60,  rot: 8,   depth: 0.08, opacity: 0.32 },
  { label: 'RESOLUTION', w: 180, h: 240, x: 15,  y: 55,  rot: 4,   depth: 0.04, opacity: 0.25 },
  { label: 'COMMITTEE',  w: 100, h: 130, x: 72,  y: 5,   rot: -7,  depth: 0.08, opacity: 0.30 },
  { label: 'PODIUM',     w: 120, h: 160, x: 55,  y: 70,  rot: 15,  depth: 0.02, opacity: 0.27 },
  { label: 'MOTION',     w: 80,  h: 105, x: 88,  y: 35,  rot: -5,  depth: 0.04, opacity: 0.35 },
  { label: 'SPEAKER',    w: 160, h: 210, x: 2,   y: 30,  rot: -14, depth: 0.08, opacity: 0.22 },
  { label: 'AMENDMENT',  w: 130, h: 170, x: 65,  y: 15,  rot: 9,   depth: 0.04, opacity: 0.28 },
  { label: 'VETO',       w: 90,  h: 115, x: 42,  y: 80,  rot: -8,  depth: 0.02, opacity: 0.33 },
  { label: 'BLOC',       w: 200, h: 260, x: 30,  y: 2,   rot: 6,   depth: 0.08, opacity: 0.20 },
  { label: 'CLAUSE',     w: 110, h: 145, x: 92,  y: 68,  rot: -11, depth: 0.04, opacity: 0.30 },
  { label: 'DAIS',       w: 85,  h: 110, x: 8,   y: 75,  rot: 13,  depth: 0.02, opacity: 0.26 },
] as const;

const VERBS = ['MARK.', 'SCORE.', 'LOCK.', 'EXPORT.'];

export default function LandingPage() {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const frameRef = useRef<number>(0);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);

  // Smooth parallax via rAF
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      targetX.current = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY.current = (e.clientY / window.innerHeight - 0.5) * 2;
    }

    function animate() {
      currentX.current += (targetX.current - currentX.current) * 0.08;
      currentY.current += (targetY.current - currentY.current) * 0.08;
      setMouseX(currentX.current);
      setMouseY(currentY.current);
      frameRef.current = requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', handleMouseMove);
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <main style={styles.main}>
      {/* ── Parallax Cards ─────────────────────────────────────────────── */}
      <div style={styles.parallaxLayer} aria-hidden="true">
        {CARDS.map((card, i) => (
          <div
            key={card.label}
            style={{
              position: 'absolute',
              left: `${card.x}%`,
              top: `${card.y}%`,
              width: card.w,
              height: card.h,
              border: '1px solid #1e1e1e',
              opacity: card.opacity,
              filter: 'grayscale(1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `
                rotate(${card.rot}deg)
                translate(
                  ${mouseX * card.depth * 300}px,
                  ${mouseY * card.depth * 300}px
                )
              `,
              willChange: 'transform',
            }}
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.6 }}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '9px',
                color: 'var(--off-white)',
                letterSpacing: '0.1em',
                textAlign: 'center',
              }}
            >
              {card.label}
            </motion.span>
          </div>
        ))}
      </div>

      {/* ── Center Content ──────────────────────────────────────────────── */}
      <div style={styles.center}>
        {/* Wordmark */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={styles.wordmark}
          className="chroma-text"
        >
          MARKZO
        </motion.h1>

        {/* Verb lines */}
        <div style={styles.verbList} aria-label="What Markzo does">
          {VERBS.map((verb, i) => (
            <motion.p
              key={verb}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + i * 0.15, duration: 0.5, ease: 'easeOut' }}
              style={styles.verb}
            >
              {verb}
            </motion.p>
          ))}
        </div>

        {/* CTAs */}
        <motion.nav
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          style={styles.ctaList}
          aria-label="Get started"
        >
          <ActionLink href="/signup" label="START A CONFERENCE →" />
          <ActionLink href="/login" label="ENTER COMMITTEE →" />
        </motion.nav>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.5 }}
        style={styles.footer}
      >
        <span>markzo.sandnco.lol</span>
        <br />
        <span>©2025 sandnco. don&apos;t steal our shkt.</span>
      </motion.footer>
    </main>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      style={{
        ...styles.cta,
        color: hovered ? 'var(--off-white)' : '#888',
        position: 'relative',
        display: 'inline-block',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {label}
      {/* Underline draws in from left */}
      <motion.span
        initial={{ scaleX: 0 }}
        animate={{ scaleX: hovered ? 1 : 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          bottom: '-2px',
          left: 0,
          right: 0,
          height: '1px',
          background: 'var(--off-white)',
          transformOrigin: 'left',
          opacity: 0.5,
        }}
      />
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: 'var(--black)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parallaxLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    pointerEvents: 'none',
  },
  center: {
    position: 'relative',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '0',
  },
  wordmark: {
    fontFamily: 'var(--font-wordmark)',
    fontSize: 'clamp(56px, 8vw, 88px)',
    color: 'var(--off-white)',
    letterSpacing: '-0.01em',
    marginBottom: '1.5rem',
    lineHeight: 1,
  },
  verbList: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.1rem',
    marginBottom: '2rem',
  },
  verb: {
    fontFamily: 'var(--font-heading)',
    fontSize: 'clamp(24px, 3vw, 36px)',
    color: '#888',
    letterSpacing: '0.1em',
    lineHeight: 1.3,
  },
  ctaList: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  cta: {
    fontFamily: 'var(--font-body)',
    fontSize: 'clamp(14px, 1.5vw, 18px)',
    letterSpacing: '0.05em',
    textDecoration: 'none',
    transition: 'color 0.15s ease',
  },
  footer: {
    position: 'fixed',
    bottom: '1.25rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 20,
    fontFamily: 'var(--font-body)',
    fontSize: '11px',
    color: 'var(--muted)',
    textAlign: 'center',
    lineHeight: '1.7',
    whiteSpace: 'nowrap',
  },
};
