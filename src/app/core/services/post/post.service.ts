import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { PostDetail } from '../../models/posts/post-detail.model';
import { PostCard } from '../../models/posts/post-card.model';
import { PostCreateRequest } from '../../models/posts/post-create-request.model';
import { PostUpdateRequest } from '../../models/posts/post-update-request.model';
import { PaginatedResponse } from '../../models/common/paginated-response.model';
import { PostFilterParams } from '../../models/posts/post-filter-params.model';

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private http = inject(HttpClient);
  private apiUrl = inject(ApiUrlService);

  readonly activePost = signal<PostDetail | null>(null);

  setActivePost(post: PostDetail): void {
    this.activePost.set(post);
  }

  clearActivePost(): void {
    this.activePost.set(null);
  }

  // ===== API CALLS =====
  getPosts(filters: PostFilterParams = {}): Observable<PaginatedResponse<PostCard>> {
    let params = new HttpParams();

    if (filters.cursor) params = params.set('cursor', filters.cursor);
    if (filters.limit) params = params.set('limit', filters.limit);
    if (filters.q) params = params.set('q', filters.q);
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.authorId) params = params.set('authorId', filters.authorId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.visibility) params = params.set('visibility', filters.visibility);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.startsFrom) params = params.set('startsFrom', filters.startsFrom);
    if (filters.startsTo) params = params.set('startsTo', filters.startsTo);
    if (filters.latitude) params = params.set('latitude', filters.latitude);
    if (filters.longitude) params = params.set('longitude', filters.longitude);
    if (filters.radiusKm) params = params.set('radiusKm', filters.radiusKm);

    if (filters.participationTypes) {
      filters.participationTypes.forEach((type) => {
        params = params.append('participationTypes', type);
      });
    }
    if (filters.reactionType) params = params.set('reactionType', filters.reactionType);

    if (filters.tags) {
      filters.tags.forEach((tag) => {
        params = params.append('tags', tag);
      });
    }

    return this.http.get<PaginatedResponse<PostCard>>(this.apiUrl.path('/posts'), { params });
  }

  getPost(id: string): Observable<PostDetail> {
    return this.http.get<PostDetail>(this.apiUrl.path(`/posts/${id}`));
  }

  addPost(payload: PostCreateRequest): Observable<PostDetail> {
    return this.http.post<PostDetail>(this.apiUrl.path('/posts'), payload);
  }

  updatePost(id: string, payload: PostUpdateRequest): Observable<PostDetail> {
    return this.http.patch<PostDetail>(this.apiUrl.path(`/posts/${id}`), payload);
  }

  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl.path(`/posts/${id}`));
  }
}
