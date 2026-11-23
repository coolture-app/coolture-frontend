import {
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroMapPin, heroXMark } from '@ng-icons/heroicons/outline';

import { Btn } from '../../core/components/btn/btn';
import { PlaceSearch } from '../../core/components/place-search/place-search';
import { NamedPlace, TRICITY } from '../../core/models/common/geo.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { GeocodingService } from '../../core/services/geocoding/geocoding.service';
import { LocationService } from '../../core/services/location/location.service';
import { Users } from '../../core/services/users/users.service';

/**
 * Where the user lives: a city, town, village or district, for the feed's proximity when the browser gives no
 * position. Onboarding's last step, and the profile's modal. Only the place is saved, never the browser's position.
 */
@Component({
  selector: 'app-home-area',
  imports: [TranslatePipe, NgIcon, Btn, PlaceSearch],
  viewProviders: [provideIcons({ heroMapPin, heroXMark })],
  templateUrl: './home-area.html',
  styleUrl: './home-area.scss',
})
export class HomeArea {
  private auth = inject(AuthService);
  private users = inject(Users);
  private geocoding = inject(GeocodingService);
  private location = inject(LocationService);

  readonly onboarding = input(false, { transform: booleanAttribute });
  /** Saved, removed or skipped. */
  readonly done = output<void>();

  protected readonly saved = this.auth.home;
  protected choice = signal<NamedPlace | null>(this.auth.home());
  protected near = computed(() => this.choice()?.coordinates ?? TRICITY);
  protected locating = signal(false);
  protected busy = signal(false);
  protected errorKey = signal<string | null>(null);

  protected choose(place: NamedPlace): void {
    this.errorKey.set(null);
    this.choice.set({ name: place.name, coordinates: place.coordinates });
  }

  protected change(): void {
    this.choice.set(null);
  }

  /** One browser prompt, then the district or city around the position. The position itself goes nowhere. */
  protected async useMyLocation(): Promise<void> {
    this.errorKey.set(null);
    this.locating.set(true);
    try {
      const position = await this.location.request();
      const area = position ? await firstValueFrom(this.geocoding.areaAt(position)) : null;
      if (area) {
        this.choose(area);
      } else {
        this.errorKey.set(position ? 'HOME_AREA.nothingHere' : 'HOME_AREA.noPosition');
      }
    } catch {
      this.errorKey.set('HOME_AREA.nothingHere');
    } finally {
      this.locating.set(false);
    }
  }

  protected async save(): Promise<void> {
    const choice = this.choice();
    if (!choice) {
      return;
    }
    await this.run(async () => {
      const stored = await firstValueFrom(this.users.setHome(this.auth.userId(), choice));
      this.auth.markHome(stored);
    });
  }

  protected async remove(): Promise<void> {
    await this.run(async () => {
      await firstValueFrom(this.users.clearHome(this.auth.userId()));
      this.auth.markHome(null);
    });
  }

  private async run(change: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      await change();
      this.done.emit();
    } catch {
      this.errorKey.set('HOME_AREA.saveError');
    } finally {
      this.busy.set(false);
    }
  }
}
