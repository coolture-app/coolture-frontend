import { Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  heroCheck,
  heroGlobeEuropeAfrica,
  heroHome,
  heroMapPin,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { lucideLocateFixed } from '@ng-icons/lucide';

import { Btn } from '../../../core/components/btn/btn';
import { PlaceSearch } from '../../../core/components/place-search/place-search';
import { GeoPoint, NamedPlace } from '../../../core/models/common/geo.model';
import { FiltersForm, PlaceFilter, RADII_KM } from '../home-view';

/** "Gdzie?": what the list's radius is centred on, and how far it reaches. The home page owns the form. */
@Component({
  selector: 'app-place-panel',
  imports: [NgTemplateOutlet, TranslatePipe, NgIcon, Btn, PlaceSearch],
  viewProviders: [
    provideIcons({
      heroCheck,
      heroGlobeEuropeAfrica,
      heroHome,
      heroMapPin,
      heroXMark,
      lucideLocateFixed,
    }),
  ],
  templateUrl: './place-panel.html',
  styleUrl: './place-panel.scss',
})
export class PlacePanel {
  readonly form = input.required<FiltersForm>();
  /** Where the user lives, offered first. */
  readonly home = input<NamedPlace | null>(null);
  /** The place the radius is centred on when it isn't the user's position. */
  readonly picked = input<NamedPlace | null>(null);
  /** Where suggestions should come from first. */
  readonly near = input.required<GeoPoint>();
  /** Waiting for the browser's position after "Moja lokalizacja" was picked. */
  readonly locating = input(false);
  /** The position couldn't be had, so the place went back to "Wszędzie". */
  readonly locationFailed = input(false);
  readonly pick = output<NamedPlace>();
  /** Changes apply as they're made; this only closes the panel. */
  readonly done = output<void>();

  /** The usual radii, and the one the map's area gave if it's none of them. */
  get radii(): number[] {
    const current = this.form().controls.radiusKm.value;
    return RADII_KM.includes(current) ? RADII_KM : [...RADII_KM, current].sort((a, b) => a - b);
  }

  setPlace(place: PlaceFilter): void {
    this.form().controls.place.setValue(place);
  }

  setRadius(km: number): void {
    this.form().controls.radiusKm.setValue(km);
  }

  /** The row with the check, and the radius under it: the home's when the radius is centred on it. */
  protected chosen(): PlaceFilter | 'home' {
    return this.isCentre(this.home()) ? 'home' : this.form().controls.place.value;
  }

  /** Whether the radius is centred on this place now. */
  private isCentre(place: NamedPlace | null): boolean {
    const picked = this.picked();
    return (
      !!place &&
      this.form().controls.place.value === 'picked' &&
      picked?.coordinates.latitude === place.coordinates.latitude &&
      picked?.coordinates.longitude === place.coordinates.longitude
    );
  }
}
