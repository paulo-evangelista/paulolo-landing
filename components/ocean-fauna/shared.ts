export const FAUNA_FONT_STACK =
  '"SFMono-Regular", "Cascadia Mono", "Roboto Mono", Consolas, monospace';

export type FaunaBounds = {
  width: number;
  height: number;
};

export type FaunaFrame = FaunaBounds & {
  time: number;
  compact: boolean;
};

export function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = clamp((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
}

export function hash(column: number, row: number) {
  const value = Math.sin(column * 127.1 + row * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

export function sampleFaunaTime(time: number, compact: boolean) {
  const sampleRate = compact ? 14 : 18;
  return Math.floor(time * sampleRate) / sampleRate;
}
