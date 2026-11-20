import {
  booleanAttribute,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgIcon } from '@ng-icons/core';
import { TranslatePipe } from '@ngx-translate/core';
import { kindIcon } from '../../icons/kind-icons';
import { Kind } from '../../models/interests/interest.model';
import { KindsService } from '../../services/interests/kinds.service';

/**
 * Kinds of event to pick, several at once. `large` is onboarding's and the profile's: tiles in two columns, each with
 * a hint of what it holds. Otherwise Filtry's: chips, the icon before the name, wrapping onto as many rows as needed.
 *
 * Toggles the keys of its `selected` model. As a form control its value is the chosen keys in the catalogue's
 * order, so the URL reads the same however they were tapped, and it follows a value set without events, which a
 * `valueChanges` subscription would miss.
 */
@Component({
  selector: 'app-kind-grid',
  imports: [NgIcon, TranslatePipe],
  templateUrl: './kind-grid.html',
  styleUrl: './kind-grid.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => KindGrid), multi: true }],
})
export class KindGrid implements ControlValueAccessor {
  private kindNames = inject(KindsService);

  readonly kinds = input.required<readonly Kind[]>();
  readonly selected = model<ReadonlySet<string>>(new Set());
  readonly large = input(false, { transform: booleanAttribute });
  readonly disabled = input(false);
  /** The group's accessible name. */
  readonly label = input('');

  private formDisabled = signal(false);
  protected off = computed(() => this.disabled() || this.formDisabled());
  private onChange?: (keys: string[]) => void;
  private onTouched: () => void = () => undefined;

  protected tiles = computed(() => {
    return this.kinds().map((kind) => ({
      key: kind.key,
      name: this.kindNames.name(kind.key) ?? kind.key,
      icon: kindIcon(kind.key),
    }));
  });

  protected tap(key: string): void {
    const chosen = new Set(this.selected());
    if (!chosen.delete(key)) {
      chosen.add(key);
    }
    this.selected.set(chosen);
    this.onChange?.(
      this.kinds()
        .map((kind) => kind.key)
        .filter((k) => chosen.has(k)),
    );
    this.onTouched();
  }

  writeValue(keys: readonly string[] | null): void {
    this.selected.set(new Set(keys ?? []));
  }

  registerOnChange(onChange: (keys: string[]) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }
}
