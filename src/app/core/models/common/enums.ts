export type PostType = 'OFFLINE' | 'ONLINE';
export type PostStatus = 'ACTIVE' | 'EDITED' | 'DELETED';
export type PostVisibility = 'PUBLIC' | 'PRIVATE' | 'FRIENDS';
export type ReactionType = 'LIKE' | 'DISLIKE';
export type ParticipationType = 'INTERESTED' | 'TAKES_PART';
/** The sorts `GET /posts` accepts. */
export type PostsSort = 'RECENT' | 'POPULAR' | 'UPCOMING';
/** What the sort control can show. RECOMMENDED means `GET /feed`, and never goes to `/posts`. */
export type PostSortBy = PostsSort | 'RECOMMENDED';
/** How a feed page was ordered. New values may be added, and the UI treats them all alike. */
export type FeedMode = 'RANKED' | 'UPCOMING';
export type MediaPurpose =
  | 'PROFILE_IMAGE'
  | 'PROFILE_IMAGE_THUMBNAIL'
  | 'EVENT_COVER'
  | 'EVENT_MEDIA';
export type MediaStatus = 'PENDING' | 'UPLOADED' | 'ATTACHED' | 'DELETED';
export type CommentStatus = 'ACTIVE' | 'DELETED';
