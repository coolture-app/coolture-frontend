import { Component, forwardRef, Input, Output, signal } from '@angular/core';
import { EventEmitter } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

@Component({
  selector: 'app-switch',
  imports: [],
  templateUrl: './switch.html',
  styleUrl: './switch.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Switch), multi: true }],
})
export class Switch implements ControlValueAccessor {
  @Output() switchState = new EventEmitter<boolean>();
  @Input() set checked(value: boolean) {
    this.isChecked.set(value);
  }
  @Input() label = '';

  readonly inputId = `switch-${nextId++}`;
  readonly isChecked = signal(false);

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  toogleState(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.isChecked.set(isChecked);
    this.onChange(isChecked);
    this.onTouched();
    this.switchState.emit(isChecked);
  }

  writeValue(value: boolean | null): void {
    this.isChecked.set(!!value);
  }

  registerOnChange(onChange: (value: boolean) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }
}
