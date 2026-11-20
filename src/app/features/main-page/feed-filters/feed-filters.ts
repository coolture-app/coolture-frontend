import { Component, computed, inject, input, output } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { startWith, switchMap } from 'rxjs';

import { Btn } from '../../../core/components/btn/btn';
import { KindGrid } from '../../../core/components/kind-grid/kind-grid';
import { Switch } from '../../../core/components/switch/switch/switch';
import { KIDS_KIND } from '../../../core/icons/kind-icons';
import { KindsService } from '../../../core/services/interests/kinds.service';
import { FiltersForm } from '../home-view';

/** The home page's filter panel, everything but the place. The home page owns the form and applies it. */
@Component({
  selector: 'app-feed-filters',
  imports: [ReactiveFormsModule, TranslatePipe, NgIcon, Btn, KindGrid, Switch],
  viewProviders: [provideIcons({ heroXMark })],
  templateUrl: './feed-filters.html',
  styleUrl: './feed-filters.scss',
})
export class FeedFilters {
  protected kinds = inject(KindsService);

  readonly form = input.required<FiltersForm>();
  /** "Od obserwowanych i znajomych" needs someone to follow, so a guest doesn't see it. */
  readonly signedIn = input(false);
  readonly clear = output<void>();
  /** Filters apply as they change; this only closes the panel. */
  readonly done = output<void>();

  private kindsValue = toSignal(
    toObservable(this.form).pipe(
      switchMap((form) =>
        form.controls.kinds.valueChanges.pipe(startWith(form.controls.kinds.value)),
      ),
    ),
    { initialValue: [] as string[] },
  );
  protected chosenKinds = computed(() => new Set(this.kindsValue()));
  protected hasKidsKind = computed(() => this.kinds.kinds().some((kind) => kind.key === KIDS_KIND));

  /** Kept in the catalogue's order, so the URL reads the same however they were tapped. */
  protected toggleKind(key: string): void {
    const chosen = new Set(this.chosenKinds());
    if (!chosen.delete(key)) {
      chosen.add(key);
    }
    const order = this.kinds.tileKinds().map((kind) => kind.key);
    this.form().controls.kinds.setValue(order.filter((k) => chosen.has(k)));
  }

  protected clearKinds(): void {
    if (this.chosenKinds().size) {
      this.form().controls.kinds.setValue([]);
    }
  }
}
