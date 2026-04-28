import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { CommentCreateRequest } from '../../models/comments/comment-create-request.model';
import { CommentUpdateRequest } from '../../models/comments/comment-update-request.model';
import { CommentSummary } from '../../models/comments/comment-summary.model';
import { PaginatedResponse, PaginationInfo } from '../../models/common/paginated-response.model';

@Injectable({
  providedIn: 'root',
})
export class CommentsService {
  private apiUrl = inject(ApiUrlService);
  private http = inject(HttpClient);

  public commentAdded$ = new Subject<CommentSummary>();

  // Leave parentCommentId empty to fetch root-level comments.
  // Provide parentCommentId to fetch direct replies to a specific comment.
  // The API enforces a maximum thread depth of 3 (root -> reply -> reply to reply).
  getCommentsOfPost(
    postId: string,
    parentCommentId?: string,
    pagination?: PaginationInfo,
  ): Observable<PaginatedResponse<CommentSummary>> {
    let params = new HttpParams();

    if (parentCommentId) params = params.set('parentCommentId', parentCommentId);
    if (pagination?.cursor) params = params.set('cursor', pagination.cursor);
    if (pagination?.limit) params = params.set('limit', pagination.limit);

    return this.http.get<PaginatedResponse<CommentSummary>>(
      this.apiUrl.path(`/posts/${postId}/comments`),
      { params },
    );
  }

  createComment(postId: string, payload: CommentCreateRequest): Observable<CommentSummary> {
    return this.http.post<CommentSummary>(this.apiUrl.path(`/posts/${postId}/comments`), payload);
  }

  editComment(commentId: string, payload: CommentUpdateRequest): Observable<CommentSummary> {
    return this.http.patch<CommentSummary>(this.apiUrl.path(`/comments/${commentId}`), payload);
  }

  deleteComment(commentId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl.path(`/comments/${commentId}`));
  }
}
