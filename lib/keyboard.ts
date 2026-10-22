export type VerticalFrame = { top: number; height: number };

export function keyboardWindowTop(
  metrics: { screenY: number; height: number } | undefined,
  statusBarHeight = 0,
) {
  if (!metrics || metrics.height <= 0 || metrics.screenY <= 0) return null;
  return Math.max(0, metrics.screenY - statusBarHeight);
}

export function keyboardOverlap(frame: VerticalFrame, keyboardTop: number | null) {
  if (keyboardTop === null || !Number.isFinite(keyboardTop)) return 0;
  return Math.max(0, Math.min(frame.height, frame.top + frame.height - keyboardTop));
}

export function focusedFieldScroll(
  field: VerticalFrame,
  viewport: VerticalFrame,
  keyboardTop: number,
  gap = 16,
) {
  const top = viewport.top + gap;
  const bottom = Math.min(viewport.top + viewport.height, keyboardTop) - gap;
  if (bottom <= top) return 0;
  if (field.top < top) return field.top - top;
  if (field.top + field.height > bottom) {
    return Math.min(field.top + field.height - bottom, field.top - top);
  }
  return 0;
}
