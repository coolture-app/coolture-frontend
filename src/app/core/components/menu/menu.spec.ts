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

    element().querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();

    expect(fixture.componentInstance.picked).toEqual(['a']);
    expect(open()).toEqual([false, false]);
  });

  it('opens again with one click after Esc closed it', () => {
    trigger('a').click();
    trigger('a').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(open()).toEqual([false, false]);

    trigger('a').click();

    expect(open()).toEqual([true, false]);
  });
});
