import { Component, computed, inject, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

import { Btn } from '../../../core/components/btn/btn';
import { KindGrid } from '../../../core/components/kind-grid/kind-grid';
import { Switch } from '../../../core/components/switch/switch/switch';
import { KIDS_KIND, KindsService } from '../../../core/services/interests/kinds.service';
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

  /** Filtry's tiles: every kind but Dla dzieci, which is a switch there. */
  protected tileKinds = computed(() => this.kinds.kinds().filter((kind) => kind.key !== KIDS_KIND));
  protected hasKidsKind = computed(() => this.kinds.kinds().some((kind) => kind.key === KIDS_KIND));
}
