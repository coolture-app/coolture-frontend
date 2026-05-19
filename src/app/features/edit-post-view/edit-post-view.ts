import { Component, inject, OnInit, signal, DestroyRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';

import { PostService } from '../../core/services/post/post.service';
import { MediaService } from '../../core/services/media/media.service';
import { AuthService } from '../../core/services/auth/auth.service';
import { PostForm } from '../../core/components/post-form/post-form';
import { PostFormData } from '../../core/models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../core/models/posts/post-detail.model';
import { PostUpdateRequest } from '../../core/models/posts/post-update-request.model';

@Component({
  selector: 'app-edit-post-view',
  standalone: true,
  imports: [CommonModule, TranslatePipe, PostForm],
  templateUrl: './edit-post-view.html',
  styleUrl: './edit-post-view.scss',
})
export class EditPostView implements OnInit {
  private postService = inject(PostService);
  private mediaService = inject(MediaService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  public authService = inject(AuthService);

  @ViewChild(PostForm) postFormComponent!: PostForm;

  currentPost = signal<PostDetail | null>(null);
  existingMedia = signal<PostMedia[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.postService
        .getPost(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (post) => {
            this.currentPost.set(post);
            this.existingMedia.set(post.media || []);
          },
          error: (err) => {
            console.error('Error while fetching event', err);
            this.router.navigate(['/404']);
          },
        });
    }
  }

  onExistingMediaRemove(mediaId: string): void {
    this.mediaService
      .deleteMedia(mediaId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.existingMedia.update((media) => media.filter((m) => m.media.id !== mediaId));
        },
        error: (err) => console.error('Could not delete existing image', err),
      });
  }

  onFormSubmit(data: PostFormData): void {
    const post = this.currentPost();
    if (!post) return;

    const payload: PostUpdateRequest = {
      title: data.title,
      type: data.type,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      description: data.description,
      eventUrl: data.eventUrl,
      tags: data.tags.length > 0 ? data.tags : undefined,
      visibility: data.visibility,
      location: data.location,
      mediaIds: data.mediaIds,
      coverMediaId: data.coverMediaId,
    };

    this.postService
      .updatePost(post.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.postService.clearActivePost();
          this.router.navigate(['/post', post.id]);
        },
        error: (err) => {
          console.error('Error while updating post', err);
          this.postFormComponent.resetSubmitting();
        },
      });
  }
}
