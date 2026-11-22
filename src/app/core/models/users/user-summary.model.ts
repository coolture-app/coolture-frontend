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

/** A person in a list of people: search, followers, following, blocked. */
export interface UserListItem extends UserSummary {
  /** False for yourself and for a guest. */
  isFollowing: boolean;
  /** With isFollowing, both true means you're friends. Always false for a guest. */
  followsYou: boolean;
}
