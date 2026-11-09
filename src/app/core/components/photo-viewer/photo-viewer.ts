import {
  afterRenderEffect,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideX } from '@ng-icons/lucide';

import { PhotoViewerService } from '../../services/photo-viewer/photo-viewer.service';
import { Tooltip } from '../../directives/tooltip';

/** Marks the history entry the viewer adds, so the browser's Back closes it. */
const HISTORY_KEY = 'photoViewer';

/**
 * Whether a click fell on the photo itself. The image element fills the screen, and `object-fit:
 * contain` draws the photo inside it with dark bars, which count as outside.
 */
function onDrawnPhoto(image: HTMLImageElement, event: MouseEvent): boolean {
  const box = image.getBoundingClientRect();
  if (!image.naturalWidth || !image.naturalHeight) {
    return true;
  }
  const scale = Math.min(box.width / image.naturalWidth, box.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const left = box.left + (box.width - width) / 2;
  const top = box.top + (box.height - height) / 2;
  return (
    event.clientX >= left &&
    event.clientX <= left + width &&
    event.clientY >= top &&
    event.clientY <= top + height
  );
}

/**
 * A post's photos, full screen and whole, over a dark background. Swipe or the arrows move between
 * them; Esc, the close button, a click beside the photo or the browser's Back close it.
 */
@Component({
  selector: 'app-photo-viewer',
  imports: [TranslatePipe, NgIcon, Tooltip],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideChevronRight, lucideX })],
  templateUrl: './photo-viewer.html',
  styleUrl: './photo-viewer.scss',
  host: {
    '(document:keydown)': 'onKey($event)',
    '(click)': 'onClick($event)',
  },
})
export class PhotoViewer {
  readonly viewer = inject(PhotoViewerService);
  private document = inject(DOCUMENT);
  private track = viewChild<ElementRef<HTMLElement>>('track');
  private closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');

  readonly index = signal(0);
  private returnFocus: HTMLElement | null = null;
  private wasOpen = false;
  /** The page's scroll when the viewer opened, put back after it closes. */
  private pageY = 0;
  private leaving = false;

  constructor() {
    const view = this.document.defaultView;
    const onPop = () => this.onPopState();
    view?.addEventListener('popstate', onPop);
    inject(DestroyRef).onDestroy(() => view?.removeEventListener('popstate', onPop));

    afterRenderEffect(() => {
      const open = this.viewer.open();
      untracked(() => open && this.opened(open.index));
    });
  }

  /**
   * Goes back past the viewer's own history entry, and the pop then finishes closing. A button, a key
   * and a click beside the photo all come here, so they act as the browser's Back does.
   */
  close(): void {
    const view = this.document.defaultView;
    if (view?.history.state?.[HISTORY_KEY]) {
      view.history.back();
    } else {
      this.finish();
    }
  }

  go(step: number): void {
    const open = this.viewer.open();
    if (!open) {
      return;
    }
    const target = Math.min(Math.max(this.index() + step, 0), open.photos.length - 1);
    this.scrollTo(target, 'smooth');
  }

  onScroll(): void {
    const track = this.track()?.nativeElement;
    if (track && track.clientWidth > 0) {
      this.index.set(Math.round(track.scrollLeft / track.clientWidth));
    }
  }

  /** A click on the dark area around the photo closes, as in most photo viewers. */
  onClick(event: MouseEvent): void {
    const target = event.target as Element;
    if (!this.viewer.open() || target.closest('button')) {
      return;
    }
    if (!(target instanceof HTMLImageElement) || !onDrawnPhoto(target, event)) {
      this.close();
    }
  }

  onKey(event: KeyboardEvent): void {
    if (!this.viewer.open()) {
      return;
    }
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'ArrowLeft') {
      this.go(-1);
    } else if (event.key === 'ArrowRight') {
      this.go(1);
    }
  }

  /**
   * The viewer's history entry is gone, by Back or by `close()`. The router takes the return to the
   * same URL for a skipped navigation and scrolls to the top on its next frame, so the viewer stays
   * over the page until that has happened, puts the page's scroll back, and only then goes.
   */
  onPopState(): void {
    if (!this.wasOpen || this.leaving) {
      return;
    }
    this.leaving = true;
    setTimeout(() =>
      requestAnimationFrame(() =>
        setTimeout(() => {
          this.document.defaultView?.scrollTo({ top: this.pageY, behavior: 'instant' });
          this.finish();
        }),
      ),
    );
  }

  private opened(index: number): void {
    if (this.wasOpen) {
      return;
    }
    this.wasOpen = true;
    this.leaving = false;
    const view = this.document.defaultView;
    this.pageY = view?.scrollY ?? 0;
    this.returnFocus = this.document.activeElement as HTMLElement | null;
    // The same URL and router state, so Back only leaves this entry and stays on the page.
    view?.history.pushState({ ...view.history.state, [HISTORY_KEY]: true }, '');
    this.document.documentElement.style.overflow = 'hidden';
    this.index.set(index);
    this.scrollTo(index, 'instant');
    this.closeButton()?.nativeElement.focus();
  }

  private finish(): void {
    this.wasOpen = false;
    this.leaving = false;
    this.viewer.close();
    this.restorePage();
  }

  private restorePage(): void {
    this.document.documentElement.style.overflow = '';
    this.returnFocus?.focus({ preventScroll: true });
    this.returnFocus = null;
  }

  private scrollTo(index: number, behavior: ScrollBehavior): void {
    const track = this.track()?.nativeElement;
    track?.scrollTo({ left: index * track.clientWidth, behavior });
  }
}
