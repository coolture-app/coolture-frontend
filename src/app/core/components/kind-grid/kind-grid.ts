import { booleanAttribute, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgIcon } from '@ng-icons/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { kindIcon } from '../../icons/kind-icons';
import { Kind } from '../../models/interests/interest.model';

/**
 * Kinds of event as tiles to pick, several at once. `large` is onboarding's and the profile's: two columns, each with
 * a hint of what it holds. Otherwise Filtry's: three columns, the icon above the name.
 */
@Component({
  selector: 'app-kind-grid',
  imports: [NgIcon, TranslatePipe],
  templateUrl: './kind-grid.html',
  styleUrl: './kind-grid.scss',
})
export class KindGrid {
  private translate = inject(TranslateService);

  readonly kinds = input.required<readonly Kind[]>();
  readonly selected = input.required<ReadonlySet<string>>();
  readonly large = input(false, { transform: booleanAttribute });
  readonly disabled = input(false);
  /** The group's accessible name. */
  readonly label = input('');
  readonly toggled = output<string>();

  private lang = toSignal(this.translate.onLangChange.pipe(map((event) => event.lang)), {
    initialValue: this.translate.getCurrentLang(),
  });

  protected tiles = computed(() => {
    const en = this.lang() === 'en';
    return this.kinds().map((kind) => ({
      key: kind.key,
      name: en ? kind.labelEn : kind.labelPl,
      icon: kindIcon(kind.key),
    }));
  });
}
