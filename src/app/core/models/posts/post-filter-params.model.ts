import { PostType, PostStatus, ParticipationType, ReactionType, PostsSort } from '../common/enums';

export interface PostFilterParams {
  cursor?: string;
  limit?: number;
  q?: string;
  authorId?: string; // UUID
  status?: PostStatus;
  /** Posts by people the viewer follows, and posts friends are interested in or go to. */
  followed?: boolean;
  type?: PostType;
  /** Only events running at some moment from then on. ISO-8601. */
  from?: string;
  /** Only events running at some moment up to then. ISO-8601. */
  to?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  participationTypes?: ParticipationType[];
  /** Whose stances participationTypes reads, the viewer when left out. A friend's only while they share them. */
  participantId?: string;
  reactionType?: ReactionType;
  sortBy?: PostsSort;
  includePast?: boolean;
  /** Kind keys; a post matches any of them. */
  kinds?: string[];
  /** Only posts for children, whatever their other kinds. */
  kids?: boolean;
}
