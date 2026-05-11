export type PostType = 'OFFLINE' | 'ONLINE';
export type PostStatus = 'ACTIVE' | 'EDITED' | 'DELETED';
export type PostVisibility = 'PUBLIC' | 'PRIVATE' | 'FRIENDS';
export type ReactionType = 'like' | 'dislike';
export type ParticipationType = 'interested' | 'takes_part';
export type PostSortBy = 'recent' | 'popular' | 'upcoming';
export type MediaPurpose =
  | 'profile_image'
  | 'profile_image_thumbnail'
  | 'event_cover'
  | 'event_media';
export type MediaStatus = 'PENDING' | 'UPLOADED' | 'ATTACHED' | 'DELETED';
export type CommentStatus = 'ACTIVE' | 'DELETED';
