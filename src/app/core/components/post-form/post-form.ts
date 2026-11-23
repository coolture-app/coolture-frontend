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
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';

import { FormInput } from '../form-input/form-input';
import { FormTextarea } from '../form-textarea/form-textarea';
import { Btn } from '../btn/btn';
import { PlacePicker } from '../place-picker/place-picker';
import { locationForm } from '../place-picker/location-form';
import { PostPhotos } from '../post-photos/post-photos';
import { BackService } from '../../services/back/back.service';
import { ConfirmService } from '../../services/confirm/confirm.service';

import { PostDetail } from '../../models/posts/post-detail.model';
import { PostCreateRequest } from '../../models/posts/post-create-request.model';
import { PostType } from '../../models/common/enums';
import { EventLocationRequest } from '../../models/common/geo.model';
import { linkUrl, PostLink } from '../../models/posts/post-link';
import {
  MAX_DESCRIPTION,
  MAX_LINK_LABEL,
  MAX_POST_LINKS,
  MAX_TITLE,
} from '../../models/posts/post-limits';

type LinkGroup = FormGroup<{ url: FormControl<string>; label: FormControl<string> }>;

/** An address with a dot in its host, with or without its scheme, which `linkUrl` adds. */
const LINK_ADDRESS = /^\s*(https?:\/\/)?[^\s/]+\.[^\s]+\s*$/i;

/**
 * A `datetime-local` input holds a local time with no zone, and the API sends UTC.
 * onSubmit reads the input back as local time, so it has to be filled with local time too.
 */
function toLocalInputValue(iso: string | undefined): string {
  return iso ? formatDate(iso, "yyyy-MM-dd'T'HH:mm", 'en-US') : '';
}

/** The post, and the saved photos taken off it, to delete once it's saved. */
export interface PostFormSubmit {
  request: PostCreateRequest;
  removedMediaIds: string[];
}

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

  @Output() formSubmit = new EventEmitter<PostFormSubmit>();

  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private host = inject(ElementRef);
  private backService = inject(BackService);
  private confirm = inject(ConfirmService);

  private readonly placePicker = viewChild<PlacePicker>('placePicker');
  readonly photos = viewChild.required(PostPhotos);

  isSubmitting = false;
  /** Most events have no end, so its field waits for "Dodaj zakończenie". */
  showEnd = false;
  /** "Bez daty końcowej": the event runs until further notice, so it has no end. */
  openEnded = false;

  readonly locationGroup = locationForm();

  /** The start as an edit loaded it. It may have passed, and sending it back unchanged is fine. */
  private initialStart = '';
  /** The fields as loaded, to tell whether leaving loses anything. */
  private loaded = '';

  /** The API refuses a start moved to the past, to the minute, as the input holds it. */
  private startNotInPast = (startsAt: AbstractControl): ValidationErrors | null => {
    const value: string = startsAt.value;
    const past =
      !!value && value !== this.initialStart && value < toLocalInputValue(new Date().toISOString());
    return past ? { past: true } : null;
  };

  /** The API refuses an end that isn't after the start. */
  private endAfterStart = (endsAt: AbstractControl<string>): ValidationErrors | null => {
    const startsAt = this.postForm?.controls.startsAt.value;
    return startsAt && endsAt.value && endsAt.value <= startsAt ? { afterStart: true } : null;
  };

  postForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(MAX_TITLE)]],
    type: ['OFFLINE' as PostType, Validators.required],
    startsAt: ['', [Validators.required, this.startNotInPast]],
    endsAt: ['', this.endAfterStart],
    description: ['', [Validators.required, Validators.maxLength(MAX_DESCRIPTION)]],
    links: new FormArray<LinkGroup>([]),
    location: this.locationGroup,
  });

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
  get links(): FormArray<LinkGroup> {
    return this.postForm.controls.links;
  }

  readonly maxTitle = MAX_TITLE;
  readonly maxDescription = MAX_DESCRIPTION;
  readonly maxLinks = MAX_POST_LINKS;
  readonly maxLinkLabel = MAX_LINK_LABEL;

  get isOffline(): boolean {
    return this.postForm.controls.type.value === 'OFFLINE';
  }

  ngOnInit(): void {
    if (!this.initialData) {
      this.loaded = this.fields();
    }
    this.postForm.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.matchLocationTo(type));
    this.startsAtControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.endsAtControl.updateValueAndValidity({ emitEvent: false });
      // A start in the past shows its error at once, since it also turns Zapisz off.
      if (this.startsAtControl.hasError('past')) {
        this.startsAtControl.markAsTouched();
      }
    });
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
    this.initialStart = toLocalInputValue(post.startsAt);
    this.postForm.patchValue({
      title: post.title,
      type: post.type,
      startsAt: toLocalInputValue(post.startsAt),
      endsAt: toLocalInputValue(post.endsAt),
      description: post.description ?? '',
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
    this.links.clear();
    (post.links ?? []).forEach((link) => this.links.push(this.linkGroup(link)));
    this.showEnd = !!post.endsAt;
    this.openEnded = post.openEnded;
    this.matchLocationTo(post.type);
    this.loaded = this.fields();
  }

  private fields(): string {
    return JSON.stringify([this.postForm.getRawValue(), this.showEnd, this.openEnded]);
  }

  /**
   * Asked when the page is left with changes: `save` them and go on, go on without them, or stay. A form that can't
   * be saved stays, showing why.
   */
  async confirmLeave(save: (data: PostFormSubmit) => Promise<boolean>): Promise<boolean> {
    if (this.isSubmitting || (this.fields() === this.loaded && !this.photos().changed())) {
      return true;
    }
    const answer = await this.confirm.choose({
      title: 'LEAVE.title',
      text: this.mode === 'create' ? 'LEAVE.textNew' : 'LEAVE.text',
      confirm: this.mode === 'create' ? 'POST_FORM.submit-create' : 'POST_FORM.submit-edit',
      other: 'LEAVE.discard',
    });
    if (answer !== 'confirm') {
      return answer === 'other';
    }
    const data = this.submit();
    return !!data && save(data);
  }

  addEnd(): void {
    this.showEnd = true;
    this.focusAfterRender('#endsAt');
  }

  removeEnd(): void {
    this.showEnd = false;
    this.postForm.controls.endsAt.setValue('');
  }

  addLink(): void {
    if (this.links.length >= MAX_POST_LINKS) {
      return;
    }
    this.links.push(this.linkGroup());
    this.focusAfterRender(`#link-url-${this.links.length - 1}`);
  }

  removeLink(index: number): void {
    this.links.removeAt(index);
  }

  private linkGroup(link?: PostLink): LinkGroup {
    return this.fb.nonNullable.group({
      url: [link?.url ?? '', [Validators.required, Validators.pattern(LINK_ADDRESS)]],
      label: [link?.label ?? '', Validators.maxLength(MAX_LINK_LABEL)],
    });
  }

  setOpenEnded(openEnded: boolean): void {
    this.openEnded = openEnded;
    if (openEnded) {
      this.removeEnd();
    }
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
    const data = this.submit();
    if (data) {
      this.formSubmit.emit(data);
    }
  }

  /** What to save, or null while it can't be saved: invalid, uploading or already saving. */
  private submit(): PostFormSubmit | null {
    const photos = this.photos();
    if (this.isSubmitting || photos.hasUploading()) {
      return null;
    }
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      this.revealFirstError();
      return null;
    }

    this.isSubmitting = true;
    const form = this.postForm.getRawValue();
    return {
      request: {
        title: form.title,
        type: form.type,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: this.showEnd && form.endsAt ? new Date(form.endsAt).toISOString() : null,
        openEnded: this.openEnded,
        description: form.description,
        // The API strips a label, and drops a blank one.
        links: form.links.map(({ url, label }) => ({ url: linkUrl(url), label })),
        location: form.type === 'OFFLINE' ? this.locationRequest() : null,
        mediaIds: photos.mediaIds(),
      },
      removedMediaIds: photos.removedMediaIds(),
    };
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

  /** Back where the form was opened from, so Back from there never lands on the form. */
  cancel(): void {
    this.backService.back(this.initialData ? `/posts/${this.initialData.id}` : '/');
  }

  resetSubmitting(): void {
    this.isSubmitting = false;
  }
}
