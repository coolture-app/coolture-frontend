import {
  PostType,
  PostStatus,
  PostVisibility,
  ParticipationType,
  ReactionType,
} from '../common/enums';

export interface PostFilterParams {
  cursor?: string;
  limit?: number;
  q?: string;
  categoryId?: string; // UUID
  tags?: string[];
  authorId?: string; // UUID
  status?: PostStatus;
  visibility?: PostVisibility;
  type?: PostType;
  startsFrom?: string; // ISO-8601
  startsTo?: string; // ISO-8601
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  participationTypes?: ParticipationType[];
  reactionType?: ReactionType;
}
