import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { MediaUploadInitRequest } from '../../models/media/media-upload-init-request.model';
import { MediaUploadInitResponse } from '../../models/media/media-upload-init-response.model';
import { MediaCompleteRequest } from '../../models/media/media-complete-request.model';
import { MediaResource } from '../../models/media/media-resource.model';

@Injectable({
  providedIn: 'root',
})
export class MediaService {
  private apiUrl = inject(ApiUrlService);
  private http = inject(HttpClient);

  // ===== FIRST STEP: INIT =====
  // we initate the desire to upload file
  // we get S3 url and MediaId as a response
  initUpload(payload: MediaUploadInitRequest): Observable<MediaUploadInitResponse> {
    return this.http.post<MediaUploadInitResponse>(
      this.apiUrl.path('/media/uploads/init'),
      payload,
    );
  }

  // ===== SECOND STEP: UPLOADING TO S3=====

  uploadToS3(
    uploadUrl: string,
    file: File,
    requiredHeaders: Record<string, string>,
  ): Observable<HttpResponse<string>> {
    let headers = new HttpHeaders();

    Object.keys(requiredHeaders).forEach((key) => {
      headers = headers.set(key, requiredHeaders[key]);
    });

    return this.http.put(uploadUrl, file, {
      headers: headers,
      observe: 'response',
      responseType: 'text',
    });
  }

  // ===== THIRD STEP: INFORM BACKEND =====

  completeUpload(mediaId: string, payload: MediaCompleteRequest = {}): Observable<MediaResource> {
    return this.http.post<MediaResource>(
      this.apiUrl.path(`/media/uploads/${mediaId}/complete`),
      payload,
    );
  }

  // ===== FETCHING AND DELETING =====

  getMedia(mediaId: string): Observable<MediaResource> {
    return this.http.get<MediaResource>(this.apiUrl.path(`/media/${mediaId}`));
  }

  deleteMedia(mediaId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl.path(`/media/${mediaId}`));
  }
}
