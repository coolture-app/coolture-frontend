import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Tooltip } from './tooltip';

@Component({
  imports: [Tooltip],
  template: `<button appTooltip="Dodaj post">+</button>`,
})
class Host {}

describe('Tooltip', () => {
  let fixture: ComponentFixture<Host>;

  function button(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

  function tip(): HTMLElement | null {
    return document.querySelector('.app-tooltip');
  }

  function pointer(type: string, pointerType: string): void {
    button().dispatchEvent(new PointerEvent(type, { pointerType }));
  }

  function hoverDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 450));
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  afterEach(() => tip()?.remove());

  it('names the control with the same text', () => {
    expect(button().getAttribute('aria-label')).toBe('Dodaj post');
  });

  it('shows on mouse hover after a moment, and hides on leaving', async () => {
    pointer('pointerenter', 'mouse');
    expect(tip()).toBeNull();

    await hoverDelay();
    expect(tip()?.textContent).toBe('Dodaj post');

    pointer('pointerleave', 'mouse');
    expect(tip()).toBeNull();
  });

  it('never shows on touch', async () => {
    pointer('pointerenter', 'touch');
    await hoverDelay();

    expect(tip()).toBeNull();
  });

  it('goes away with the control', async () => {
    pointer('pointerenter', 'mouse');
    await hoverDelay();
    fixture.destroy();

    expect(tip()).toBeNull();
  });
});
