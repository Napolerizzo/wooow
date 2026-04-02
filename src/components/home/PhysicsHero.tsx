'use client';

import { useEffect, useRef } from 'react';

const LETTERS = ['M', 'A', 'R', 'K', 'Z', 'O'];
const LETTER_SIZE = 80; // px, font-size
const CHAR_W = 52;
const CHAR_H = 76;

export default function PhysicsHero({ onReady }: { onReady?: () => void }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<import('matter-js').Engine | null>(null);
  const renderRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const divRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    let Matter: typeof import('matter-js');
    let engine: import('matter-js').Engine;
    let runner: import('matter-js').Runner;
    let mouseConstraint: import('matter-js').MouseConstraint;
    let bodies: import('matter-js').Body[] = [];
    let mounted = true;

    import('matter-js').then((M) => {
      if (!mounted || !canvasRef.current) return;
      Matter = M;

      engine = Matter.Engine.create({ gravity: { y: 1.2 } });
      engineRef.current = engine;
      runner = Matter.Runner.create();

      const W = canvasRef.current.offsetWidth || window.innerWidth;
      const H = canvasRef.current.offsetHeight || window.innerHeight;
      const T = 20; // wall thickness

      // Ground + walls
      const ground = Matter.Bodies.rectangle(W / 2, H + T / 2, W, T, { isStatic: true, label: 'ground' });
      const wallL  = Matter.Bodies.rectangle(-T / 2, H / 2, T, H, { isStatic: true });
      const wallR  = Matter.Bodies.rectangle(W + T / 2, H / 2, T, H, { isStatic: true });
      Matter.Composite.add(engine.world, [ground, wallL, wallR]);

      // Drop MARKZO letters from above
      const totalW = LETTERS.length * (CHAR_W + 8);
      const startX = (W - totalW) / 2 + CHAR_W / 2;

      bodies = LETTERS.map((_, i) => {
        const x = startX + i * (CHAR_W + 8);
        const y = -CHAR_H * (i + 1) * 0.6; // stagger drop height
        const body = Matter.Bodies.rectangle(x, y, CHAR_W - 4, CHAR_H - 4, {
          restitution: 0.45,
          friction: 0.3,
          frictionAir: 0.015,
          label: `letter-${i}`,
          chamfer: { radius: 4 },
        });
        return body;
      });
      Matter.Composite.add(engine.world, bodies);

      // Mouse constraint
      const mouse = Matter.Mouse.create(canvasRef.current);
      mouseConstraint = Matter.MouseConstraint.create(engine, {
        mouse,
        constraint: { stiffness: 0.2, render: { visible: false } },
      });
      Matter.Composite.add(engine.world, mouseConstraint);

      Matter.Runner.run(runner, engine);

      // Sync DOM divs
      renderRef.current = setInterval(() => {
        bodies.forEach((body, i) => {
          const el = divRefs.current[i];
          if (!el) return;
          el.style.transform = `translate(${body.position.x - CHAR_W / 2}px, ${body.position.y - CHAR_H / 2}px) rotate(${body.angle}rad)`;
        });
      }, 16);

      onReady?.();
    });

    return () => {
      mounted = false;
      if (renderRef.current) clearInterval(renderRef.current);
      if (engineRef.current) {
        import('matter-js').then((M) => {
          M.Runner.stop(runner);
          M.Engine.clear(engineRef.current!);
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
      aria-hidden="true"
    >
      {LETTERS.map((letter, i) => (
        <div
          key={i}
          ref={(el) => { if (el) divRefs.current[i] = el; }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${CHAR_W}px`,
            height: `${CHAR_H}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-wordmark)',
            fontWeight: 800,
            fontSize: `${LETTER_SIZE}px`,
            color: '#f0ece4',
            lineHeight: 1,
            userSelect: 'none',
            willChange: 'transform',
            textShadow: '-2px 0 rgba(255,0,0,0.45), 2px 0 rgba(0,255,255,0.45)',
          }}
        >
          {letter}
        </div>
      ))}
    </div>
  );
}
