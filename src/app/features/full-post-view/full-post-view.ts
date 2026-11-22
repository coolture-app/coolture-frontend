import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  OnInit,
  viewChild,
  DestroyRef,
  effect,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Title } from '@angular/platform-browser';
import { PostComponent } from '../../core/components/post-component/post-component';
import { BackLink } from '../../core/components/back-link/back-link';
import { ActivatedRoute, Router } from '@angular/router';
import { CommentThread } from '../../core/components/comment-thread/comment-thread';
import { PostService } from '../../core/services/post/post.service';
import { TranslatePipe } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BackService } from '../../core/services/back/back.service';
import { PostListStore } from '../../core/services/post-list/post-list.store';
import { NotFoundView } from '../not-found-view/not-found-view';
import { LoadState } from '../../core/components/load-state/load-state';
import { PostSkeleton } from '../../core/components/post-skeleton/post-skeleton';

@Component({
  selector: 'app-full-post-view',
  imports: [
    PostComponent,
    CommentThread,
    TranslatePipe,
    BackLink,
    NotFoundView,
    LoadState,
    PostSkeleton,
  ],
  templateUrl: './full-post-view.html',
  styleUrl: './full-post-view.scss',
})
export class FullPostView implements OnInit {
  private route = inject(ActivatedRoute);
  private postService = inject(PostService);
  private destroyRef = inject(DestroyRef);
  private title = inject(Title);
  private backService = inject(BackService);
  private list = inject(PostListStore);
  private router = inject(Router);

  private isScrolling = false;

  commentSection = viewChild<ElementRef>('commentSection');
  post = this.postService.activePost;
  /** Deleted, missing, or by someone in a block with the viewer: the API doesn't say which. The URL stays. */
  notFound = signal(false);
  failed = signal(false);

  constructor() {
    effect(() => {
      const post = this.post();
      if (post) {
        this.backService.rememberPostTitle(post.id, post.title);
      }
    });

    // Once the comments are on the page, which can wait for the post to load. A frame and a task
    // later, so it comes after the router's own scroll to the top.
    afterRenderEffect(() => {
      const section = this.commentSection()?.nativeElement as HTMLElement | undefined;
      if (section && this.isScrolling) {
        this.isScrolling = false;
        requestAnimationFrame(() =>
          setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' })),
        );
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    // Not on Back or Forward, where the router puts back the scroll the reader left.
    this.isScrolling =
      this.route.snapshot.fragment === 'comments' &&
      this.router.currentNavigation()?.trigger !== 'popstate';
    if (id && this.post()?.id !== id) {
      // A post from another page would show until this one comes.
      this.postService.clearActivePost();
      this.load(id);
    }
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.load(id);
    }
  }

  private load(id: string): void {
    this.failed.set(false);
    this.postService
      .getPost(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.postService.setActivePost(data);
          this.title.setTitle(data.title);
        },
        error: (error) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.notFound.set(true);
          } else {
            console.error(error);
            this.failed.set(true);
          }
        },
      });
  }

  changeCount(by: number): void {
    const post = this.post();
    if (post) {
      const commentsCount = Math.max(0, (post.commentsCount || 0) + by);
      this.postService.setActivePost({ ...post, commentsCount });
    }
  }

  /** The post is gone, so it leaves the list it's going back to as well. */
  removeChild(id: string) {
    this.list.removeItem(id);
    this.backService.back('/');
  }
}
