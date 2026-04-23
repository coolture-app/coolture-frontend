import { PostComment } from './comments.model';
import { EventLocation } from './eventLocation.model';
import { UserMin } from './userMin.model';

export interface PostModel {
  id: number;
  title: string;
  user: UserMin;
  dateOfEvent: string;
  dateOfPosting: string;
  // location: EventLocation;
  description: string;
  photos?: string[];
  likesCount: number;
  participatingCount: number;
  commentCount: number;
  comments: PostComment[];
}
