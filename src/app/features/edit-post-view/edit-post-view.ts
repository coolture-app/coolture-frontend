import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { PostService } from '../../core/services/post/post.service';
import { MediaService } from '../../core/services/media/media.service';
import { DictionaryService } from '../../core/services/dictionary/dictionary.service';

import { PostDetail, PostMedia } from '../../core/models/posts/post-detail.model';
import { PostUpdateRequest } from '../../core/models/posts/post-update-request.model';
import { PostType } from '../../core/models/common/enums';
import { MediaUploadInitRequest } from '../../core/models/media/media-upload-init-request.model';
import { MediaResource } from '../../core/models/media/media-resource.model';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-edit-post-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
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

  currentPost = signal<PostDetail | null>(null);
  categories = toSignal(this.dictionaryService.getEventCategories(), { initialValue: [] });

  postTypes: PostType[] = ['OFFLINE', 'ONLINE'];

  postForm: FormGroup = this.fb.group({
    title: ['', Validators.required],
    categoryId: ['', Validators.required],
    type: ['', Validators.required],
    startsAt: ['', Validators.required],
    description: ['', Validators.required],
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
        });

        this.existingMedia.set(post.media || []);
      }
    });
  }
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.postService.getPost(id).subscribe({
        next: (post) => {
          this.currentPost.set(post);
        },
        error: (err) => {
          console.error('Błąd podczas pobierania wydarzenia', err);
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
      console.error('Błąd podczas wgrywania zdjęcia', error);
    } finally {
      this.isUploading.set(false);
      input.value = '';
    }
  }

  removeExistingMedia(mediaIdToRemove: string): void {
    this.mediaService.deleteMedia(mediaIdToRemove).subscribe({
      next: () => {
        this.existingMedia.update((media) => media.filter((m) => m.media.id !== mediaIdToRemove));
      },
      error: (err) => console.error('Nie udało się usunąć istniejącego zdjęcia', err),
    });
  }

  removeNewMedia(mediaIdToRemove: string): void {
    this.mediaService.deleteMedia(mediaIdToRemove).subscribe({
      next: () => {
        this.newlyUploadedMedia.update((media) => media.filter((m) => m.id !== mediaIdToRemove));
      },
      error: (err) => console.error('Nie udało się usunąć świeżego zdjęcia', err),
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

    const payload: PostUpdateRequest = {
      title: formValues.title,
      categoryId: formValues.categoryId,
      type: formValues.type,
      startsAt: new Date(formValues.startsAt).toISOString(),
      description: formValues.description,
      mediaIds: finalMediaIds,
      coverMediaId: finalMediaIds.length > 0 ? finalMediaIds[0] : null,
    };

    this.postService.updatePost(post.id, payload).subscribe({
      next: (updatedPost) => {
        console.log('Post pomyślnie zaktualizowany!', updatedPost);
        this.newlyUploadedMedia.set([]);
        const post = this.currentPost();
        if (post != null) {
          this.postService.clearActivePost();
          this.router.navigate(['/post', post.id]);
        }
      },
      error: (err) => console.error('Błąd aktualizacji posta', err),
    });
  }
}
