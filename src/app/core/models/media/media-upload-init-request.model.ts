import { MediaPurpose } from '../common/enums';

export interface MediaUploadInitRequest {
  purpose: MediaPurpose;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}
