import {
  clamp,
  FAUNA_FONT_STACK,
  hash,
  smoothstep,
  type FaunaFrame,
} from "./shared";

type Point = {
  x: number;
  y: number;
  glyph: string;
  alpha: number;
};

type Coordinate = readonly [number, number];

const BODY_PROFILE: readonly Coordinate[] = [
  [-0.68, 0.045],
  [-0.48, 0.09],
  [-0.2, 0.165],
  [0.14, 0.245],
  [0.46, 0.305],
  [0.75, 0.29],
  [0.94, 0.205],
  [1.02, 0.08],
  [1.06, 0],
] as const;

const PECTORAL_FIN: readonly Coordinate[] = [
  [0.34, 0.205],
  [0.04, 0.43],
  [-0.28, 0.37],
  [-0.08, 0.15],
] as const;

const FLUKE: readonly Coordinate[] = [
  [-0.58, 0.025],
  [-0.8, 0.06],
  [-1.06, 0.44],
  [-0.77, 0.5],
  [-0.54, 0.1],
] as const;

const WHALE_GLYPHS = ["#", "@"] as const;

function interpolateBodyWidth(x: number) {
  for (let index = 1; index < BODY_PROFILE.length; index += 1) {
    const previous = BODY_PROFILE[index - 1];
    const next = BODY_PROFILE[index];
    if (x <= next[0]) {
      const progress = (x - previous[0]) / (next[0] - previous[0]);
      return previous[1] + (next[1] - previous[1]) * progress;
    }
  }

  return 0;
}

function pointInPolygon(x: number, y: number, polygon: readonly Coordinate[]) {
  let inside = false;

  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const [currentX, currentY] = polygon[current];
    const [previousX, previousY] = polygon[previous];
    const crosses =
      currentY > y !== previousY > y &&
      x <
        ((previousX - currentX) * (y - currentY)) /
          (previousY - currentY) +
          currentX;

    if (crosses) inside = !inside;
  }

  return inside;
}

function makePoint(x: number, y: number, seed: number, edge = false): Point {
  const noise = hash(Math.round((x + 1.2) * 100) + seed, Math.round((y + 0.7) * 100));
  const glyphIndex = edge ? 0 : Math.floor(noise * WHALE_GLYPHS.length);

  return {
    x,
    y,
    glyph: WHALE_GLYPHS[glyphIndex],
    alpha: edge ? 0.7 + noise * 0.25 : 0.55 + noise * 0.45,
  };
}

function buildWhalePoints() {
  const body: Point[] = [];
  const tail: Point[] = [];
  const xStep = 0.028;
  const yStep = 0.025;

  for (let x = -0.68; x <= 1.061; x += xStep) {
    const halfWidth = interpolateBodyWidth(x);
    for (let y = -halfWidth; y <= halfWidth + yStep * 0.5; y += yStep) {
      const edge = halfWidth - Math.abs(y) < yStep * 1.1;
      const seed = hash(Math.round(x * 140), Math.round(y * 170));
      const isBlowhole = x > 0.53 && x < 0.65 && Math.abs(y) < 0.026;
      if (!isBlowhole && (edge || seed > 0.34)) {
        body.push(makePoint(x, y, 13, edge));
      }
    }
  }

  for (let x = -0.42; x <= 0.43; x += xStep) {
    for (let y = -0.57; y <= 0.57; y += yStep) {
      const mirroredY = Math.abs(y);
      if (
        pointInPolygon(x, mirroredY, PECTORAL_FIN) &&
        hash(Math.round(x * 180) + 29, Math.round(y * 180)) > 0.5
      ) {
        body.push(makePoint(x, y, 31));
      }
    }
  }

  for (let x = -1.08; x <= -0.53; x += xStep) {
    for (let y = -0.52; y <= 0.52; y += yStep) {
      const mirroredY = Math.abs(y);
      if (
        pointInPolygon(x, mirroredY, FLUKE) &&
        hash(Math.round(x * 180) + 43, Math.round(y * 180)) > 0.38
      ) {
        tail.push(makePoint(x, y, 47));
      }
    }
  }

  return { body, tail };
}

const WHALE_POINTS = buildWhalePoints();

export function renderWhale(
  context: CanvasRenderingContext2D,
  frame: FaunaFrame,
  opacityScale = 1,
) {
  const { width, height, time, compact } = frame;
  const cycleDuration = 154;
  const passDuration = 58;
  // The first encounter enters within the opening seconds; later passes stay rare.
  const shiftedTime = time + 142;
  const passTime = shiftedTime % cycleDuration;

  if (passTime > passDuration) return;

  const progress = passTime / passDuration;
  const passIndex = Math.floor(shiftedTime / cycleDuration);
  const direction = passIndex % 2 === 0 ? 1 : -1;
  const fade =
    smoothstep(0, 0.08, progress) * (1 - smoothstep(0.9, 1, progress));
  const targetLength = compact
    ? clamp(width * 1.35, 520, 720)
    : clamp(width * 0.82, 760, 1280);
  // Keep its huge portrait scale while preserving the full silhouette in landscape.
  const length = Math.min(targetLength, height * 1.42);
  const padding = length * 0.66;
  const travel = width + padding * 2;
  const x =
    direction === 1
      ? -padding + travel * progress
      : width + padding - travel * progress;
  const visualRadius = length * 0.62;
  if (x + visualRadius < 0 || x - visualRadius > width) return;

  const verticalRadius = Math.min(height * 0.35, length * 0.24);
  const startY = clamp(
    height * (0.25 + hash(passIndex * 31 + 5, 113) * 0.5),
    verticalRadius,
    height - verticalRadius,
  );
  const destinationY = clamp(
    startY + (hash(passIndex * 37 + 7, 127) - 0.5) * height * 0.44,
    verticalRadius,
    height - verticalRadius,
  );
  const bendDirection = hash(passIndex * 41 + 11, 139) > 0.5 ? 1 : -1;
  const bendStrength =
    height * (0.22 + hash(passIndex * 43 + 13, 151) * 0.1);
  const controlY = clamp(
    (startY + destinationY) * 0.5 + bendDirection * bendStrength,
    verticalRadius,
    height - verticalRadius,
  );
  const inverseProgress = 1 - progress;
  const currentDirection = hash(passIndex * 53 + 19, 179) > 0.5 ? 1 : -1;
  const currentStrength =
    currentDirection *
    height *
    (0.015 + hash(passIndex * 59 + 23, 191) * 0.012);
  const currentPhase = progress * Math.PI;
  const currentRipple = Math.sin(currentPhase * 2) * Math.sin(currentPhase);
  const y =
    inverseProgress * inverseProgress * startY +
    2 * inverseProgress * progress * controlY +
    progress * progress * destinationY +
    currentRipple * currentStrength;
  const bezierSlope =
    2 * inverseProgress * (controlY - startY) +
    2 * progress * (destinationY - controlY);
  const currentSlope =
    currentStrength *
    Math.PI *
    (2 * Math.cos(currentPhase * 2) * Math.sin(currentPhase) +
      Math.sin(currentPhase * 2) * Math.cos(currentPhase));
  const pathSlope = bezierSlope + currentSlope;
  const pathAngle = Math.atan2(pathSlope, travel);
  const tailBeatPhase = time * Math.PI * 0.3;
  const tailPitch = Math.sin(tailBeatPhase) * 1.05;
  const tailProjection = Math.cos(tailPitch);
  const propulsion = Math.sin(tailBeatPhase - 0.9) * length * 0.008;
  const fontSize = clamp(length / 86, 6.8, 13.5);
  const opacity = fade * (compact ? 0.25 : 0.22) * opacityScale;
  const scale = length * 0.5;

  const drawPoint = (point: Point, tail = false) => {
    let pointX = point.x;
    let pointY = point.y;

    if (tail) {
      const pivotX = -0.56;
      const relativeX = point.x - pivotX;
      // Cetacean flukes beat vertically. From above, that motion foreshortens
      // the tail instead of sweeping it from side to side.
      pointX = pivotX + relativeX * tailProjection;
      pointY = point.y;
    }

    const depthAlpha = tail ? 0.55 + tailProjection * 0.45 : 1;
    context.globalAlpha = opacity * point.alpha * depthAlpha;
    context.fillText(point.glyph, pointX * scale, pointY * scale);
  };

  context.save();
  context.translate(x + propulsion * direction, y);
  context.rotate(pathAngle * direction);
  context.scale(direction, 1);
  context.font = `600 ${fontSize}px ${FAUNA_FONT_STACK}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fff";

  const pointStep = opacityScale < 1 ? 2 : 1;
  for (let index = 0; index < WHALE_POINTS.body.length; index += pointStep) {
    drawPoint(WHALE_POINTS.body[index]);
  }
  for (let index = 0; index < WHALE_POINTS.tail.length; index += pointStep) {
    drawPoint(WHALE_POINTS.tail[index], true);
  }

  context.restore();
}
