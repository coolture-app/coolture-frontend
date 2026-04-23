import { Component, computed, Input } from '@angular/core';

@Component({
  selector: 'app-dithering-filter',
  imports: [],
  templateUrl: './dithering-filter.html',
  styleUrl: './dithering-filter.scss',
})
export class DitheringFilter {
  readonly uniqueId = 'dither-' + Math.random().toString(36).substring(2, 9);

  @Input() colorOne = '#bd0828';
  @Input() colorTwo = '#b5d7ff';
  @Input() intensity = 1;

  colorMatrix = computed(() => {
    const c1 = this.hexToRgb(this.colorOne);
    const c2 = this.hexToRgb(this.colorTwo);

    const rD = c2.r - c1.r;
    const gD = c2.g - c1.g;
    const bD = c2.b - c1.b;

    return `
      ${rD} 0 0 0 ${c1.r}
      ${gD} 0 0 0 ${c1.g}
      ${bD} 0 0 0 ${c1.b}
      0 0 0 1 0
    `;
  });

  private hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }
}
