import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth/auth.service';
import { PostService } from '../../core/services/post/post.service';
import { CreatePostModel } from '../../core/models/posts/createPost.model';

@Component({
  selector: 'app-add-post-view',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './add-post-view.html',
  styleUrl: './add-post-view.scss',
})
export class AddPostView {
  private authService = inject(AuthService);
  private postService = inject(PostService);
  private fb = inject(FormBuilder);

  postForm = this.fb.group({
    id: [null],

    title: [
      'zbieranie grzybow z artystami i rzemieslnikami',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(200),
        Validators.pattern(/^[a-zA-Z0-9_ ]+$/),
      ],
    ],

    authorUuid: [this.authService.getUserId(), Validators.required],

    dateOfEvent: ['2026-04-18T21:04', Validators.required],

    locationUuid: ['3fa85f64-5717-4562-b3fc-2c963f66afa6', Validators.required],

    description: ['lubie grzyyyybyyyyyy', [Validators.required, Validators.maxLength(2000)]],
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
