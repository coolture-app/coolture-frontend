import { NamedPlace } from '../common/geo.model';
import { UserSummary } from './user-summary.model';

/**
 * As read from the API: fields without a value are left out of the JSON. Someone you blocked comes as a slim profile,
 * with `isBlocked` and without the counts, bio, createdAt and interests.
 */
export interface UserProfile extends Omit<UserSummary, 'followersCount' | 'followingCount'> {
  followersCount?: number;
  followingCount?: number;
  bio?: string;
  createdAt?: string;
  isFollowing: boolean;
  isBlocked: boolean;
  /** With isFollowing, both true means you're friends. */
  followsYou: boolean;
  /** Interest keys, in the catalogue's order. */
  interests?: string[];
  /** Kind keys, in the catalogue's order. */
  kinds?: string[];
}

/** The `/auth/me` response: the caller's profile plus account state only the caller sees. */
export interface Me extends UserProfile {
  followersCount: number;
  followingCount: number;
  interests: string[];
  kinds: string[];
  /** Whether the caller has picked a kind of event; accounts from before kinds haven't. */
  interestsSelected: boolean;
  /** Whether friends see the caller's Interesuje mnie and Biorę udział. */
  shareStances: boolean;
  /** Where the caller lives, if they said. Nobody else can read it. */
  home?: NamedPlace;
}
