import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon } from '@ng-icons/core';

export interface InterestChip {
  key: string;
  label: string | null;
  icon?: string;
}

/** A box of chips. With no title, the chips stand on their own, as on your own profile. */
export interface InterestGroup {
  title: string | null;
  shared: boolean;
  kinds: InterestChip[];
  interests: InterestChip[];
}

@Component({
  selector: 'app-profile-interests',
  imports: [TranslatePipe, NgIcon],
  templateUrl: './profile-interests.html',
  styleUrl: './profile-interests.scss',
})
export class ProfileInterests {
  readonly groups = input.required<InterestGroup[]>();
}
