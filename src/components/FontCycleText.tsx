'use client';

import { useEffect, useRef, useState } from 'react';

const FONTS = [
  '"Syne", sans-serif',
  '"DM Mono", monospace',
  '"Impact", "Arial Black", sans-serif',
  '"Georgia", serif',
  '"Courier New", monospace',
  '"Arial Narrow", "Arial", sans-serif',
  '"Syne", sans-serif',  // return to home
];

interface Props {
  children: string;
  style?: React.CSSProperties;
  className?: string;
  interval?: number; // ms between switches, default 2200
}

export default function FontCycleText({ children, style, className, interval = 2200 }: Props) {
  const [fontIdx, setFontIdx] = useState(0);
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => {
      setFlash(true);
      setTimeout(() => {
        setFontIdx((i) => (i + 1) % FONTS.length);
        setFlash(false);
      }, 60);
    }, interval);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [interval]);

  return (
    <span
      className={className}
      style={{
        ...style,
        fontFamily: FONTS[fontIdx],
        transition: 'font-family 0s',
        filter: flash ? 'blur(2px)' : 'none',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  );
}
