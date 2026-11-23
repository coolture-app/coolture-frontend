import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroListBullet, heroMap } from '@ng-icons/heroicons/outline';

/**
 * Lista or Mapa. Wide screens have both in one pill, the chosen one raised. Phones have one button that names where it
 * goes, as an icon alone didn't say what it does.
 */
@Component({
  selector: 'app-view-switch',
  imports: [TranslatePipe, NgIcon],
  viewProviders: [provideIcons({ heroListBullet, heroMap })],
  template: `
    <div class="view-switch" role="group" [attr.aria-label]="'MAIN_PAGE.view' | translate">
      <button
        type="button"
        class="view-switch__option"
        [class.view-switch__option--on]="!mapView()"
        [attr.aria-pressed]="!mapView()"
        (click)="switched.emit(false)"
      >
        {{ 'MAIN_PAGE.list' | translate }}
      </button>
      <button
        type="button"
        class="view-switch__option"
        [class.view-switch__option--on]="mapView()"
        [attr.aria-pressed]="mapView()"
        (click)="switched.emit(true)"
      >
        {{ 'MAIN_PAGE.map' | translate }}
      </button>
    </div>
    <button type="button" class="view-toggle" (click)="switched.emit(!mapView())">
      <ng-icon [name]="mapView() ? 'heroListBullet' : 'heroMap'" aria-hidden="true" />
      {{ (mapView() ? 'MAIN_PAGE.list' : 'MAIN_PAGE.map') | translate }}
    </button>
  `,
  styleUrl: './view-switch.scss',
})
export class ViewSwitch {
  readonly mapView = input.required<boolean>();
  readonly switched = output<boolean>();
}
