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
import { FeedPage } from '../../models/posts/feed-page.model';
import { GeoPoint } from '../../models/common/geo.model';
import { PostMark } from '../../models/posts/post-mark.model';

/**
 * The first page may send a location for proximity, which the cursor then holds. The filters go with
 * every page, as on `/posts`, and a radius sends its own centre every time.
 */
export interface FeedParams {
  cursor?: string;
  limit?: number;
  location?: GeoPoint;
  filters?: PostFilterParams;
}

/** The search and filters that `/posts` and `/posts/map` both take. */
function filterParams(filters: PostFilterParams): HttpParams {
  let params = new HttpParams();
  if (filters.q) params = params.set('q', filters.q);
  if (filters.authorId) params = params.set('authorId', filters.authorId);
  if (filters.status) params = params.set('status', filters.status);
  if (filters.visibility) params = params.set('visibility', filters.visibility);
  if (filters.type) params = params.set('type', filters.type);
  if (filters.startsFrom) params = params.set('startsFrom', filters.startsFrom);
  if (filters.startsTo) params = params.set('startsTo', filters.startsTo);
  if (filters.includePast) params = params.set('includePast', true);
  if (filters.reactionType) params = params.set('reactionType', filters.reactionType);
  filters.participationTypes?.forEach(
    (type) => (params = params.append('participationTypes', type)),
  );
  filters.tags?.forEach((tag) => (params = params.append('tags', tag)));
  if (filters.radiusKm && filters.latitude !== undefined && filters.longitude !== undefined) {
    params = params
      .set('latitude', filters.latitude)
      .set('longitude', filters.longitude)
      .set('radiusKm', filters.radiusKm);
  }
  return params;
}

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
    let params = filterParams(filters);
    if (filters.cursor) params = params.set('cursor', filters.cursor);
    if (filters.limit) params = params.set('limit', filters.limit);
    // NEAREST needs the position even without a radius.
    if (filters.latitude !== undefined && filters.longitude !== undefined) {
      params = params.set('latitude', filters.latitude).set('longitude', filters.longitude);
    }
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);

    return this.http.get<PaginatedResponse<PostCard>>(this.apiUrl.path('/posts'), { params });
  }

  getFeed({ cursor, limit, location, filters = {} }: FeedParams = {}): Observable<FeedPage> {
    let params = filterParams(filters);
    if (limit) params = params.set('limit', limit);
    if (cursor) {
      params = params.set('cursor', cursor);
    } else if (location && !params.has('latitude')) {
      params = params.set('latitude', location.latitude).set('longitude', location.longitude);
    }
    return this.http.get<FeedPage>(this.apiUrl.path('/feed'), { params });
  }

  /** With excludeMine, the map leaves out what the feed leaves out: the viewer's own and reacted posts. */
  getMapMarks(
    filters: PostFilterParams = {},
    bounds: {
      leftUpper: { latitude: number; longitude: number };
      rightBottom: { latitude: number; longitude: number };
    },
    excludeMine = false,
  ): Observable<PostMark[]> {
    let params = filterParams(filters);
    if (excludeMine) params = params.set('excludeMine', true);
    params = params.set('leftUpper.latitude', bounds.leftUpper.latitude.toString());
    params = params.set('leftUpper.longitude', bounds.leftUpper.longitude.toString());
    params = params.set('rightBottom.latitude', bounds.rightBottom.latitude.toString());
    params = params.set('rightBottom.longitude', bounds.rightBottom.longitude.toString());

    return this.http.get<PostMark[]>(this.apiUrl.path('/posts/map'), { params });
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
