import { Component, inject, OnInit, signal, DestroyRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { PostService } from '../../core/services/post/post.service';
import { MediaService } from '../../core/services/media/media.service';
import { PostForm } from '../../core/components/post-form/post-form';
import { PostFormData } from '../../core/models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../core/models/posts/post-detail.model';
import { PostUpdateRequest } from '../../core/models/posts/post-update-request.model';
import { BackService } from '../../core/services/back/back.service';
import { BackLink } from '../../core/components/back-link/back-link';
import { LoadState } from '../../core/components/load-state/load-state';
import { ToastService } from '../../core/services/toast/toast.service';
import { NotFoundView } from '../not-found-view/not-found-view';

@Component({
  selector: 'app-edit-post-view',
  standalone: true,
  imports: [CommonModule, TranslatePipe, PostForm, BackLink, LoadState, NotFoundView],
  templateUrl: './edit-post-view.html',
  styleUrl: './edit-post-view.scss',
})
export class EditPostView implements OnInit {
  private postService = inject(PostService);
  private mediaService = inject(MediaService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private backService = inject(BackService);
  private toast = inject(ToastService);

  @ViewChild(PostForm) postFormComponent!: PostForm;

  readonly postId = this.route.snapshot.paramMap.get('id') ?? '';
  currentPost = signal<PostDetail | null>(null);
  existingMedia = signal<PostMedia[]>([]);
  readonly notFound = signal(false);
  readonly failed = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.failed.set(false);
    this.postService
      .getPost(this.postId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.currentPost.set(post);
          this.backService.rememberPostTitle(post.id, post.title);
          this.existingMedia.set(post.media || []);
        },
        error: (err) => {
          console.error('Error while fetching event', err);
          if (err instanceof HttpErrorResponse && err.status === 404) {
            this.notFound.set(true);
          } else {
            this.failed.set(true);
          }
        },
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
      openEnded: data.openEnded,
      description: data.description,
      links: data.links,
      location: data.location,
      mediaIds: data.mediaIds,
    };

    this.postService
      .updatePost(post.id, payload)
      .pipe(
        // The API refuses to delete a photo still on a post, so this waits for the save. A failed delete leaves a
        // file nobody sees.
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
          this.toast.failed();
        },
      });
  }
}
