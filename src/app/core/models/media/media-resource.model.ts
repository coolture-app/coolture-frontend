import { MediaPurpose, MediaStatus } from '../common/enums';

export interface MediaResource {
  id: string;
  purpose: MediaPurpose;
  mimeType: string;
  sizeBytes: number;
  status: MediaStatus;
  url: string;
  createdAt: string;
  deletedAt: string | null;
}
