import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { ApiUrlService } from '../api-url.service';
import { MediaUploadInitRequest } from '../../models/media/media-upload-init-request.model';
import { MediaUploadInitResponse } from '../../models/media/media-upload-init-response.model';
import { MediaResource } from '../../models/media/media-resource.model';
import { MediaPurpose } from '../../models/common/enums';

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

  /** The file is stored but belongs to nothing until a post or the profile takes its id. */
  async upload(file: File, purpose: MediaPurpose): Promise<MediaResource> {
    const request: MediaUploadInitRequest = {
      purpose,
      mimeType: file.type,
      sizeBytes: file.size,
      fileName: file.name,
      ...(await imageSize(file)),
    };
    const init = await firstValueFrom(
      this.http.post<MediaUploadInitResponse>(this.apiUrl.path('/media/uploads/init'), request),
    );
    let headers = new HttpHeaders();
    for (const [key, value] of Object.entries(init.requiredHeaders)) {
      // The S3 PUT must skip `host` and `content-length`.
      if (!['host', 'content-length'].includes(key.toLowerCase())) {
        headers = headers.set(key, value);
      }
    }
    await firstValueFrom(this.http.put(init.uploadUrl, file, { headers, responseType: 'text' }));
    return firstValueFrom(
      this.http.post<MediaResource>(
        this.apiUrl.path(`/media/uploads/${init.mediaId}/complete`),
        {},
      ),
    );
  }

  deleteMedia(mediaId: string): Observable<void> {
    return this.http.delete<void>(this.apiUrl.path(`/media/${mediaId}`));
  }
}
