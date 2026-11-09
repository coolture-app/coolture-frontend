import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tooltip } from '../../directives/tooltip';

export type BtnVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'success'
  | 'plain'
  | 'icon'
  | 'social';
export type BtnSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-btn',
  imports: [CommonModule, Tooltip],
  templateUrl: './btn.html',
  styleUrl: './btn.scss',
})
export class Btn {
  @Input({ required: true }) variant: BtnVariant = 'primary';
  @Input() size: BtnSize = 'md';
  @Input() disabled = false;
  @Input() fullWidth = false;
  @Input() pressed?: boolean;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  /** What the button does: its accessible name, and the tooltip on hover and keyboard focus. */
  @Input() label = '';

  @Output() btnClick = new EventEmitter<Event>();

  @Input() class = '';

  get classes(): string {
    const base = 'btn';
    const variantClass = `btn--${this.variant}`;
    const sizeClass = this.size !== 'md' ? `btn--${this.size}` : '';
    const widthClass = this.fullWidth ? 'btn--full' : '';
    return [base, variantClass, sizeClass, widthClass, this.class].filter(Boolean).join(' ');
  }

  onClick(event: Event): void {
    if (!this.disabled) {
      this.btnClick.emit(event);
    }
  }
}
