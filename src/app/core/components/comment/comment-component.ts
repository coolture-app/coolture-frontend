import { InitialsPipe } from '../../pipes/initials.pipe';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEllipsis, lucidePencil, lucideTrash2 } from '@ng-icons/lucide';

import { CommentSummary } from '../../models/comments/comment-summary.model';
import { CommentsService } from '../../services/comments/comments.service';
import { AuthService } from '../../services/auth/auth.service';
import { ToastService } from '../../services/toast/toast.service';
import { ConfirmService } from '../../services/confirm/confirm.service';
import { Tooltip } from '../../directives/tooltip';
import { Sheet } from '../sheet/sheet';
import { Menu, MenuItem } from '../menu/menu';
import { commentTime } from './comment-time';

/** Who a reply answers, and where it goes. */
export interface ReplyTarget {
  parentId: string;
  username: string;
  /** Answering a reply: it sits under the top comment, so the text says who it's for. */
  mention: boolean;
}

/** A deleted comment, and whether replies keep it on the list as a note. */
export interface DeletedComment {
  id: string;
  hasReplies: boolean;
}

/** The API's limit on a comment. */
export const MAX_COMMENT_LENGTH = 512;

/** A deleted comment stays only as the note above its replies. */
export function isShown(comment: CommentSummary): boolean {
  return comment.status !== 'DELETED' || comment.repliesCount > 0;
}

export function afterDelete(
  comments: CommentSummary[],
  { id, hasReplies }: DeletedComment,
): CommentSummary[] {
  return hasReplies
    ? comments.map((c) => (c.id === id ? { ...c, status: 'DELETED' as const } : c))
    : comments.filter((c) => c.id !== id);
}

const REPLIES_PAGE = 20;

/**
 * One comment and its replies. Replies show as one level under the top comment, and answering a reply
 * mentions its author. One written while the top comment was deleted sits a level deeper, and still shows.
 */
@Component({
  selector: 'app-comment-component',
  imports: [InitialsPipe, TranslatePipe, RouterLink, NgIcon, Tooltip, Menu, MenuItem],
  viewProviders: [provideIcons({ lucideEllipsis, lucidePencil, lucideTrash2 })],
  templateUrl: './comment-component.html',
  styleUrl: './comment-component.scss',
})
export class CommentComponent implements OnInit {
  readonly comment = input.required<CommentSummary>();
  /** Whether the top comment can still take replies. A deleted one can't. */
  readonly rootActive = input(true);
  readonly replyClicked = output<ReplyTarget>();
  readonly commentDeleted = output<DeletedComment>();
  /** A reply below this one, at any depth, was deleted. */
  readonly replyDeleted = output<void>();

  /** In the sheet, a profile link replaces the sheet's history entry, so Back returns to the feed. */
  readonly inSheet = !!inject(Sheet, { optional: true });
  readonly maxLength = MAX_COMMENT_LENGTH;

  private authService = inject(AuthService);
  private commentsService = inject(CommentsService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private host: HTMLElement = inject(ElementRef).nativeElement;
  private confirm = inject(ConfirmService);
  private editInput = viewChild<ElementRef<HTMLTextAreaElement>>('editInput');

  readonly isShowingReplies = signal(false);
  readonly replies = signal<CommentSummary[]>([]);
  /** Older replies exist, which the API pages from the newest down. */
  readonly hasEarlierReplies = signal(false);
  readonly repliesFailed = signal(false);
  readonly isEditing = signal(false);
  readonly repliesCount = linkedSignal(() => this.comment().repliesCount);
  private readonly savedContent = signal<string | null>(null);
  private readonly wasEdited = signal(false);
  private repliesCursor: string | undefined;
  private hasFetchedReplies = false;

  readonly isDeleted = computed(() => this.comment().status === 'DELETED');
  readonly isMine = computed(() => this.authService.currentUser()?.id === this.comment().author.id);
  readonly content = computed(() => this.savedContent() ?? this.comment().content);
  readonly edited = computed(() => this.wasEdited() || !!this.comment().lastEditedAt);
  readonly mention = computed(() => {
    const match = this.comment().depth > 0 ? this.content().match(/^@(\S+)\s*([\s\S]*)$/) : null;
    return match ? { username: match[1], text: match[2] } : null;
  });
  readonly time = computed(() =>
    commentTime(this.comment().createdAt, this.translate.currentLang ?? 'pl'),
  );
  /** Top comments and first-level replies can always be answered; the API stops at depth 2. */
  readonly canReply = computed(() => {
    const { depth } = this.comment();
    return !this.isDeleted() && (depth < 2 || this.rootActive());
  });

  ngOnInit(): void {
    this.commentsService.commentAdded$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((added) => {
        if (added.parentCommentId === this.comment().id) {
          this.showNewReply(added);
        }
      });
  }

  onReply(): void {
    const { id, depth, rootCommentId, author } = this.comment();
    const underRoot = depth > 0 && this.rootActive() && rootCommentId;
    this.replyClicked.emit({
      parentId: underRoot ? rootCommentId : id,
      username: author.username,
      mention: depth > 0,
    });
  }

  toggleReplies(): void {
    this.isShowingReplies.update((showing) => !showing);
    if (this.isShowingReplies() && !this.hasFetchedReplies) {
      this.loadReplies();
    }
  }

  /** The API sends each page newest first. A thread reads as a conversation, oldest first. */
  loadReplies(then?: () => void): void {
    this.repliesFailed.set(false);
    this.commentsService
      .getCommentsOfPost(this.comment().postId, this.comment().id, {
        cursor: this.repliesCursor ?? '',
        limit: REPLIES_PAGE,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const shown = res.items.filter(isShown);
          const known = new Set(this.replies().map((c) => c.id));
          const older = shown.filter((c) => !known.has(c.id)).reverse();
          this.replies.update((replies) => [...older, ...replies]);
          this.repliesCursor = res.page.nextCursor;
          this.hasEarlierReplies.set(res.page.hasMore);
          this.hasFetchedReplies = true;
          then?.();
        },
        error: () => this.repliesFailed.set(true),
      });
  }

  startEditing(): void {
    this.isEditing.set(true);
    afterNextRender(
      () => {
        const textarea = this.editInput()?.nativeElement;
        textarea?.focus();
        textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
      },
      { injector: this.injector },
    );
  }

  cancelEdit(event: Event): void {
    event.stopPropagation();
    this.isEditing.set(false);
  }

  /** Enter and leaving the box both save. An empty or unchanged text changes nothing. */
  saveEdit(text: string, event?: Event): void {
    event?.preventDefault();
    if (!this.isEditing()) {
      return;
    }
    this.isEditing.set(false);
    const before = this.content();
    const content = text.trim();
    if (!content || content === before) {
      return;
    }
    this.savedContent.set(content);
    this.commentsService
      .editComment(this.comment().id, { content })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.wasEdited.set(true),
        error: () => {
          this.savedContent.set(before);
          this.toast.show(this.translate.instant('COMMENT.edit-error'));
        },
      });
  }

  async askToDelete(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: 'COMMENT.deleteTitle',
      text: 'COMMENT.deleteText',
      confirm: 'COMMENT.delete-comment',
      danger: true,
    });
    if (confirmed) {
      this.deleteComment();
    }
  }

  onReplyDeleted(deleted: DeletedComment): void {
    this.replies.update((replies) => afterDelete(replies, deleted));
    this.repliesCount.update((count) => Math.max(0, count - 1));
    this.replyDeleted.emit();
  }

  private deleteComment(): void {
    this.commentsService
      .deleteComment(this.comment().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () =>
          this.commentDeleted.emit({ id: this.comment().id, hasReplies: this.repliesCount() > 0 }),
        error: () => this.toast.show(this.translate.instant('COMMENT.delete-error')),
      });
  }

  /** Opens the thread, with what was already there, and brings the new reply into view. */
  private showNewReply(added: CommentSummary): void {
    const show = () => {
      if (!this.replies().some((c) => c.id === added.id)) {
        this.replies.update((replies) => [...replies, added]);
      }
      this.isShowingReplies.set(true);
      this.repliesCount.update((count) => count + 1);
      afterNextRender(
        () =>
          this.host
            .querySelector(`[data-comment-id="${added.id}"]`)
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
        { injector: this.injector },
      );
    };
    if (this.repliesCount() > 0 && !this.hasFetchedReplies) {
      this.loadReplies(show);
    } else {
      this.hasFetchedReplies = true;
      show();
    }
  }
}
