import { MediaPurpose, MediaStatus } from '../common/enums';

export interface MediaResource {
  id: string;
  purpose?: MediaPurpose;
  mimeType?: string;
  sizeBytes?: number;
  status?: MediaStatus;
  url?: string;
  createdAt?: string;
  deletedAt?: string;
  /** Pixels. Missing for media uploaded before sizes were stored. */
  width?: number;
  height?: number;
}
