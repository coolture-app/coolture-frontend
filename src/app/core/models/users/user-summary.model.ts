import { MediaResource } from '../media/media-resource.model';

export interface UserSummary {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: MediaResource;
  followersCount: number;
  followingCount: number;
}
