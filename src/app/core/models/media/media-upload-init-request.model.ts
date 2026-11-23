import { MediaPurpose } from '../common/enums';

export interface MediaUploadInitRequest {
  purpose: MediaPurpose;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
  /** Pixels, from the file itself. Lets the post's frame take the photo's shape before it loads. */
  width?: number;
  height?: number;
}
