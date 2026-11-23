import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/**
 * A ⋯ menu: the trigger marked `menuTrigger` calls `toggle()`, and the rows are `app-menu-item`s. A click outside,
 * on a row, or Esc closes it. The host takes no box, so the panel sits under the trigger against the caller's nearest
 * positioned element.
 */
@Component({
  selector: 'app-menu',
  template: `
    <ng-content select="[menuTrigger]" />
    @if (open()) {
      <div class="menu" [class.menu--start]="align() === 'start'" role="menu">
        <ng-content />
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .menu {
      position: absolute;
      top: 100%;
      right: 0;
      z-index: var(--z-dropdown);
      min-width: 160px;
      padding: var(--space-xs);
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);

      &--start {
        top: calc(100% + var(--space-sm));
        right: auto;
        left: 0;
      }
    }
  `,
  host: {
    '(document:click)': 'closeOutside($event)',
    '(keydown.escape)': 'close()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menu {
  /** Which edge of the trigger the panel lines up with. */
  readonly align = input<'end' | 'start'>('end');
  readonly open = signal(false);

  private host: HTMLElement = inject(ElementRef).nativeElement;

  toggle(): void {
    this.open.update((open) => !open);
  }

  close(): void {
    this.open.set(false);
  }

  closeOutside(event: Event): void {
    if (this.open() && !this.host.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}

/** One row of an `app-menu`, which a click closes. The icon is provided by the component that uses it. */
@Component({
  selector: 'app-menu-item',
  imports: [NgIcon],
  template: `
    <button type="button" role="menuitem" class="item" [class.item--danger]="danger()">
      <ng-icon [name]="icon()" aria-hidden="true" />
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: block;
    }

    .item {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      width: 100%;
      min-height: 44px;
      padding: 0 var(--space-sm);
      border: none;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--color-text);
      font: inherit;
      font-size: var(--text-body);
      text-align: left;
      cursor: pointer;
      --ng-icon__size: 18px;

      &:hover {
        background: var(--color-surface-alt);
      }

      &--danger {
        color: var(--color-danger);
      }
    }
  `,
  host: { '(click)': 'menu.close()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuItem {
  protected menu = inject(Menu);
  readonly icon = input.required<string>();
  readonly danger = input(false, { transform: booleanAttribute });
}
