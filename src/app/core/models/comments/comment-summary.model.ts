import { UserSummary } from '../users/user-summary.model';
import { CommentStatus } from '../common/enums';

export interface CommentSummary {
  id: string; // UUID
  postId: string; // UUID
  rootCommentId: string | null; // UUID
  parentCommentId: string | null; // UUID
  author: UserSummary;
  content: string;
  depth: number; // 0 = root, 1 = response, 2 = response to response
  repliesCount: number;
  createdAt: string; // ISO-8601
  lastEditedAt: string | null; // ISO-8601
  deletedAt: string | null; // ISO-8601
  status: CommentStatus;
}
