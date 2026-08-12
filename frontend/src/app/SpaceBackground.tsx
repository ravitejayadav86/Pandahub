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
  colorRgb: string;
  pulse: number;
  pulseSpeed: number;
  baseVx: number;
  baseVy: number;
  depth: number; // 0-1: parallax depth
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  angle: number;
}

interface DepthOrb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  colorRgb: string;
  opacity: number;
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
    let particles: Particle[]     = [];
    let shootingStars: ShootingStar[] = [];
    let depthOrbs: DepthOrb[]     = [];
    let frame = 0;

    // Smooth LERP mouse tracking
    const mouse = {
      x: -2000,
      y: -2000,
      targetX: -2000,
      targetY: -2000,
      radius: 220,
    };

    const getColors = (): string[] => {
      if (typeof window === 'undefined') return THEMES.multicolor ?? ['#0A84FF'];
      const themeId = document.documentElement.getAttribute('data-bg-theme') || 'multicolor';
      return THEMES[themeId] ?? THEMES.multicolor ?? ['#0A84FF'];
    };

    const isDark = () => {
      if (typeof window === 'undefined') return false;
      return document.documentElement.classList.contains('dark') ||
             document.body.classList.contains('dark');
    };

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `${r},${g},${b}`;
    };

    /* ── Initialise particles ── */
    const init = () => {
      const colors = getColors();
      const count = Math.min(Math.floor((canvas.width * canvas.height) / 7500), 110);

      particles = Array.from({ length: count }, () => {
        const vx = (Math.random() - 0.5) * 0.14;
        const vy = -Math.random() * 0.22 - 0.08;
        const depth = Math.random(); // 0 = far, 1 = near
        const colorHex = colors[Math.floor(Math.random() * colors.length)] ?? '#0A84FF';
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx, vy, baseVx: vx, baseVy: vy,
          // Near particles are bigger and more opaque (Spatial depth)
          size: 0.5 + depth * 2.5,
          opacity: 0.10 + depth * 0.45,
          color: colorHex,
          colorRgb: hexToRgb(colorHex),
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: 0.005 + Math.random() * 0.012,
          depth,
        };
      });

      /* ── Depth orbs — large diffuse blobs (Spatial Glassmorphism) ── */
      depthOrbs = [
        {
          x: canvas.width * 0.15,
          y: canvas.height * 0.2,
          vx:  0.18,
          vy:  0.10,
          radius: Math.min(canvas.width, canvas.height) * 0.28,
          color: '#0A84FF',
          colorRgb: hexToRgb('#0A84FF'),
          opacity: isDark() ? 0.040 : 0.025,
        },
        {
          x: canvas.width * 0.8,
          y: canvas.height * 0.65,
          vx: -0.14,
          vy: -0.08,
          radius: Math.min(canvas.width, canvas.height) * 0.24,
          color: '#BF5AF2',
          colorRgb: hexToRgb('#BF5AF2'),
          opacity: isDark() ? 0.038 : 0.022,
        },
        {
          x: canvas.width * 0.5,
          y: canvas.height * 0.85,
          vx: 0.10,
          vy: -0.12,
          radius: Math.min(canvas.width, canvas.height) * 0.20,
          color: '#30D158',
          colorRgb: hexToRgb('#30D158'),
          opacity: isDark() ? 0.030 : 0.018,
        },
      ];
    };

    /* ── Shooting star spawn ── */
    const spawnShootingStar = () => {
      shootingStars.push({
        x: Math.random() * canvas.width * 0.65,
        y: Math.random() * canvas.height * 0.45,
        length: 90 + Math.random() * 200,
        speed: 7 + Math.random() * 12,
        opacity: 1,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.45,
      });
    };

    /* ── Resize ── */
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    /* ── Mouse events ── */
    const onMouseMove  = (e: MouseEvent) => { mouse.targetX = e.clientX; mouse.targetY = e.clientY; };
    const onMouseLeave = ()               => { mouse.targetX = -2000;    mouse.targetY = -2000; };

    /* ── Update particle colors on theme change ── */
    const updateColors = () => {
      const colors = getColors();
      for (const p of particles) {
        const newColor = colors[Math.floor(Math.random() * colors.length)] ?? '#0A84FF';
        p.color = newColor;
        p.colorRgb = hexToRgb(newColor);
      }
    };

    /* ══════════════════════════════════════════════
       MAIN DRAW LOOP
    ══════════════════════════════════════════════ */
    const draw = () => {
      const dark = isDark();

      // LERP mouse
      if (mouse.targetX === -2000) {
        mouse.x += (-2000 - mouse.x) * 0.08;
        mouse.y += (-2000 - mouse.y) * 0.08;
      } else {
        mouse.x += (mouse.targetX - mouse.x) * 0.07;
        mouse.y += (mouse.targetY - mouse.y) * 0.07;
      }

      // Fade trail (lower alpha = longer comet trails)
      ctx.fillStyle = dark
        ? 'rgba(6, 8, 16, 0.18)'
        : 'rgba(240, 245, 255, 0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      frame++;
      if (frame % 180 === 0 && Math.random() > 0.35) spawnShootingStar();

      /* ── 1. Depth Orbs (Spatial glow layers behind everything) ── */
      for (const orb of depthOrbs) {
        const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.radius);
        grad.addColorStop(0,   `rgba(${orb.colorRgb},${orb.opacity})`);
        grad.addColorStop(0.5, `rgba(${orb.colorRgb},${(orb.opacity * 0.4).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${orb.colorRgb},0)`);

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Slowly drift
        orb.x += orb.vx;
        orb.y += orb.vy;

        // Bounce off walls
        if (orb.x < -orb.radius)               { orb.x = -orb.radius;              orb.vx *= -1; }
        if (orb.x > canvas.width + orb.radius)  { orb.x = canvas.width + orb.radius; orb.vx *= -1; }
        if (orb.y < -orb.radius)               { orb.y = -orb.radius;              orb.vy *= -1; }
        if (orb.y > canvas.height + orb.radius) { orb.y = canvas.height + orb.radius; orb.vy *= -1; }
      }

      /* ── 2. Particle connections (depth-aware alpha) ── */
      const maxDist = 120;
      const maxDistSq = maxDist * maxDist;
      
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]!;
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy;
          
          if (distSq < maxDistSq) {
            const dist = Math.sqrt(distSq);
            // Deeper (farther) particles have dimmer connections
            const depthAlpha = (p1.depth + p2.depth) / 2;
            const alpha = (dark ? 0.18 : 0.09) * depthAlpha * (1 - dist / maxDist);
            ctx.beginPath();
            ctx.strokeStyle = dark
              ? `rgba(10,132,255,${alpha.toFixed(3)})`
              : `rgba(0,80,200,${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.5 * depthAlpha;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      /* ── 3. Particles (Spatial — depth-scaled) ── */
      for (const p of particles) {
        p.pulse += p.pulseSpeed;
        const pulsedOpacity = Math.min(p.opacity + Math.sin(p.pulse) * 0.14, 1);
        const pulsedSize    = p.size + Math.sin(p.pulse) * (0.15 * p.depth);

        // Mouse repulsion (near particles react more)
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distSq = dx * dx + dy * dy;
        const effectRadius = mouse.radius * (0.6 + p.depth * 0.6);
        const effectRadiusSq = effectRadius * effectRadius;

        if (distSq < effectRadiusSq) {
          const dist = Math.sqrt(distSq);
          const force = ((effectRadius - dist) / effectRadius) * p.depth;
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force * 0.38;
          p.vy += Math.sin(angle) * force * 0.38;
        } else {
          p.vx += (p.baseVx - p.vx) * 0.025;
          p.vy += (p.baseVy - p.vy) * 0.025;
        }

        // Draw with optional glow for near particles
        if (p.depth > 0.7) {
          const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, pulsedSize * 4);
          glowGrad.addColorStop(0, `rgba(${p.colorRgb},${(pulsedOpacity * 0.8).toFixed(2)})`);
          glowGrad.addColorStop(1, `rgba(${p.colorRgb},0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, pulsedSize * 4, 0, Math.PI * 2);
          ctx.fillStyle = glowGrad;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(pulsedSize, 0.1), 0, Math.PI * 2);
        const extraOpacity = dark ? 0.28 : 0.06;
        ctx.fillStyle = `rgba(${p.colorRgb},${Math.min(pulsedOpacity + extraOpacity, 1).toFixed(2)})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) { p.y = 0; p.x = Math.random() * canvas.width; }
      }

      /* ── 4. Shooting stars ── */
      shootingStars = shootingStars.filter(s => s.opacity > 0);
      for (const s of shootingStars) {
        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;
        const grad  = ctx.createLinearGradient(s.x, s.y, tailX, tailY);

        if (dark) {
          grad.addColorStop(0,   `rgba(255,255,255,${s.opacity.toFixed(2)})`);
          grad.addColorStop(0.3, `rgba(140,190,255,${(s.opacity * 0.6).toFixed(2)})`);
          grad.addColorStop(1,   'rgba(140,190,255,0)');
        } else {
          grad.addColorStop(0,   `rgba(10,132,255,${s.opacity.toFixed(2)})`);
          grad.addColorStop(0.3, `rgba(94,92,230,${(s.opacity * 0.6).toFixed(2)})`);
          grad.addColorStop(1,   'rgba(94,92,230,0)');
        }

        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1.8;
        ctx.lineCap     = 'round';
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();

        // Head sparkle
        ctx.beginPath();
        ctx.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = dark
          ? `rgba(255,255,255,${s.opacity.toFixed(2)})`
          : `rgba(10,132,255,${s.opacity.toFixed(2)})`;
        ctx.fill();

        s.x      += Math.cos(s.angle) * s.speed;
        s.y      += Math.sin(s.angle) * s.speed;
        s.opacity -= 0.011;
      }

      /* ── 5. Mouse ambient glow ── */
      if (mouse.x > -1000) {
        const aGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 140);
        aGlow.addColorStop(0,   dark ? 'rgba(10,132,255,0.06)'  : 'rgba(10,132,255,0.04)');
        aGlow.addColorStop(0.5, dark ? 'rgba(124,58,237,0.03)'  : 'rgba(124,58,237,0.02)');
        aGlow.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 140, 0, Math.PI * 2);
        ctx.fillStyle = aGlow;
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    // Kick off
    resize();
    ctx.fillStyle = isDark() ? '#060810' : '#eef2f7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();

    window.addEventListener('resize',     resize);
    window.addEventListener('mousemove',  onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    // Watch for theme / dark-mode changes
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.attributeName === 'data-bg-theme') updateColors();
        if (m.attributeName === 'class') {
          for (const orb of depthOrbs) {
            orb.opacity = isDark() ? 0.040 : 0.025;
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-bg-theme'] });

    return () => {
      window.removeEventListener('resize',     resize);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      observer.disconnect();
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
