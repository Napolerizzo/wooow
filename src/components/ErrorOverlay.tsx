'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ErrorOverlayProps {
  message: string;
  sub?: string;
  onDismiss?: () => void;
}

/**
 * Full-screen dark overlay for fatal errors.
 * Uses Syne font as per aesthetic spec.
 */
export default function ErrorOverlay({ message, sub, onDismiss }: ErrorOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.overlay}
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          style={styles.content}
        >
          <p style={styles.heading}>{message}</p>
          {sub && <p style={styles.sub}>{sub}</p>}
          {onDismiss && (
            <button
              onClick={onDismiss}
              style={styles.button}
              autoFocus
            >
              DISMISS
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,8,8,0.97)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
    textAlign: 'center',
    maxWidth: '480px',
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: 'clamp(1.8rem, 4vw, 3rem)',
    color: 'var(--off-white)',
    lineHeight: 1.2,
  },
  sub: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    color: 'var(--secondary)',
    lineHeight: 1.6,
  },
  button: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    letterSpacing: '0.1em',
    color: 'var(--off-white)',
    background: 'transparent',
    border: '1px solid var(--border-emphasis)',
    padding: '0.6rem 1.5rem',
    cursor: 'pointer',
  },
};
