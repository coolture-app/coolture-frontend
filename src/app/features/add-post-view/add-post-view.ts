import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';

import { PostService } from '../../core/services/post/post.service';
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
      };

      const createdPost = await lastValueFrom(this.postService.addPost(payload));
      this.postFormComponent.resetForm();
      // In place of the form, so going back from the new post never lands on the form again.
      this.router.navigate(['/posts', createdPost.id], { replaceUrl: true });
    } catch (err) {
      console.error(err);
      this.postFormComponent.resetSubmitting();
    }
  }
}
