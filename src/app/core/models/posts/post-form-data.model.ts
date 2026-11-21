import { PostType } from '../common/enums';
import { EventLocationRequest } from '../common/geo.model';
import { PostLink } from './post-link';

export interface PostFormData {
  title: string;
  type: PostType;
  startsAt: string;
  endsAt: string | null;
  openEnded: boolean;
  description: string;
  links: PostLink[];
  location: EventLocationRequest | null;
  /** In the order the post shows them. The first is the cover. */
  mediaIds: string[];
  /** Saved photos taken off the post, to delete once it's saved. */
  removedMediaIds: string[];
}
