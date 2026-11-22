import { PostType } from '../common/enums';
import { EventLocationRequest } from '../common/geo.model';
import { PostLink } from './post-link';

export interface PostCreateRequest {
  title: string;
  description: string;
  links?: PostLink[];
  startsAt: string; // ISO-8601
  endsAt?: string | null; // ISO-8601
  /** No end date. Can't come with an endsAt. */
  openEnded?: boolean;
  type: PostType;
  location?: EventLocationRequest | null;
  mediaIds?: string[];
}
