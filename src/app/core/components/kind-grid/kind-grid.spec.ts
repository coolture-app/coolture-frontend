import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KindGrid } from './kind-grid';

const KINDS = ['concerts', 'stage', 'cinema', 'exhibitions', 'games'].map((key) => ({
  key,
  labelPl: key,
  labelEn: key,
}));

describe('KindGrid folded to its first kinds', () => {
  let fixture: ComponentFixture<KindGrid>;
  let changed: string[][];

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function chips(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.kind:not(.kind--fold)'));
  }

  function names(): string[] {
    return chips().map((chip) => chip.textContent!.trim());
  }

  function fold(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.kind--fold');
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(KindGrid);
    fixture.componentRef.setInput('kinds', KINDS);
    fixture.componentRef.setInput('first', ['cinema', 'concerts']);
    changed = [];
    fixture.componentInstance.registerOnChange((keys) => changed.push(keys));
    await render();
  });

  it('shows the first kinds in their order, and how many more there are', () => {
    expect(names()).toEqual(['cinema', 'concerts']);
    expect(fold().textContent!.trim()).toBe('KINDS.more');
    expect(fold().getAttribute('aria-expanded')).toBe('false');
  });

  it('unfolds the rest after them in the catalogue’s order, and folds back', async () => {
    fold().click();
    await render();
    expect(names()).toEqual(['cinema', 'concerts', 'stage', 'exhibitions', 'games']);
    expect(fold().textContent!.trim()).toBe('KINDS.less');

    fold().click();
    await render();
    expect(names()).toEqual(['cinema', 'concerts']);
  });

  it('keeps a chosen kind in view while folded, and the value in the catalogue’s order', async () => {
    fixture.componentInstance.writeValue(['games']);
    await render();
    expect(names()).toEqual(['cinema', 'concerts', 'games']);

    chips()[0].click();
    await render();
    expect(changed.at(-1)).toEqual(['cinema', 'games']);

    // Tapped off while folded, it stays under the finger until the grid folds again.
    chips()[2].click();
    await render();
    expect(names()).toEqual(['cinema', 'concerts', 'games']);
    expect(changed.at(-1)).toEqual(['cinema']);
  });

  it('never folds without first kinds', async () => {
    fixture.componentRef.setInput('first', []);
    await render();
    expect(names().length).toBe(5);
    expect(fold()).toBeNull();
  });
});
