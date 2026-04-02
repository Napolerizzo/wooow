'use client';

import { useRef, useImperativeHandle, forwardRef } from 'react';
import { useRouter } from 'next/navigation';

export interface ZoomTransitionHandle {
  trigger: (originX: number, originY: number, href: string) => void;
}

const ZoomTransition = forwardRef<ZoomTransitionHandle>(function ZoomTransition(_, ref) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    async trigger(originX: number, originY: number, href: string) {
      const el = overlayRef.current;
      if (!el) { router.push(href); return; }

      // Position origin at click point
      el.style.transformOrigin = `${originX}px ${originY}px`;
      el.style.opacity = '1';
      el.style.transition = 'none';
      el.style.transform = 'scale(0)';

      // Force reflow
      void el.offsetWidth;

      // Expand
      el.style.transition = 'transform 0.55s cubic-bezier(0.16,1,0.3,1), opacity 0.1s';
      el.style.transform = 'scale(40)';

      setTimeout(() => {
        router.push(href);
      }, 400);

      setTimeout(() => {
        el.style.transition = 'none';
        el.style.opacity = '0';
        el.style.transform = 'scale(0)';
      }, 700);
    },
  }));

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: '#f0ece4',
        zIndex: 9000,
        pointerEvents: 'none',
        opacity: 0,
        transform: 'scale(0)',
      }}
      aria-hidden="true"
    />
  );
});

export default ZoomTransition;
