import { UserSummary } from '../users/user-summary.model';
import { EventLocation } from '../common/geo.model';
import { MediaResource } from '../media/media-resource.model';
import {
  PostType,
  PostStatus,
  PostVisibility,
  ReactionType,
  ParticipationType,
} from '../common/enums';

// Fields without a value are left out of the JSON, not sent as null.
export interface PostBase {
  id: string; // UUID
  author: UserSummary;
  location?: EventLocation;
  title: string;
  description?: string;
  eventUrl?: string;
  startsAt: string; // ISO-8601
  endsAt?: string; // ISO-8601
  tags: string[];
  positiveReactionCount: number;
  participantCount: number;
  commentsCount: number;
  type: PostType;
  status: PostStatus;
  visibility: PostVisibility;
  createdAt: string; // ISO-8601
  lastModifiedAt?: string; // ISO-8601
  deletedAt?: string; // ISO-8601
  myReaction?: ReactionType;
  myParticipation?: ParticipationType;
  coverMedia?: MediaResource;
}
