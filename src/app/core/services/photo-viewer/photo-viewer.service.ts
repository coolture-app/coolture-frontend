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
    this.open.set({ photos, index });
  }

  close(): void {
    this.open.set(null);
  }
}
