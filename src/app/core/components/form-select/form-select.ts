import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-form-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './form-select.html',
  styleUrl: './form-select.scss',
})
export class FormSelect {
  @Input({ required: true }) control!: FormControl;
  @Input() label = '';
  @Input() placeholder = '';
  @Input() options: SelectOption[] = [];
  @Input() required = false;
  @Input() inputId = '';
  @Input() optionalLabel = 'POST_FORM.optional';
  @Input() errorMessages: Record<string, string> = {};

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
