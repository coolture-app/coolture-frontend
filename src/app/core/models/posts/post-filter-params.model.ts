import { PostType, PostStatus, ParticipationType, ReactionType, PostsSort } from '../common/enums';

export interface PostFilterParams {
  cursor?: string;
  limit?: number;
  q?: string;
  tags?: string[];
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
  reactionType?: ReactionType;
  sortBy?: PostsSort;
  includePast?: boolean;
}
