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
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSendHorizontal, lucideX } from '@ng-icons/lucide';

import { CommentComponent, DeletedComment, ReplyTarget } from '../comment/comment-component';
import { CommentSummary } from '../../models/comments/comment-summary.model';
import { CommentsService } from '../../services/comments/comments.service';
import { AuthService } from '../../services/auth/auth.service';
import { ToastService } from '../../services/toast/toast.service';
import { InfiniteScroll } from '../../directives/infinite-scroll';
import { Tooltip } from '../../directives/tooltip';

const PAGE = 20;
/** The API's limit on a comment. */
const MAX_LENGTH = 512;
/** The counter stays out of the way until the limit is near. */
const COUNTER_FROM = 400;

/**
 * A post's comments with the box to write one, for the post page and the sheet over the feed. The list
 * is newest first, as the API sends it, so a new comment appears at the top.
 */
@Component({
  selector: 'app-comment-thread',
  imports: [FormsModule, TranslatePipe, NgIcon, CommentComponent, InfiniteScroll, Tooltip],
  viewProviders: [provideIcons({ lucideSendHorizontal, lucideX })],
  templateUrl: './comment-thread.html',
  styleUrl: './comment-thread.scss',
  host: { '[class.thread--sheet]': 'inSheet()' },
})
export class CommentThread implements OnInit {
  readonly postId = input.required<string>();
  readonly inSheet = input(false);
  /** A comment was added (+1) or removed (-1), so whoever shows the count can update it. */
  readonly countChange = output<number>();
  /** The box took focus, which on a phone means the keyboard is coming. */
  readonly composerFocused = output<void>();

  private commentsService = inject(CommentsService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private document = inject(DOCUMENT);
  private host: HTMLElement = inject(ElementRef).nativeElement;
  private input = viewChild<ElementRef<HTMLTextAreaElement>>('commentInput');
  private authService = inject(AuthService);

  readonly user = this.authService.currentUser;
  readonly maxLength = MAX_LENGTH;
  readonly comments = signal<CommentSummary[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly hasMore = signal(false);
  readonly content = signal('');
  readonly replyTo = signal<ReplyTarget | null>(null);
  readonly sending = signal(false);
  private cursor: string | undefined;

  readonly canSend = computed(() => !this.sending() && this.body().length > 0);
  /** What's left to write, once that's worth showing. */
  readonly remaining = computed(() => {
    const length = this.content().length;
    return length >= COUNTER_FROM ? MAX_LENGTH - length : null;
  });
  /** A reply's prefilled @name alone says nothing, so it doesn't count as a comment. */
  private readonly body = computed(() => {
    const text = this.content().trim();
    return text === this.mentionPrefix().trim() ? '' : text;
  });
  private readonly mentionPrefix = computed(() => {
    const target = this.replyTo();
    return target?.mention ? `@${target.username} ` : '';
  });

  constructor() {
    this.trackKeyboard();
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.commentsService
      .getCommentsOfPost(this.postId(), undefined, { cursor: this.cursor ?? '', limit: PAGE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const known = new Set(this.comments().map((c) => c.id));
          const added = res.items.filter(
            (c) => !known.has(c.id) && (c.status !== 'DELETED' || c.repliesCount > 0),
          );
          this.comments.update((comments) => [...comments, ...added]);
          this.cursor = res.page.nextCursor;
          this.hasMore.set(res.page.hasMore);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  /** Signing in comes back to these comments, and writing is what a guest wanted to do. */
  signIn(): void {
    void this.authService.login();
  }

  setReplyTo(target: ReplyTarget): void {
    if (!this.user()) {
      this.signIn();
      return;
    }
    const previous = this.mentionPrefix();
    this.replyTo.set(target);
    const kept = this.content().startsWith(previous) ? this.content().slice(previous.length) : '';
    this.content.set(this.mentionPrefix() + kept);
    afterNextRender(
      () => {
        const box = this.input()?.nativeElement;
        this.resize();
        box?.focus();
        box?.setSelectionRange(box.value.length, box.value.length);
      },
      { injector: this.injector },
    );
  }

  cancelReply(): void {
    const prefix = this.mentionPrefix();
    if (prefix && this.content().startsWith(prefix)) {
      this.content.update((text) => text.slice(prefix.length));
    }
    this.replyTo.set(null);
  }

  resize(): void {
    const box = this.input()?.nativeElement;
    if (box) {
      box.style.height = 'auto';
      box.style.height = `${box.scrollHeight + 2}px`;
    }
  }

  /** Ctrl or Cmd and Enter sends. Enter alone starts a new line, as on a phone's keyboard. */
  onKeydown(event: Event): void {
    event.preventDefault();
    this.send();
  }

  send(): void {
    if (!this.canSend()) {
      return;
    }
    this.sending.set(true);
    this.commentsService
      .createComment(this.postId(), {
        content: this.body(),
        parentCommentId: this.replyTo()?.parentId ?? null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comment) => this.sent(comment),
        error: () => {
          this.sending.set(false);
          this.toast.show(this.translate.instant('COMMENT.send-error'));
        },
      });
  }

  /** A reply's deletion comes through here too. Its id matches nothing on this list. */
  onDeleted({ id, hasReplies }: DeletedComment): void {
    this.comments.update((comments) =>
      hasReplies
        ? comments.map((c) => (c.id === id ? { ...c, status: 'DELETED' as const } : c))
        : comments.filter((c) => c.id !== id),
    );
    this.countChange.emit(-1);
  }

  private sent(comment: CommentSummary): void {
    this.sending.set(false);
    this.content.set('');
    this.replyTo.set(null);
    this.resize();
    this.input()?.nativeElement.blur();
    this.countChange.emit(1);
    if (comment.parentCommentId) {
      this.commentsService.commentAdded$.next(comment);
      return;
    }
    this.comments.update((comments) => [comment, ...comments]);
    afterNextRender(
      () =>
        this.host
          .querySelector(`[data-comment-id="${comment.id}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      { injector: this.injector },
    );
  }

  /**
   * A phone's keyboard covers the page without resizing it, so whatever sits at the bottom of the
   * screen moves up by this much. The value goes on the root, for the sheet to use as well.
   */
  private trackKeyboard(): void {
    const view = this.document.defaultView;
    const viewport = view?.visualViewport;
    if (!view || !viewport) {
      return;
    }
    const root = this.document.documentElement;
    const update = () => {
      const covered = view.innerHeight - viewport.height - viewport.offsetTop;
      root.style.setProperty('--keyboard-inset', `${Math.max(0, Math.round(covered))}px`);
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    this.destroyRef.onDestroy(() => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-inset');
    });
  }
}
