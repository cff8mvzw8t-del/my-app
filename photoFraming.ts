export const PASSPORT_ASPECT_RATIO = 35 / 45;
export type PhotoFraming = { zoom: number; offsetX: number; offsetY: number; aspectRatio: number; frameAspectRatio?: number };

const finite = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizePhotoFraming(value?: Partial<PhotoFraming>): PhotoFraming {
  const zoom = clamp(finite(value?.zoom, 1), 1, 4);
  const aspectRatio = clamp(finite(value?.aspectRatio, 1), 0.01, 100);
  const frameAspectRatio = clamp(finite(value?.frameAspectRatio, 1), 0.1, 10);
  const maxX = (Math.max(1, aspectRatio / frameAspectRatio) * zoom - 1) / 2;
  const maxY = (Math.max(1, frameAspectRatio / aspectRatio) * zoom - 1) / 2;
  return { zoom, aspectRatio, frameAspectRatio, offsetX: clamp(finite(value?.offsetX, 0), -maxX, maxX), offsetY: clamp(finite(value?.offsetY, 0), -maxY, maxY) };
}

export function photoFrameRect(value: PhotoFraming, size: number) {
  const frame = normalizePhotoFraming(value);
  const frameHeight = size / frame.frameAspectRatio!;
  const width = size * Math.max(1, frame.aspectRatio / frame.frameAspectRatio!) * frame.zoom;
  const height = frameHeight * Math.max(1, frame.frameAspectRatio! / frame.aspectRatio) * frame.zoom;
  return { width, height, left: (size - width) / 2 + frame.offsetX * size, top: (frameHeight - height) / 2 + frame.offsetY * frameHeight };
}

export function isPhotoFraming(value: unknown): value is PhotoFraming {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as PhotoFraming;
  if (![candidate.zoom, candidate.offsetX, candidate.offsetY, candidate.aspectRatio].every(item => typeof item === 'number' && Number.isFinite(item))) return false;
  if (candidate.frameAspectRatio !== undefined && (typeof candidate.frameAspectRatio !== 'number' || !Number.isFinite(candidate.frameAspectRatio))) return false;
  const normalized = normalizePhotoFraming(candidate);
  return (Object.keys(normalized) as (keyof PhotoFraming)[]).every(key => key === 'frameAspectRatio' && candidate[key] === undefined || Math.abs(normalized[key]! - candidate[key]!) < 1e-8);
}
