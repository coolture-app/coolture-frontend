import { PostBase } from './post-base.model';
import { MediaResource } from '../media/media-resource.model';
import { PostMedia } from './post-detail.model';
import { MAX_POST_PHOTOS } from './post-limits';

export interface PostCard extends PostBase {
  /** Every photo, cover first, at most MAX_POST_PHOTOS. Left out when the post has none. */
  photos?: MediaResource[];
}

/** A card's photos from the post page's media, in the order the API gives cards. */
export function cardPhotos(media: PostMedia[]): MediaResource[] | undefined {
  const ordered = [...media]
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_POST_PHOTOS)
    .map((item) => item.media);
  return ordered.length > 0 ? ordered : undefined;
}
