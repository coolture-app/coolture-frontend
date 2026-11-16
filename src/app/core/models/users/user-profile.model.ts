import { NamedPlace } from '../common/geo.model';
import { UserSummary } from './user-summary.model';

// As read from the API: fields without a value are left out of the JSON.
export interface UserProfile extends UserSummary {
  bio?: string;
  createdAt?: string;
  isFollowing: boolean;
  isBlocked: boolean;
}

/** The `/auth/me` response: the caller's profile plus account state only the caller sees. */
export interface Me extends UserProfile {
  interestsSelected: boolean;
  /** Whether friends see the caller's Interesuje mnie and Biorę udział. */
  shareStances: boolean;
  /** Where the caller lives, if they said. Nobody else can read it. */
  home?: NamedPlace;
}
