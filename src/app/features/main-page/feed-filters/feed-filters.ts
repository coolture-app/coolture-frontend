import { Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

import { Btn } from '../../../core/components/btn/btn';
import { Switch } from '../../../core/components/switch/switch/switch';
import { FiltersForm } from '../home-view';

/** The home page's filter panel, everything but the place. The home page owns the form and applies it. */
@Component({
  selector: 'app-feed-filters',
  imports: [ReactiveFormsModule, TranslatePipe, NgIcon, Btn, Switch],
  viewProviders: [provideIcons({ heroXMark })],
  templateUrl: './feed-filters.html',
  styleUrl: './feed-filters.scss',
})
export class FeedFilters {
  readonly form = input.required<FiltersForm>();
  readonly clear = output<void>();
  /** Filters apply as they change; this only closes the panel. */
  readonly done = output<void>();
}
