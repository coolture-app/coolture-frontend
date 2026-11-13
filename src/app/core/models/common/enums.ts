export type PostType = 'OFFLINE' | 'ONLINE';
export type PostStatus = 'ACTIVE' | 'EDITED' | 'DELETED';
export type PostVisibility = 'PUBLIC' | 'PRIVATE' | 'FRIENDS';
export type ReactionType = 'LIKE';
/** NOT_INTERESTED is "Nie dla mnie": private, never counted, and it hides the post from Dla Ciebie. */
export type ParticipationType = 'INTERESTED' | 'TAKES_PART' | 'NOT_INTERESTED';
/**
 * The orders of `/posts`. NEAREST needs a position, and shows only posts with a place. STANCE_NEWEST needs
 * participationTypes, and puts the viewer's newest of those stances first.
 */
export type PostsSort = 'RECENT' | 'POPULAR' | 'UPCOMING' | 'NEAREST' | 'STANCE_NEWEST';
/** How a feed page was ordered. New values may be added, and the UI treats them all alike. */
export type FeedMode = 'RANKED' | 'UPCOMING';
export type MediaPurpose = 'PROFILE_IMAGE' | 'PROFILE_IMAGE_THUMBNAIL' | 'EVENT_MEDIA';
export type MediaStatus = 'PENDING' | 'UPLOADED' | 'ATTACHED' | 'DELETED';
export type CommentStatus = 'ACTIVE' | 'DELETED';
