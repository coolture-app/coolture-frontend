import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgIcon } from '@ng-icons/core';

/** A reaction bar's icon with its count as a badge. The icon is provided by the component that uses it. */
@Component({
  selector: 'app-counted-icon',
  imports: [NgIcon],
  template: `
    <ng-icon [name]="icon()" [class.icon--filled]="filled()" />
    @if (count()) {
      <span class="post__count" aria-hidden="true">{{ shown(count()) }}</span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-flex;
    }

    /* Neutral: blue or red would read as unread. */
    .post__count {
      position: absolute;
      top: -7px;
      left: 12px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: var(--radius-full);
      background: var(--color-text-secondary);
      box-shadow: 0 0 0 2px var(--color-surface);
      color: var(--color-surface);
      font-size: 10px;
      font-weight: var(--font-semibold);
      font-variant-numeric: tabular-nums;
      line-height: 16px;
      text-align: center;
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountedIcon {
  readonly icon = input.required<string>();
  readonly count = input.required<number>();
  readonly filled = input(false);

  /** A badge stays small. The exact number is in the button's name and tooltip. */
  protected shown(count: number): string {
    return count > 99 ? '99+' : String(count);
  }
}
