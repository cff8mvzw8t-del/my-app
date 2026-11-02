export type PhotoFraming = { zoom: number; offsetX: number; offsetY: number; aspectRatio: number };

const finite = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizePhotoFraming(value?: Partial<PhotoFraming>): PhotoFraming {
  const zoom = clamp(finite(value?.zoom, 1), 1, 4);
  const aspectRatio = clamp(finite(value?.aspectRatio, 1), 0.01, 100);
  const maxX = (Math.max(1, aspectRatio) * zoom - 1) / 2;
  const maxY = (Math.max(1, 1 / aspectRatio) * zoom - 1) / 2;
  return { zoom, aspectRatio, offsetX: clamp(finite(value?.offsetX, 0), -maxX, maxX), offsetY: clamp(finite(value?.offsetY, 0), -maxY, maxY) };
}

export function photoFrameRect(value: PhotoFraming, size: number) {
  const frame = normalizePhotoFraming(value);
  const width = size * Math.max(1, frame.aspectRatio) * frame.zoom;
  const height = size * Math.max(1, 1 / frame.aspectRatio) * frame.zoom;
  return { width, height, left: (size - width) / 2 + frame.offsetX * size, top: (size - height) / 2 + frame.offsetY * size };
}

export function isPhotoFraming(value: unknown): value is PhotoFraming {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as PhotoFraming;
  if (![candidate.zoom, candidate.offsetX, candidate.offsetY, candidate.aspectRatio].every(item => typeof item === 'number' && Number.isFinite(item))) return false;
  const normalized = normalizePhotoFraming(candidate);
  return (Object.keys(normalized) as (keyof PhotoFraming)[]).every(key => Math.abs(normalized[key] - candidate[key]) < 1e-8);
}
