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
  baseVx: number;
  baseVy: number;
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
    
    // Mouse positioning for interactive motion detection
    const mouse = {
      x: -1000,
      y: -1000,
      radius: 180 // detection radius
    };

    const isDarkMode = () => {
      if (typeof window === 'undefined') return false;
      return document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      const count = Math.floor((canvas.width * canvas.height) / 7000);
      particles = Array.from({ length: Math.min(count, 120) }, () => {
        // Antigravity upward bias drift
        const vx = (Math.random() - 0.5) * 0.2;
        const vy = -Math.random() * 0.3 - 0.1; // Floating upwards
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx,
          vy,
          baseVx: vx,
          baseVy: vy,
          size: Math.random() * 2.2 + 0.6,
          opacity: Math.random() * 0.5 + 0.2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#0A84FF',
          pulse: Math.random() * Math.PI * 2,
          pulseSpeed: Math.random() * 0.02 + 0.005,
        };
      });
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

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const draw = () => {
      const dark = isDarkMode();
      
      // Fade trail effect
      ctx.fillStyle = dark ? 'rgba(8, 10, 18, 0.18)' : 'rgba(255, 255, 255, 0.18)';
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
            const alpha = (dark ? 0.18 : 0.09) * (1 - dist / 130);
            ctx.beginPath();
            ctx.strokeStyle = dark 
              ? `rgba(10,132,255,${alpha.toFixed(3)})`
              : `rgba(0,100,255,${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        p.pulse += p.pulseSpeed;
        const pulsedOpacity = p.opacity + Math.sin(p.pulse) * 0.15;
        const pulsedSize = p.size + Math.sin(p.pulse) * 0.2;

        // Antigravity Motion Detection (Push away from cursor)
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < mouse.radius) {
          const force = (mouse.radius - distance) / mouse.radius; // 0 to 1
          const angle = Math.atan2(dy, dx);
          
          // Add repulsion velocity
          p.vx += Math.cos(angle) * force * 0.6;
          p.vy += Math.sin(angle) * force * 0.6;
        } else {
          // Slow recovery back to base antigravity upward velocities
          p.vx += (p.baseVx - p.vx) * 0.04;
          p.vy += (p.baseVy - p.vy) * 0.04;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(pulsedSize, 0.1), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${hexToRgb(p.color)},${Math.min(pulsedOpacity + (dark ? 0.3 : 0.1), 1).toFixed(2)})`;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        // Wrap around borders
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) {
          p.y = 0;
          p.x = Math.random() * canvas.width;
        }
      }

      // Shooting stars
      shootingStars = shootingStars.filter(s => s.opacity > 0);
      for (const s of shootingStars) {
        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        
        if (dark) {
          grad.addColorStop(0, `rgba(255,255,255,${s.opacity.toFixed(2)})`);
          grad.addColorStop(0.4, `rgba(120,180,255,${(s.opacity * 0.6).toFixed(2)})`);
          grad.addColorStop(1, 'rgba(120,180,255,0)');
        } else {
          grad.addColorStop(0, `rgba(10,132,255,${s.opacity.toFixed(2)})`);
          grad.addColorStop(0.4, `rgba(94,92,230,${(s.opacity * 0.6).toFixed(2)})`);
          grad.addColorStop(1, 'rgba(94,92,230,0)');
        }
        
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
        ctx.fillStyle = dark 
          ? `rgba(255,255,255,${s.opacity.toFixed(2)})`
          : `rgba(10,132,255,${s.opacity.toFixed(2)})`;
        ctx.fill();

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.opacity -= 0.012;
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    // Fill solid base color on first frame
    ctx.fillStyle = isDarkMode() ? '#080a12' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    draw();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    
    // Set up MutationObserver to track theme shifts (e.g. settings)
    const observer = new MutationObserver(() => {});
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      observer.disconnect();
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden="true"
    />
  );
}
