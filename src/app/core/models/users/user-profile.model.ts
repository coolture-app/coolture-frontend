export interface UserAvatar {
  id: string;
  purpose: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  url: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatar: UserAvatar;
  followersCount: number;
  followingCount: number;
  bio: string;
  createdAt: string;
  isFollowing: boolean;
  isBlocked: boolean;
}
