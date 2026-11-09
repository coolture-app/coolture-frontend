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
} from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { lastValueFrom, Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FormInput } from '../form-input/form-input';
import { FormSelect, SelectOption } from '../form-select/form-select';
import { FormTextarea } from '../form-textarea/form-textarea';
import { FormFileUpload } from '../form-file-upload/form-file-upload';
import { Btn } from '../btn/btn';

import { PostFormData } from '../../models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../models/posts/post-detail.model';
import { PostType, PostVisibility } from '../../models/common/enums';
import { imageSize, MediaService } from '../../services/media/media.service';
import { DictionaryService } from '../../services/dictionary/dictionary.service';
import { CountryCode } from '../../models/dictionary/country-code.model';
import { MAX_POST_PHOTOS } from '../../models/posts/post-limits';
import { ToastService } from '../../services/toast/toast.service';

/**
 * A `datetime-local` input holds a local time with no zone, and the API sends UTC.
 * onSubmit reads the input back as local time, so it has to be filled with local time too.
 */
function toLocalInputValue(iso: string | undefined): string {
  return iso ? formatDate(iso, "yyyy-MM-dd'T'HH:mm", 'en-US') : '';
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

@Component({
  selector: 'app-post-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    FormInput,
    FormSelect,
    FormTextarea,
    FormFileUpload,
    Btn,
    CdkDropList,
    CdkDrag,
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
  private dictionaryService = inject(DictionaryService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toast = inject(ToastService);
  private host = inject(ElementRef);

  countryCodes$: Observable<CountryCode[]> = this.dictionaryService.getCountryCodes();

  countryCodeOptions: SelectOption[] = [];

  /** In the order the post shows them. The first is the cover. */
  photos: FormPhoto[] = [];
  /** What screen readers hear after a change to the photos, which sighted people see happen. */
  photoStatus = '';
  isSubmitting = false;

  private removedMediaIds: string[] = [];
  private nextPhotoKey = 0;
  private isLeft = false;
  private pendingFocus: { key: string | null; control: PhotoControl } | null = null;

  typeOptions: SelectOption[] = [
    { value: 'ONLINE', label: '' },
    { value: 'OFFLINE', label: '' },
  ];

  visibilityOptions: SelectOption[] = [
    { value: 'PUBLIC', label: '' },
    { value: 'PRIVATE', label: '' },
    { value: 'FRIENDS', label: '' },
  ];

  // Form definition with validation matching API contract + DB schema
  postForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(128)]],
    type: ['ONLINE' as PostType, Validators.required],
    startsAt: ['', Validators.required],
    endsAt: [''],
    description: ['', [Validators.required, Validators.maxLength(1024)]],
    eventUrl: [''],
    tags: [''],
    visibility: ['PUBLIC' as PostVisibility, Validators.required],
    location: this.fb.group({
      countryCode: ['', [Validators.minLength(3), Validators.maxLength(3)]],
      venueName: ['', Validators.maxLength(64)],
      buildingNum: ['', Validators.maxLength(16)],
      street: ['', Validators.maxLength(128)],
      postalCode: ['', Validators.maxLength(16)],
      city: ['', Validators.maxLength(128)],
      coordinates: this.fb.group({
        latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
        longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
      }),
    }),
  });

  // FormControl getters for template
  get titleControl(): FormControl {
    return this.postForm.get('title') as FormControl;
  }
  get typeControl(): FormControl {
    return this.postForm.get('type') as FormControl;
  }
  get startsAtControl(): FormControl {
    return this.postForm.get('startsAt') as FormControl;
  }
  get endsAtControl(): FormControl {
    return this.postForm.get('endsAt') as FormControl;
  }
  get descriptionControl(): FormControl {
    return this.postForm.get('description') as FormControl;
  }
  get eventUrlControl(): FormControl {
    return this.postForm.get('eventUrl') as FormControl;
  }
  get tagsControl(): FormControl {
    return this.postForm.get('tags') as FormControl;
  }
  get visibilityControl(): FormControl {
    return this.postForm.get('visibility') as FormControl;
  }
  get countryCodeControl(): FormControl {
    return this.postForm.get('location.countryCode') as FormControl;
  }
  get cityControl(): FormControl {
    return this.postForm.get('location.city') as FormControl;
  }
  get postalCodeControl(): FormControl {
    return this.postForm.get('location.postalCode') as FormControl;
  }
  get streetControl(): FormControl {
    return this.postForm.get('location.street') as FormControl;
  }
  get buildingNumControl(): FormControl {
    return this.postForm.get('location.buildingNum') as FormControl;
  }
  get venueNameControl(): FormControl {
    return this.postForm.get('location.venueName') as FormControl;
  }
  get latitudeControl(): FormControl {
    return this.postForm.get('location.coordinates.latitude') as FormControl;
  }
  get longitudeControl(): FormControl {
    return this.postForm.get('location.coordinates.longitude') as FormControl;
  }

  get isOffline(): boolean {
    return this.postForm.get('type')?.value === 'OFFLINE';
  }

  get hasUploading(): boolean {
    return this.photos.some((photo) => photo.isUploading);
  }

  readonly maxPhotos = MAX_POST_PHOTOS;

  get photosFull(): boolean {
    return this.photos.length >= MAX_POST_PHOTOS;
  }

  ngOnInit(): void {
    // Load dictionaries, then re-patch form if initialData already arrived
    this.countryCodes$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((codes) => {
      this.countryCodeOptions = codes.map((c) => ({ value: c.code, label: c.code }));
      // Re-sync select after options are available
      if (this.initialData?.location) {
        this.countryCodeControl.setValue(this.initialData.location.countryCode ?? '', {
          emitEvent: false,
        });
      }
    });

    // Subscribe to type changes for location validators
    this.postForm
      .get('type')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.toggleLocationValidators(type ?? 'ONLINE'));

    this.toggleLocationValidators(this.postForm.get('type')?.value ?? 'ONLINE');

    // Set translated labels for type/visibility
    this.updateTranslatedOptions();
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateTranslatedOptions());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.patchFormFromPost(this.initialData);
    }
    if (changes['existingMedia']) {
      this.showSavedPhotos();
    }
  }

  private updateTranslatedOptions(): void {
    this.typeOptions = [
      { value: 'ONLINE', label: this.translate.instant('POST_FORM.type-online') },
      { value: 'OFFLINE', label: this.translate.instant('POST_FORM.type-offline') },
    ];
    this.visibilityOptions = [
      { value: 'PUBLIC', label: this.translate.instant('POST_FORM.visibility-public') },
      { value: 'PRIVATE', label: this.translate.instant('POST_FORM.visibility-private') },
      { value: 'FRIENDS', label: this.translate.instant('POST_FORM.visibility-friends') },
    ];
  }

  private patchFormFromPost(post: PostDetail): void {
    const tagsStr = post.tags ? post.tags.join(', ') : '';

    this.postForm.patchValue({
      title: post.title,
      type: post.type,
      startsAt: toLocalInputValue(post.startsAt),
      endsAt: toLocalInputValue(post.endsAt),
      description: post.description ?? '',
      eventUrl: post.eventUrl ?? '',
      tags: tagsStr,
      visibility: post.visibility ?? 'PUBLIC',
      location: {
        countryCode: post.location?.countryCode ?? '',
        venueName: post.location?.venueName ?? '',
        buildingNum: post.location?.buildingNum ?? '',
        street: post.location?.street ?? '',
        postalCode: post.location?.postalCode ?? '',
        city: post.location?.city ?? '',
        coordinates: {
          latitude: post.location?.coordinates?.latitude ?? null,
          longitude: post.location?.coordinates?.longitude ?? null,
        },
      },
    });

    this.toggleLocationValidators(post.type);
  }

  private toggleLocationValidators(type: PostType): void {
    const controls = [
      this.countryCodeControl,
      this.postalCodeControl,
      this.cityControl,
      this.latitudeControl,
      this.longitudeControl,
    ];

    if (controls.some((c) => !c)) return;

    if (type === 'OFFLINE') {
      this.countryCodeControl.addValidators(Validators.required);
      this.postalCodeControl.addValidators(Validators.required);
      this.cityControl.addValidators(Validators.required);
      this.latitudeControl.addValidators(Validators.required);
      this.longitudeControl.addValidators(Validators.required);
    } else {
      this.countryCodeControl.removeValidators(Validators.required);
      this.postalCodeControl.removeValidators(Validators.required);
      this.cityControl.removeValidators(Validators.required);
      this.latitudeControl.removeValidators(Validators.required);
      this.longitudeControl.removeValidators(Validators.required);
    }

    controls.forEach((c) => c.updateValueAndValidity({ emitEvent: false }));
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
    if (this.postForm.invalid || this.isSubmitting || this.hasUploading) {
      this.postForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const formValue = this.postForm.getRawValue();
    const isOffline = formValue.type === 'OFFLINE';

    // In the order the post will show them: the first is the cover.
    const mediaIds = this.photos.flatMap((photo) => photo.mediaId ?? []);

    // Parse tags from comma-separated string
    const tagsRaw = formValue.tags ?? '';
    const tags = tagsRaw
      .split(',')
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0)
      .slice(0, 10)
      .map((t: string) => t.substring(0, 32));

    const data: PostFormData = {
      title: formValue.title ?? '',
      type: formValue.type ?? 'ONLINE',
      startsAt: formValue.startsAt ? new Date(formValue.startsAt).toISOString() : '',
      endsAt: formValue.endsAt ? new Date(formValue.endsAt).toISOString() : null,
      description: formValue.description ?? '',
      eventUrl: formValue.eventUrl || null,
      tags,
      visibility: (formValue.visibility as PostVisibility) ?? 'PUBLIC',
      location: isOffline
        ? {
            countryCode: formValue.location?.countryCode ?? '',
            venueName: formValue.location?.venueName || null,
            buildingNum: formValue.location?.buildingNum || null,
            street: formValue.location?.street || null,
            postalCode: formValue.location?.postalCode ?? '',
            city: formValue.location?.city ?? '',
            coordinates: {
              latitude: Number(formValue.location?.coordinates?.latitude),
              longitude: Number(formValue.location?.coordinates?.longitude),
            },
          }
        : null,
      mediaIds,
      removedMediaIds: this.removedMediaIds,
    };

    this.formSubmit.emit(data);
  }

  resetSubmitting(): void {
    this.isSubmitting = false;
  }

  resetForm(): void {
    this.postForm.reset({
      type: 'ONLINE',
      visibility: 'PUBLIC',
      location: {
        countryCode: '',
        venueName: '',
        buildingNum: '',
        street: '',
        postalCode: '',
        city: '',
        coordinates: { latitude: null, longitude: null },
      },
    });
    this.photos.filter((p) => !p.isSaved).forEach((p) => URL.revokeObjectURL(p.url));
    this.photos = [];
    this.removedMediaIds = [];
    this.photoStatus = '';
    this.pendingFocus = null;
    this.isSubmitting = false;
  }
}
