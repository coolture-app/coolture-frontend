/** A friend is a mutual follow. Only friends who share their stances are listed. */
export interface Friend {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export interface FriendGroup {
  /** All friends with this stance. */
  count: number;
  /** The newest of them, at most two. */
  people: Friend[];
}

/** The viewer's friends who marked a post Biorę udział (going) or Interesuje mnie (interested). */
export interface FriendStances {
  going?: FriendGroup;
  interested?: FriendGroup;
}

/** All of them, for the friends list. Both empty for a guest. */
export interface PostFriends {
  going: Friend[];
  interested: Friend[];
}

/** First and last name, or the username when there's no first name. */
export function fullName(friend: Friend): string {
  return friend.firstName
    ? [friend.firstName, friend.lastName].filter(Boolean).join(' ')
    : friend.username;
}
