import { UserSummary } from '../users/user-summary.model';
import { EventLocation } from '../common/geo.model';
import { MediaResource } from '../media/media-resource.model';
import { PostType, PostStatus, ReactionType, ParticipationType } from '../common/enums';
import { FriendStances } from './friend-stances.model';

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
  /** No end date: no endsAt, and the event never ends. */
  openEnded: boolean;
  positiveReactionCount: number;
  /** Interesuje mnie and Biorę udział together. */
  participantCount: number;
  interestedCount: number;
  goingCount: number;
  commentsCount: number;
  type: PostType;
  status: PostStatus;
  createdAt: string; // ISO-8601
  lastModifiedAt?: string; // ISO-8601
  deletedAt?: string; // ISO-8601
  myReaction?: ReactionType;
  myParticipation?: ParticipationType;
  coverMedia?: MediaResource;
  /** Left out for a guest, or when no friend took a stance. */
  friendStances?: FriendStances;
}
