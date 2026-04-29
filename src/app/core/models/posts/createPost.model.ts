import { EventLocation } from './eventLocation.model';

export interface CreatePostModel {
  categoryId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  eventUrl: string | null;
  tags: string[];
  type: 'OFFLINE' | 'ONLINE';
  visibility: 'PUBLIC' | 'PRIVATE' | 'FRIENDS';
  location: EventLocation | null;
}

export interface UpdatePostModel {
  categoryId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  eventUrl: string | null;
  tags: string[];
  type: 'OFFLINE' | 'ONLINE';
  visibility: 'PUBLIC' | 'PRIVATE' | 'FRIENDS';
  location: EventLocation | null;
}
