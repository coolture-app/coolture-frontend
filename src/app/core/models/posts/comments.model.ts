import { UserMin } from './userMin.model';

export interface PostComment {
  id: number;
  author: UserMin;
  likesCount: number;
  content: string;
  comments: PostComment[];
}
