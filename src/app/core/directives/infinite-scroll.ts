import {
  afterRenderEffect,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';

/** Goes on an element in a list, and asks for more when that gets within one screen of the view. */
@Directive({
  selector: '[appInfiniteScroll]',
})
export class InfiniteScroll {
  readonly enabled = input.required<boolean>({ alias: 'appInfiniteScroll' });
  readonly reachedEnd = output<void>();

  private element: HTMLElement = inject(ElementRef).nativeElement;
  private observer: IntersectionObserver | undefined;

  constructor() {
    // Runs only in the browser, so the element stays inert while prerendering.
    afterRenderEffect(() => {
      const enabled = this.enabled();
      this.observer ??= new IntersectionObserver(
        (entries) => {
          if (this.enabled() && entries.at(-1)?.isIntersecting) {
            this.reachedEnd.emit();
          }
        },
        { rootMargin: '0px 0px 100% 0px' },
      );
      // An observer only reports changes. After a short page the element may still be in range, so
      // observing it afresh is what makes the observer report it again.
      this.observer.unobserve(this.element);
      if (enabled) {
        this.observer.observe(this.element);
      }
    });
    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }
}
