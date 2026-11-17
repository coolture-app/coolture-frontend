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
  startsFrom?: string; // ISO-8601
  startsTo?: string; // ISO-8601
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  participationTypes?: ParticipationType[];
  reactionType?: ReactionType;
  sortBy?: PostsSort;
  includePast?: boolean;
}
