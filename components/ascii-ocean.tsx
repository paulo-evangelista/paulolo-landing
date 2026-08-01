"use client";

import { useEffect, useRef } from "react";

const GLYPHS = " .·,:;~=+*#%@";
const FONT_STACK = '"SFMono-Regular", "Cascadia Mono", "Roboto Mono", Consolas, monospace';

const WAVE_COMPONENTS = [
  { amplitude: 0.58, x: 0.56, z: 0.94, speed: -0.66, phase: 0.0 },
  { amplitude: 0.28, x: -1.08, z: 0.6, speed: -0.93, phase: 1.7 },
  { amplitude: 0.15, x: 2.04, z: 0.34, speed: -1.31, phase: 4.1 },
  { amplitude: 0.07, x: -3.22, z: 1.42, speed: -1.72, phase: 2.6 },
] as const;

type OceanGrid = {
  width: number;
  height: number;
  columns: number;
  rows: number;
  cellWidth: number;
  startX: number;
  phaseStart: Float32Array;
  phaseStepSine: Float32Array;
  phaseStepCosine: Float32Array;
  grain: Float32Array;
  depth: Float32Array;
  baseY: Float32Array;
  amplitude: Float32Array;
  fonts: string[];
  baseAlpha: Float32Array;
  foamX: Float32Array;
  foamY: Float32Array;
  foamGlyph: Uint8Array;
  horizon: number;
};

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = clamp((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
}

function hash(column: number, row: number) {
  const value = Math.sin(column * 127.1 + row * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function buildGrid(context: CanvasRenderingContext2D, width: number, height: number): OceanGrid {
  const compact = width < 560;
  const rows = Math.round(clamp(height / (compact ? 10.7 : 12.2), 46, compact ? 76 : 74));
  const targetSamples = clamp(Math.sqrt(width * height) * 9.5, 8_500, 16_000);
  const targetColumns = clamp(targetSamples / rows, 92, 216);
  const targetCellWidth = width / targetColumns;
  const maximumFont = compact ? 8.4 : clamp(targetCellWidth / 0.88, 9.4, 22);

  context.font = `500 ${maximumFont}px ${FONT_STACK}`;
  const measuredGlyph = Math.max(context.measureText("@").width, maximumFont * 0.54);
  const cellWidth = measuredGlyph * (compact ? 1.42 : 1.48);
  const columns = Math.ceil(width / cellWidth) + 4;
  // Start the projected surface just above the viewport so the ocean—not a sky band—fills every edge.
  const horizon = -maximumFont * 1.8;
  const startX = -cellWidth * 1.5;
  const cellCount = columns * rows;
  const rowWaveCount = rows * WAVE_COMPONENTS.length;
  const phaseStart = new Float32Array(rowWaveCount);
  const phaseStepSine = new Float32Array(rowWaveCount);
  const phaseStepCosine = new Float32Array(rowWaveCount);
  const grain = new Float32Array(cellCount);
  const depth = new Float32Array(rows);
  const baseY = new Float32Array(rows);
  const amplitude = new Float32Array(rows);
  const fonts = new Array<string>(rows);
  const baseAlpha = new Float32Array(rows);
  const foamX = new Float32Array(columns);
  const foamY = new Float32Array(columns);
  const foamGlyph = new Uint8Array(columns);

  for (let row = 0; row < rows; row += 1) {
    const progress = row / Math.max(rows - 1, 1);
    const perspective = Math.pow(progress, compact ? 1.48 : 1.58);
    const worldZ = (1 - progress) * 13.5;
    const worldSpan = 7.4 + progress * 4.8;
    const worldStep = (worldSpan * 2) / Math.max(columns - 1, 1);

    depth[row] = progress;
    baseY[row] = horizon + perspective * (height - horizon + maximumFont * 0.8);
    amplitude[row] = 2.2 + Math.pow(progress, 1.45) * (compact ? 15 : 21);
    const fontSize = 5.2 + Math.pow(progress, 0.66) * (maximumFont - 5.2);
    fonts[row] = `500 ${fontSize}px ${FONT_STACK}`;
    baseAlpha[row] = 0.13 + Math.pow(progress, 0.55) * 0.55;

    for (let waveIndex = 0; waveIndex < WAVE_COMPONENTS.length; waveIndex += 1) {
      const wave = WAVE_COMPONENTS[waveIndex];
      const waveOffset = row * WAVE_COMPONENTS.length + waveIndex;
      const phaseStep = worldStep * wave.x;
      phaseStart[waveOffset] = -worldSpan * wave.x + worldZ * wave.z + wave.phase;
      phaseStepSine[waveOffset] = Math.sin(phaseStep);
      phaseStepCosine[waveOffset] = Math.cos(phaseStep);
    }

    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      grain[index] = hash(column, row);
    }
  }

  return {
    width,
    height,
    columns,
    rows,
    cellWidth,
    startX,
    phaseStart,
    phaseStepSine,
    phaseStepCosine,
    grain,
    depth,
    baseY,
    amplitude,
    fonts,
    baseAlpha,
    foamX,
    foamY,
    foamGlyph,
    horizon,
  };
}

function renderOcean(context: CanvasRenderingContext2D, grid: OceanGrid, time: number) {
  const { width, height, columns, rows } = grid;
  context.clearRect(0, 0, width, height);
  context.textAlign = "center";
  context.textBaseline = "middle";

  const surgePhase = (time % 43) / 43;
  const surgeEnvelope = Math.pow(Math.max(0, Math.sin(surgePhase * Math.PI)), 18) * 0.24;
  const surgeCenter = -0.92 + surgePhase * 1.84;
  const wave0 = WAVE_COMPONENTS[0];
  const wave1 = WAVE_COMPONENTS[1];
  const wave2 = WAVE_COMPONENTS[2];
  const wave3 = WAVE_COMPONENTS[3];
  context.fillStyle = "#fff";

  for (let row = 0; row < rows; row += 1) {
    const progress = grid.depth[row];
    const waveOffset = row * WAVE_COMPONENTS.length;
    const phase0 = grid.phaseStart[waveOffset] + time * wave0.speed;
    const phase1 = grid.phaseStart[waveOffset + 1] + time * wave1.speed;
    const phase2 = grid.phaseStart[waveOffset + 2] + time * wave2.speed;
    const phase3 = grid.phaseStart[waveOffset + 3] + time * wave3.speed;
    let sine0 = Math.sin(phase0);
    let sine1 = Math.sin(phase1);
    let sine2 = Math.sin(phase2);
    let sine3 = Math.sin(phase3);
    let cosine0 = Math.cos(phase0);
    let cosine1 = Math.cos(phase1);
    let cosine2 = Math.cos(phase2);
    let cosine3 = Math.cos(phase3);
    const stepSine0 = grid.phaseStepSine[waveOffset];
    const stepSine1 = grid.phaseStepSine[waveOffset + 1];
    const stepSine2 = grid.phaseStepSine[waveOffset + 2];
    const stepSine3 = grid.phaseStepSine[waveOffset + 3];
    const stepCosine0 = grid.phaseStepCosine[waveOffset];
    const stepCosine1 = grid.phaseStepCosine[waveOffset + 1];
    const stepCosine2 = grid.phaseStepCosine[waveOffset + 2];
    const stepCosine3 = grid.phaseStepCosine[waveOffset + 3];
    let foamCount = 0;
    context.font = grid.fonts[row];
    context.globalAlpha = grid.baseAlpha[row];

    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      let elevation =
        wave0.amplitude * sine0 +
        wave1.amplitude * sine1 +
        wave2.amplitude * sine2 +
        wave3.amplitude * sine3;
      let slopeX =
        wave0.amplitude * wave0.x * cosine0 +
        wave1.amplitude * wave1.x * cosine1 +
        wave2.amplitude * wave2.x * cosine2 +
        wave3.amplitude * wave3.x * cosine3;
      const slopeZ =
        wave0.amplitude * wave0.z * cosine0 +
        wave1.amplitude * wave1.z * cosine1 +
        wave2.amplitude * wave2.z * cosine2 +
        wave3.amplitude * wave3.z * cosine3;

      // A rare, slow constructive swell travels through the ordinary wave field.
      const normalizedX = (column / Math.max(columns - 1, 1) - 0.5) * 2;
      if (surgeEnvelope > 0.001) {
        const distance = normalizedX - surgeCenter;
        const localEnvelope = surgeEnvelope / (1 + distance * distance * 18);
        const localPhase = normalizedX * 8.5 + progress * 5.2 - time * 0.82;
        elevation += Math.sin(localPhase) * localEnvelope;
        slopeX += Math.cos(localPhase) * localEnvelope * 0.85;
      }

      const inverseNormalLength = 1 / Math.sqrt(1 + slopeX * slopeX + slopeZ * slopeZ);
      const light = clamp(
        (-slopeX * -0.34 + 0.88 + -slopeZ * -0.32) * inverseNormalLength,
      );
      const glint = Math.pow(clamp((light - 0.52) / 0.48), 4.5);
      const crest = smoothstep(0.38, 0.88, elevation + Math.abs(slopeX) * 0.08);
      const texture = grid.grain[index] - 0.5;
      const tone = clamp(
        0.06 + light * 0.46 + glint * 0.42 + progress * 0.08 + texture * 0.13,
      );
      const glyphIndex = Math.floor(Math.pow(tone, 1.18) * (GLYPHS.length - 1));
      const glyph = GLYPHS[glyphIndex];

      if (glyph !== " ") {
        const x = grid.startX + column * grid.cellWidth + Math.sin(elevation + progress * 2.2) * progress * 0.9;
        const y = grid.baseY[row] - elevation * grid.amplitude[row];
        const foam =
          progress > 0.05 &&
          crest > 0.48 + grid.grain[index] * 0.32 &&
          (slopeZ < 0.34 || glint > 0.58);

        if (foam) {
          grid.foamX[foamCount] = x;
          grid.foamY[foamCount] = y;
          grid.foamGlyph[foamCount] = Math.max(glyphIndex, GLYPHS.length - 3);
          foamCount += 1;
        } else {
          context.fillText(glyph, x, y);
        }
      }

      const nextSine0 = sine0 * stepCosine0 + cosine0 * stepSine0;
      const nextSine1 = sine1 * stepCosine1 + cosine1 * stepSine1;
      const nextSine2 = sine2 * stepCosine2 + cosine2 * stepSine2;
      const nextSine3 = sine3 * stepCosine3 + cosine3 * stepSine3;
      cosine0 = cosine0 * stepCosine0 - sine0 * stepSine0;
      cosine1 = cosine1 * stepCosine1 - sine1 * stepSine1;
      cosine2 = cosine2 * stepCosine2 - sine2 * stepSine2;
      cosine3 = cosine3 * stepCosine3 - sine3 * stepSine3;
      sine0 = nextSine0;
      sine1 = nextSine1;
      sine2 = nextSine2;
      sine3 = nextSine3;
    }

    if (foamCount > 0) {
      context.globalAlpha = 0.72 + progress * 0.24;
      for (let foamIndex = 0; foamIndex < foamCount; foamIndex += 1) {
        context.fillText(
          GLYPHS[grid.foamGlyph[foamIndex]],
          grid.foamX[foamIndex],
          grid.foamY[foamIndex],
        );
      }
    }
  }

  // Fine salt spray is tied to the same rare swell, so it reads as water—not noise.
  if (surgeEnvelope > 0.08) {
    context.font = grid.fonts[0];
    context.globalAlpha = surgeEnvelope * 1.8;
    for (let particle = 0; particle < 11; particle += 1) {
      const seed = hash(particle, 91);
      const x = width * ((surgeCenter + 1) * 0.5) + (seed - 0.5) * width * 0.12;
      const lift = Math.sin(surgePhase * Math.PI) * (18 + seed * 24);
      const y = grid.horizon + 12 - lift + Math.sin(time * 1.7 + particle) * 3;
      context.fillText(particle % 3 === 0 ? "·" : ".", x, y);
    }
  }

  context.globalAlpha = 1;
}

export function AsciiOcean() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let grid: OceanGrid | null = null;
    let animationFrame = 0;
    let resizeFrame = 0;
    let lastTick = performance.now();
    let lastPaint = 0;
    let averagePaintTime = 0;
    let simulationTime = 7.4;
    let disposed = false;

    const paint = () => {
      if (grid) renderOcean(context, grid, simulationTime);
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const dpr = Math.min(window.devicePixelRatio || 1, width < 560 ? 1.5 : 1.8);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = false;
      grid = buildGrid(context, width, height);
      paint();
    };

    const requestResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };

    const stop = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const animate = (now: number) => {
      if (disposed || reducedMotion.matches || document.hidden) {
        animationFrame = 0;
        return;
      }

      const delta = Math.min((now - lastTick) / 1000, 0.05);
      lastTick = now;
      simulationTime += delta;

      const preferredFrameRate = (grid?.width ?? window.innerWidth) < 560 ? 28 : 36;
      const frameRate = averagePaintTime > 15 ? 24 : averagePaintTime > 10 ? 30 : preferredFrameRate;
      const frameInterval = 1000 / frameRate;
      if (now - lastPaint >= frameInterval) {
        const paintStart = performance.now();
        paint();
        const paintTime = performance.now() - paintStart;
        averagePaintTime = averagePaintTime === 0 ? paintTime : averagePaintTime * 0.92 + paintTime * 0.08;
        lastPaint = now;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    const start = () => {
      stop();
      lastTick = performance.now();
      if (!reducedMotion.matches && !document.hidden) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        stop();
        simulationTime = 7.4;
        paint();
      } else {
        start();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    resize();
    start();
    window.addEventListener("resize", requestResize, { passive: true });
    window.visualViewport?.addEventListener("resize", requestResize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);

    return () => {
      disposed = true;
      stop();
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener("resize", requestResize);
      window.visualViewport?.removeEventListener("resize", requestResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, []);

  return <canvas ref={canvasRef} className="ascii-ocean" aria-hidden="true" />;
}
