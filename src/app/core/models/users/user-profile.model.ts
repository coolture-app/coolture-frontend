import { UserSummary } from './user-summary.model';

export interface UserProfile extends UserSummary {
  bio: string | null;
  createdAt: string;
  isFollowing: boolean;
  isBlocked: boolean;
}
