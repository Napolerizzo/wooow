'use client';

import { useEffect, useRef } from 'react';

const PIECE_COUNT = 18;

type ArtType = 'gridFragment' | 'signalLine' | 'dotCluster';
const ART_TYPES: ArtType[] = ['gridFragment', 'signalLine', 'dotCluster'];

interface Dot { x: number; y: number; vx: number; vy: number; }

interface Piece {
  type: ArtType;
  nx: number;
  ny: number;
  depth: number;
  opacity: number;
  phase: number;
  dots?: Dot[];
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
      opacity: r() * 0.04 + 0.02,
      phase: r() * Math.PI * 2,
    };
    if (type === 'dotCluster') {
      piece.dots = Array.from({ length: 18 }, () => ({
        x: (r() - 0.5) * 220,
        y: (r() - 0.5) * 220,
        vx: (r() - 0.5) * 0.09,
        vy: (r() - 0.5) * 0.09,
      }));
    }
    return piece;
  });
}

/* ── Grid Fragment ───────────────────────────────────────────────────────── */
function drawGridFragment(ctx: CanvasRenderingContext2D, t: number, alpha: number) {
  const cols = 7;
  const rows = 5;
  const W = 200;
  const H = 140;
  ctx.lineWidth = 0.5;

  // vertical lines with horizontal wave
  for (let c = 0; c <= cols; c++) {
    const x = (c / cols) * W - W / 2;
    ctx.beginPath();
    for (let step = 0; step <= rows * 4; step++) {
      const y = (step / (rows * 4)) * H - H / 2;
      const dx = Math.sin(y * 0.06 + t * 0.7 + c * 0.9) * 10;
      if (step === 0) ctx.moveTo(x + dx, y);
      else ctx.lineTo(x + dx, y);
    }
    ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.abs(Math.sin(c * 0.7 + t * 0.3)));
    ctx.stroke();
  }

  // horizontal lines with vertical wave
  for (let ro = 0; ro <= rows; ro++) {
    const y = (ro / rows) * H - H / 2;
    ctx.beginPath();
    for (let step = 0; step <= cols * 4; step++) {
      const x = (step / (cols * 4)) * W - W / 2;
      const dy = Math.sin(x * 0.05 + t * 0.5 + ro * 1.1) * 8;
      if (step === 0) ctx.moveTo(x, y + dy);
      else ctx.lineTo(x, y + dy);
    }
    ctx.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.cos(ro * 0.8 + t * 0.2)));
    ctx.stroke();
  }
}

/* ── Signal Line ─────────────────────────────────────────────────────────── */
function drawSignalLine(ctx: CanvasRenderingContext2D, t: number, alpha: number) {
  ctx.lineWidth = 0.6;
  const W = 260;
  const lineCount = 6;

  for (let i = 0; i < lineCount; i++) {
    const yBase = ((i / (lineCount - 1)) - 0.5) * 120;
    const freq1 = 0.022 + i * 0.004;
    const freq2 = 0.047 + i * 0.003;
    const amp   = 16 + i * 3;
    const speed = 1.4 + i * 0.3;

    ctx.beginPath();
    for (let px = -W / 2; px <= W / 2; px += 2) {
      const dy = Math.sin(px * freq1 + t * speed) * amp
               + Math.sin(px * freq2 + t * speed * 0.6 + i) * (amp * 0.4);
      if (px === -W / 2) ctx.moveTo(px, yBase + dy);
      else ctx.lineTo(px, yBase + dy);
    }

    // scan envelope: bright band sweeps left→right
    const scan = ((t * 0.4 + i * 0.17) % 1);
    const scanX = scan * W - W / 2;
    const distToScan = Math.abs(0 - scanX) / (W / 2); // distance from center
    const envelope = Math.max(0, 1 - distToScan * 1.2);
    ctx.globalAlpha = alpha * (0.35 + envelope * 0.65);
    ctx.stroke();
  }
}

/* ── Dot Cluster ─────────────────────────────────────────────────────────── */
function drawDotCluster(ctx: CanvasRenderingContext2D, t: number, alpha: number, dots: Dot[]) {
  // gently orbit center
  for (const d of dots) {
    d.x += d.vx + Math.sin(t * 0.4 + d.y * 0.01) * 0.04;
    d.y += d.vy + Math.cos(t * 0.35 + d.x * 0.01) * 0.04;
    if (Math.abs(d.x) > 110) d.vx *= -1;
    if (Math.abs(d.y) > 110) d.vy *= -1;
  }

  // connection lines between nearby dots
  ctx.lineWidth = 0.4;
  for (let i = 0; i < dots.length; i++) {
    for (let j = i + 1; j < dots.length; j++) {
      const dx = dots[i].x - dots[j].x;
      const dy = dots[i].y - dots[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 75) {
        ctx.globalAlpha = alpha * (1 - dist / 75) * 0.6;
        ctx.beginPath();
        ctx.moveTo(dots[i].x, dots[i].y);
        ctx.lineTo(dots[j].x, dots[j].y);
        ctx.stroke();
      }
    }
  }

  // dot nodes — pulse with time
  for (const d of dots) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 1.1 + d.x * 0.05);
    ctx.globalAlpha = alpha * 2.8 * pulse;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function GenerativeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const piecesRef = useRef<Piece[]>(buildPieces());
  const rafRef    = useRef<number>(0);
  const mouseRef  = useRef({ x: 0, y: 0 });
  const smoothRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX - window.innerWidth  / 2;
      mouseRef.current.y = e.clientY - window.innerHeight / 2;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);

    const startTime = performance.now();

    const tick = (now: number) => {
      const t = (now - startTime) * 0.001;

      smoothRef.current.x += (mouseRef.current.x - smoothRef.current.x) * 0.06;
      smoothRef.current.y += (mouseRef.current.y - smoothRef.current.y) * 0.06;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const piece of piecesRef.current) {
        const baseX = piece.nx * canvas.width;
        const baseY = piece.ny * canvas.height;
        const offX  = smoothRef.current.x * piece.depth;
        const offY  = smoothRef.current.y * piece.depth;

        ctx.save();
        ctx.translate(baseX + offX, baseY + offY);
        ctx.strokeStyle = '#f0ece4';
        ctx.fillStyle   = '#f0ece4';
        ctx.globalAlpha = piece.opacity;

        const t2 = t + piece.phase;

        switch (piece.type) {
          case 'gridFragment': drawGridFragment(ctx, t2, piece.opacity); break;
          case 'signalLine':   drawSignalLine(ctx, t2, piece.opacity);   break;
          case 'dotCluster':   drawDotCluster(ctx, t2, piece.opacity, piece.dots!); break;
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
