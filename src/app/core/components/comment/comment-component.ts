import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommentSummary } from '../../models/comments/comment-summary.model';
import { Subscription } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { CommentsService } from '../../services/comments/comments.service';
import { AuthService } from '../../services/auth/auth.service';
import { CommentUpdateRequest } from '../../models/comments/comment-update-request.model';
import { ModalWindow } from '../modal/modal-window/modal-window';

@Component({
  selector: 'app-comment-component',
  imports: [TranslatePipe, ModalWindow],
  templateUrl: './comment-component.html',
  styleUrl: './comment-component.scss',
})
export class CommentComponent implements OnInit, OnDestroy {
  @Input({ required: true }) comment!: CommentSummary;
  @Output() replyClicked = new EventEmitter<[string, string]>();
  @Output() commentDeleted = new EventEmitter<string>();
  private authService = inject(AuthService);
  isShowingReplies = signal(false);
  replies = signal<CommentSummary[]>([]);
  private commentsService = inject(CommentsService);
  private hasFetchedReplies = false;
  private commentAddedSub?: Subscription;

  @ViewChild('editInput') editInput?: ElementRef;
  @ViewChild('myModal') myModal?: ModalWindow;

  isMyComment = false;
  isEditing = false;

  ngOnInit() {
    this.commentAddedSub = this.commentsService.commentAdded$.subscribe((newComment) => {
      if (newComment.parentCommentId === this.comment.id) {
        const handleNewComment = () => {
          if (!this.replies().find((c) => c.id === newComment.id)) {
            this.replies.update((r) => [...r, newComment]);
          }
          this.isShowingReplies.set(true);
          this.comment.repliesCount++;
        };

        if (this.comment.repliesCount > 0 && !this.hasFetchedReplies) {
          this.loadReplies(() => handleNewComment());
        } else {
          this.hasFetchedReplies = true;
          handleNewComment();
        }
      }
    });

    if (this.authService.currentUser()?.id == this.comment.author.id) {
      this.isMyComment = true;
    }
  }

  ngOnDestroy() {
    this.commentAddedSub?.unsubscribe();
  }

  onReply(): void {
    this.replyClicked.emit([this.comment.id, this.comment.author.username]);
  }

  showReplies(): void {
    this.isShowingReplies.set(!this.isShowingReplies());
    if (this.isShowingReplies() && !this.hasFetchedReplies) {
      this.loadReplies();
    }
  }

  private loadReplies(callback?: () => void): void {
    this.commentsService
      .getCommentsOfPost(this.comment.postId, this.comment.id, { cursor: '', limit: 20 })
      .subscribe({
        next: (res) => {
          this.replies.set(res.items.filter((c) => c.status !== 'DELETED' || c.repliesCount > 0));
          this.hasFetchedReplies = true;
          if (callback) callback();
        },
        error: (err) => console.error(err),
      });
  }

  startEditingComment(): void {
    this.isEditing = true;
    setTimeout(() => {
      const textarea = this.editInput?.nativeElement;
      if (textarea) {
        textarea.focus();
        textarea.selectionStart = textarea.value.length;
        textarea.selectionEnd = textarea.value.length;
      }
    }, 0);
  }

  saveEdit(newContent: string): void {
    this.isEditing = false;
    if (newContent.trim() === '' || newContent === this.comment.content) {
      return;
    }
    this.comment.content = newContent;
    const commentUpdateRequest: CommentUpdateRequest = {
      content: newContent,
    };
    this.commentsService.editComment(this.comment.id, commentUpdateRequest).subscribe({
      next: () => {
        console.log('Edycja zapisana');
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  handleModalResponse(action: string): void {
    if (action === 'YES') {
      this.deleteComment();
    }
  }

  openModal(): void {
    this.myModal?.open();
  }

  deleteComment(): void {
    this.commentsService.deleteComment(this.comment.id).subscribe({
      next: () => {
        this.commentDeleted.emit(this.comment.id);
      },
      error: (err) => {
        console.error(err);
      },
    });
  }

  onCommentDeleted(deletedId: string): void {
    this.replies.update((r) => r.filter((c) => c.id !== deletedId));
    this.comment.repliesCount = Math.max(0, this.comment.repliesCount - 1);
  }
}
