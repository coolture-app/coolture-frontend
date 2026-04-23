import { UserMin } from './userMin.model';

export interface PostComment {
  commentId: number;
  author: UserMin;
  likesCount: number;
  content: string;
  postUuid: string;
  parentUuid: string;
  replies: PostComment[];
}
