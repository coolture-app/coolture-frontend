import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { heroListBullet, heroMap } from '@ng-icons/heroicons/outline';

/** "Lista | Mapa": two options in one pill, the chosen one raised. Icons on phones, words on wide screens. */
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
        [attr.aria-label]="'MAIN_PAGE.list' | translate"
        (click)="switched.emit(false)"
      >
        <ng-icon class="narrow-only" name="heroListBullet" aria-hidden="true" />
        <span class="wide-only">{{ 'MAIN_PAGE.list' | translate }}</span>
      </button>
      <button
        type="button"
        class="view-switch__option"
        [class.view-switch__option--on]="mapView()"
        [attr.aria-pressed]="mapView()"
        [attr.aria-label]="'MAIN_PAGE.map' | translate"
        (click)="switched.emit(true)"
      >
        <ng-icon class="narrow-only" name="heroMap" aria-hidden="true" />
        <span class="wide-only">{{ 'MAIN_PAGE.map' | translate }}</span>
      </button>
    </div>
  `,
  styleUrl: './view-switch.scss',
})
export class ViewSwitch {
  readonly mapView = input.required<boolean>();
  readonly switched = output<boolean>();
}
