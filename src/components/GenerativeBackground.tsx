'use client';

import { useEffect, useRef } from 'react';

const PIECE_COUNT = 20;

type ArtType = 'lines' | 'rings' | 'constellation' | 'fragments' | 'spiral' | 'vortex';
const ART_TYPES: ArtType[] = ['lines', 'rings', 'constellation', 'fragments', 'spiral', 'vortex'];

interface Dot { x: number; y: number; vx: number; vy: number; }
interface Poly { vertices: { x: number; y: number }[]; phase: number; }
interface Particle { baseAngle: number; phase: number; }

interface Piece {
  type: ArtType;
  nx: number;   // normalized 0..1 position
  ny: number;
  depth: number;
  opacity: number;
  phase: number;
  dots?: Dot[];
  polys?: Poly[];
  particles?: Particle[];
}

function seeded(seed: number) {
  let s = (seed * 1664525 + 1013904223) & 0x7fffffff;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function buildPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => {
    const r = seeded(i * 7919 + 137);
    const type = ART_TYPES[i % ART_TYPES.length];
    const piece: Piece = {
      type,
      nx: r() * 0.88 + 0.06,
      ny: r() * 0.88 + 0.06,
      depth: r() * 0.05 + 0.01,
      opacity: r() * 0.04 + 0.025,
      phase: r() * Math.PI * 2,
    };
    if (type === 'constellation') {
      piece.dots = Array.from({ length: 12 }, () => ({
        x: (r() - 0.5) * 260,
        y: (r() - 0.5) * 260,
        vx: (r() - 0.5) * 0.12,
        vy: (r() - 0.5) * 0.12,
      }));
    }
    if (type === 'fragments') {
      piece.polys = Array.from({ length: 6 }, () => {
        const sides = Math.floor(r() * 3) + 3;
        const size = r() * 40 + 18;
        const cx = (r() - 0.5) * 140;
        const cy = (r() - 0.5) * 140;
        const angle0 = r() * Math.PI * 2;
        return {
          vertices: Array.from({ length: sides }, (__, j) => ({
            x: cx + Math.cos(angle0 + (j / sides) * Math.PI * 2) * size,
            y: cy + Math.sin(angle0 + (j / sides) * Math.PI * 2) * size,
          })),
          phase: r() * Math.PI * 2,
        };
      });
    }
    if (type === 'vortex') {
      piece.particles = Array.from({ length: 42 }, () => ({
        baseAngle: r() * Math.PI * 2,
        phase: r(),
      }));
    }
    return piece;
  });
}

function drawLines(ctx: CanvasRenderingContext2D, t: number, alpha: number) {
  ctx.lineWidth = 0.7;
  const W = 240, H = 160;
  for (let i = 0; i < 9; i++) {
    const y = (i / 8) * H - H / 2;
    ctx.beginPath();
    for (let x = -W / 2; x <= W / 2; x += 3) {
      const dy = Math.sin(x * 0.025 + t + i * 0.55) * 22;
      if (x === -W / 2) ctx.moveTo(x, y + dy);
      else ctx.lineTo(x, y + dy);
    }
    ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.abs(Math.cos(i * 0.8)));
    ctx.stroke();
  }
}

function drawRings(ctx: CanvasRenderingContext2D, t: number, alpha: number) {
  ctx.lineWidth = 0.6;
  for (let i = 1; i <= 7; i++) {
    const r = i * 18;
    ctx.save();
    ctx.rotate(t * 0.07 + i * 0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.globalAlpha = alpha * (1 - i * 0.08);
    ctx.stroke();
    ctx.restore();
  }
}

function drawConstellation(ctx: CanvasRenderingContext2D, alpha: number, dots: Dot[]) {
  for (const d of dots) {
    d.x += d.vx;
    d.y += d.vy;
    if (Math.abs(d.x) > 130) d.vx *= -1;
    if (Math.abs(d.y) > 130) d.vy *= -1;
  }
  ctx.lineWidth = 0.45;
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const dx = dots[i].x - dots[j].x;
      const dy = dots[i].y - dots[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 90) {
        ctx.globalAlpha = alpha * (1 - dist / 90) * 0.7;
        ctx.beginPath();
        ctx.moveTo(dots[i].x, dots[i].y);
        ctx.lineTo(dots[j].x, dots[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = alpha * 2.5;
  for (const d of dots) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFragments(ctx: CanvasRenderingContext2D, t: number, alpha: number, polys: Poly[]) {
  ctx.lineWidth = 0.65;
  for (const poly of polys) {
    const pulse = 0.85 + Math.sin(t * 0.9 + poly.phase) * 0.15;
    ctx.globalAlpha = alpha * pulse;
    ctx.beginPath();
    poly.vertices.forEach((v, idx) => {
      const x = v.x * pulse;
      const y = v.y * pulse;
      if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }
}

function drawSpiral(ctx: CanvasRenderingContext2D, t: number, alpha: number) {
  ctx.lineWidth = 0.7;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const turns = 4.5;
  const steps = 320;
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2 * turns + t * 0.18;
    const rr = (i / steps) * 110;
    const x = Math.cos(theta) * rr;
    const y = Math.sin(theta) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawVortex(ctx: CanvasRenderingContext2D, t: number, alpha: number, particles: Particle[]) {
  for (const p of particles) {
    const progress = ((t * 0.18 + p.phase) % 1 + 1) % 1;
    const rr = 110 * (1 - progress);
    const angle = p.baseAngle + progress * Math.PI * 5;
    const x = Math.cos(angle) * rr;
    const y = Math.sin(angle) * rr;
    ctx.globalAlpha = alpha * 2.2 * (1 - progress);
    ctx.beginPath();
    ctx.arc(x, y, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function GenerativeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<Piece[]>(buildPieces());
  const rafRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const smoothRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX - window.innerWidth / 2;
      mouseRef.current.y = e.clientY - window.innerHeight / 2;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);

    const startTime = performance.now();

    const tick = (now: number) => {
      const t = (now - startTime) * 0.001;

      // Lerp mouse
      smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.06;
      smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.06;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const piece of piecesRef.current) {
        const baseX = piece.nx * canvas.width;
        const baseY = piece.ny * canvas.height;
        const offX = smoothRef.current.x * piece.depth;
        const offY = smoothRef.current.y * piece.depth;

        ctx.save();
        ctx.translate(baseX + offX, baseY + offY);
        ctx.strokeStyle = '#f0ece4';
        ctx.fillStyle = '#f0ece4';
        ctx.globalAlpha = piece.opacity;

        const t2 = t + piece.phase;

        switch (piece.type) {
          case 'lines':       drawLines(ctx, t2, piece.opacity); break;
          case 'rings':       drawRings(ctx, t2, piece.opacity); break;
          case 'constellation': drawConstellation(ctx, piece.opacity, piece.dots!); break;
          case 'fragments':   drawFragments(ctx, t2, piece.opacity, piece.polys!); break;
          case 'spiral':      drawSpiral(ctx, t2, piece.opacity); break;
          case 'vortex':      drawVortex(ctx, t2, piece.opacity, piece.particles!); break;
        }

        ctx.restore();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}
