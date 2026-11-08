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
    '(window:popstate)': 'onPopState()',
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

  constructor() {
    // Runs when it opens or closes: the history entry, the page's scroll, focus, and the first photo.
    afterRenderEffect(() => {
      const open = this.viewer.open();
      untracked(() => (open ? this.opened(open.index) : this.closed()));
    });
  }

  close(): void {
    this.viewer.close();
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

  /** The browser's Back took the viewer's history entry away. */
  onPopState(): void {
    if (this.viewer.open()) {
      this.wasOpen = false;
      this.viewer.close();
      this.restorePage();
    }
  }

  private opened(index: number): void {
    if (this.wasOpen) {
      return;
    }
    this.wasOpen = true;
    this.returnFocus = this.document.activeElement as HTMLElement | null;
    const view = this.document.defaultView;
    // The same URL and router state, so the router ignores this entry; Back then only closes.
    view?.history.pushState({ ...view.history.state, [HISTORY_KEY]: true }, '');
    this.document.documentElement.style.overflow = 'hidden';
    this.index.set(index);
    this.scrollTo(index, 'instant');
    this.closeButton()?.nativeElement.focus();
  }

  private closed(): void {
    if (!this.wasOpen) {
      return;
    }
    this.wasOpen = false;
    const view = this.document.defaultView;
    if (view?.history.state?.[HISTORY_KEY]) {
      view.history.back();
    }
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
