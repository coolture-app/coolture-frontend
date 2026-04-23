export interface CommentCreateRequest {
  content: string;
  parentCommentId?: string | null;
}
