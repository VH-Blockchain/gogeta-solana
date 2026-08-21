import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  angle: number;
  speed: number;
  size: number;
  color: string;
  rotSpeed: number;
  delay: number;
}

/**
 * Lightweight confetti burst for win / level-up / lucky-winner moments.
 * Self-contained canvas animation — no external packages. A direct port of
 * `ConfettiBurst`/`_ConfettiPainter`, including its seeded RNG so the burst
 * looks the same as the Flutter app's.
 */
export function ConfettiBurst({
  count = 90,
  colors,
  loop = false,
}: {
  count?: number;
  colors: string[];
  loop?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    // Flutter's math.Random(7) — a fixed seed, reproduced with a small LCG so
    // the particle field is stable across renders.
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const particles: Particle[] = Array.from({ length: count }, (_, i) => ({
      x: random(),
      angle: random() * Math.PI * 2,
      speed: 0.6 + random() * 0.9,
      size: 5 + random() * 7,
      color: colors[i % colors.length],
      rotSpeed: (random() - 0.5) * 8,
      delay: random() * 0.3,
    }));

    const DURATION_MS = 2600;
    let raf = 0;
    let start = performance.now();
    let dpr = window.devicePixelRatio || 1;

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (now: number) => {
      const elapsed = now - start;
      let t = elapsed / DURATION_MS;
      if (t >= 1) {
        if (loop) {
          start = now;
          t = 0;
        } else {
          t = 1;
        }
      }

      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        const lt = Math.min(Math.max((t - p.delay) / (1 - p.delay), 0), 1);
        if (lt <= 0) continue;
        const startX = w * p.x;
        const dx = Math.cos(p.angle) * p.speed * w * 0.4 * lt;
        const dy = lt * h * (0.5 + p.speed) - Math.sin(lt * Math.PI) * 40;
        const px = startX + dx;
        const py = -20 + dy;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.rotSpeed * lt);
        ctx.globalAlpha = Math.min(Math.max(1 - lt, 0), 1);
        ctx.fillStyle = p.color;
        roundRect(ctx, -p.size / 2, -(p.size * 0.6) / 2, p.size, p.size * 0.6, 2);
        ctx.fill();
        ctx.restore();
      }

      if (t < 1 || loop) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [count, colors, loop]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
