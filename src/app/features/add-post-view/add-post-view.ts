import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';

import { PostService } from '../../core/services/post/post.service';
import { PostForm, PostFormSubmit } from '../../core/components/post-form/post-form';
import { ToastService } from '../../core/services/toast/toast.service';
import { PostDetail } from '../../core/models/posts/post-detail.model';

@Component({
  selector: 'app-add-post-view',
  imports: [CommonModule, TranslatePipe, PostForm],
  templateUrl: './add-post-view.html',
  styleUrl: './add-post-view.scss',
})
export class AddPostView {
  private postService = inject(PostService);
  private router = inject(Router);
  private toast = inject(ToastService);

  @ViewChild(PostForm) postFormComponent!: PostForm;

  async onFormSubmit(data: PostFormSubmit): Promise<void> {
    const post = await this.save(data);
    if (post) {
      // In place of the form, so going back from the new post never lands on the form again.
      void this.router.navigate(['/posts', post.id], { replaceUrl: true });
    }
  }

  confirmLeave(): Promise<boolean> {
    return this.postFormComponent.confirmLeave(async (data) => !!(await this.save(data)));
  }

  private async save({ request }: PostFormSubmit): Promise<PostDetail | null> {
    try {
      return await lastValueFrom(this.postService.addPost(request));
    } catch (err) {
      console.error(err);
      this.postFormComponent.resetSubmitting();
      this.toast.failed();
      return null;
    }
  }
}
