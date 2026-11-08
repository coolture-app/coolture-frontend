import { DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const HOVER_DELAY_MS = 400;
const GAP = 6;
const EDGE = 8;

/**
 * Says what a control does, on hover with a mouse and on keyboard focus, never on touch. The same
 * text is the control's `aria-label`, so what's seen and what's read out can't drift apart.
 *
 * The tip lives in `body` with a fixed position, so a card's `overflow: hidden` can't cut it.
 */
@Directive({
  selector: '[appTooltip]',
  host: {
    '[attr.aria-label]': 'text() || null',
    '(pointerenter)': 'onPointerEnter($event)',
    '(pointerleave)': 'hide()',
    '(focusin)': 'onFocus()',
    '(focusout)': 'hide()',
    '(click)': 'hide()',
    '(keydown.escape)': 'hide()',
  },
})
export class Tooltip {
  readonly text = input.required<string>({ alias: 'appTooltip' });

  private host: HTMLElement = inject(ElementRef).nativeElement;
  private document = inject(DOCUMENT);
  private tip: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly onScroll = () => this.hide();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.hide());
  }

  onPointerEnter(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') {
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.show(), HOVER_DELAY_MS);
  }

  /** Only focus from the keyboard, so a click doesn't leave a tip behind on the button. */
  onFocus(): void {
    const focused = this.document.activeElement;
    if (focused && this.host.contains(focused) && focused.matches(':focus-visible')) {
      this.show();
    }
  }

  hide(): void {
    clearTimeout(this.timer);
    this.tip?.remove();
    this.tip = null;
    this.document.defaultView?.removeEventListener('scroll', this.onScroll, true);
  }

  private show(): void {
    const text = this.text();
    if (!text || !this.host.isConnected) {
      return;
    }
    this.hide();
    const tip = this.document.createElement('div');
    tip.className = 'app-tooltip';
    tip.setAttribute('aria-hidden', 'true');
    tip.textContent = text;
    this.document.body.appendChild(tip);
    this.tip = tip;
    this.place(tip);
    this.document.defaultView?.addEventListener('scroll', this.onScroll, true);
  }

  /** Below the control, or above it when there's no room, and always inside the screen. */
  private place(tip: HTMLElement): void {
    const view = this.document.documentElement;
    const anchor = this.host.getBoundingClientRect();
    const { width, height } = tip.getBoundingClientRect();
    const below = anchor.bottom + GAP;
    const top = below + height + EDGE > view.clientHeight ? anchor.top - GAP - height : below;
    const centred = anchor.left + anchor.width / 2 - width / 2;
    const left = Math.min(Math.max(centred, EDGE), view.clientWidth - width - EDGE);
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
  }
}
