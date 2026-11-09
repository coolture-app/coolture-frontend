import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { MediaUploadInitRequest } from '../../models/media/media-upload-init-request.model';
import { MediaUploadInitResponse } from '../../models/media/media-upload-init-response.model';
import { MediaCompleteRequest } from '../../models/media/media-complete-request.model';
import { MediaResource } from '../../models/media/media-resource.model';

/**
 * An image's size in pixels, as the browser shows it (turned by its EXIF orientation), or null when
 * the file isn't an image the browser can read.
 */
export async function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) {
    return null;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'host' && lowerKey !== 'content-length') {
        headers = headers.set(key, requiredHeaders[key]);
      }
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
