"use client";
import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  pulse: number;
  pulseSpeed: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  angle: number;
}

const COLORS = ['#0A84FF', '#5E5CE6', '#30D158', '#64D2FF', '#BF5AF2'];

export default function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    let shootingStars: ShootingStar[] = [];
    let frame = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      const count = Math.floor((canvas.width * canvas.height) / 7000);
      particles = Array.from({ length: Math.min(count, 120) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.8 + 0.4,
        opacity: Math.random() * 0.5 + 0.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#0A84FF',
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      }));
    };

    const spawnShootingStar = () => {
      shootingStars.push({
        x: Math.random() * canvas.width * 0.6,
        y: Math.random() * canvas.height * 0.4,
        length: Math.random() * 180 + 80,
        speed: Math.random() * 10 + 6,
        opacity: 1,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.4,
      });
    };

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r},${g},${b}`;
    };

    const draw = () => {
      // Fade trail effect
      ctx.fillStyle = 'rgba(8, 10, 18, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      frame++;
      if (frame % 200 === 0 && Math.random() > 0.4) spawnShootingStar();

      // Draw connections between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          if (!p1 || !p2) continue;
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            const alpha = 0.18 * (1 - dist / 130);
            ctx.beginPath();
            ctx.strokeStyle = `rgba(10,132,255,${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw and update particles
      for (const p of particles) {
        p.pulse += p.pulseSpeed;
        const pulsedOpacity = p.opacity + Math.sin(p.pulse) * 0.15;
        const pulsedSize = p.size + Math.sin(p.pulse * 1.3) * 0.3;

        // Glow
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulsedSize * 4);
        grd.addColorStop(0, `rgba(${hexToRgb(p.color)},${pulsedOpacity.toFixed(2)})`);
        grd.addColorStop(1, `rgba(${hexToRgb(p.color)},0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulsedSize * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulsedSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${hexToRgb(p.color)},${Math.min(pulsedOpacity + 0.3, 1).toFixed(2)})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }

      // Shooting stars
      shootingStars = shootingStars.filter(s => s.opacity > 0);
      for (const s of shootingStars) {
        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${s.opacity.toFixed(2)})`);
        grad.addColorStop(0.4, `rgba(120,180,255,${(s.opacity * 0.6).toFixed(2)})`);
        grad.addColorStop(1, 'rgba(120,180,255,0)');
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Head sparkle
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.opacity.toFixed(2)})`;
        ctx.fill();

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.opacity -= 0.012;
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    // Fill solid dark on first frame
    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
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
