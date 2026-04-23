import { PostBase } from './post-base.model';
import { MediaResource } from '../media/media-resource.model';

export interface PostMedia {
  media: MediaResource;
  position: number;
  isCover: boolean;
}
export interface PostDetail extends PostBase {
  media: PostMedia[];
}
