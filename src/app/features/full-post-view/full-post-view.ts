import {
  AfterViewInit,
  Component,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { PostComponent } from '../../core/components/post-component/post-component';
import { ActivatedRoute, Router } from '@angular/router';
import { CommentComponent } from '../../core/components/comment/comment-component';
import { PostService } from '../../core/services/post/post.service';
import { CommentsService } from '../../core/services/comments/comments.service';
import { CommentSummary } from '../../core/models/comments/comment-summary.model';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CommentCreateRequest } from '../../core/models/comments/comment-create-request.model';

@Component({
  selector: 'app-full-post-view',
  imports: [PostComponent, CommentComponent, FormsModule, TranslatePipe],
  templateUrl: './full-post-view.html',
  styleUrl: './full-post-view.scss',
})
export class FullPostView implements OnInit, AfterViewInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private postService = inject(PostService);
  private commentsService = inject(CommentsService);
  private isScrolling = false;
  parentCommentId: string | null = null;
  parentUsername: string | null = null;

  commentSection = viewChild<ElementRef>('commentSection');
  commentInput = viewChild<ElementRef>('commentInput');
  commentContent = signal<string>('');
  isCommentFocused = signal<boolean>(false);
  post = this.postService.activePost;
  comments = signal<CommentSummary[]>([]);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    this.isScrolling = this.route.snapshot.queryParamMap.get('scrollToComments') === 'true';
    if (id) {
      if (!this.post() || this.post()?.id !== id) {
        this.postService.getPost(id).subscribe({
          next: (data) => {
            this.postService.setActivePost(data);
          },
          error: (error) => console.log(error),
        });
      }
      this.commentsService.getCommentsOfPost(id, undefined, { cursor: '', limit: 20 }).subscribe({
        next: (res) =>
          this.comments.set(res.items.filter((c) => c.status !== 'DELETED' || c.repliesCount > 0)),
        error: (err) => console.error(err),
      });
    } else {
      console.error('NO ID IN URL ERRRR');
    }
  }

  ngAfterViewInit(): void {
    if (this.isScrolling) {
      //the timeout is to ensure that the scrolling is turned on after page renders
      setTimeout(() => {
        this.commentSection()?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
    }
  }

  // comments fetched via service are available in this.comments()

  goBack() {
    this.router.navigate(['/']);
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
      this.commentsService.createComment(this.post()!.id, payload).subscribe({
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
        },
        error: (err) => console.error(err),
      });
    }
  }

  onCommentDeleted(deletedId: string): void {
    this.comments.update((comments) => comments.filter((c) => c.id !== deletedId));
    const currentPost = this.post();
    if (currentPost) {
      this.postService.setActivePost({
        ...currentPost,
        commentsCount: Math.max(0, currentPost.commentsCount - 1),
      });
    }
  }
}
