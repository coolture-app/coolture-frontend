import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { lastValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FormFileUpload } from '../form-file-upload/form-file-upload';
import { PostMedia } from '../../models/posts/post-detail.model';
import { MAX_POST_PHOTOS } from '../../models/posts/post-limits';
import { imageSize, MediaService } from '../../services/media/media.service';
import { ToastService } from '../../services/toast/toast.service';

/** One photo in the form's gallery: saved on the post, or added in this form. */
export interface FormPhoto {
  /** Stays the same while the photo uploads, so it can be moved before it finishes. */
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
export class PostPhotos implements OnChanges, AfterViewChecked, OnDestroy {
  /** The post's saved photos, in any order. */
  @Input() saved: PostMedia[] = [];
  /** An edited post with no photos says so. */
  @Input() editing = false;

  private mediaService = inject(MediaService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private host = inject(ElementRef);

  /** In the order the post shows them. The first is the cover. */
  photos: FormPhoto[] = [];
  /** Saved photos the user took out. The post keeps them until the form is saved. */
  removedMediaIds: string[] = [];
  /** What screen readers hear after a change to the photos, which sighted people see happen. */
  photoStatus = '';

  readonly maxPhotos = MAX_POST_PHOTOS;

  private nextPhotoKey = 0;
  private isLeft = false;
  private pendingFocus: { key: string | null; control: PhotoControl } | null = null;

  get hasUploading(): boolean {
    return this.photos.some((photo) => photo.isUploading);
  }

  get photosFull(): boolean {
    return this.photos.length >= MAX_POST_PHOTOS;
  }

  /** In the order the post will show them: the first is the cover. */
  mediaIds(): string[] {
    return this.photos.flatMap((photo) => photo.mediaId ?? []);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['saved']) {
      this.showSavedPhotos();
    }
  }

  async onFilesSelected(selected: File[]): Promise<void> {
    const room = Math.max(0, MAX_POST_PHOTOS - this.photos.length);
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
      const photo: FormPhoto = {
        key: `new-${this.nextPhotoKey++}`,
        url: URL.createObjectURL(file),
        isUploading: true,
        isSaved: false,
      };
      this.photos.push(photo);
      // Later files arrive after the first's upload, with no event to show them.
      this.cdr.markForCheck();

      try {
        const size = await imageSize(file);
        const initRes = await lastValueFrom(
          this.mediaService.initUpload({
            purpose: 'EVENT_MEDIA',
            mimeType: file.type,
            sizeBytes: file.size,
            fileName: file.name,
            ...size,
          }),
        );

        await lastValueFrom(
          this.mediaService.uploadToS3(initRes.uploadUrl, file, initRes.requiredHeaders),
        );
        await lastValueFrom(this.mediaService.completeUpload(initRes.mediaId));

        photo.mediaId = initRes.mediaId;
        photo.isUploading = false;
        if (this.isLeft) {
          this.deleteUpload(initRes.mediaId);
          return;
        }
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Error while loading file', file.name, err);
        URL.revokeObjectURL(photo.url);
        this.photos = this.photos.filter((p) => p !== photo);
        if (!this.isLeft) {
          this.toast.show(this.translate.instant('POST_FORM.upload-failed', { name: file.name }));
        }
        this.cdr.detectChanges();
      }
    }
  }

  onPhotoDropped(event: CdkDragDrop<FormPhoto[]>): void {
    this.moveTo(event.previousIndex, event.currentIndex);
  }

  /** The button keeps the focus, even at the end of the row, because moving a tile in the page would drop it. */
  movePhoto(index: number, by: -1 | 1): void {
    const target = index + by;
    if (target < 0 || target >= this.photos.length) {
      return;
    }
    this.pendingFocus = { key: this.photos[index].key, control: by < 0 ? 'earlier' : 'later' };
    this.moveTo(index, target);
  }

  /** Moves the photo to the front, and the others keep their order. */
  setAsCover(index: number): void {
    // This photo's "set as cover" button is about to go, so the focus moves to the one beside it.
    this.pendingFocus = { key: this.photos[index].key, control: 'later' };
    this.moveTo(index, 0);
  }

  removePhoto(index: number): void {
    const [photo] = this.photos.splice(index, 1);
    if (photo.isSaved) {
      // The post keeps it until the form is saved, and leaving without saving changes nothing.
      this.removedMediaIds.push(photo.mediaId!);
    } else {
      URL.revokeObjectURL(photo.url);
      if (photo.mediaId) {
        this.deleteUpload(photo.mediaId);
      }
    }
    const next = this.photos[Math.min(index, this.photos.length - 1)];
    this.pendingFocus = { key: next?.key ?? null, control: 'remove' };
    this.announce(
      index === 0 && next ? 'POST_FORM.status-cover-removed' : 'POST_FORM.status-removed',
      { total: this.photos.length },
    );
  }

  /** The removed or moved control took the focus with it, so it comes back here once the page is updated. */
  ngAfterViewChecked(): void {
    const focus = this.pendingFocus;
    if (!focus) {
      return;
    }
    this.pendingFocus = null;
    const page: HTMLElement = this.host.nativeElement;
    const target = focus.key
      ? page.querySelector(`[data-photo-key="${focus.key}"] [data-control="${focus.control}"]`)
      : page.querySelector('.form-file-upload__dropzone');
    (target as HTMLElement | null)?.focus();
  }

  /** Deletes what this form uploaded and the post doesn't hold. Saved photos stay. */
  discardUploads(): void {
    for (const photo of this.photos) {
      if (!photo.isSaved && photo.mediaId) {
        this.deleteUpload(photo.mediaId);
      }
    }
  }

  reset(): void {
    this.revokeAddedPhotos();
    this.photos = [];
    this.removedMediaIds = [];
    this.photoStatus = '';
    this.pendingFocus = null;
  }

  /** An upload still running when the form is left deletes itself once it finishes. */
  ngOnDestroy(): void {
    this.isLeft = true;
    this.revokeAddedPhotos();
  }

  private revokeAddedPhotos(): void {
    for (const photo of this.photos.filter((p) => !p.isSaved)) {
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
    moveItemInArray(this.photos, from, to);
    this.announce(from === 0 || to === 0 ? 'POST_FORM.status-cover' : 'POST_FORM.status-moved', {
      number: to + 1,
      total: this.photos.length,
    });
  }

  private announce(key: string, params: Record<string, number>): void {
    this.photoStatus = this.translate.instant(key, params);
  }

  private showSavedPhotos(): void {
    const added = this.photos.filter((photo) => !photo.isSaved);
    const saved = [...this.saved]
      .sort((a, b) => a.position - b.position)
      .map(
        (item): FormPhoto => ({
          key: item.media.id,
          url: item.media.url ?? '',
          isUploading: false,
          isSaved: true,
          mediaId: item.media.id,
        }),
      );
    this.photos = [...saved, ...added];
    this.removedMediaIds = [];
  }
}
