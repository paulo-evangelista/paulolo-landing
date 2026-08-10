import { renderShark } from "./shark";
import { sampleFaunaTime, type FaunaBounds, type FaunaFrame } from "./shared";
import { renderWhale } from "./whale";

function createFaunaFrame(bounds: FaunaBounds, time: number): FaunaFrame {
  const compact = bounds.width < 560;
  return {
    ...bounds,
    compact,
    time: sampleFaunaTime(time, compact),
  };
}

export function renderOceanFauna(
  context: CanvasRenderingContext2D,
  bounds: FaunaBounds,
  time: number,
) {
  const frame = createFaunaFrame(bounds, time);

  // Darkest/deepest silhouettes go first; the ocean glyphs overpaint all fauna.
  renderWhale(context, frame);
  renderShark(context, frame);
}

export function renderWhaleGlimmer(
  context: CanvasRenderingContext2D,
  bounds: FaunaBounds,
  time: number,
) {
  // A faint trace connects the silhouette without lifting it above the surface.
  renderWhale(context, createFaunaFrame(bounds, time), 0.28);
}
