/** Where the picture sits in a round viewport of `size` px: its top-left corner and its scale. */
export interface CropView {
  x: number;
  y: number;
  scale: number;
}

export const MAX_ZOOM = 3;

/** The scale at which the picture's shorter side just fills the viewport. */
export function coverScale(width: number, height: number, size: number): number {
  return size / Math.min(width, height);
}

/** Keeps the viewport covered: the picture can't be moved or zoomed out so that an edge shows. */
export function clampView(view: CropView, width: number, height: number, size: number): CropView {
  const min = coverScale(width, height, size);
  const scale = Math.min(Math.max(view.scale, min), min * MAX_ZOOM);
  const clamp = (value: number, length: number) =>
    Math.min(0, Math.max(size - length * scale, value));
  return { x: clamp(view.x, width), y: clamp(view.y, height), scale };
}

export function centredView(width: number, height: number, size: number): CropView {
  const scale = coverScale(width, height, size);
  return { x: (size - width * scale) / 2, y: (size - height * scale) / 2, scale };
}

/** Zooms to `scale` around a point of the viewport, so the picture under that point stays put. */
export function zoomAt(view: CropView, scale: number, px: number, py: number): CropView {
  const ratio = scale / view.scale;
  return { x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio, scale };
}

/** The square of the picture, in its own pixels, that the viewport shows. */
export function sourceSquare(
  view: CropView,
  size: number,
): { sx: number; sy: number; side: number } {
  return { sx: -view.x / view.scale, sy: -view.y / view.scale, side: size / view.scale };
}
