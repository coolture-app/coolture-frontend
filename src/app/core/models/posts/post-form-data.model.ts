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
  /** In the order the post shows them. The first is the cover. */
  mediaIds: string[];
  /** Saved photos taken off the post, to delete once it's saved. */
  removedMediaIds: string[];
}
