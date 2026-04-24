import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PostService } from '../../core/services/post/post.service';
import { PostCreateRequest } from '../../core/models/posts/post-create-request.model';
import { PostType } from '../../core/models/common/enums';
import { MediaService } from '../../core/services/media/media.service';
import { DictionaryService } from '../../core/services/dictionary/dictionary.service';
import { EventCategory } from '../../core/models/dictionary/event-category.model';
import { lastValueFrom, Observable } from 'rxjs';

interface MediaPreview {
  file: File;
  previewUrl: string;
  isUploading: boolean;
  mediaId?: string;
}

@Component({
  selector: 'app-add-post-view',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './add-post-view.html',
  styleUrl: './add-post-view.scss',
})
export class AddPostView {
  private postService = inject(PostService);
  private mediaService = inject(MediaService);
  private dictionaryService = inject(DictionaryService);
  private fb = inject(FormBuilder);

  categories$: Observable<EventCategory[]> = this.dictionaryService.getEventCategories();
  mediaPreviews: MediaPreview[] = [];
  isSubmitting = false;

  postForm = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    categoryId: ['', Validators.required],
    type: ['ONLINE' as PostType, Validators.required],
    startsAt: ['', Validators.required],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
  });

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
      } catch (err) {
        console.error('Błąd podczas wgrywania pliku', file.name, err);
        alert('Wystąpił błąd podczas wgrywania pliku: ' + file.name);
        this.mediaPreviews = this.mediaPreviews.filter((p) => p !== preview);
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
      alert('Poczekaj na wgranie wszystkich zdjęć.');
      return;
    }

    this.isSubmitting = true;
    try {
      const formValue = this.postForm.getRawValue();
      const uploadedMediaIds = this.mediaPreviews.map((p) => p.mediaId!).filter(Boolean);

      const payload: PostCreateRequest = {
        title: formValue.title ?? '',
        categoryId: formValue.categoryId ?? '',
        type: formValue.type ?? 'OFFLINE',
        startsAt: formValue.startsAt ? new Date(formValue.startsAt).toISOString() : '',
        description: formValue.description ?? '',
        mediaIds: uploadedMediaIds.length > 0 ? uploadedMediaIds : undefined,
        coverMediaId: uploadedMediaIds.length > 0 ? uploadedMediaIds[0] : undefined,
      };

      await lastValueFrom(this.postService.addPost(payload));
      alert('Dodano post pomyślnie!');
      this.postForm.reset({ type: 'ONLINE' });
      this.mediaPreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      this.mediaPreviews = [];
    } catch (err) {
      console.error(err);
      alert('Wystąpił błąd podczas dodawania posta.');
    } finally {
      this.isSubmitting = false;
    }
  }
}
