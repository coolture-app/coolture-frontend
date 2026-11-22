import { A11yModule } from '@angular/cdk/a11y';
import { Location } from '@angular/common';
import {
  afterRenderEffect,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { filter } from 'rxjs';

import { backClosable } from '../../services/back-closable/back-closable';
import { Tooltip } from '../../directives/tooltip';

export type SheetSize = 'half' | 'full';

/** On the root while docked, so the page beside can make room. See styles.scss. */
const DOCKED_CLASS = 'sheet-docked';

/**
 * From this width the panel sits beside the page. Keep it in step with the html.sheet-docked rules in
 * styles.scss.
 */
const DOCKED_FROM_PX = 1024;

/** A fast flick decides by its direction alone, in pixels per millisecond. */
const FLICK_SPEED = 0.5;

let sheets = 0;

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
 * A panel open for as long as it's rendered. On a wide screen it's docked beside the page, which stays bright and
 * scrolls by itself. On anything narrower, a sheet over the page, which opens at half the screen and drags up to
 * full. The address bar shows `url` while it's open, and X, Esc, the browser's Back and a tap outside the sheet close
 * it, as does following a link out of it. Content marked `sheetHeading` goes above the title, and the rest is the
 * body, which scrolls itself. One at a time: they share a history key.
 */
@Component({
  selector: 'app-sheet',
  imports: [A11yModule, NgIcon, Tooltip],
  viewProviders: [provideIcons({ lucideX })],
  templateUrl: './sheet.html',
  styleUrl: './sheet.scss',
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class Sheet {
  /** The app's path for the address bar while open, such as `/posts/1#comments`. */
  readonly url = input.required<string>();
  readonly title = input.required<string>();
  readonly closeLabel = input.required<string>();
  readonly closed = output<void>();

  private document = inject(DOCUMENT);
  private location = inject(Location);
  private panel = viewChild<ElementRef<HTMLElement>>('panel');
  private overlay = backClosable('sheet', () => this.onClosed());
  readonly titleId = `sheet-title-${++sheets}`;
  private shownUrl: string | null = null;
  private destroyed = false;

  /** Beside the page, rather than over it. Decided on opening, for as long as it stays open. */
  readonly docked = signal(false);
  readonly size = signal<SheetSize>('half');
  readonly dragHeight = signal<number | null>(null);
  private drag: { startY: number; startHeight: number; lastY: number; lastTime: number } | null =
    null;
  private speed = 0;

  constructor() {
    afterRenderEffect(() => {
      const url = this.url();
      untracked(() => this.show(url));
    });

    // Following a link out of it: the sheet goes, and the link takes over its history entry.
    inject(Router)
      .events.pipe(
        filter(
          (event) => event instanceof NavigationStart && event.navigationTrigger !== 'popstate',
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.overlay.abandon());

    // Its owner took it away without closing it, such as a profile loading another user.
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.overlay.abandon();
    });
  }

  close(): void {
    this.overlay.close();
  }

  onEscape(): void {
    // A confirmation is a dialog of its own, and Esc belongs to it.
    if (!this.document.querySelector('dialog[open]')) {
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

  private show(path: string): void {
    const url = this.location.prepareExternalUrl(path);
    if (this.overlay.isOpen()) {
      // Another card's button, with the panel docked beside the page. Still one Back to close.
      if (url !== this.shownUrl) {
        this.shownUrl = url;
        this.overlay.showUrl(url);
      }
      return;
    }
    const docked = !!this.document.defaultView?.matchMedia(`(min-width: ${DOCKED_FROM_PX}px)`)
      .matches;
    this.docked.set(docked);
    this.document.documentElement.classList.toggle(DOCKED_CLASS, docked);
    this.shownUrl = url;
    this.overlay.opened({ url, pageStaysLive: docked });
    // The panel itself. A text box would bring up a phone's keyboard for someone who came to read,
    // and the close button would show its tooltip each time.
    this.panel()?.nativeElement.focus();
  }

  private onClosed(): void {
    this.shownUrl = null;
    this.document.documentElement.classList.remove(DOCKED_CLASS);
    if (!this.destroyed) {
      this.closed.emit();
    }
  }

  private halfHeight(): number {
    return (this.document.defaultView?.innerHeight ?? 0) * 0.5;
  }

  private fullHeight(): number {
    return (this.document.defaultView?.innerHeight ?? 0) - 24;
  }
}
