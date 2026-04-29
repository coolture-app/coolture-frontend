import { Component, inject, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PostService } from '../../core/services/post/post.service';
import { CreatePostModel, UpdatePostModel } from '../../core/models/posts/createPost.model';
import { ActivatedRoute } from '@angular/router';
import { EventLocation } from '../../core/models/posts/eventLocation.model';

@Component({
  selector: 'app-add-post-view',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './add-post-view.html',
  styleUrl: './add-post-view.scss',
})
export class AddPostView implements OnInit {
  private postService = inject(PostService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  private readonly urlPattern = /^https?:\/\/\S+$/i;
  private readonly countryCodePattern = /^[A-Z]{3}$/;
  editPostId: string | null = null;

  postForm = this.fb.group({
    categoryId: ['', [Validators.required]],
    title: ['', [Validators.required, Validators.maxLength(32)]],
    description: ['', [Validators.required, Validators.maxLength(1024)]],
    startsAt: ['', Validators.required],
    endsAt: [''],
    eventUrl: ['', Validators.pattern(this.urlPattern)],
    tags: ['', [this.tagsValidator]],
    type: ['ONLINE', Validators.required],
    visibility: ['PUBLIC', Validators.required],
    location: this.fb.group({
      countryCode: ['', [Validators.pattern(this.countryCodePattern)]],
      venueName: ['', [Validators.maxLength(64)]],
      buildingNum: ['', [Validators.maxLength(16)]],
      street: ['', [Validators.maxLength(128)]],
      postalCode: ['', [Validators.maxLength(16)]],
      city: ['', [Validators.maxLength(128)]],
      coordinates: this.fb.group({
        latitude: [null as number | null, [Validators.min(-90), Validators.max(90)]],
        longitude: [null as number | null, [Validators.min(-180), Validators.max(180)]],
      }),
    }),
  });

  ngOnInit(): void {
    this.editPostId = this.route.snapshot.paramMap.get('id');
    this.updateLocationValidators(this.isOffline);
    this.postForm.controls.type.valueChanges.subscribe((type) => {
      this.updateLocationValidators(type === 'OFFLINE');
    });

    if (this.editPostId) {
      this.loadPostForEdit(this.editPostId);
    }
  }

  get isOffline(): boolean {
    return this.postForm.controls.type.value === 'OFFLINE';
  }

  onSubmit(): void {
    if (this.postForm.invalid) {
      this.postForm.markAllAsTouched();
      return;
    }

    const payload = this.toPayload();
    if (this.editPostId) {
      this.postService.updatePost(this.editPostId, payload as UpdatePostModel).subscribe();
      return;
    }

    this.postService.addPost(payload as CreatePostModel).subscribe();
  }

  private toPayload(): CreatePostModel {
    const value = this.postForm.getRawValue();
    const tags = this.parseTags(value.tags ?? '');

    return {
      categoryId: value.categoryId ?? '',
      title: value.title ?? '',
      description: value.description ?? '',
      startsAt: value.startsAt ?? '',
      endsAt: this.nullIfEmpty(value.endsAt),
      eventUrl: this.nullIfEmpty(value.eventUrl),
      tags,
      type: (value.type ?? 'ONLINE') as 'OFFLINE' | 'ONLINE',
      visibility: (value.visibility ?? 'PUBLIC') as 'PUBLIC' | 'PRIVATE' | 'FRIENDS',
      location: this.isOffline ? this.toLocation() : null,
    };
  }

  private toLocation(): EventLocation {
    const location = this.postForm.controls.location.getRawValue();
    const coordinates = location.coordinates;
    return {
      countryCode: (location.countryCode ?? '').toUpperCase(),
      venueName: this.nullIfEmpty(location.venueName),
      buildingNum: this.nullIfEmpty(location.buildingNum),
      street: this.nullIfEmpty(location.street),
      postalCode: location.postalCode ?? '',
      city: location.city ?? '',
      coordinates: {
        latitude: Number(coordinates.latitude),
        longitude: Number(coordinates.longitude),
      },
    };
  }

  private parseTags(tagsValue: string): string[] {
    if (!tagsValue.trim()) {
      return [];
    }

    return tagsValue
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .slice(0, 10);
  }

  private tagsValidator(control: AbstractControl): ValidationErrors | null {
    const value = (control.value as string | null) ?? '';
    if (!value.trim()) {
      return null;
    }

    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    if (tags.length > 10) {
      return { maxTags: true };
    }
    if (tags.some((tag) => tag.length > 32)) {
      return { maxTagLength: true };
    }
    return null;
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    if (!value || !value.trim()) {
      return null;
    }
    return value.trim();
  }

  private updateLocationValidators(isOffline: boolean): void {
    const location = this.postForm.controls.location.controls;
    const coordinates = location.coordinates.controls;

    location.countryCode.setValidators(
      isOffline
        ? [Validators.required, Validators.pattern(this.countryCodePattern)]
        : [Validators.pattern(this.countryCodePattern)],
    );
    location.venueName.setValidators([Validators.maxLength(64)]);
    location.buildingNum.setValidators([Validators.maxLength(16)]);
    location.street.setValidators([Validators.maxLength(128)]);
    location.postalCode.setValidators(
      isOffline ? [Validators.required, Validators.maxLength(16)] : [Validators.maxLength(16)],
    );
    location.city.setValidators(
      isOffline ? [Validators.required, Validators.maxLength(128)] : [Validators.maxLength(128)],
    );

    coordinates.latitude.setValidators(
      isOffline
        ? [Validators.required, Validators.min(-90), Validators.max(90)]
        : [Validators.min(-90), Validators.max(90)],
    );
    coordinates.longitude.setValidators(
      isOffline
        ? [Validators.required, Validators.min(-180), Validators.max(180)]
        : [Validators.min(-180), Validators.max(180)],
    );

    if (!isOffline) {
      this.postForm.controls.location.reset({
        countryCode: '',
        venueName: '',
        buildingNum: '',
        street: '',
        postalCode: '',
        city: '',
        coordinates: { latitude: null, longitude: null },
      });
    }

    location.countryCode.updateValueAndValidity({ emitEvent: false });
    location.venueName.updateValueAndValidity({ emitEvent: false });
    location.buildingNum.updateValueAndValidity({ emitEvent: false });
    location.street.updateValueAndValidity({ emitEvent: false });
    location.postalCode.updateValueAndValidity({ emitEvent: false });
    location.city.updateValueAndValidity({ emitEvent: false });
    coordinates.latitude.updateValueAndValidity({ emitEvent: false });
    coordinates.longitude.updateValueAndValidity({ emitEvent: false });
  }

  private loadPostForEdit(postId: string): void {
    this.postService.getPost(postId).subscribe((response) => {
      const post = response as unknown as Record<string, unknown>;
      const location = (post['location'] ?? null) as EventLocation | null;
      const startsAt =
        (post['startsAt'] as string | null) ?? (post['dateOfEvent'] as string | null) ?? '';

      this.postForm.patchValue({
        categoryId: (post['categoryId'] as string | null) ?? '',
        title: (post['title'] as string | null) ?? '',
        description: (post['description'] as string | null) ?? '',
        startsAt: startsAt ? startsAt.slice(0, 16) : '',
        endsAt: ((post['endsAt'] as string | null) ?? '')?.slice(0, 16),
        eventUrl: (post['eventUrl'] as string | null) ?? '',
        tags: Array.isArray(post['tags']) ? (post['tags'] as string[]).join(', ') : '',
        type: (post['type'] as 'OFFLINE' | 'ONLINE' | undefined) ?? 'ONLINE',
        visibility:
          (post['visibility'] as 'PUBLIC' | 'PRIVATE' | 'FRIENDS' | undefined) ?? 'PUBLIC',
        location: {
          countryCode: location?.countryCode ?? '',
          venueName: location?.venueName ?? '',
          buildingNum: location?.buildingNum ?? '',
          street: location?.street ?? '',
          postalCode: location?.postalCode ?? '',
          city: location?.city ?? '',
          coordinates: {
            latitude: location?.coordinates?.latitude ?? null,
            longitude: location?.coordinates?.longitude ?? null,
          },
        },
      });
    });
  }
}
