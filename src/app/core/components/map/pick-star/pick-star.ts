import { ChangeDetectionStrategy, Component } from '@angular/core';

/** The top pick's star as the map draws it on pins (map-layers.ts), for HTML beside the map. Sized by its host. */
@Component({
  selector: 'app-pick-star',
  template: `<svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="#2563eb" stroke="#ffffff" stroke-width="1.5" />
    <polygon
      fill="#ffffff"
      points="8.00,3.95 9.16,6.75 12.18,6.99 9.88,8.96 10.59,11.91 8.00,10.33 5.41,11.91 6.12,8.96 3.82,6.99 6.84,6.75"
    />
  </svg>`,
  styles: `
    :host {
      display: inline-block;
      flex-shrink: 0;
      width: 16px;
      height: 16px;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PickStar {}
