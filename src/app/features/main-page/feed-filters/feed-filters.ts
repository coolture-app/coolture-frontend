import { Component, input, output } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';

import { Btn } from '../../../core/components/btn/btn';
import { Switch } from '../../../core/components/switch/switch/switch';
import { FiltersForm, RADII_KM } from '../home-view';

/** The home page's filter panel. The home page owns the form and applies it. */
@Component({
  selector: 'app-feed-filters',
  imports: [ReactiveFormsModule, TranslatePipe, NgIcon, Btn, Switch],
  viewProviders: [provideIcons({ heroXMark })],
  templateUrl: './feed-filters.html',
  styleUrl: './feed-filters.scss',
})
export class FeedFilters {
  readonly form = input.required<FiltersForm>();
  /** Waiting for the browser's position after "Moja lokalizacja" was picked. */
  readonly locating = input(false);
  /** The position couldn't be had, so the filter went back to "Wszędzie". */
  readonly locationFailed = input(false);
  readonly clear = output<void>();
  /** Filters apply as they change; this only closes the panel. */
  readonly done = output<void>();

  readonly radii = RADII_KM;

  setNear(near: boolean): void {
    this.form().controls.near.setValue(near);
  }

  setRadius(km: number): void {
    this.form().controls.radiusKm.setValue(km);
  }
}
