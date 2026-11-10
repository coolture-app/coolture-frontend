import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectorRef,
  AfterViewChecked,
  ElementRef,
  OnDestroy,
  OnInit,
  OnChanges,
  SimpleChanges,
  DestroyRef,
  afterNextRender,
  Injector,
  viewChild,
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule, formatDate } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { lastValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FormInput } from '../form-input/form-input';
import { FormTextarea } from '../form-textarea/form-textarea';
import { FormFileUpload } from '../form-file-upload/form-file-upload';
import { Btn } from '../btn/btn';
import { locationForm, PlacePicker } from '../place-picker/place-picker';

import { PostFormData } from '../../models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../models/posts/post-detail.model';
import { PostType, PostVisibility } from '../../models/common/enums';
import { EventLocationRequest } from '../../models/common/geo.model';
import { imageSize, MediaService } from '../../services/media/media.service';
import { MAX_POST_PHOTOS } from '../../models/posts/post-limits';
import { ToastService } from '../../services/toast/toast.service';

/**
 * A `datetime-local` input holds a local time with no zone, and the API sends UTC.
 * onSubmit reads the input back as local time, so it has to be filled with local time too.
 */
function toLocalInputValue(iso: string | undefined): string {
  return iso ? formatDate(iso, "yyyy-MM-dd'T'HH:mm", 'en-US') : '';
}

/** The API refuses an end that isn't after the start. The error sits on the end, where it shows. */
function endAfterStart(form: AbstractControl): ValidationErrors | null {
  const startsAt: string = form.get('startsAt')?.value;
  const endsAt = form.get('endsAt');
  if (!endsAt) {
    return null;
  }
  const wrong = !!startsAt && !!endsAt.value && endsAt.value <= startsAt;
  if (wrong !== endsAt.hasError('afterStart')) {
    endsAt.setErrors(wrong ? { afterStart: true } : null);
  }
  return null;
}

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

const VISIBILITY_LABELS: Record<PostVisibility, string> = {
  PUBLIC: 'POST_FORM.visibility-public',
  FRIENDS: 'POST_FORM.visibility-friends',
  PRIVATE: 'POST_FORM.visibility-private',
};

@Component({
  selector: 'app-post-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    FormInput,
    FormTextarea,
    FormFileUpload,
    Btn,
    CdkDropList,
    CdkDrag,
    PlacePicker,
  ],
  templateUrl: './post-form.html',
  styleUrl: './post-form.scss',
})
export class PostForm implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() initialData?: PostDetail;
  @Input() existingMedia: PostMedia[] = [];

  @Output() formSubmit = new EventEmitter<PostFormData>();

  private fb = inject(FormBuilder);
  private mediaService = inject(MediaService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private host = inject(ElementRef);

  private readonly placePicker = viewChild(PlacePicker);

  /** In the order the post shows them. The first is the cover. */
  photos: FormPhoto[] = [];
  /** What screen readers hear after a change to the photos, which sighted people see happen. */
  photoStatus = '';
  isSubmitting = false;
  /** Most events have no end, so its field waits for "Dodaj zakończenie". */
  showEnd = false;

  private removedMediaIds: string[] = [];
  private nextPhotoKey = 0;
  private isLeft = false;
  private pendingFocus: { key: string | null; control: PhotoControl } | null = null;

  /** Prywatne left the form. A post saved as private keeps it while being edited. */
  get visibilityOptions(): { value: PostVisibility; labelKey: string }[] {
    const values: PostVisibility[] =
      this.initialData?.visibility === 'PRIVATE'
        ? ['PUBLIC', 'FRIENDS', 'PRIVATE']
        : ['PUBLIC', 'FRIENDS'];
    return values.map((value) => ({ value, labelKey: VISIBILITY_LABELS[value] }));
  }

  readonly locationGroup = locationForm();

  postForm = this.fb.group(
    {
      title: ['', [Validators.required, Validators.maxLength(128)]],
      type: ['OFFLINE' as PostType, Validators.required],
      startsAt: ['', Validators.required],
      endsAt: [''],
      description: ['', [Validators.required, Validators.maxLength(1024)]],
      eventUrl: [''],
      visibility: ['PUBLIC' as PostVisibility, Validators.required],
      location: this.locationGroup,
    },
    { validators: endAfterStart },
  );

  get titleControl(): FormControl {
    return this.postForm.controls.title;
  }
  get startsAtControl(): FormControl {
    return this.postForm.controls.startsAt;
  }
  get endsAtControl(): FormControl {
    return this.postForm.controls.endsAt;
  }
  get descriptionControl(): FormControl {
    return this.postForm.controls.description;
  }
  get eventUrlControl(): FormControl {
    return this.postForm.controls.eventUrl;
  }

  get isOffline(): boolean {
    return this.postForm.controls.type.value === 'OFFLINE';
  }

  get hasUploading(): boolean {
    return this.photos.some((photo) => photo.isUploading);
  }

  readonly maxPhotos = MAX_POST_PHOTOS;

  get photosFull(): boolean {
    return this.photos.length >= MAX_POST_PHOTOS;
  }

  ngOnInit(): void {
    this.postForm.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.matchLocationTo(type ?? 'OFFLINE'));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.patchFormFromPost(this.initialData);
    }
    if (changes['existingMedia']) {
      this.showSavedPhotos();
    }
  }

  /** An online post has no place, so its fields don't validate. They stay filled for a switch back. */
  private matchLocationTo(type: PostType): void {
    if (type === 'OFFLINE') {
      this.locationGroup.enable({ emitEvent: false });
    } else {
      this.locationGroup.disable({ emitEvent: false });
    }
  }

  private patchFormFromPost(post: PostDetail): void {
    const location = post.location;
    this.postForm.patchValue({
      title: post.title,
      type: post.type,
      startsAt: toLocalInputValue(post.startsAt),
      endsAt: toLocalInputValue(post.endsAt),
      description: post.description ?? '',
      eventUrl: post.eventUrl ?? '',
      visibility: post.visibility ?? 'PUBLIC',
      location: {
        venueName: location?.venueName ?? '',
        street: location?.street ?? '',
        buildingNum: location?.buildingNum ?? '',
        postalCode: location?.postalCode ?? '',
        city: location?.city ?? '',
        countryCode: location?.countryCode ?? null,
        coordinates: location?.coordinates ?? null,
      },
    });
    this.showEnd = !!post.endsAt;
    this.matchLocationTo(post.type);
  }

  addEnd(): void {
    this.showEnd = true;
    this.focusAfterRender('#endsAt');
  }

  removeEnd(): void {
    this.showEnd = false;
    this.postForm.controls.endsAt.setValue('');
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

  /**
   * Leaving without publishing drops what this form uploaded, and a daily job catches a closed tab.
   * While saving, the post may already hold these photos, so they stay.
   */
  ngOnDestroy(): void {
    this.isLeft = true;
    for (const photo of this.photos.filter((p) => !p.isSaved)) {
      URL.revokeObjectURL(photo.url);
      if (photo.mediaId && !this.isSubmitting) {
        this.deleteUpload(photo.mediaId);
      }
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
    const saved = [...this.existingMedia]
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

  onSubmit(): void {
    if (this.isSubmitting || this.hasUploading) {
      return;
    }
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      this.revealFirstError();
      return;
    }

    this.isSubmitting = true;
    const form = this.postForm.getRawValue();

    const data: PostFormData = {
      title: form.title ?? '',
      type: form.type ?? 'OFFLINE',
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
      endsAt: this.showEnd && form.endsAt ? new Date(form.endsAt).toISOString() : null,
      description: form.description ?? '',
      eventUrl: form.eventUrl?.trim() || null,
      visibility: form.visibility ?? 'PUBLIC',
      location: form.type === 'OFFLINE' ? this.locationRequest() : null,
      // In the order the post will show them: the first is the cover.
      mediaIds: this.photos.flatMap((photo) => photo.mediaId ?? []),
      removedMediaIds: this.removedMediaIds,
    };

    this.formSubmit.emit(data);
  }

  private locationRequest(): EventLocationRequest {
    const place = this.locationGroup.getRawValue();
    const optional = (text: string) => text.trim() || null;
    return {
      countryCode: place.countryCode,
      venueName: optional(place.venueName),
      street: optional(place.street),
      buildingNum: optional(place.buildingNum),
      postalCode: optional(place.postalCode),
      city: place.city.trim(),
      coordinates: place.coordinates!,
    };
  }

  /** Once the errors are on screen, the first one takes the focus, which scrolls it into view. */
  private revealFirstError(): void {
    if (this.isOffline) {
      this.placePicker()?.revealErrors();
    }
    this.focusAfterRender('.has-error input, .has-error textarea, [aria-invalid="true"]');
  }

  private focusAfterRender(selector: string): void {
    afterNextRender(
      () => (this.host.nativeElement as HTMLElement).querySelector<HTMLElement>(selector)?.focus(),
      { injector: this.injector },
    );
  }

  resetSubmitting(): void {
    this.isSubmitting = false;
  }

  resetForm(): void {
    this.postForm.reset({ type: 'OFFLINE', visibility: 'PUBLIC' });
    this.matchLocationTo('OFFLINE');
    this.showEnd = false;
    this.photos.filter((p) => !p.isSaved).forEach((p) => URL.revokeObjectURL(p.url));
    this.photos = [];
    this.removedMediaIds = [];
    this.photoStatus = '';
    this.pendingFocus = null;
    this.isSubmitting = false;
  }
}
