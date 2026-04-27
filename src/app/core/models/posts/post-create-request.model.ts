import { PostType, PostVisibility } from '../common/enums';
import { EventLocation } from '../common/geo.model';

export interface PostCreateRequest {
  categoryId: string; // UUID
  title: string;
  description: string;
  eventUrl?: string | null;
  startsAt: string; // ISO-8601
  endsAt?: string | null; // ISO-8601
  tags?: string[];
  type: PostType;
  visibility?: PostVisibility;
  location?: EventLocation | null;

  // List of ids from S3
  mediaIds?: string[]; // Tablica UUID
  coverMediaId?: string | null; // UUID
}
