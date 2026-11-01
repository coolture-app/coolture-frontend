import { UserSummary } from './user-summary.model';

export interface UserProfile extends UserSummary {
  bio: string | null;
  createdAt: string;
  isFollowing: boolean;
  isBlocked: boolean;
}

/** The `/auth/me` response: the caller's profile plus account state only the caller sees. */
export interface Me extends UserProfile {
  interestsSelected: boolean;
}
