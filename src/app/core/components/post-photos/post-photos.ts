import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  OnDestroy,
  signal,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FormFileUpload } from '../form-file-upload/form-file-upload';
import { PostMedia } from '../../models/posts/post-detail.model';
import { MAX_POST_PHOTOS } from '../../models/posts/post-limits';
import { MediaService } from '../../services/media/media.service';
import { ToastService } from '../../services/toast/toast.service';

/** One photo in the form's gallery: saved on the post, or added in this form. */
export interface FormPhoto {
  /** A saved photo's media id. An added one's stays the same while it uploads, so it can be moved before it finishes. */
  key: string;
  url: string;
  isUploading: boolean;
  isSaved: boolean;
  mediaId?: string;
}

type PhotoControl = 'earlier' | 'later' | 'remove';

/**
 * The post form's photos: uploaded as soon as they're added, ordered by drag or arrows. The first is the cover.
 * Whether its uploads outlive the form is the form's call, see `discardUploads`.
 */
@Component({
  selector: 'app-post-photos',
  imports: [TranslatePipe, FormFileUpload, CdkDropList, CdkDrag],
  templateUrl: './post-photos.html',
  styleUrl: './post-photos.scss',
})
export class PostPhotos implements OnDestroy {
  /** The post's saved photos, in any order. */
  readonly saved = input<PostMedia[]>([]);
  /** An edited post with no photos says so. */
  readonly editing = input(false);

  private mediaService = inject(MediaService);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private host = inject(ElementRef);
  private injector = inject(Injector);

  /** In the order the post shows them. The first is the cover. Photos added here outlast a new `saved`. */
  readonly photos = linkedSignal<PostMedia[], FormPhoto[]>({
    source: this.saved,
    computation: (saved, previous) => [
      ...[...saved]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({
          key: item.media.id,
          url: item.media.url ?? '',
          isUploading: false,
          isSaved: true,
          mediaId: item.media.id,
        })),
      ...(previous?.value.filter((photo) => !photo.isSaved) ?? []),
    ],
  });
  /** Saved photos the user took out. The post keeps them until the form is saved. */
  readonly removedMediaIds = linkedSignal<PostMedia[], string[]>({
    source: this.saved,
    computation: () => [],
  });
  /** What screen readers hear after a change to the photos, which sighted people see happen. */
  readonly photoStatus = signal('');

  readonly hasUploading = computed(() => this.photos().some((photo) => photo.isUploading));
  readonly photosFull = computed(() => this.photos().length >= MAX_POST_PHOTOS);
  readonly mediaIds = computed(() => this.photos().flatMap((photo) => photo.mediaId ?? []));
  /** Added, removed or moved since `saved`. */
  readonly changed = computed(
    () =>
      this.photos()
        .map((photo) => photo.key)
        .join() !==
      [...this.saved()]
        .sort((a, b) => a.position - b.position)
        .map((item) => item.media.id)
        .join(),
  );

  readonly maxPhotos = MAX_POST_PHOTOS;

  private nextPhotoKey = 0;
  private isLeft = false;

  async onFilesSelected(selected: File[]): Promise<void> {
    const room = Math.max(0, MAX_POST_PHOTOS - this.photos().length);
    const files = selected.slice(0, room);
    if (files.length < selected.length) {
      this.toast.show(
        this.translate.instant('POST_FORM.too-many-photos', { max: MAX_POST_PHOTOS }),
      );
    }
    for (const file of files) {
      if (this.isLeft) {
        return;
      }
      const key = `new-${this.nextPhotoKey++}`;
      const url = URL.createObjectURL(file);
      this.photos.update((photos) => [...photos, { key, url, isUploading: true, isSaved: false }]);

      try {
        const { id } = await this.mediaService.upload(file, 'EVENT_MEDIA');
        if (this.isLeft) {
          this.deleteUpload(id);
          return;
        }
        this.photos.update((photos) =>
          photos.map((photo) =>
            photo.key === key ? { ...photo, mediaId: id, isUploading: false } : photo,
          ),
        );
      } catch (err) {
        console.error('Error while loading file', file.name, err);
        URL.revokeObjectURL(url);
        this.photos.update((photos) => photos.filter((photo) => photo.key !== key));
        if (!this.isLeft) {
          this.toast.show(this.translate.instant('POST_FORM.upload-failed', { name: file.name }));
        }
      }
    }
  }

  onPhotoDropped(event: CdkDragDrop<FormPhoto[]>): void {
    this.moveTo(event.previousIndex, event.currentIndex);
  }

  /** The button keeps the focus, even at the end of the row, because moving a tile in the page would drop it. */
  movePhoto(index: number, by: -1 | 1): void {
    const target = index + by;
    if (target < 0 || target >= this.photos().length) {
      return;
    }
    this.focusAfterRender(this.photos()[index].key, by < 0 ? 'earlier' : 'later');
    this.moveTo(index, target);
  }

  setAsCover(index: number): void {
    // The "Make cover" button is replaced by the cover badge, so the focus goes to this tile's "later" arrow.
    this.focusAfterRender(this.photos()[index].key, 'later');
    this.moveTo(index, 0);
  }

  removePhoto(index: number): void {
    const photo = this.photos()[index];
    const photos = this.photos().filter((_, i) => i !== index);
    this.photos.set(photos);
    if (photo.isSaved) {
      this.removedMediaIds.update((ids) => [...ids, photo.key]);
    } else {
      URL.revokeObjectURL(photo.url);
      if (photo.mediaId) {
        this.deleteUpload(photo.mediaId);
      }
    }
    const next = photos[Math.min(index, photos.length - 1)];
    this.focusAfterRender(next?.key ?? null, 'remove');
    this.announce(
      index === 0 && next ? 'POST_FORM.status-cover-removed' : 'POST_FORM.status-removed',
      { total: photos.length },
    );
  }

  /** Deletes what this form uploaded and the post doesn't hold. Saved photos stay. */
  discardUploads(): void {
    for (const photo of this.photos()) {
      if (!photo.isSaved && photo.mediaId) {
        this.deleteUpload(photo.mediaId);
      }
    }
  }

  /** An upload still running when the form is left deletes itself once it finishes. */
  ngOnDestroy(): void {
    this.isLeft = true;
    for (const photo of this.photos().filter((p) => !p.isSaved)) {
      URL.revokeObjectURL(photo.url);
    }
  }

  private deleteUpload(mediaId: string): void {
    this.mediaService.deleteMedia(mediaId).subscribe({
      error: (err) => console.error('Could not delete uploaded image', err),
    });
  }

  private moveTo(from: number, to: number): void {
    if (from === to) {
      return;
    }
    const photos = [...this.photos()];
    moveItemInArray(photos, from, to);
    this.photos.set(photos);
    this.announce(from === 0 || to === 0 ? 'POST_FORM.status-cover' : 'POST_FORM.status-moved', {
      number: to + 1,
      total: photos.length,
    });
  }

  private announce(key: string, params: Record<string, number>): void {
    this.photoStatus.set(this.translate.instant(key, params));
  }

  /** The removed or moved control took the focus with it, so it comes back once the page is updated. */
  private focusAfterRender(key: string | null, control: PhotoControl): void {
    afterNextRender(
      () => {
        const page: HTMLElement = this.host.nativeElement;
        const target = key
          ? page.querySelector(`[data-photo-key="${key}"] [data-control="${control}"]`)
          : page.querySelector('.form-file-upload__dropzone');
        (target as HTMLElement | null)?.focus();
      },
      { injector: this.injector },
    );
  }
}
