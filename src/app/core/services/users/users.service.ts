import { inject, Injectable } from '@angular/core';
import { ApiUrlService } from '../api-url.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { UserProfile } from '../../models/users/user-profile.model';
import { Observable } from 'rxjs';
import { MediaUploadConfirmation } from '../../models/media/media-upload.confirmation.model';
import { PaginationInfo } from '../../models/common/paginated-response.model';

@Injectable({
  providedIn: 'root',
})
export class Users {
  private apiurl = inject(ApiUrlService);
  private http = inject(HttpClient);

  searchForUsers(q: string, pagination: PaginationInfo): Observable<UserProfile[]> {
    const params = new HttpParams()
      .set('q', q)
      .set('cursor', pagination.cursor)
      .set('limit', pagination.limit.toString());
    return this.http.get<UserProfile[]>(this.apiurl.path('/users'), { params });
  }

  getUserById(userId: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiurl.path(`/users/${userId}`));
  }

  updateProfile(userId: string, updatedInfo: Partial<UserProfile>): Observable<UserProfile> {
    return this.http.patch<UserProfile>(this.apiurl.path(`/users/${userId}`), updatedInfo);
  }

  setOrUpdateProfilePicture(
    userId: string,
    fullMediaId: string,
    thumbnailMediaId: string,
  ): Observable<MediaUploadConfirmation> {
    return this.http.put<MediaUploadConfirmation>(
      this.apiurl.path(`/users/${userId}/profile-image`),
      {
        fullMediaId: fullMediaId,
        thumbnailMediaId: thumbnailMediaId,
      },
    );
  }

  deleteProfileImage(userId: string): Observable<void> {
    return this.http.delete<void>(this.apiurl.path(`users/${userId}/profile-image`));
  }

  getUserByUsername(username: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.apiurl.path(`/users/by-username/${username}`));
  }
}
