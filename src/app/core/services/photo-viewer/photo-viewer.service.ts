import { Injectable, signal } from '@angular/core';
import { Photo } from '../../models/media/photo';

export interface OpenPhotos {
  photos: Photo[];
  index: number;
}

/** The full-screen photo viewer: a card asks for it, and the app shell shows it over everything. */
@Injectable({
  providedIn: 'root',
})
export class PhotoViewerService {
  readonly open = signal<OpenPhotos | null>(null);

  show(photos: Photo[], index: number): void {
    if (photos.length > 0) {
      this.open.set({ photos, index: Math.min(Math.max(index, 0), photos.length - 1) });
    }
  }

  close(): void {
    this.open.set(null);
  }
}
