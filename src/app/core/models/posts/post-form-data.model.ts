import { PostType, PostVisibility } from '../common/enums';
import { EventLocationRequest } from '../common/geo.model';

export interface PostFormData {
  title: string;
  type: PostType;
  startsAt: string;
  endsAt: string | null;
  description: string;
  eventUrl: string | null;
  tags: string[];
  visibility: PostVisibility;
  location: EventLocationRequest | null;
  mediaIds: string[];
  coverMediaId: string | null;
}
