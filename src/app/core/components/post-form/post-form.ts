import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
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
import { TranslatePipe } from '@ngx-translate/core';

import { FormInput } from '../form-input/form-input';
import { FormTextarea } from '../form-textarea/form-textarea';
import { Btn } from '../btn/btn';
import { locationForm, PlacePicker } from '../place-picker/place-picker';
import { PostPhotos } from '../post-photos/post-photos';

import { PostFormData } from '../../models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../models/posts/post-detail.model';
import { PostType, PostVisibility } from '../../models/common/enums';
import { EventLocationRequest } from '../../models/common/geo.model';

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
    Btn,
    PlacePicker,
    PostPhotos,
  ],
  templateUrl: './post-form.html',
  styleUrl: './post-form.scss',
})
export class PostForm implements OnInit, OnChanges, OnDestroy {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() initialData?: PostDetail;
  @Input() existingMedia: PostMedia[] = [];

  @Output() formSubmit = new EventEmitter<PostFormData>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private host = inject(ElementRef);

  private readonly placePicker = viewChild(PlacePicker);
  readonly photos = viewChild.required(PostPhotos);

  isSubmitting = false;
  /** Most events have no end, so its field waits for "Dodaj zakończenie". */
  showEnd = false;

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

  ngOnInit(): void {
    this.postForm.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.matchLocationTo(type ?? 'OFFLINE'));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialData'] && this.initialData) {
      this.patchFormFromPost(this.initialData);
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

  /**
   * Leaving without publishing drops what this form uploaded, and a daily job catches a closed tab.
   * While saving, the post may already hold these photos, so they stay.
   */
  ngOnDestroy(): void {
    if (!this.isSubmitting) {
      this.photos().discardUploads();
    }
  }

  onSubmit(): void {
    const photos = this.photos();
    if (this.isSubmitting || photos.hasUploading) {
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
      mediaIds: photos.mediaIds(),
      removedMediaIds: photos.removedMediaIds,
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
    this.photos().reset();
    this.isSubmitting = false;
  }
}
