import { Component, inject, OnInit, signal, DestroyRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { PostService } from '../../core/services/post/post.service';
import { MediaService } from '../../core/services/media/media.service';
import { PostForm } from '../../core/components/post-form/post-form';
import { PostFormData } from '../../core/models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../core/models/posts/post-detail.model';
import { PostUpdateRequest } from '../../core/models/posts/post-update-request.model';
import { BackService } from '../../core/services/back/back.service';

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
  private backService = inject(BackService);

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
      visibility: data.visibility,
      location: data.location,
      mediaIds: data.mediaIds,
    };

    this.postService
      .updatePost(post.id, payload)
      .pipe(
        // Only now: the API refuses to delete a photo still on a post. A failure leaves a file nobody sees.
        switchMap(() =>
          data.removedMediaIds.length > 0
            ? forkJoin(
                data.removedMediaIds.map((id) =>
                  this.mediaService.deleteMedia(id).pipe(
                    catchError((err) => {
                      console.error('Could not delete removed image', err);
                      return of(undefined);
                    }),
                  ),
                ),
              )
            : of([]),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          // Back to where the edit was opened from, so "Wróć" there never lands on this form.
          this.postService.clearActivePost();
          this.backService.back(`/posts/${post.id}`);
        },
        error: (err) => {
          console.error('Error while updating post', err);
          this.postFormComponent.resetSubmitting();
        },
      });
  }
}
