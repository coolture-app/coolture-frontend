import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
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
import { lucideEllipsis } from '@ng-icons/lucide';

import { CommentSummary } from '../../models/comments/comment-summary.model';
import { CommentsService } from '../../services/comments/comments.service';
import { AuthService } from '../../services/auth/auth.service';
import { ToastService } from '../../services/toast/toast.service';
import { ModalWindow } from '../modal/modal-window/modal-window';
import { Tooltip } from '../../directives/tooltip';
import { commentTime } from './comment-time';

/** Who a reply answers, and where it goes. See `target` below. */
export interface ReplyTarget {
  parentId: string;
  username: string;
  /** Answering a reply: it sits under the top comment, so the text says who it's for. */
  mention: boolean;
}

const REPLIES_PAGE = 20;

/**
 * One comment and its replies. Replies show as one level under the top comment, and answering a reply
 * mentions its author. Replies deeper than that were written before this rule, and still show.
 */
@Component({
  selector: 'app-comment-component',
  imports: [TranslatePipe, ModalWindow, RouterLink, NgIcon, Tooltip],
  viewProviders: [provideIcons({ lucideEllipsis })],
  templateUrl: './comment-component.html',
  styleUrl: './comment-component.scss',
})
export class CommentComponent implements OnInit {
  readonly comment = input.required<CommentSummary>();
  /** Whether the top comment can still take replies. A deleted one can't. */
  readonly rootActive = input(true);
  /** In the sheet, a profile link replaces the sheet's history entry, so Back returns to the feed. */
  readonly inSheet = input(false);
  readonly replyClicked = output<ReplyTarget>();
  readonly commentDeleted = output<string>();

  private authService = inject(AuthService);
  private commentsService = inject(CommentsService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);
  private host: HTMLElement = inject(ElementRef).nativeElement;
  private myModal = viewChild<ModalWindow>('myModal');
  private editInput = viewChild<ElementRef<HTMLTextAreaElement>>('editInput');

  readonly isShowingReplies = signal(false);
  readonly replies = signal<CommentSummary[]>([]);
  /** Older replies exist, which the API pages from the newest down. */
  readonly hasEarlierReplies = signal(false);
  readonly repliesFailed = signal(false);
  readonly isEditing = signal(false);
  readonly menuOpen = signal(false);
  readonly repliesCount = linkedSignal(() => this.comment().repliesCount);
  private readonly savedContent = signal<string | null>(null);
  private readonly wasEdited = signal(false);
  private repliesCursor: string | undefined;
  private hasFetchedReplies = false;

  readonly isDeleted = computed(() => this.comment().status === 'DELETED');
  readonly isMine = computed(() => this.authService.currentUser()?.id === this.comment().author.id);
  readonly content = computed(() => this.savedContent() ?? this.comment().content);
  readonly edited = computed(() => this.wasEdited() || !!this.comment().lastEditedAt);
  /** A reply's leading @name links to that person. */
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
          const shown = res.items.filter((c) => c.status !== 'DELETED' || c.repliesCount > 0);
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

  /** The next click anywhere closes the menu, including on one of its items. */
  toggleMenu(): void {
    const opening = !this.menuOpen();
    this.menuOpen.set(opening);
    if (opening) {
      // After this click has finished, so that it doesn't count as the next one.
      setTimeout(() =>
        this.document.addEventListener('click', () => this.menuOpen.set(false), { once: true }),
      );
    }
  }

  closeMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.set(false);
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

  openDeleteModal(): void {
    this.myModal()?.open();
  }

  handleModalResponse(action: string): void {
    if (action === 'YES') {
      this.deleteComment();
    }
  }

  onReplyDeleted(deletedId: string): void {
    this.replies.update((replies) => {
      const reply = replies.find((c) => c.id === deletedId);
      if (reply && reply.repliesCount > 0) {
        return replies.map((c) => (c.id === deletedId ? { ...c, status: 'DELETED' as const } : c));
      }
      return replies.filter((c) => c.id !== deletedId);
    });
    this.repliesCount.update((count) => Math.max(0, count - 1));
    this.commentDeleted.emit(deletedId);
  }

  private deleteComment(): void {
    this.commentsService
      .deleteComment(this.comment().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.commentDeleted.emit(this.comment().id),
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
