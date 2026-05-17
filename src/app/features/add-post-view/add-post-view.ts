import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';

import { PostService } from '../../core/services/post/post.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { PostForm } from '../../core/components/post-form/post-form';
import { PostFormData } from '../../core/models/posts/post-form-data.model';
import { PostCreateRequest } from '../../core/models/posts/post-create-request.model';

@Component({
  selector: 'app-add-post-view',
  imports: [CommonModule, TranslatePipe, PostForm],
  templateUrl: './add-post-view.html',
  styleUrl: './add-post-view.scss',
})
export class AddPostView {
  private postService = inject(PostService);
  private router = inject(Router);
  public authService = inject(AuthService);

  @ViewChild(PostForm) postFormComponent!: PostForm;

  async onFormSubmit(data: PostFormData): Promise<void> {
    try {
      const payload: PostCreateRequest = {
        title: data.title,
        type: data.type,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        description: data.description,
        eventUrl: data.eventUrl,
        tags: data.tags.length > 0 ? data.tags : undefined,
        visibility: data.visibility,
        location: data.location,
        mediaIds: data.mediaIds.length > 0 ? data.mediaIds : undefined,
        coverMediaId: data.coverMediaId,
      };

      const createdPost = await lastValueFrom(this.postService.addPost(payload));
      this.postFormComponent.resetForm();
      this.router.navigate(['/post', createdPost.id]);
    } catch (err) {
      console.error(err);
      this.postFormComponent.resetSubmitting();
    }
  }
}
