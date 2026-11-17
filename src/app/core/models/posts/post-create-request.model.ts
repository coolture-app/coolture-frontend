import { PostType } from '../common/enums';
import { EventLocationRequest } from '../common/geo.model';

export interface PostCreateRequest {
  title: string;
  description: string;
  eventUrl?: string | null;
  startsAt: string; // ISO-8601
  endsAt?: string | null; // ISO-8601; null removes the end on an edit
  /** No end date. Can't come with an endsAt. */
  openEnded?: boolean;
  tags?: string[];
  type: PostType;
  location?: EventLocationRequest | null;

  // List of ids from S3
  mediaIds?: string[]; // Tablica UUID
}
