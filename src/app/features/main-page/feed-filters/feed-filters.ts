import { Component, computed, inject, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

import { Btn } from '../../../core/components/btn/btn';
import { KindGrid } from '../../../core/components/kind-grid/kind-grid';
import { Switch } from '../../../core/components/switch/switch/switch';
import { KIDS_KIND, KindsService } from '../../../core/services/interests/kinds.service';
import { PostsSort } from '../../../core/models/common/enums';
import { FiltersForm } from '../home-view';

/** Rodzaj's chips while folded: the kinds with the most upcoming posts. */
const FIRST_KINDS = ['stage', 'concerts', 'cinema', 'talks', 'nightlife'];

/** The home page's filter panel: Wszystkie's order and everything but the place. The home page owns both. */
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
  /** Wszystkie's order, or null on Dla Ciebie, whose order is the ranking. */
  readonly sort = input<PostsSort | null>(null);
  readonly sortOptions = input<{ value: PostsSort; labelKey: string }[]>([]);
  readonly sortChange = output<PostsSort>();
  readonly clear = output<void>();
  /** Filters apply as they change, so the panel has only a close. */
  readonly done = output<void>();

  /** Filtry's tiles: every kind but Dla dzieci, which is a switch there. */
  protected readonly firstKinds = FIRST_KINDS;
  protected tileKinds = computed(() => this.kinds.kinds().filter((kind) => kind.key !== KIDS_KIND));
  protected hasKidsKind = computed(() => this.kinds.kinds().some((kind) => kind.key === KIDS_KIND));
}
