import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Sheet, settleDrag } from './sheet';

describe('settleDrag', () => {
  const HALF = 400;
  const FULL = 776;

  it('settles on the nearest size after a slow drag', () => {
    expect(settleDrag(420, HALF, FULL, 0, 'half')).toBe('half');
    expect(settleDrag(700, HALF, FULL, 0, 'half')).toBe('full');
    expect(settleDrag(500, HALF, FULL, 0, 'full')).toBe('half');
  });

  it('closes when dragged well below half', () => {
    expect(settleDrag(200, HALF, FULL, 0, 'half')).toBe('close');
  });

  it('follows a fast flick one step', () => {
    expect(settleDrag(420, HALF, FULL, 1, 'half')).toBe('full');
    expect(settleDrag(700, HALF, FULL, -1, 'full')).toBe('half');
    expect(settleDrag(380, HALF, FULL, -1, 'half')).toBe('close');
  });
});

@Component({
  imports: [Sheet],
  template: `
    @if (open()) {
      <app-sheet
        url="/profile#followers"
        title="Obserwujący"
        closeLabel="Zamknij"
        (closed)="closed()"
      >
        <p class="body">Lista</p>
      </app-sheet>
    }
  `,
})
class Host {
  readonly open = signal(true);
  closed = jasmine.createSpy('closed');
}

describe('Sheet', () => {
  let fixture: ComponentFixture<Host>;
  let startUrl: string;

  beforeEach(async () => {
    startUrl = location.pathname + location.search;
    TestBed.configureTestingModule({ imports: [Host], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    document.documentElement.style.overflow = '';
    history.replaceState(history.state, '', startUrl);
  });

  it('shows its title, as the dialog’s name, over its body', () => {
    const element: HTMLElement = fixture.nativeElement;
    const title = element.querySelector('.sheet__title')!;
    expect(title.textContent).toContain('Obserwujący');
    expect(element.querySelector('.sheet')?.getAttribute('aria-labelledby')).toBe(title.id);
    expect(element.querySelector('.sheet .body')).not.toBeNull();
    expect(location.pathname + location.hash).toBe('/profile#followers');
  });

  it('tells its owner when it closes', async () => {
    (fixture.nativeElement.querySelector('.sheet__close') as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(fixture.componentInstance.closed).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('lets the page scroll again when its owner takes it away open', async () => {
    expect(document.documentElement.style.overflow).toBe('hidden');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(document.documentElement.style.overflow).toBe('');
    expect(document.documentElement.classList).not.toContain('sheet-docked');
    expect(fixture.componentInstance.closed).not.toHaveBeenCalled();
  });
});
