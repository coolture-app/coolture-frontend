import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { PaginatedResponse, PaginationInfo } from '../../models/common/paginated-response.model';
import { UserListItem } from '../../models/users/user-summary.model';
import { ConfirmRequest } from '../confirm/confirm.service';

export function unblockQuestion(username: string): ConfirmRequest {
  return {
    title: 'PROFILE.unblockTitle',
    text: 'PROFILE.unblockText',
    confirm: 'PROFILE.unblock',
    params: { username },
  };
}

@Injectable({
  providedIn: 'root',
})
export class RelationsService {
  private apiUrl = inject(ApiUrlService);
  private http = inject(HttpClient);

  /** Sorted by name, A to Z. `q` keeps names or usernames holding all its words. */
  getFollowers(
    userId: string,
    pagination?: PaginationInfo,
    q?: string,
  ): Observable<PaginatedResponse<UserListItem>> {
    return this.http.get<PaginatedResponse<UserListItem>>(
      this.apiUrl.path(`/users/${userId}/followers`),
      { params: this.peopleParams(pagination, q) },
    );
  }

  getFollowing(
    userId: string,
    pagination?: PaginationInfo,
    q?: string,
  ): Observable<PaginatedResponse<UserListItem>> {
    return this.http.get<PaginatedResponse<UserListItem>>(
      this.apiUrl.path(`/users/${userId}/following`),
      { params: this.peopleParams(pagination, q) },
    );
  }

  getBlocking(
    userId: string,
    pagination?: PaginationInfo,
  ): Observable<PaginatedResponse<UserListItem>> {
    return this.http.get<PaginatedResponse<UserListItem>>(
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

  private peopleParams(pagination?: PaginationInfo, q?: string): HttpParams {
    const params = this.paginationParams(pagination);
    return q ? params.set('q', q) : params;
  }

  private paginationParams(pagination?: PaginationInfo): HttpParams {
    let params = new HttpParams();
    if (pagination?.cursor) params = params.set('cursor', pagination.cursor);
    if (pagination?.limit) params = params.set('limit', pagination.limit.toString());
    return params;
  }
}
