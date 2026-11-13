import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PULL_THRESHOLD, PullToRefresh } from './pull-to-refresh';

@Component({
  imports: [PullToRefresh],
  template: `
    <div
      class="page"
      [appPullToRefresh]="enabled()"
      #ptr="pullToRefresh"
      (refresh)="refreshed = refreshed + 1"
    >
      <p class="card">card</p>
      <div class="scroller" style="height: 20px; overflow-y: auto">
        <div style="height: 200px">long</div>
      </div>
      <span class="pull">{{ ptr.pull() }}</span>
    </div>
  `,
})
class Host {
  enabled = signal(true);
  refreshed = 0;
}

describe('PullToRefresh', () => {
  let fixture: ComponentFixture<Host>;

  function touch(type: string, target: Element, y: number): void {
    const point = new Touch({ identifier: 1, target, clientX: 10, clientY: y });
    const ending = type === 'touchend' || type === 'touchcancel';
    target.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        touches: ending ? [] : [point],
        changedTouches: [point],
      }),
    );
  }

  /** The finger moves twice the indicator's distance, so this pulls the indicator `distance` down. */
  function pull(selector: string, distance: number): void {
    const target = fixture.nativeElement.querySelector(selector);
    touch('touchstart', target, 100);
    touch('touchmove', target, 100 + distance * 2);
    fixture.detectChanges();
  }

  function release(selector = '.card'): void {
    touch('touchend', fixture.nativeElement.querySelector(selector), 0);
    fixture.detectChanges();
  }

  beforeEach(() => {
    window.scrollTo(0, 0);
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('refreshes when let go past the threshold', () => {
    pull('.card', PULL_THRESHOLD + 1);
    expect(fixture.nativeElement.querySelector('.pull').textContent).toBe(
      String(PULL_THRESHOLD + 1),
    );

    release();

    expect(fixture.componentInstance.refreshed).toBe(1);
    expect(fixture.nativeElement.querySelector('.pull').textContent).toBe('0');
  });

  it('springs back without refreshing when let go short of it', () => {
    pull('.card', PULL_THRESHOLD - 1);
    release();

    expect(fixture.componentInstance.refreshed).toBe(0);
  });

  it('leaves a scrolling area inside the page its own pull', () => {
    pull('.scroller div', PULL_THRESHOLD + 20);
    release('.scroller div');

    expect(fixture.componentInstance.refreshed).toBe(0);
  });

  it('does nothing while off', () => {
    fixture.componentInstance.enabled.set(false);
    fixture.detectChanges();

    pull('.card', PULL_THRESHOLD + 20);
    release();

    expect(fixture.componentInstance.refreshed).toBe(0);
  });

  it("turns the browser's own pull off, and back on when the page goes", async () => {
    await fixture.whenStable();
    expect(document.documentElement.style.overscrollBehaviorY).toBe('none');

    fixture.destroy();

    expect(document.documentElement.style.overscrollBehaviorY).toBe('');
  });
});
