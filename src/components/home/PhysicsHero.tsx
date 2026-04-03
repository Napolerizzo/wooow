'use client';

import { useEffect, useRef } from 'react';

const LETTERS = ['M', 'A', 'R', 'K', 'Z', 'O'];
const CHAR_W = 80;   // body collision width
const CHAR_H = 90;   // body collision height
const FONT_SIZE = 100;

export default function PhysicsHero({ onReady }: { onReady?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const divRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    let mounted = true;
    let runner: import('matter-js').Runner | null = null;
    let engine: import('matter-js').Engine | null = null;

    import('matter-js').then((M) => {
      if (!mounted) return;

      // Always use window dimensions for physics world
      const W = window.innerWidth;
      const H = window.innerHeight;
      const T = 40;

      engine = M.Engine.create({ gravity: { y: 1.5 } });
      runner = M.Runner.create();

      // Boundaries
      const ground = M.Bodies.rectangle(W / 2, H + T / 2, W * 3, T, { isStatic: true });
      const wallL  = M.Bodies.rectangle(-T / 2, H / 2, T, H * 2, { isStatic: true });
      const wallR  = M.Bodies.rectangle(W + T / 2, H / 2, T, H * 2, { isStatic: true });
      M.Composite.add(engine.world, [ground, wallL, wallR]);

      // Spread letters evenly across the viewport top
      const count  = LETTERS.length;
      const gap    = W / (count + 1);
      const bodies = LETTERS.map((_, i) => {
        const x = gap * (i + 1) + (Math.random() - 0.5) * (gap * 0.3);
        const y = -(80 + i * 120 + Math.random() * 60); // cascade from top
        return M.Bodies.rectangle(x, y, CHAR_W - 8, CHAR_H - 10, {
          restitution: 0.38,
          friction: 0.25,
          frictionAir: 0.012,
          angle: (Math.random() - 0.5) * 0.4,
          chamfer: { radius: 6 },
        });
      });
      M.Composite.add(engine.world, bodies);

      // Mouse drag
      if (containerRef.current) {
        const mouse = M.Mouse.create(containerRef.current);
        const mc = M.MouseConstraint.create(engine, {
          mouse,
          constraint: { stiffness: 0.18, render: { visible: false } },
        });
        M.Composite.add(engine.world, mc);
      }

      M.Runner.run(runner, engine);

      // Sync letter divs
      function tick() {
        bodies.forEach((body, i) => {
          const el = divRefs.current[i];
          if (!el) return;
          el.style.transform = `translate(${body.position.x - CHAR_W / 2}px, ${body.position.y - CHAR_H / 2}px) rotate(${body.angle}rad)`;
        });
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
      onReady?.();
    });

    return () => {
      mounted = false;
      cancelAnimationFrame(rafRef.current);
      if (runner && engine) {
        import('matter-js').then((M) => {
          if (runner) M.Runner.stop(runner);
          if (engine) M.Engine.clear(engine);
        });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'auto',
        zIndex: 0,
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
            fontFamily: '"Syne", sans-serif',
            fontWeight: 800,
            fontSize: `${FONT_SIZE}px`,
            color: '#f0ece4',
            lineHeight: 1,
            userSelect: 'none',
            willChange: 'transform',
            textShadow: '-3px 0 rgba(255,0,0,0.5), 3px 0 rgba(0,255,255,0.5)',
            letterSpacing: '-0.02em',
          }}
        >
          {letter}
        </div>
      ))}
    </div>
  );
}
