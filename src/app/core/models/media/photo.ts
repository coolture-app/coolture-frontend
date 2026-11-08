import { MediaResource } from './media-resource.model';

/** A photo as a post shows it. The size is in pixels, and missing for older uploads. */
export interface Photo {
  url: string;
  width?: number;
  height?: number;
}

/** The tallest and the widest frame, width over height: 4:5 and 1.91:1, as Instagram's feed. */
export const TALLEST_FRAME = 4 / 5;
export const WIDEST_FRAME = 1.91;

export function toPhoto(media: MediaResource | undefined): Photo | null {
  return media?.url ? { url: media.url, width: media.width, height: media.height } : null;
}

/**
 * The frame's shape, width over height: the photo's own, held between the tallest and the widest
 * frame, or square when the size isn't known. It comes from the data, never from the loaded image,
 * so the frame never changes after load.
 */
export function frameShape(photo: Photo | undefined): number {
  if (!photo?.width || !photo.height) {
    return 1;
  }
  return Math.min(Math.max(photo.width / photo.height, TALLEST_FRAME), WIDEST_FRAME);
}
