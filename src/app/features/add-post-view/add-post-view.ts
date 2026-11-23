import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';

import { PostService } from '../../core/services/post/post.service';
import { PostForm, PostFormSubmit } from '../../core/components/post-form/post-form';
import { ToastService } from '../../core/services/toast/toast.service';

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

  async onFormSubmit({ request }: PostFormSubmit): Promise<void> {
    try {
      const createdPost = await lastValueFrom(this.postService.addPost(request));
      // In place of the form, so going back from the new post never lands on the form again.
      this.router.navigate(['/posts', createdPost.id], { replaceUrl: true });
    } catch (err) {
      console.error(err);
      this.postFormComponent.resetSubmitting();
      this.toast.failed();
    }
  }
}
