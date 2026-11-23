import { Component, viewChildren } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIcons } from '@ng-icons/core';
import { lucidePencil } from '@ng-icons/lucide';

import { Menu, MenuItem } from './menu';

@Component({
  imports: [Menu, MenuItem],
  viewProviders: [provideIcons({ lucidePencil })],
  template: `
    @for (name of ['a', 'b']; track name) {
      <app-menu #menu>
        <button menuTrigger type="button" [class]="name" (click)="menu.toggle()">⋯</button>
        <app-menu-item icon="lucidePencil" (click)="picked.push(name)">Edytuj</app-menu-item>
      </app-menu>
    }
  `,
})
class TwoMenus {
  readonly menus = viewChildren(Menu);
  readonly picked: string[] = [];
}

describe('Menu', () => {
  let fixture: ComponentFixture<TwoMenus>;
  const element = () => fixture.nativeElement as HTMLElement;
  const trigger = (name: string) => element().querySelector<HTMLButtonElement>(`.${name}`)!;
  const open = () => fixture.componentInstance.menus().map((menu) => menu.open());

  beforeEach(() => {
    fixture = TestBed.createComponent(TwoMenus);
    fixture.detectChanges();
  });

  it('closes on the next click anywhere, and opening another closes it', () => {
    trigger('a').click();
    expect(open()).toEqual([true, false]);

    trigger('b').click();
    expect(open()).toEqual([false, true]);

    document.body.click();
    expect(open()).toEqual([false, false]);
  });

  it('closes when a row is picked', () => {
    trigger('a').click();
    fixture.detectChanges();

    document.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();

    expect(fixture.componentInstance.picked).toEqual(['a']);
    expect(open()).toEqual([false, false]);
  });

  it('opens in body, below its trigger, or above it with no room below', () => {
    trigger('a').click();
    fixture.detectChanges();
    const panel = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(panel.parentElement).toBe(document.body);
    expect(panel.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      trigger('a').getBoundingClientRect().bottom,
    );
    trigger('a').click();
    fixture.detectChanges();

    const low = trigger('b');
    low.style.position = 'fixed';
    low.style.bottom = '0';
    low.click();
    fixture.detectChanges();

    const above = document.querySelector<HTMLElement>('[role="menu"]')!;
    expect(above.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      low.getBoundingClientRect().top,
    );
  });

  it('closes on Esc without passing it on, so a sheet around it stays open', () => {
    const reached = jasmine.createSpy('document Escape');
    document.addEventListener('keydown', reached);
    trigger('a').click();
    fixture.detectChanges();

    document
      .querySelector('[role="menuitem"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(open()).toEqual([false, false]);
    expect(reached).not.toHaveBeenCalled();
    document.removeEventListener('keydown', reached);
  });

  it('opens again with one click after Esc closed it', () => {
    trigger('a').click();
    trigger('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(open()).toEqual([false, false]);

    trigger('a').click();

    expect(open()).toEqual([true, false]);
  });
});
