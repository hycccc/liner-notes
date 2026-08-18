'use client';

import { useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { X } from 'lucide-react';

interface EasterEggProps {
  onClose: () => void;
  isDark: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  alpha: number;
}

interface DiscoTile {
  left: number;
  top: number;
  hue: number;
  size: number;
  duration: number;
  delay: number;
}

interface ConfettiPiece {
  left: number;
  hue: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
}

interface MatrixColumn {
  left: number;
  duration: number;
  delay: number;
  fontSize: number;
  content: string;
}

type DancePhase =
  | 'build404'
  | 'hold404'
  | 'explode404'
  | 'buildFound'
  | 'holdFound'
  | 'explodeFound';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const MATRIX_CHARS = '01アカサタナハマヤラワユメ∞#%$<>*';

const seededRandom = (seed: number) => {
  const raw = Math.sin(seed * 12.9898 + 78.233) * 43758.5453123;
  return raw - Math.floor(raw);
};

const generateMatrixText = (seedBase: number) => {
  return Array.from({ length: 20 }, (_, index) => {
    const seed = seedBase * 97 + index * 31 + 11;
    const charIndex = Math.floor(seededRandom(seed) * MATRIX_CHARS.length);
    return MATRIX_CHARS[charIndex];
  }).join('');
};

const getPhase = (elapsed: number): DancePhase => {
  const cycle = elapsed % 14000;
  if (cycle < 3000) return 'build404';
  if (cycle < 4500) return 'hold404';
  if (cycle < 6200) return 'explode404';
  if (cycle < 9200) return 'buildFound';
  if (cycle < 11000) return 'holdFound';
  return 'explodeFound';
};

export default function EasterEgg({ onClose, isDark }: EasterEggProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dancerRef = useRef<HTMLDivElement>(null);

  const discoTiles = useMemo<DiscoTile[]>(
    () =>
      Array.from({ length: 52 }, (_, index) => ({
        left: seededRandom(index * 3 + 1) * 100,
        top: seededRandom(index * 5 + 2) * 100,
        hue: Math.floor(seededRandom(index * 7 + 3) * 360),
        size: 20 + seededRandom(index * 11 + 4) * 48,
        duration: 0.9 + seededRandom(index * 13 + 5) * 2.1,
        delay: seededRandom(index * 17 + 6) * 2.6,
      })),
    []
  );

  const confetti = useMemo<ConfettiPiece[]>(
    () =>
      Array.from({ length: 72 }, (_, index) => ({
        left: seededRandom(index * 3 + 9) * 100,
        hue: Math.floor(seededRandom(index * 7 + 10) * 360),
        size: 6 + seededRandom(index * 11 + 12) * 14,
        duration: 4.5 + seededRandom(index * 13 + 13) * 5.5,
        delay: seededRandom(index * 17 + 14) * 5.5,
        drift: -12 + seededRandom(index * 19 + 15) * 24,
      })),
    []
  );

  const matrixColumns = useMemo<MatrixColumn[]>(
    () =>
      Array.from({ length: 24 }, (_, index) => ({
        left: seededRandom(index * 3 + 18) * 100,
        duration: 5.5 + seededRandom(index * 5 + 19) * 6,
        delay: seededRandom(index * 7 + 20) * 3.5,
        fontSize: 12 + seededRandom(index * 11 + 21) * 8,
        content: generateMatrixText(index + 1),
      })),
    []
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [onClose]);

  useEffect(() => {
    if (!dancerRef.current) return;

    const dancer = dancerRef.current;
    const pointer = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.7 };
    const position = { x: window.innerWidth * 0.5, y: window.innerHeight * 0.7, vx: 0, vy: 0 };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      const firstTouch = event.touches[0];
      if (!firstTouch) return;
      pointer.x = firstTouch.clientX;
      pointer.y = firstTouch.clientY;
    };

    let rafId = 0;
    const animateDancer = (time: number) => {
      position.vx += (pointer.x - position.x) * 0.022;
      position.vy += (pointer.y - position.y) * 0.022;
      position.vx *= 0.84;
      position.vy *= 0.84;
      position.x += position.vx;
      position.y += position.vy;

      const bounce = Math.sin(time * 0.013) * 13;
      const rotate = Math.sin(time * 0.007) * 16;
      dancer.style.transform = `translate3d(${position.x}px, ${position.y + bounce}px, 0) rotate(${rotate}deg)`;
      rafId = window.requestAnimationFrame(animateDancer);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    rafId = window.requestAnimationFrame(animateDancer);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: Particle[] = [];
    let points404: Point[] = [];
    let pointsFound: Point[] = [];
    let width = 1;
    let height = 1;
    let prevPhase: DancePhase = 'build404';
    const startedAt = performance.now();

    const buildTextPoints = (text: string, yOffset = 0): Point[] => {
      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = width;
      tmpCanvas.height = height;
      const tmpCtx = tmpCanvas.getContext('2d');
      if (!tmpCtx) return [];

      const fontSize = clamp(width * 0.12, 56, 168);
      tmpCtx.clearRect(0, 0, width, height);
      tmpCtx.fillStyle = '#ffffff';
      tmpCtx.textAlign = 'center';
      tmpCtx.textBaseline = 'middle';
      tmpCtx.font = `900 ${fontSize}px "Arial Black", "SF Pro Display", system-ui, sans-serif`;
      tmpCtx.fillText(text, width / 2, height / 2 + yOffset);

      const { data } = tmpCtx.getImageData(0, 0, width, height);
      const points: Point[] = [];
      const step = clamp(Math.floor(width / 230), 4, 8);

      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const alpha = data[(y * width + x) * 4 + 3];
          if (alpha > 130) points.push({ x, y });
        }
      }

      return points;
    };

    const burst = (power: number) => {
      const centerX = width / 2;
      const centerY = height / 2;
      particles.forEach((particle) => {
        const angle = Math.atan2(particle.y - centerY, particle.x - centerX) + (Math.random() - 0.5) * 0.8;
        const speed = power * (0.6 + Math.random() * 0.9);
        particle.vx += Math.cos(angle) * speed;
        particle.vy += Math.sin(angle) * speed;
      });
    };

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      points404 = buildTextPoints('404 BORING', -height * 0.03);
      pointsFound = buildTextPoints('YOU FOUND ME', height * 0.07);

      const particleCount = clamp(Math.max(points404.length, 820), 820, 1600);
      particles.length = 0;

      for (let index = 0; index < particleCount; index += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 2.5,
          vy: (Math.random() - 0.5) * 2.5,
          size: 1.2 + Math.random() * 2.3,
          hue: Math.random() * 360,
          alpha: 0.35 + Math.random() * 0.6,
        });
      }
    };

    const renderAurora = (elapsed: number) => {
      for (let lane = 0; lane < 4; lane += 1) {
        ctx.beginPath();
        const baseY = height * (0.12 + lane * 0.2);
        for (let x = 0; x <= width; x += 16) {
          const wave =
            Math.sin(x * 0.007 + elapsed * 0.0015 + lane) * (22 + lane * 7) +
            Math.sin(x * 0.011 - elapsed * 0.0012 + lane * 2.2) * 14;
          const y = baseY + wave;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const hue = (elapsed * 0.03 + lane * 70) % 360;
        ctx.strokeStyle = `hsla(${hue}, 100%, 65%, 0.15)`;
        ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.35)`;
        ctx.shadowBlur = 24;
        ctx.lineWidth = 26 - lane * 4;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    };

    let rafId = 0;
    const animate = (timestamp: number) => {
      const elapsed = timestamp - startedAt;
      const phase = getPhase(elapsed);
      if (phase !== prevPhase) {
        if (phase === 'explode404') burst(5.2);
        if (phase === 'explodeFound') burst(6.1);
        prevPhase = phase;
      }

      const currentPoints = phase === 'buildFound' || phase === 'holdFound' || phase === 'explodeFound' ? pointsFound : points404;
      const hasTargets = currentPoints.length > 0;
      const isBuild = phase === 'build404' || phase === 'buildFound';
      const isHold = phase === 'hold404' || phase === 'holdFound';

      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, `hsla(${(elapsed * 0.02) % 360}, 100%, ${isDark ? 7 : 12}%, 0.94)`);
      background.addColorStop(0.6, `hsla(${(elapsed * 0.024 + 120) % 360}, 90%, ${isDark ? 11 : 16}%, 0.9)`);
      background.addColorStop(1, `hsla(${(elapsed * 0.019 + 240) % 360}, 85%, ${isDark ? 6 : 10}%, 0.96)`);
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      renderAurora(elapsed);

      ctx.save();
      ctx.globalAlpha = 0.17;
      ctx.font = `${Math.max(14, Math.floor(width / 80))}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = 'top';
      const columns = Math.floor(width / 30);
      for (let col = 0; col <= columns; col += 1) {
        const x = col * 30;
        const speed = 0.07 + (col % 6) * 0.016;
        const y = ((elapsed * speed + col * 120) % (height + 220)) - 220;
        for (let trail = 0; trail < 10; trail += 1) {
          const charIndex = Math.floor(elapsed / 40 + col * 3 + trail * 13) % MATRIX_CHARS.length;
          const alpha = 0.05 + (10 - trail) * 0.02;
          ctx.fillStyle = `hsla(${120 + ((col * 14 + trail * 9) % 120)}, 100%, 65%, ${alpha})`;
          ctx.fillText(MATRIX_CHARS[charIndex], x, y - trail * 18);
        }
      }
      ctx.restore();

      ctx.globalCompositeOperation = 'lighter';
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        const target = hasTargets ? currentPoints[index % currentPoints.length] : { x: width / 2, y: height / 2 };

        if (isBuild || isHold) {
          const wobbleX = Math.sin(elapsed * 0.004 + index * 0.09) * 2.4;
          const wobbleY = Math.cos(elapsed * 0.003 + index * 0.11) * 2.4;
          const attraction = isHold ? 0.042 : 0.021;
          const drag = isHold ? 0.77 : 0.89;

          particle.vx += (target.x + wobbleX - particle.x) * attraction;
          particle.vy += (target.y + wobbleY - particle.y) * attraction;
          particle.vx *= drag;
          particle.vy *= drag;
        } else {
          particle.vx += Math.sin(index * 0.2 + elapsed * 0.0012) * 0.07;
          particle.vy += Math.cos(index * 0.19 + elapsed * 0.0011) * 0.07;
          particle.vx *= 0.988;
          particle.vy *= 0.988;
        }

        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < -120) particle.x = width + 120;
        if (particle.x > width + 120) particle.x = -120;
        if (particle.y < -120) particle.y = height + 120;
        if (particle.y > height + 120) particle.y = -120;

        const hueOffset = phase === 'buildFound' || phase === 'holdFound' || phase === 'explodeFound' ? 110 : 0;
        const hue = (particle.hue + elapsed * 0.085 + hueOffset) % 360;
        ctx.fillStyle = `hsla(${hue}, 100%, 68%, ${particle.alpha})`;
        ctx.shadowColor = `hsla(${hue}, 100%, 68%, 0.85)`;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${clamp(width * 0.055, 24, 72)}px "Arial Black", system-ui, sans-serif`;
      ctx.fillStyle = `rgba(255, 255, 255, ${isHold ? 0.2 : 0.08})`;
      const message = phase === 'buildFound' || phase === 'holdFound' || phase === 'explodeFound' ? 'YOU FOUND ME' : '404 BORING';
      ctx.fillText(message, width / 2, height * 0.22);

      rafId = window.requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    rafId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(rafId);
    };
  }, [isDark]);

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden bg-zinc-950/95" role="dialog" aria-modal="true" aria-label="Secret Easter egg mode">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      <div className="pointer-events-none absolute inset-0">
        <div className={`egg-grid ${isDark ? 'egg-grid-dark' : 'egg-grid-light'}`} />

        {discoTiles.map((tile, index) => (
          <span
            key={`tile-${index}`}
            className="egg-tile"
            style={
              {
                '--egg-left': `${tile.left}%`,
                '--egg-top': `${tile.top}%`,
                '--egg-hue': `${tile.hue}`,
                '--egg-size': `${tile.size}px`,
                '--egg-duration': `${tile.duration}s`,
                '--egg-delay': `${tile.delay}s`,
              } as CSSProperties
            }
          />
        ))}

        {matrixColumns.map((column, index) => (
          <span
            key={`matrix-${index}`}
            className="egg-matrix"
            style={
              {
                '--egg-left': `${column.left}%`,
                '--egg-duration': `${column.duration}s`,
                '--egg-delay': `${column.delay}s`,
                '--egg-font-size': `${column.fontSize}px`,
              } as CSSProperties
            }
          >
            {column.content}
          </span>
        ))}

        {confetti.map((piece, index) => (
          <span
            key={`confetti-${index}`}
            className="egg-confetti"
            style={
              {
                '--egg-left': `${piece.left}%`,
                '--egg-hue': `${piece.hue}`,
                '--egg-size': `${piece.size}px`,
                '--egg-duration': `${piece.duration}s`,
                '--egg-delay': `${piece.delay}s`,
                '--egg-drift': `${piece.drift}vw`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="pointer-events-none absolute left-6 top-6 z-20">
        <p className="egg-kicker">SECRET MODE</p>
        <h2 className="egg-title">YOU FOUND ME</h2>
        <p className="egg-subtitle">404 BORING · Party protocol engaged</p>
      </div>

      <div
        ref={dancerRef}
        className="pointer-events-none absolute left-0 top-0 z-20 select-none text-4xl will-change-transform sm:text-5xl"
        aria-hidden="true"
      >
        🕺
      </div>

      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white transition hover:scale-110 hover:border-white/40 hover:bg-black/55"
        aria-label="Close Easter egg mode"
      >
        <X className="h-6 w-6" />
      </button>

      <style jsx>{`
        .egg-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
          background-size: 42px 42px;
          mix-blend-mode: screen;
          opacity: 0.38;
          animation: egg-grid-drift 14s linear infinite;
        }

        .egg-grid-dark {
          filter: hue-rotate(0deg) saturate(1.3);
        }

        .egg-grid-light {
          filter: hue-rotate(180deg) saturate(1.1);
          opacity: 0.28;
        }

        .egg-tile {
          position: absolute;
          left: var(--egg-left);
          top: var(--egg-top);
          width: var(--egg-size);
          height: var(--egg-size);
          border-radius: 10px;
          background: hsla(var(--egg-hue), 100%, 64%, 0.22);
          box-shadow: 0 0 12px hsla(var(--egg-hue), 100%, 64%, 0.33);
          animation: egg-tile-flash var(--egg-duration) steps(2, end) infinite;
          animation-delay: var(--egg-delay);
        }

        .egg-matrix {
          position: absolute;
          top: -30%;
          left: var(--egg-left);
          writing-mode: vertical-rl;
          font-size: var(--egg-font-size);
          letter-spacing: 0.16em;
          color: rgba(123, 255, 174, 0.55);
          text-shadow: 0 0 12px rgba(123, 255, 174, 0.55);
          opacity: 0.68;
          animation: egg-matrix-fall var(--egg-duration) linear infinite;
          animation-delay: var(--egg-delay);
        }

        .egg-confetti {
          position: absolute;
          top: -12vh;
          left: var(--egg-left);
          width: var(--egg-size);
          height: calc(var(--egg-size) * 0.45);
          border-radius: 999px;
          background: hsl(var(--egg-hue) 100% 62%);
          box-shadow: 0 0 10px hsl(var(--egg-hue) 100% 62% / 0.7);
          animation: egg-confetti-fall var(--egg-duration) linear infinite;
          animation-delay: var(--egg-delay);
          transform-origin: center;
        }

        .egg-kicker {
          margin: 0;
          font-size: 11px;
          letter-spacing: 0.42em;
          color: rgba(255, 255, 255, 0.75);
          text-transform: uppercase;
        }

        .egg-title {
          margin: 6px 0 0;
          font-size: clamp(1.9rem, 6.5vw, 4.8rem);
          font-weight: 900;
          line-height: 0.95;
          color: #ffffff;
          text-shadow:
            0 0 10px rgba(255, 255, 255, 0.55),
            0 0 30px rgba(138, 92, 255, 0.5),
            0 0 52px rgba(39, 216, 255, 0.45);
          animation: egg-title-glitch 1.9s infinite;
        }

        .egg-subtitle {
          margin: 10px 0 0;
          font-size: clamp(0.78rem, 1.8vw, 1rem);
          letter-spacing: 0.18em;
          color: rgba(255, 255, 255, 0.7);
          text-transform: uppercase;
        }

        @keyframes egg-grid-drift {
          0% {
            transform: translate3d(0, 0, 0);
          }
          100% {
            transform: translate3d(42px, 42px, 0);
          }
        }

        @keyframes egg-tile-flash {
          0%,
          100% {
            opacity: 0.08;
            transform: scale(0.88) rotate(0deg);
          }
          32% {
            opacity: 0.62;
            transform: scale(1.06) rotate(12deg);
          }
          68% {
            opacity: 0.22;
            transform: scale(0.95) rotate(-9deg);
          }
        }

        @keyframes egg-matrix-fall {
          0% {
            transform: translateY(-24vh);
            opacity: 0;
          }
          12% {
            opacity: 0.68;
          }
          100% {
            transform: translateY(145vh);
            opacity: 0;
          }
        }

        @keyframes egg-confetti-fall {
          0% {
            transform: translate3d(0, -6vh, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--egg-drift), 122vh, 0) rotate(820deg);
            opacity: 0;
          }
        }

        @keyframes egg-title-glitch {
          0%,
          100% {
            transform: translate3d(0, 0, 0);
          }
          15% {
            transform: translate3d(-2px, 1px, 0);
          }
          16% {
            transform: translate3d(2px, -1px, 0);
          }
          17% {
            transform: translate3d(0, 0, 0);
          }
          52% {
            transform: translate3d(1px, 0, 0);
          }
          53% {
            transform: translate3d(-1px, 1px, 0);
          }
          54% {
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>
    </div>
  );
}
