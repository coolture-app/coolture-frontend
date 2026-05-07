import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-form-textarea',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './form-textarea.html',
  styleUrl: './form-textarea.scss',
})
export class FormTextarea {
  @Input({ required: true }) control!: FormControl;
  @Input() label = '';
  @Input() placeholder = '';
  @Input() required = false;
  @Input() rows = 5;
  @Input() maxLength?: number;
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
