import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PostService } from '../../core/services/post/post.service';
import { PostCreateRequest } from '../../core/models/posts/post-create-request.model';
import { PostType } from '../../core/models/common/enums';
import { MediaService } from '../../core/services/media/media.service';
import { DictionaryService } from '../../core/services/dictionary/dictionary.service';
import { EventCategory } from '../../core/models/dictionary/event-category.model';
import { CountryCode } from '../../core/models/dictionary/country-code.model';
import { lastValueFrom, Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth/auth.service';

interface MediaPreview {
  file: File;
  previewUrl: string;
  isUploading: boolean;
  mediaId?: string;
}

@Component({
  selector: 'app-add-post-view',
  imports: [ReactiveFormsModule, CommonModule, TranslatePipe],
  templateUrl: './add-post-view.html',
  styleUrl: './add-post-view.scss',
})
export class AddPostView {
  private postService = inject(PostService);
  private mediaService = inject(MediaService);
  private dictionaryService = inject(DictionaryService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  public authService = inject(AuthService);

  categories$: Observable<EventCategory[]> = this.dictionaryService.getEventCategories();
  countryCodes$: Observable<CountryCode[]> = this.dictionaryService.getCountryCodes();
  mediaPreviews: MediaPreview[] = [];
  isSubmitting = false;

  postForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    categoryId: ['', Validators.required],
    type: ['ONLINE' as PostType, Validators.required],
    startsAt: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
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

  constructor() {
    this.postForm
      .get('type')
      ?.valueChanges.subscribe((type) => this.toggleLocationValidators(type ?? 'ONLINE'));
    this.toggleLocationValidators(this.postForm.get('type')?.value ?? 'ONLINE');
  }

  private toggleLocationValidators(type: PostType): void {
    const locationGroup = this.postForm.get('location');
    const countryCodeControl = locationGroup?.get('countryCode');
    const postalCodeControl = locationGroup?.get('postalCode');
    const cityControl = locationGroup?.get('city');
    const latitudeControl = locationGroup?.get('coordinates.latitude');
    const longitudeControl = locationGroup?.get('coordinates.longitude');

    if (
      !countryCodeControl ||
      !postalCodeControl ||
      !cityControl ||
      !latitudeControl ||
      !longitudeControl
    ) {
      return;
    }

    if (type === 'OFFLINE') {
      countryCodeControl.addValidators(Validators.required);
      postalCodeControl.addValidators(Validators.required);
      cityControl.addValidators(Validators.required);
      latitudeControl.addValidators(Validators.required);
      longitudeControl.addValidators(Validators.required);
    } else {
      countryCodeControl.removeValidators(Validators.required);
      postalCodeControl.removeValidators(Validators.required);
      cityControl.removeValidators(Validators.required);
      latitudeControl.removeValidators(Validators.required);
      longitudeControl.removeValidators(Validators.required);
    }

    countryCodeControl.updateValueAndValidity({ emitEvent: false });
    postalCodeControl.updateValueAndValidity({ emitEvent: false });
    cityControl.updateValueAndValidity({ emitEvent: false });
    latitudeControl.updateValueAndValidity({ emitEvent: false });
    longitudeControl.updateValueAndValidity({ emitEvent: false });
  }

  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files);

    for (const file of files) {
      const preview: MediaPreview = {
        file,
        previewUrl: URL.createObjectURL(file),
        isUploading: true,
      };
      this.mediaPreviews.push(preview);

      try {
        const initRes = await lastValueFrom(
          this.mediaService.initUpload({
            purpose: 'event_media',
            mimeType: file.type,
            sizeBytes: file.size,
            fileName: file.name,
          }),
        );

        await lastValueFrom(
          this.mediaService.uploadToS3(initRes.uploadUrl, file, initRes.requiredHeaders),
        );
        await lastValueFrom(this.mediaService.completeUpload(initRes.mediaId));

        preview.mediaId = initRes.mediaId;
        preview.isUploading = false;
        this.cdr.detectChanges();
      } catch (err) {
        console.error('Error while loading file', file.name, err);
        this.mediaPreviews = this.mediaPreviews.filter((p) => p !== preview);
        this.cdr.detectChanges();
      }
    }
    input.value = '';
  }

  removeMedia(index: number) {
    URL.revokeObjectURL(this.mediaPreviews[index].previewUrl);
    this.mediaPreviews.splice(index, 1);
  }

  async onSubmit() {
    if (this.postForm.invalid || this.isSubmitting) return;

    if (this.mediaPreviews.some((p) => p.isUploading)) {
      return;
    }

    this.isSubmitting = true;
    try {
      const formValue = this.postForm.getRawValue();
      const uploadedMediaIds = this.mediaPreviews.map((p) => p.mediaId!).filter(Boolean);
      const isOffline = formValue.type === 'OFFLINE';

      const payload: PostCreateRequest = {
        title: formValue.title ?? '',
        categoryId: formValue.categoryId ?? '',
        type: formValue.type ?? 'OFFLINE',
        startsAt: formValue.startsAt ? new Date(formValue.startsAt).toISOString() : '',
        description: formValue.description ?? '',
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
        mediaIds: uploadedMediaIds.length > 0 ? uploadedMediaIds : undefined,
        coverMediaId: uploadedMediaIds.length > 0 ? uploadedMediaIds[0] : undefined,
      };

      const createdPost = await lastValueFrom(this.postService.addPost(payload));
      this.postForm.reset({
        type: 'ONLINE',
        location: {
          countryCode: '',
          venueName: '',
          buildingNum: '',
          street: '',
          postalCode: '',
          city: '',
          coordinates: {
            latitude: null,
            longitude: null,
          },
        },
      });
      this.mediaPreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      this.mediaPreviews = [];
      this.router.navigate(['/post', createdPost.id]);
    } catch (err) {
      console.error(err);
    } finally {
      this.isSubmitting = false;
    }
  }
}
