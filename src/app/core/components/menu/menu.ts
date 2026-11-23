import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon } from '@ng-icons/core';

const GAP = 4;
const EDGE = 8;

/**
 * A ⋯ menu: the trigger marked `menuTrigger` calls `toggle()`, and the rows are `app-menu-item`s. A click outside,
 * on a row, a scroll, or Esc closes it.
 *
 * The open panel lives in `body` with a fixed position, as the tooltip does, so a scrolling sheet can't cut it and a
 * fixed bar can't cover it. The host takes no box, so the trigger keeps its place in the caller's layout.
 */
@Component({
  selector: 'app-menu',
  template: `
    <ng-content select="[menuTrigger]" />
    @if (open()) {
      <div #panel class="menu" role="menu">
        <ng-content />
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    .menu {
      position: fixed;
      z-index: var(--z-toast);
      min-width: 160px;
      padding: var(--space-xs);
      border: 1px solid var(--color-border-light);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      box-shadow: var(--shadow-md);
    }
  `,
  host: {
    '(document:click)': 'closeOutside($event)',
    '(keydown.escape)': 'onEscape($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Menu {
  /** Which edge of the trigger the panel lines up with. */
  readonly align = input<'end' | 'start'>('end');
  readonly open = signal(false);

  private host: HTMLElement = inject(ElementRef).nativeElement;
  private document = inject(DOCUMENT);
  private panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly onScroll = () => this.close();
  private readonly onPanelKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.onEscape(event);
    }
  };

  constructor() {
    afterRenderEffect(() => {
      const panel = this.panel()?.nativeElement;
      if (panel) {
        this.float(panel);
      }
    });
    // Angular removes only the host's own subtree, and the panel has left it.
    inject(DestroyRef).onDestroy(() => {
      this.panel()?.nativeElement.remove();
      this.stopListening();
    });
  }

  toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.open.set(true);
    }
  }

  close(): void {
    this.open.set(false);
    this.stopListening();
  }

  closeOutside(event: Event): void {
    const target = event.target as Node;
    if (
      this.open() &&
      !this.host.contains(target) &&
      !this.panel()?.nativeElement.contains(target)
    ) {
      this.close();
    }
  }

  /** Only the menu closes, not a sheet it sits in. */
  onEscape(event: Event): void {
    if (this.open()) {
      event.stopPropagation();
      this.close();
    }
  }

  /** Below the trigger, or above it when there's no room, and always inside the screen. */
  private float(panel: HTMLElement): void {
    const trigger = this.host.querySelector('[menuTrigger]') ?? this.host;
    this.document.body.appendChild(panel);
    const view = this.document.documentElement;
    const anchor = trigger.getBoundingClientRect();
    const { width, height } = panel.getBoundingClientRect();
    const below = anchor.bottom + GAP;
    const top = below + height + EDGE > view.clientHeight ? anchor.top - GAP - height : below;
    const edge = this.align() === 'start' ? anchor.left : anchor.right - width;
    const left = Math.min(Math.max(edge, EDGE), view.clientWidth - width - EDGE);
    panel.style.top = `${Math.round(Math.max(top, EDGE))}px`;
    panel.style.left = `${Math.round(left)}px`;
    panel.addEventListener('keydown', this.onPanelKeydown);
    this.document.defaultView?.addEventListener('scroll', this.onScroll, true);
    this.document.defaultView?.addEventListener('resize', this.onScroll);
  }

  private stopListening(): void {
    this.document.defaultView?.removeEventListener('scroll', this.onScroll, true);
    this.document.defaultView?.removeEventListener('resize', this.onScroll);
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
