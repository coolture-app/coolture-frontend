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

export interface PostBase {
  id: string; // UUID
  author: UserSummary;
  location: EventLocation | null;
  title: string;
  description: string;
  eventUrl: string | null;
  startsAt: string; // ISO-8601
  endsAt: string | null; // ISO-8601
  tags: string[];
  positiveReactionCount: number;
  negativeReactionCount: number;
  participantCount: number;
  commentsCount: number;
  type: PostType;
  status: PostStatus;
  visibility: PostVisibility;
  createdAt: string; // ISO-8601
  lastModifiedAt: string | null; // ISO-8601
  deletedAt: string | null; // ISO-8601
  myReaction: ReactionType | null;
  myParticipation: ParticipationType | null;
  coverMedia: MediaResource | null;
}
