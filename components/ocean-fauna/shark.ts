import {
  clamp,
  FAUNA_FONT_STACK,
  hash,
  smoothstep,
  type FaunaFrame,
} from "./shared";

// A dorsal-view shark: the body and articulated tail are both made from glyphs.
const SHARK_BODY = [
  "           ..",
  "          :++:",
  "         :+##+:",
  "        :+####+:",
  "   ...:+########+:...",
  "  :+################++==-",
  " +########################>",
  "  :+################++==-",
  "   ...:+########+:...",
  "        :+####+:",
  "         :+##+:",
  "          :++:",
  "           ..",
] as const;

const SHARK_TAIL_FIN = [
  ".:",
  ":#+",
  "+###:",
  "   =#+",
  "+###:",
  ":#+",
  ".:",
] as const;

const SHARK_GLYPH_ALPHA: Record<string, number> = {
  ".": 0.34,
  ":": 0.48,
  "-": 0.56,
  "=": 0.66,
  "+": 0.78,
  "#": 1,
  ">": 0.82,
};

export function renderShark(context: CanvasRenderingContext2D, frame: FaunaFrame) {
  const { width, height, time, compact } = frame;
  const cycleDuration = 34;
  const passDuration = 16.4;
  // The offset makes the first pass arrive just after the ocean has fully revealed.
  const shiftedTime = time + 22;
  const passTime = shiftedTime % cycleDuration;

  if (passTime > passDuration) return;

  const progress = passTime / passDuration;
  const passIndex = Math.floor(shiftedTime / cycleDuration);
  const direction = passIndex % 2 === 0 ? 1 : -1;
  const fade =
    smoothstep(0, 0.1, progress) * (1 - smoothstep(0.88, 1, progress));
  const stepX = clamp(width / 108, 3.5, 6.2);
  const fontSize = stepX / 0.62;
  const stepY = fontSize * 0.78;
  const padding = stepX * 43;
  const travel = width + padding * 2;
  const x =
    direction === 1
      ? -padding + travel * progress
      : width + padding - travel * progress;
  const visualRadius = stepX * 31;
  if (x + visualRadius < 0 || x - visualRadius > width) return;

  const spawnY = height * (0.28 + hash(passIndex * 7 + 3, 17) * 0.4);
  const swimAngle = (hash(passIndex * 11 + 5, 23) - 0.5) * 0.32;
  const destinationY = clamp(
    spawnY + Math.tan(swimAngle) * travel,
    height * 0.24,
    height * 0.72,
  );
  const bendDirection = hash(passIndex * 13 + 7, 41) > 0.5 ? 1 : -1;
  const curveScale = Math.min(height, width * 1.2);
  const bendStrength =
    curveScale * (0.18 + hash(passIndex * 17 + 9, 53) * 0.18);
  const controlY = clamp(
    (spawnY + destinationY) * 0.5 + bendDirection * bendStrength,
    height * 0.15,
    height * 0.85,
  );
  const inverseProgress = 1 - progress;
  const currentDirection = hash(passIndex * 19 + 11, 67) > 0.5 ? 1 : -1;
  const currentStrength =
    currentDirection *
    height *
    (0.012 + hash(passIndex * 23 + 13, 79) * 0.018);
  const currentPhase = progress * Math.PI;
  const currentRipple = Math.sin(currentPhase * 2) * Math.sin(currentPhase);
  const y =
    inverseProgress * inverseProgress * spawnY +
    2 * inverseProgress * progress * controlY +
    progress * progress * destinationY +
    currentRipple * currentStrength;
  const bezierSlope =
    2 * inverseProgress * (controlY - spawnY) +
    2 * progress * (destinationY - controlY);
  const currentSlope =
    currentStrength *
    Math.PI *
    (2 * Math.cos(currentPhase * 2) * Math.sin(currentPhase) +
      Math.sin(currentPhase * 2) * Math.cos(currentPhase));
  const pathSlope = bezierSlope + currentSlope;
  const pathAngle = Math.atan2(pathSlope, travel);
  const tailPhase = time * Math.PI * 0.72;
  const bodyYaw = -Math.sin(tailPhase) * 0.052;
  const opacity = fade * (compact ? 0.205 : 0.19);

  const drawGlyph = (glyph: string, glyphX: number, glyphY: number) => {
    context.globalAlpha = opacity * (SHARK_GLYPH_ALPHA[glyph] ?? 0.62);
    context.fillText(glyph, glyphX, glyphY);
  };

  context.save();
  context.translate(x, y);
  context.rotate((pathAngle + bodyYaw) * direction);
  context.scale(direction, 1);
  context.font = `600 ${fontSize}px ${FAUNA_FONT_STACK}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fff";

  // The head counters the tail while the rear body flows into three articulated sections.
  const jointAngles = [
    Math.sin(tailPhase) * 0.12,
    Math.sin(tailPhase - 0.55) * 0.2,
    Math.sin(tailPhase - 1.05) * 0.32,
  ];
  const segmentLengths = [2, 3, 3];
  let tailX = 0;
  let tailY = 0;
  let tailAngle = 0;
  let tailStep = 0;
  const totalTailSteps = segmentLengths.reduce((sum, length) => sum + length, 0);

  for (let joint = 0; joint < segmentLengths.length; joint += 1) {
    tailAngle += jointAngles[joint];
    for (let segment = 0; segment < segmentLengths[joint]; segment += 1) {
      tailX -= Math.cos(tailAngle) * stepX;
      tailY += Math.sin(tailAngle) * stepX;
      tailStep += 1;
      const taper = tailStep / totalTailSteps;
      const glyph = taper < 0.34 ? "#" : taper < 0.72 ? "+" : ":";
      drawGlyph(glyph, tailX, tailY);

      if (taper < 0.48) {
        const halfWidth = stepY * (0.48 - taper * 0.55);
        drawGlyph(
          "+",
          tailX - Math.sin(tailAngle) * halfWidth,
          tailY - Math.cos(tailAngle) * halfWidth,
        );
        drawGlyph(
          "+",
          tailX + Math.sin(tailAngle) * halfWidth,
          tailY + Math.cos(tailAngle) * halfWidth,
        );
      }
    }
  }

  context.save();
  context.translate(tailX, tailY);
  context.rotate(-tailAngle);
  for (let row = 0; row < SHARK_TAIL_FIN.length; row += 1) {
    const glyphRow = SHARK_TAIL_FIN[row];
    for (let column = 0; column < glyphRow.length; column += 1) {
      const glyph = glyphRow[column];
      if (glyph !== " ") {
        drawGlyph(glyph, (column - 5) * stepX, (row - 3) * stepY);
      }
    }
  }
  context.restore();

  for (let row = 0; row < SHARK_BODY.length; row += 1) {
    const glyphRow = SHARK_BODY[row];
    for (let column = 0; column < glyphRow.length; column += 1) {
      const glyph = glyphRow[column];
      if (glyph !== " ") {
        const longitudinal = clamp((column - 1) / 24);
        const rearFlex =
          Math.sin(tailPhase) *
          Math.pow(1 - longitudinal, 1.7) *
          stepY *
          0.65;
        drawGlyph(
          glyph,
          (column - 1) * stepX,
          (row - 6) * stepY + rearFlex,
        );
      }
    }
  }

  context.restore();
}
