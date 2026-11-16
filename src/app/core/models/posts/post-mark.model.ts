import { ParticipationType, ReactionType } from '../common/enums';
import { GeoPoint } from '../common/geo.model';
import { FriendStances } from './friend-stances.model';

export interface PostMark {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  coverMediaUrl?: string;
  /** The description's start, for the map's preview. */
  excerpt?: string;
  positiveReactionCount: number;
  interestedCount: number;
  goingCount: number;
  coordinates: GeoPoint;
  venueName?: string;
  city?: string;
  /** The viewer's own; left out for a guest. */
  myReaction?: ReactionType;
  myParticipation?: ParticipationType;
  friendStances?: FriendStances;
}
