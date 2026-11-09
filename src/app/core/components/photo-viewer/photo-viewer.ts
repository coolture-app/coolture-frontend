import {
  afterRenderEffect,
  Component,
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
import { backClosable } from '../../services/back-closable/back-closable';
import { Tooltip } from '../../directives/tooltip';

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
  private track = viewChild<ElementRef<HTMLElement>>('track');
  private closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private overlay = backClosable('photoViewer', () => this.viewer.close());

  readonly index = signal(0);

  constructor() {
    afterRenderEffect(() => {
      const open = this.viewer.open();
      untracked(() => open && this.opened(open.index));
    });
  }

  /** A button, a key and a click beside the photo all act as the browser's Back does. */
  close(): void {
    this.overlay.close();
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

  private opened(index: number): void {
    if (this.overlay.isOpen()) {
      return;
    }
    this.overlay.opened();
    this.index.set(index);
    this.scrollTo(index, 'instant');
    this.closeButton()?.nativeElement.focus();
  }

  private scrollTo(index: number, behavior: ScrollBehavior): void {
    const track = this.track()?.nativeElement;
    track?.scrollTo({ left: index * track.clientWidth, behavior });
  }
}
