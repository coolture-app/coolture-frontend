import { Component, effect, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { PostService } from '../../core/services/post/post.service';
import { MediaService } from '../../core/services/media/media.service';
import { DictionaryService } from '../../core/services/dictionary/dictionary.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { Btn } from '../../core/components/btn/btn';

import { PostDetail, PostMedia } from '../../core/models/posts/post-detail.model';
import { PostUpdateRequest } from '../../core/models/posts/post-update-request.model';
import { PostType } from '../../core/models/common/enums';
import { MediaUploadInitRequest } from '../../core/models/media/media-upload-init-request.model';
import { MediaResource } from '../../core/models/media/media-resource.model';
import { CountryCode } from '../../core/models/dictionary/country-code.model';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-edit-post-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe, Btn],
  templateUrl: './edit-post-view.html',
  styleUrl: './edit-post-view.scss',
})
export class EditPostView implements OnInit {
  private fb = inject(FormBuilder);
  private postService = inject(PostService);
  private mediaService = inject(MediaService);
  private dictionaryService = inject(DictionaryService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  public authService = inject(AuthService);

  currentPost = signal<PostDetail | null>(null);
  categories = toSignal(this.dictionaryService.getEventCategories(), { initialValue: [] });
  countryCodes = toSignal(this.dictionaryService.getCountryCodes(), {
    initialValue: [] as CountryCode[],
  });

  postTypes: PostType[] = ['OFFLINE', 'ONLINE'];

  postForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(32)]],
    categoryId: ['', Validators.required],
    type: ['', Validators.required],
    startsAt: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(1024)]],
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

  existingMedia = signal<PostMedia[]>([]);
  newlyUploadedMedia = signal<MediaResource[]>([]);
  isUploading = signal(false);

  constructor() {
    effect(() => {
      const post = this.currentPost();
      if (post) {
        this.postForm.patchValue({
          title: post.title,
          categoryId: post.category?.id,
          type: post.type,
          startsAt: post.startsAt ? post.startsAt.substring(0, 16) : '',
          description: post.description,
          location: {
            countryCode: post.location?.countryCode ?? '',
            venueName: post.location?.venueName ?? '',
            buildingNum: post.location?.buildingNum ?? '',
            street: post.location?.street ?? '',
            postalCode: post.location?.postalCode ?? '',
            city: post.location?.city ?? '',
            coordinates: {
              latitude: post.location?.coordinates.latitude ?? null,
              longitude: post.location?.coordinates.longitude ?? null,
            },
          },
        });

        this.existingMedia.set(post.media || []);
        this.toggleLocationValidators(post.type);
      }
    });

    this.postForm
      .get('type')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.toggleLocationValidators(type ?? 'ONLINE'));
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

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.postService
        .getPost(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (post) => {
            this.currentPost.set(post);
          },
          error: (err) => {
            console.error('Error while fetching event', err);
            this.router.navigate(['/404']);
          },
        });
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.isUploading.set(true);

    try {
      const initPayload: MediaUploadInitRequest = {
        purpose: 'event_media',
        mimeType: file.type,
        sizeBytes: file.size,
        fileName: file.name,
      };

      const initRes = await lastValueFrom(this.mediaService.initUpload(initPayload));

      await lastValueFrom(
        this.mediaService.uploadToS3(initRes.uploadUrl, file, initRes.requiredHeaders || {}),
      );
      const completedMedia = await lastValueFrom(this.mediaService.completeUpload(initRes.mediaId));

      this.newlyUploadedMedia.update((media) => [...media, completedMedia]);
    } catch (error) {
      console.error('Error while uploadin image', error);
    } finally {
      this.isUploading.set(false);
      input.value = '';
    }
  }

  removeExistingMedia(mediaIdToRemove: string): void {
    this.mediaService
      .deleteMedia(mediaIdToRemove)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.existingMedia.update((media) => media.filter((m) => m.media.id !== mediaIdToRemove));
        },
        error: (err) => console.error('Couldnt delete existing image', err),
      });
  }

  removeNewMedia(mediaIdToRemove: string): void {
    this.mediaService
      .deleteMedia(mediaIdToRemove)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.newlyUploadedMedia.update((media) => media.filter((m) => m.id !== mediaIdToRemove));
        },
        error: (err) => console.error('Coudlnt delete newly added image', err),
      });
  }

  updatePost(): void {
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }

    const post = this.currentPost();
    if (!post) return;

    const existingIds = this.existingMedia().map((m) => m.media.id);
    const newIds = this.newlyUploadedMedia().map((m) => m.id);

    const finalMediaIds = [...existingIds, ...newIds];

    const formValues = this.postForm.value;
    const isOffline = formValues.type === 'OFFLINE';

    const payload: PostUpdateRequest = {
      title: formValues.title,
      categoryId: formValues.categoryId,
      type: formValues.type,
      startsAt: new Date(formValues.startsAt).toISOString(),
      description: formValues.description,
      location: isOffline
        ? {
            countryCode: formValues.location?.countryCode ?? '',
            venueName: formValues.location?.venueName || null,
            buildingNum: formValues.location?.buildingNum || null,
            street: formValues.location?.street || null,
            postalCode: formValues.location?.postalCode ?? '',
            city: formValues.location?.city ?? '',
            coordinates: {
              latitude: Number(formValues.location?.coordinates?.latitude),
              longitude: Number(formValues.location?.coordinates?.longitude),
            },
          }
        : null,
      mediaIds: finalMediaIds,
      coverMediaId: finalMediaIds.length > 0 ? finalMediaIds[0] : null,
    };

    this.postService
      .updatePost(post.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedPost) => {
          console.log('Post updated!', updatedPost);
          this.newlyUploadedMedia.set([]);
          const current = this.currentPost();
          if (current != null) {
            this.postService.clearActivePost();
            this.router.navigate(['/post', current.id]);
          }
        },
        error: (err) => console.error('Error while updating post', err),
      });
  }
}
