import {
  afterNextRender,
  DestroyRef,
  Directive,
  DOCUMENT,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/** How far the indicator has to come down before letting go refreshes, in px. */
export const PULL_THRESHOLD = 72;
/** The finger moves this much further than the indicator, so a pull feels like it has weight. */
const RESISTANCE = 0.5;
const MAX_PULL = 110;

/**
 * Pull down at the top of the page to refresh, by touch only. While it's on, the browser's own pull,
 * which reloads the whole app, is off. `pull` is how far the indicator should be down.
 */
@Directive({
  selector: '[appPullToRefresh]',
  exportAs: 'pullToRefresh',
  host: {
    '(touchstart)': 'onStart($event)',
    '(touchmove)': 'onMove($event)',
    '(touchend)': 'onEnd()',
    '(touchcancel)': 'cancel()',
  },
})
export class PullToRefresh {
  readonly enabled = input.required<boolean>({ alias: 'appPullToRefresh' });
  readonly refresh = output<void>();
  readonly pull = signal(0);

  private document = inject(DOCUMENT);
  private startY: number | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // In the browser only, so a prerendered page doesn't carry it.
    afterNextRender(() => {
      const root = this.document.documentElement;
      const before = root.style.overscrollBehaviorY;
      root.style.overscrollBehaviorY = 'none';
      destroyRef.onDestroy(() => (root.style.overscrollBehaviorY = before));
    });
  }

  onStart(event: TouchEvent): void {
    const atTop = (this.document.defaultView?.scrollY ?? 0) <= 0;
    if (!this.enabled() || !atTop || event.touches.length !== 1 || this.insideOwnScroller(event)) {
      this.startY = null;
      return;
    }
    this.startY = event.touches[0].clientY;
  }

  onMove(event: TouchEvent): void {
    if (this.startY === null) {
      return;
    }
    const down = event.touches[0].clientY - this.startY;
    if (down <= 0 && this.pull() === 0) {
      // Scrolling up into the list, not pulling.
      this.startY = null;
      return;
    }
    this.pull.set(Math.min(Math.max(down, 0) * RESISTANCE, MAX_PULL));
  }

  onEnd(): void {
    if (this.startY !== null && this.pull() >= PULL_THRESHOLD) {
      this.refresh.emit();
    }
    this.cancel();
  }

  cancel(): void {
    this.startY = null;
    this.pull.set(0);
  }

  /** A sheet, a panel or a popover that scrolls by itself, or is fixed over the page, keeps its own pull. */
  private insideOwnScroller(event: TouchEvent): boolean {
    const view = this.document.defaultView;
    for (
      let el = event.target as Element | null;
      el && el !== this.document.body;
      el = el.parentElement
    ) {
      const style = view?.getComputedStyle(el);
      if (!style) {
        return false;
      }
      if (style.position === 'fixed') {
        return true;
      }
      const scrolls = style.overflowY === 'auto' || style.overflowY === 'scroll';
      if (scrolls && el.scrollHeight > el.clientHeight) {
        return true;
      }
    }
    return false;
  }
}
