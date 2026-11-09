import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { PostComponent } from '../../core/components/post-component/post-component';
import { Btn } from '../../core/components/btn/btn';
import { ActivatedRoute, Router } from '@angular/router';
import { CommentComponent } from '../../core/components/comment/comment-component';
import { PostService } from '../../core/services/post/post.service';
import { CommentsService } from '../../core/services/comments/comments.service';
import { CommentSummary } from '../../core/models/comments/comment-summary.model';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CommentCreateRequest } from '../../core/models/comments/comment-create-request.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BackService } from '../../core/services/back/back.service';
import { PostListStore } from '../../core/services/post-list/post-list.store';

@Component({
  selector: 'app-full-post-view',
  imports: [PostComponent, CommentComponent, FormsModule, TranslatePipe, Btn],
  templateUrl: './full-post-view.html',
  styleUrl: './full-post-view.scss',
})
export class FullPostView implements OnInit {
  private route = inject(ActivatedRoute);
  private postService = inject(PostService);
  private commentsService = inject(CommentsService);
  private destroyRef = inject(DestroyRef);
  private title = inject(Title);
  private backService = inject(BackService);
  private list = inject(PostListStore);
  private router = inject(Router);

  private isScrolling = false;
  parentCommentId: string | null = null;
  parentUsername: string | null = null;

  commentSection = viewChild<ElementRef>('commentSection');
  commentInput = viewChild<ElementRef>('commentInput');
  commentContent = signal<string>('');
  isCommentFocused = signal<boolean>(false);
  post = this.postService.activePost;
  comments = signal<CommentSummary[]>([]);

  constructor() {
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
    if (id) {
      if (!this.post() || this.post()?.id !== id) {
        this.postService
          .getPost(id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (data) => {
              this.postService.setActivePost(data);
              this.title.setTitle(data.title);
            },
            error: (error) => console.log(error),
          });
      }
      this.commentsService
        .getCommentsOfPost(id, undefined, { cursor: '', limit: 20 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) =>
            this.comments.set(
              res.items.filter((c) => c.status !== 'DELETED' || c.repliesCount > 0),
            ),
          error: (err) => console.error(err),
        });
    } else {
      console.error('NO ID IN URL ERRRR');
    }
  }

  // comments fetched via service are available in this.comments()

  /** As the browser's Back, so the list comes back where it was left. */
  goBack() {
    this.backService.back('/');
  }

  checkIfResize(): void {
    const textarea = this.commentInput()?.nativeElement;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight + 2}px`;
    }
  }

  setReplyTo(payload: [string, string]) {
    this.parentCommentId = payload[0];
    this.parentUsername = payload[1];
    this.commentInput()?.nativeElement.focus();
  }

  addComment(): void {
    const payload: CommentCreateRequest = {
      content: this.commentContent(),
      parentCommentId: this.parentCommentId,
    };
    if (this.post() != null) {
      this.commentsService
        .createComment(this.post()!.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (newComment) => {
            if (!newComment.parentCommentId) {
              this.comments.update((comments) => [...comments, newComment]);
            } else {
              this.commentsService.commentAdded$.next(newComment);
            }
            this.commentContent.set('');
            this.parentCommentId = null;
            this.parentUsername = null;
            this.checkIfResize();
            this.commentInput()?.nativeElement.blur();
            const currentPost = this.post();
            if (currentPost) {
              this.postService.setActivePost({
                ...currentPost,
                commentsCount: (currentPost.commentsCount || 0) + 1,
              });
            }
          },
          error: (err) => console.error(err),
        });
    }
  }

  onCommentDeleted(deletedId: string): void {
    this.comments.update((comments) => {
      const comment = comments.find((c) => c.id === deletedId);
      if (comment && comment.repliesCount > 0) {
        return comments.map((c) => (c.id === deletedId ? { ...c, status: 'DELETED' } : c));
      }
      return comments.filter((c) => c.id !== deletedId);
    });
    const currentPost = this.post();
    if (currentPost) {
      this.postService.setActivePost({
        ...currentPost,
        commentsCount: Math.max(0, (currentPost.commentsCount || 0) - 1),
      });
    }
  }

  /** The post is gone, so it leaves the list it's going back to as well. */
  removeChild(id: string) {
    this.list.removeItem(id);
    this.backService.back('/');
  }
}
