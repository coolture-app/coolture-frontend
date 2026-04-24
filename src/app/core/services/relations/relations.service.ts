import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { PaginatedResponse, PaginationInfo } from '../../models/common/paginated-response.model';
import { UserSummary } from '../../models/users/user-summary.model';

@Injectable({
  providedIn: 'root',
})
export class RelationsService {
  private apiUrl = inject(ApiUrlService);
  private http = inject(HttpClient);

  getFollowers(
    userId: string,
    pagination?: PaginationInfo,
  ): Observable<PaginatedResponse<UserSummary>> {
    return this.http.get<PaginatedResponse<UserSummary>>(
      this.apiUrl.path(`/users/${userId}/followers`),
      { params: this.paginationParams(pagination) },
    );
  }

  getFollowing(
    userId: string,
    pagination?: PaginationInfo,
  ): Observable<PaginatedResponse<UserSummary>> {
    return this.http.get<PaginatedResponse<UserSummary>>(
      this.apiUrl.path(`/users/${userId}/following`),
      { params: this.paginationParams(pagination) },
    );
  }

  getBlocking(
    userId: string,
    pagination?: PaginationInfo,
  ): Observable<PaginatedResponse<UserSummary>> {
    return this.http.get<PaginatedResponse<UserSummary>>(
      this.apiUrl.path(`/users/${userId}/blocking`),
      { params: this.paginationParams(pagination) },
    );
  }

  follow(userId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/users/${userId}/follow`), null);
  }

  unfollow(userId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl.path(`/users/${userId}/follow`));
  }

  block(userId: string): Observable<void> {
    return this.http.post<void>(this.apiUrl.path(`/users/${userId}/block`), null);
  }

  unblock(userId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl.path(`/users/${userId}/block`));
  }

  private paginationParams(pagination?: PaginationInfo): HttpParams {
    let params = new HttpParams();
    if (pagination?.cursor) params = params.set('cursor', pagination.cursor);
    if (pagination?.limit) params = params.set('limit', pagination.limit.toString());
    return params;
  }
}
