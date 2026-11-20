import { PostBase } from './post-base.model';
import { MediaResource } from '../media/media-resource.model';

export interface PostMedia {
  media: MediaResource;
  position: number;
}
export interface PostDetail extends PostBase {
  media: PostMedia[];
  /** Kinds of event, the first the likeliest; left out until derived. */
  kinds?: string[];
}
