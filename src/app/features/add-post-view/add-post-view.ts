import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PostService } from '../../core/services/post/post.service';
import { CreatePostModel } from '../../core/models/posts/createPost.model';

@Component({
  selector: 'app-add-post-view',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './add-post-view.html',
  styleUrl: './add-post-view.scss',
})
export class AddPostView {
  private postService = inject(PostService);
  private fb = inject(FormBuilder);

  postForm = this.fb.group({
    categoryId: ['', [Validators.required]],
    title: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(32),
        Validators.pattern(/^[a-zA-Z0-9_ ]+$/),
      ],
    ],
    startsAt: ['2026-04-18T21:04', Validators.required],
    type: ['ONLINE' as const, Validators.required],

    // locationUuid: ['3fa85f64-5717-4562-b3fc-2c963f66afa6', Validators.required],

    description: ['', [Validators.required, Validators.maxLength(1024)]],
  });

  onSubmit() {
    if (this.postForm.valid) {
      console.log('Dane do wysłania na backend:', this.postForm.value);
      this.postService.addPost(this.postForm.value as CreatePostModel).subscribe();
    } else {
      console.log('Formularz zawiera błędy.');
      this.postForm.markAllAsTouched();
    }
  }
}
