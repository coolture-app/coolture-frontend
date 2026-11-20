import { ParticipationType, ReactionType } from '../common/enums';
import { GeoPoint } from '../common/geo.model';
import { FriendStances } from './friend-stances.model';

export interface PostMark {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  /** No end date: no endsAt, and the event never ends. */
  openEnded: boolean;
  coverMediaUrl?: string;
  /** The description's start, for the map's preview. */
  excerpt?: string;
  positiveReactionCount: number;
  interestedCount: number;
  goingCount: number;
  coordinates: GeoPoint;
  venueName?: string;
  city?: string;
  /** The kind the pin names: the first one the filter asked for, else the first; left out until derived. */
  kind?: string;
  /** Every kind, best first; left out until derived. */
  kinds?: string[];
  /** The viewer's own; left out for a guest. */
  myReaction?: ReactionType;
  myParticipation?: ParticipationType;
  friendStances?: FriendStances;
}
