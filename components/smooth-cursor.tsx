"use client";

import { useEffect, useRef } from "react";

type TrailPoint = {
  x: number;
  y: number;
  time: number;
};

type DrawBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const CURSOR_RADIUS = 5;
const FOLLOW_RATE = 13;
const TRAIL_LIFETIME = 280;
const MAX_TRAIL_POINTS = 28;

export function SmoothCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", {
      alpha: true,
      desynchronized: true,
    });
    if (!context) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    const trail: TrailPoint[] = [];
    canvas.width = 1;
    canvas.height = 1;
    let enabled = false;
    let hasPosition = false;
    let animationFrame = 0;
    let drawnBounds: DrawBounds | null = null;
    let lastFrame = performance.now();
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const resize = () => {
      if (!enabled) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const pixelBudgetDpr = Math.sqrt(4_000_000 / (width * height));
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        1.5,
        Math.max(1, pixelBudgetDpr),
      );
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawnBounds = null;
      if (hasPosition) scheduleDraw();
    };

    const clearDrawnRegion = () => {
      if (!drawnBounds) return;
      const padding = 8;
      const left = Math.max(0, drawnBounds.left - padding);
      const top = Math.max(0, drawnBounds.top - padding);
      const right = Math.min(window.innerWidth, drawnBounds.right + padding);
      const bottom = Math.min(window.innerHeight, drawnBounds.bottom + padding);
      context.clearRect(left, top, right - left, bottom - top);
      drawnBounds = null;
    };

    const hide = () => {
      hasPosition = false;
      trail.length = 0;
      root.classList.remove("smooth-cursor-enabled");
      canvas.classList.remove("is-visible");
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      clearDrawnRegion();
    };

    const draw = (now: number) => {
      animationFrame = 0;
      if (!enabled || !hasPosition || document.hidden) return;

      const delta = Math.min(Math.max((now - lastFrame) / 1000, 1 / 240), 0.05);
      lastFrame = now;
      const follow = 1 - Math.exp(-FOLLOW_RATE * delta);
      currentX += (targetX - currentX) * follow;
      currentY += (targetY - currentY) * follow;
      const distanceToTarget = Math.hypot(targetX - currentX, targetY - currentY);
      const latest = trail[trail.length - 1];

      if (!latest || Math.hypot(currentX - latest.x, currentY - latest.y) > 0.35) {
        trail.push({ x: currentX, y: currentY, time: now });
        if (trail.length > MAX_TRAIL_POINTS) trail.shift();
      }

      while (trail.length > 0 && now - trail[0].time > TRAIL_LIFETIME) {
        trail.shift();
      }

      clearDrawnRegion();
      context.lineCap = "round";

      for (let index = 1; index < trail.length; index += 1) {
        const previous = trail[index - 1];
        const point = trail[index];
        const life = Math.max(0, 1 - (now - point.time) / TRAIL_LIFETIME);
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(point.x, point.y);
        context.lineWidth = 0.5 + life * 1.9;
        context.strokeStyle = `rgb(255 255 255 / ${life * life * 0.22})`;
        context.stroke();
      }

      context.beginPath();
      context.arc(currentX, currentY, CURSOR_RADIUS, 0, Math.PI * 2);
      context.fillStyle = "#fff";
      context.fill();

      let left = currentX;
      let top = currentY;
      let right = currentX;
      let bottom = currentY;
      for (const point of trail) {
        left = Math.min(left, point.x);
        top = Math.min(top, point.y);
        right = Math.max(right, point.x);
        bottom = Math.max(bottom, point.y);
      }
      drawnBounds = { left, top, right, bottom };
      root.classList.add("smooth-cursor-enabled");
      canvas.classList.add("is-visible");

      if (distanceToTarget > 0.04 || trail.length > 0) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    const scheduleDraw = () => {
      if (animationFrame || !enabled || document.hidden) return;
      lastFrame = performance.now();
      animationFrame = requestAnimationFrame(draw);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!enabled || event.pointerType === "touch") return;

      targetX = event.clientX;
      targetY = event.clientY;
      if (!hasPosition) {
        currentX = targetX;
        currentY = targetY;
        trail.push({ x: currentX, y: currentY, time: performance.now() });
        hasPosition = true;
      }
      scheduleDraw();
    };

    const updatePreference = () => {
      const shouldEnable = finePointer.matches && !reducedMotion.matches;
      if (shouldEnable === enabled) return;

      enabled = shouldEnable;
      if (enabled) resize();
      else {
        hide();
        canvas.width = 1;
        canvas.height = 1;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) hide();
    };

    updatePreference();
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", hide);
    window.addEventListener("resize", resize, { passive: true });
    document.documentElement.addEventListener("pointerleave", hide);
    document.addEventListener("visibilitychange", handleVisibility);
    finePointer.addEventListener("change", updatePreference);
    reducedMotion.addEventListener("change", updatePreference);

    return () => {
      hide();
      root.classList.remove("smooth-cursor-enabled");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", hide);
      window.removeEventListener("resize", resize);
      document.documentElement.removeEventListener("pointerleave", hide);
      document.removeEventListener("visibilitychange", handleVisibility);
      finePointer.removeEventListener("change", updatePreference);
      reducedMotion.removeEventListener("change", updatePreference);
    };
  }, []);

  return <canvas ref={canvasRef} className="smooth-cursor" aria-hidden="true" />;
}
