import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-form-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './form-input.html',
  styleUrl: './form-input.scss',
})
export class FormInput {
  @Input({ required: true }) control!: FormControl;
  @Input() label = '';
  @Input() placeholder = '';
  @Input() type: 'text' | 'number' | 'datetime-local' | 'url' | 'email' = 'text';
  @Input() required = false;
  @Input() maxLength?: number;
  @Input() step?: string;
  @Input() inputId = '';
  @Input() optionalLabel = 'POST_FORM.optional';
  @Input() errorMessages: Record<string, string> = {};

  get currentLength(): number {
    const val = this.control.value;
    return typeof val === 'string' ? val.length : 0;
  }

  get showErrors(): boolean {
    return this.control.invalid && this.control.touched;
  }

  get activeErrors(): string[] {
    if (!this.control.errors) return [];
    return Object.keys(this.control.errors)
      .filter((key) => this.errorMessages[key])
      .map((key) => this.errorMessages[key]);
  }
}
