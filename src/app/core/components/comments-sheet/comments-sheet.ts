import { A11yModule } from '@angular/cdk/a11y';
import { Location } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { filter } from 'rxjs';

import { CommentsSheetService } from '../../services/comments-sheet/comments-sheet.service';
import { backClosable } from '../../services/back-closable/back-closable';
import { Tooltip } from '../../directives/tooltip';
import { CommentThread } from '../comment-thread/comment-thread';

export type SheetSize = 'half' | 'full';

/** On the root while docked, so the app's content can make room. See styles.scss. */
const DOCKED_CLASS = 'comments-docked';

/**
 * From this width the panel sits beside the feed. The feed's column and the panel fit side by side here
 * (560 + 420 px and some margin), so below it there's no room to use both at once.
 */
const DOCKED_FROM_PX = 1024;

/** A fast flick decides by its direction alone, in pixels per millisecond. */
const FLICK_SPEED = 0.5;

/**
 * Where a drag ends. A fast flick moves one step its way, and a slow drag settles on the nearest
 * size. Below half, the sheet closes.
 */
export function settleDrag(
  height: number,
  half: number,
  full: number,
  speed: number,
  from: SheetSize,
): SheetSize | 'close' {
  if (speed > FLICK_SPEED) {
    return 'full';
  }
  if (speed < -FLICK_SPEED) {
    return from === 'full' ? 'half' : 'close';
  }
  if (height < half * 0.7) {
    return 'close';
  }
  return height < (half + full) / 2 ? 'half' : 'full';
}

/**
 * The comments of a post in the feed. On a wide screen, a panel docked beside the feed, which stays
 * bright and scrolls by itself, so another card's comment button just switches the panel to that post.
 * On anything narrower, a sheet over the feed, which opens at half the screen and drags up to full. The
 * address bar shows the post's comments link while it's open, and X, Esc and the browser's Back close
 * either one, as does a tap outside the sheet.
 */
@Component({
  selector: 'app-comments-sheet',
  imports: [A11yModule, RouterLink, TranslatePipe, NgIcon, Tooltip, CommentThread],
  viewProviders: [provideIcons({ lucideX })],
  templateUrl: './comments-sheet.html',
  styleUrl: './comments-sheet.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class CommentsSheet {
  readonly sheet = inject(CommentsSheetService);
  private document = inject(DOCUMENT);
  private location = inject(Location);
  private panel = viewChild<ElementRef<HTMLElement>>('panel');
  private overlay = backClosable('commentsSheet', () => this.closed());
  private shownPostId: string | null = null;

  /** Beside the feed, rather than over it. Decided on opening, for as long as it stays open. */
  readonly docked = signal(false);
  readonly size = signal<SheetSize>('half');
  /** The panel's height in pixels while it's being dragged. */
  readonly dragHeight = signal<number | null>(null);
  private drag: { startY: number; startHeight: number; lastY: number; lastTime: number } | null =
    null;
  private speed = 0;

  constructor() {
    afterRenderEffect(() => {
      const post = this.sheet.post();
      untracked(() => post && this.opened(post.id));
    });

    // Following a profile link: the sheet goes, and the link takes over its history entry.
    inject(Router)
      .events.pipe(
        filter(
          (event) => event instanceof NavigationStart && event.navigationTrigger !== 'popstate',
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.overlay.abandon());
  }

  close(): void {
    this.overlay.close();
  }

  onEscape(): void {
    // The delete confirmation is a dialog of its own, and Esc belongs to it.
    if (this.sheet.post() && !this.document.querySelector('dialog[open]')) {
      this.close();
    }
  }

  /** Typing needs the room, and on a phone the keyboard is about to take half the screen. */
  grow(): void {
    this.size.set('full');
  }

  onDragStart(event: PointerEvent): void {
    const panel = this.panel()?.nativeElement;
    if (!panel || this.docked()) {
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = {
      startY: event.clientY,
      startHeight: panel.offsetHeight,
      lastY: event.clientY,
      lastTime: event.timeStamp,
    };
    this.speed = 0;
  }

  onDragMove(event: PointerEvent): void {
    if (!this.drag) {
      return;
    }
    const elapsed = event.timeStamp - this.drag.lastTime;
    if (elapsed > 0) {
      this.speed = (this.drag.lastY - event.clientY) / elapsed;
    }
    this.drag.lastY = event.clientY;
    this.drag.lastTime = event.timeStamp;
    const height = this.drag.startHeight + this.drag.startY - event.clientY;
    this.dragHeight.set(Math.min(Math.max(height, 0), this.fullHeight()));
  }

  onDragEnd(): void {
    const height = this.dragHeight();
    this.drag = null;
    this.dragHeight.set(null);
    if (height === null) {
      return;
    }
    const end = settleDrag(height, this.halfHeight(), this.fullHeight(), this.speed, this.size());
    if (end === 'close') {
      this.close();
    } else {
      this.size.set(end);
    }
  }

  private opened(postId: string): void {
    const url = this.location.prepareExternalUrl(`/posts/${postId}#comments`);
    if (this.overlay.isOpen()) {
      // Another card's button, with the panel docked beside the feed. Still one Back to close.
      if (postId !== this.shownPostId) {
        this.shownPostId = postId;
        this.overlay.showUrl(url);
      }
      return;
    }
    const view = this.document.defaultView;
    const docked = !!view?.matchMedia(`(min-width: ${DOCKED_FROM_PX}px)`).matches;
    this.docked.set(docked);
    this.document.documentElement.classList.toggle(DOCKED_CLASS, docked);
    this.size.set('half');
    this.shownPostId = postId;
    this.overlay.opened({ url, pageStaysLive: docked });
    // The panel itself. The text box would bring up a phone's keyboard for someone who came to read,
    // and the close button would show its tooltip each time.
    this.panel()?.nativeElement.focus();
  }

  private closed(): void {
    this.sheet.close();
    this.shownPostId = null;
    this.docked.set(false);
    this.document.documentElement.classList.remove(DOCKED_CLASS);
  }

  private halfHeight(): number {
    return (this.document.defaultView?.innerHeight ?? 0) * 0.5;
  }

  private fullHeight(): number {
    return (this.document.defaultView?.innerHeight ?? 0) - 24;
  }
}
