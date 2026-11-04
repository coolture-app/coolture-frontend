import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfiniteScroll } from './infinite-scroll';

@Component({
  imports: [InfiniteScroll],
  template: `<div [appInfiniteScroll]="enabled()" (reachedEnd)="reached = reached + 1"></div>`,
})
class Host {
  enabled = signal(true);
  reached = 0;
}

describe('InfiniteScroll', () => {
  let fixture: ComponentFixture<Host>;
  let observe: jasmine.Spy;
  let report: (isIntersecting: boolean) => void;
  let options: IntersectionObserverInit | undefined;

  beforeEach(() => {
    observe = jasmine.createSpy('observe');
    const fakeObserver = function (
      callback: IntersectionObserverCallback,
      init?: IntersectionObserverInit,
    ) {
      options = init;
      report = (isIntersecting) =>
        callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
      return { observe, unobserve: () => undefined, disconnect: () => undefined };
    };
    spyOn(
      window as unknown as { IntersectionObserver: () => void },
      'IntersectionObserver',
    ).and.callFake(fakeObserver as unknown as () => void);

    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('starts 600 px before the end', () => {
    expect(options?.rootMargin).toBe('0px 0px 600px 0px');
  });

  it('asks for more only when the end is in range', () => {
    report(false);
    expect(fixture.componentInstance.reached).toBe(0);

    report(true);
    expect(fixture.componentInstance.reached).toBe(1);
  });

  it('stays quiet while disabled', () => {
    fixture.componentInstance.enabled.set(false);
    fixture.detectChanges();

    report(true);

    expect(fixture.componentInstance.reached).toBe(0);
  });

  it('checks again when enabled, as a short page can leave the end in range', () => {
    fixture.componentInstance.enabled.set(false);
    fixture.detectChanges();
    observe.calls.reset();

    fixture.componentInstance.enabled.set(true);
    fixture.detectChanges();

    expect(observe).toHaveBeenCalledTimes(1);
  });
});
