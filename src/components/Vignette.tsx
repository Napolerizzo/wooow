'use client';

export default function Vignette() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        pointerEvents: 'none',
        boxShadow: 'inset 0 0 280px rgba(0,0,0,0.93)',
      }}
    />
  );
}
