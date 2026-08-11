"use client";
import { useEffect, useRef } from 'react';
import { sample } from './perlin';

// Advanced Graphics: Perlin Flow Field
// A fluid, high-performance particle system based on a Perlin-like flow field.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
}

const THEMES: Record<string, string[]> = {
  multicolor: ['#0A84FF', '#5E5CE6', '#30D158', '#64D2FF', '#BF5AF2'],
  emerald:    ['#30D158', '#34C759', '#00C7BE', '#32D74B'],
  ocean:      ['#0A84FF', '#64D2FF', '#0040DD', '#007AFF'],
  cyberpunk:  ['#BF5AF2', '#FF2D55', '#FF375F', '#D30DF2'],
  mono:       ['#64748B', '#475569', '#334155', '#94A3B8'],
};

export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
const mouse = {
  x: -1000,
  y: -1000,
  vx: 0,
  vy: 0,
  radius: 250,
  isMoving: false,
};
let mouseTimeout: number;
    let scrollY = 0;

    const getColors = (): string[] => {
      if (typeof window === 'undefined') return THEMES.multicolor ?? ['#0A84FF'];
      const themeId = document.documentElement.getAttribute('data-bg-theme') || 'multicolor';
      return THEMES[themeId] ?? THEMES.multicolor ?? ['#0A84FF'];
    };

    const init = () => {
      const colors = getColors();
      particles = Array.from({ length: 150 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 0,
        vy: 0,
        alpha: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const onScroll = () => {
  scrollY = window.scrollY;
};

const onMouseMove = (e: MouseEvent) => {
  const dx = e.clientX - mouse.x;
  const dy = e.clientY - mouse.y;
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.vx = dx;
  mouse.vy = dy;
  mouse.isMoving = true;
  clearTimeout(mouseTimeout);
  mouseTimeout = setTimeout(() => {
    mouse.isMoving = false;
    mouse.vx = 0;
    mouse.vy = 0;
  }, 100);
};

const onMouseLeave = () => {
  mouse.x = -1000;
  mouse.y = -1000;
  mouse.vx = 0;
  mouse.vy = 0;
  mouse.isMoving = false;
};

    const draw = () => {
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  particles.forEach(p => {
    // Perlin flow field influence
    const flow = sample(p.x, p.y, 0.003);
    p.vx += flow.dx * 0.3;
    p.vy += flow.dy * 0.3;

    // Mouse interaction (vortex & repulsion)
    const dx = mouse.x - p.x;
    const dy = mouse.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < mouse.radius) {
      const force = (mouse.radius - dist) / mouse.radius;
      if (mouse.isMoving) {
        p.vx -= mouse.vx * force * 0.02;
        p.vy -= mouse.vy * force * 0.02;
      } else {
        p.vx += (dx / dist) * force * 0.02;
        p.vy += (dy / dist) * force * 0.02;
      }
    }

    // Friction and slight random drift
    p.vx *= 0.96;
    p.vy *= 0.96;
    p.x += p.vx + (Math.random() - 0.5) * 0.2;
    p.y += p.vy + (Math.random() - 0.5) * 0.2;

    // Wrap around bounds
    if (p.x < 0) p.x = canvas.width;
    if (p.x > canvas.width) p.x = 0;
    if (p.y < 0) p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;

    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  animationId = requestAnimationFrame(draw);
};

    resize();
    draw();

    window.addEventListener('resize', resize);
window.addEventListener('scroll', onScroll);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseleave', onMouseLeave);

    return () => {
      window.removeEventListener('resize', resize);
window.removeEventListener('scroll', onScroll);
window.removeEventListener('mousemove', onMouseMove);
window.removeEventListener('mouseleave', onMouseLeave);
cancelAnimationFrame(animationId);
clearTimeout(mouseTimeout);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
