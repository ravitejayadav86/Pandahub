"use client";

import React, { useEffect, useRef } from "react";

interface NodePoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseX: number;
  baseY: number;
  size: number;
  alpha: number;
}

interface PulseWave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

const GRID_SIZE = 120;

export default function MotionDetectiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ── Pre-rendered Static Coordinate Crosses Offscreen Canvas ──
    let offscreenGrid: HTMLCanvasElement | null = null;
    const renderOffscreenGrid = () => {
      offscreenGrid = document.createElement("canvas");
      offscreenGrid.width = width * dpr;
      offscreenGrid.height = height * dpr;
      const oCtx = offscreenGrid.getContext("2d");
      if (!oCtx) return;
      oCtx.scale(dpr, dpr);
      oCtx.strokeStyle = "rgba(255, 255, 255, 0.035)";
      oCtx.lineWidth = 1;
      const cols = Math.ceil(width / GRID_SIZE);
      const rows = Math.ceil(height / GRID_SIZE);
      oCtx.beginPath();
      for (let c = 0; c <= cols; c++) {
        const gx = c * GRID_SIZE;
        for (let r = 0; r <= rows; r++) {
          const gy = r * GRID_SIZE;
          const arm = 3;
          oCtx.moveTo(gx - arm, gy);
          oCtx.lineTo(gx + arm, gy);
          oCtx.moveTo(gx, gy - arm);
          oCtx.lineTo(gx, gy + arm);
        }
      }
      oCtx.stroke();
    };

    const resize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
      renderOffscreenGrid();
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    // ── Mouse & Motion State ──
    let mouseX = width * 0.5;
    let mouseY = height * 0.4;
    let targetX = mouseX;
    let targetY = mouseY;
    let curVel = 0;
    let lastMoveTime = performance.now();
    let isTracking = false;
    let hasInteracted = false;
    let reticleAngle = 0;

    // ── Optimized Nodes Array ──
    const NODE_COUNT = Math.min(32, Math.floor((width * height) / 36000));
    const nodes: NodePoint[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      nodes.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 1.4 + 1,
        alpha: Math.random() * 0.3 + 0.15,
      });
    }

    // ── Pulse Waves ──
    const pulses: PulseWave[] = [];
    let lastPulseTime = 0;

    const onPointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      hasInteracted = true;
      lastMoveTime = performance.now();
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        targetX = touch.clientX;
        targetY = touch.clientY;
        hasInteracted = true;
        lastMoveTime = performance.now();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    let scanLineY = 0;

    // ── Animation Loop ──
    let lastFrameTime = performance.now();

    const loop = (now: number) => {
      animId = requestAnimationFrame(loop);

      const dt = Math.min(50, now - lastFrameTime);
      lastFrameTime = now;

      // Smooth cursor lerp
      const prevX = mouseX;
      const prevY = mouseY;
      mouseX += (targetX - mouseX) * 0.14;
      mouseY += (targetY - mouseY) * 0.14;

      // Compute instantaneous motion velocity
      const instVel = Math.hypot(mouseX - prevX, mouseY - prevY);
      curVel += (instVel - curVel) * 0.12;

      isTracking = now - lastMoveTime < 600 && curVel > 0.4;
      reticleAngle += 0.012 + curVel * 0.008;

      // Trigger radar pulse when motion velocity spikes
      if (isTracking && curVel > 2.5 && now - lastPulseTime > 260) {
        pulses.push({
          x: mouseX,
          y: mouseY,
          r: 10,
          maxR: Math.min(180, 50 + curVel * 16),
          alpha: 0.35,
        });
        lastPulseTime = now;
        if (pulses.length > 6) pulses.shift();
      }

      // Clear frame
      ctx.clearRect(0, 0, width, height);

      // ── 1. Coordinate Background Grid (Blit from Offscreen Canvas in 1 call) ──
      if (offscreenGrid) {
        ctx.drawImage(offscreenGrid, 0, 0, width, height);
      }

      // Proximity highlight crosses near cursor (only 3-4 crosses max)
      if (hasInteracted) {
        const cStart = Math.max(0, Math.floor((mouseX - 180) / GRID_SIZE));
        const cEnd = Math.min(Math.ceil(width / GRID_SIZE), Math.ceil((mouseX + 180) / GRID_SIZE));
        const rStart = Math.max(0, Math.floor((mouseY - 180) / GRID_SIZE));
        const rEnd = Math.min(Math.ceil(height / GRID_SIZE), Math.ceil((mouseY + 180) / GRID_SIZE));

        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = cStart; c <= cEnd; c++) {
          const gx = c * GRID_SIZE;
          for (let r = rStart; r <= rEnd; r++) {
            const gy = r * GRID_SIZE;
            const distToMouse = Math.hypot(gx - mouseX, gy - mouseY);
            if (distToMouse < 180) {
              const arm = 5;
              ctx.moveTo(gx - arm, gy);
              ctx.lineTo(gx + arm, gy);
              ctx.moveTo(gx, gy - arm);
              ctx.lineTo(gx, gy + arm);
            }
          }
        }
        ctx.stroke();
      }

      // ── 2. Laser Detective Scanner Beam ──
      scanLineY = (scanLineY + 0.65) % (height + 100);
      const scanY = scanLineY - 50;
      if (scanY >= 0 && scanY <= height) {
        const grad = ctx.createLinearGradient(0, scanY, width, scanY);
        grad.addColorStop(0, "rgba(255, 255, 255, 0)");
        grad.addColorStop(0.3, "rgba(255, 255, 255, 0.05)");
        grad.addColorStop(0.5, "rgba(255, 255, 255, 0.12)");
        grad.addColorStop(0.7, "rgba(255, 255, 255, 0.05)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");

        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(width, scanY);
        ctx.stroke();
      }

      // ── 3. Radar Pulse Waves (from motion events) ──
      if (pulses.length > 0) {
        for (let i = pulses.length - 1; i >= 0; i--) {
          const p = pulses[i];
          if (!p) continue;
          p.r += 2.2;
          p.alpha *= 0.96;

          ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();

          if (p.r >= p.maxR || p.alpha <= 0.01) {
            pulses.splice(i, 1);
          }
        }
      }

      // ── 4. Tactical Nodes & Detective Interconnection Web (Batched) ──
      const effectRadius = 140;

      // Update positions
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n) continue;
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < 0) n.x = width;
        if (n.x > width) n.x = 0;
        if (n.y < 0) n.y = height;
        if (n.y > height) n.y = 0;

        const dx = n.x - mouseX;
        const dy = n.y - mouseY;
        const dist = Math.hypot(dx, dy);

        if (dist < effectRadius && dist > 1) {
          const force = (1 - dist / effectRadius) * 2;
          n.x += (dx / dist) * force;
          n.y += (dy / dist) * force;
        }
      }

      // Batch all line strokes into 1 single call
      ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        if (!n1) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const n2 = nodes[j];
          if (!n2) continue;
          const d2 = Math.hypot(n1.x - n2.x, n1.y - n2.y);
          if (d2 < 90) {
            ctx.moveTo(n1.x, n1.y);
            ctx.lineTo(n2.x, n2.y);
          }
        }
      }
      ctx.stroke();

      // Batch all node points into 1 single call
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.beginPath();
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (!n) continue;
        ctx.moveTo(n.x + n.size, n.y);
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
      }
      ctx.fill();

      // ── 5. Motion Detective Reticle & Telemetry HUD ──
      if (hasInteracted) {
        const reticleR = Math.max(18, Math.min(42, 22 + curVel * 1.2));

        ctx.save();
        ctx.translate(mouseX, mouseY);

        // Rotating outer segmented brackets
        ctx.rotate(reticleAngle);
        ctx.strokeStyle = isTracking
          ? "rgba(255, 255, 255, 0.45)"
          : "rgba(255, 255, 255, 0.20)";
        ctx.lineWidth = 1;

        // 4 Segmented Ring Arcs
        const segCount = 4;
        const arcLen = (Math.PI * 2) / segCount;
        for (let s = 0; s < segCount; s++) {
          const startAngle = s * arcLen + 0.2;
          const endAngle = (s + 1) * arcLen - 0.2;
          ctx.beginPath();
          ctx.arc(0, 0, reticleR, startAngle, endAngle);
          ctx.stroke();
        }

        // Center Crosshair
        ctx.rotate(-reticleAngle); // unrotate crosshair
        ctx.strokeStyle = isTracking
          ? "rgba(255, 255, 255, 0.65)"
          : "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1;

        const chGap = 4;
        const chLen = 12;
        ctx.beginPath();
        // Top
        ctx.moveTo(0, -chGap);
        ctx.lineTo(0, -chGap - chLen);
        // Bottom
        ctx.moveTo(0, chGap);
        ctx.lineTo(0, chGap + chLen);
        // Left
        ctx.moveTo(-chGap, 0);
        ctx.lineTo(-chGap - chLen, 0);
        // Right
        ctx.moveTo(chGap, 0);
        ctx.lineTo(chGap + chLen, 0);
        ctx.stroke();

        // Detective Box Corner Brackets
        const boxSize = reticleR + 10;
        const bCorner = 6;
        ctx.strokeStyle = isTracking
          ? "rgba(255, 255, 255, 0.4)"
          : "rgba(255, 255, 255, 0.15)";
        ctx.beginPath();
        // Top-left
        ctx.moveTo(-boxSize, -boxSize + bCorner);
        ctx.lineTo(-boxSize, -boxSize);
        ctx.lineTo(-boxSize + bCorner, -boxSize);
        // Top-right
        ctx.moveTo(boxSize - bCorner, -boxSize);
        ctx.lineTo(boxSize, -boxSize);
        ctx.lineTo(boxSize - bCorner, -boxSize);
        // Bottom-right
        ctx.moveTo(boxSize, boxSize - bCorner);
        ctx.lineTo(boxSize, boxSize);
        ctx.lineTo(boxSize - bCorner, boxSize);
        // Bottom-left
        ctx.moveTo(-boxSize + bCorner, boxSize);
        ctx.lineTo(-boxSize, boxSize);
        ctx.lineTo(-boxSize, boxSize - bCorner);
        ctx.stroke();

        // Telemetry readout (crisp monochrome monospace font)
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillStyle = isTracking
          ? "rgba(255, 255, 255, 0.70)"
          : "rgba(255, 255, 255, 0.35)";

        const textX = boxSize + 8;
        const statusText = isTracking ? "MOTION: ACTIVE" : "IDLE SCAN";
        const coordText = `LOC: [${Math.round(mouseX)}, ${Math.round(mouseY)}]`;
        const velText = `VEL: ${Math.round(curVel * 18)} PX/S`;

        ctx.fillText(statusText, textX, -10);
        ctx.fillText(coordText, textX, 2);
        ctx.fillText(velText, textX, 14);

        ctx.restore();
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
