import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PostService } from '../../core/services/post/post.service';
import { PostCreateRequest } from '../../core/models/posts/post-create-request.model';
import { PostType } from '../../core/models/common/enums';
import { MediaService } from '../../core/services/media/media.service';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-add-post-view',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './add-post-view.html',
  styleUrl: './add-post-view.scss',
})
export class AddPostView {
  private postService = inject(PostService);
  private mediaService = inject(MediaService);
  private fb = inject(FormBuilder);

  selectedFiles: File[] = [];

  postForm = this.fb.group({
    id: [null],

    title: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(200),
        Validators.pattern(/^[a-zA-Z0-9_ ]+$/),
      ],
    ],

    categoryId: ['3fa85f64-5717-4562-b3fc-2c963f66afa6', Validators.required],
    type: ['ONLINE' as PostType, Validators.required],

    startsAt: ['2026-04-18T21:04:00Z', Validators.required], // locationUuid: ['3fa85f64-5717-4562-b3fc-2c963f66afa6', Validators.required],

    description: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  uploadedMediaIds: string[] = [];

  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles = Array.from(input.files);

      for (const file of this.selectedFiles) {
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

          this.uploadedMediaIds.push(initRes.mediaId);
        } catch (err) {
          console.error('Błąd podczas wgrywania pliku', file.name, err);
          alert('Wystąpił błąd podczas wgrywania pliku: ' + file.name);
        }
      }
    }
  }

  async onSubmit() {
    if (this.postForm.valid) {
      try {
        const formValue = this.postForm.getRawValue();

        const payload: PostCreateRequest = {
          title: formValue.title ?? '',
          categoryId: formValue.categoryId ?? '',
          type: formValue.type ?? 'OFFLINE',
          startsAt: formValue.startsAt ? new Date(formValue.startsAt).toISOString() : '',
          description: formValue.description ?? '',

          mediaIds: this.uploadedMediaIds.length > 0 ? this.uploadedMediaIds : undefined,
          coverMediaId: this.uploadedMediaIds.length > 0 ? this.uploadedMediaIds[0] : undefined,
        };

        console.log('Dane do wysłania na backend:', payload);
        await lastValueFrom(this.postService.addPost(payload));
        alert('Hej, dodano post pomyślnie!');
      } catch (err) {
        console.log('ERRR :' + err);
      }
    }
  }
}
