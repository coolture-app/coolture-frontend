import { Component, computed, inject, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideMapPin, lucideNavigation, lucideX } from '@ng-icons/lucide';
import { DateFormatService } from '../../../services/date-format/date-format.service';
import { placeLine } from '../../../models/posts/post-place';
import { Place } from '../map-pins';
import { directionsUrl } from '../map-memory';

/** What a pin opens: its post, or the posts at its place, soonest first. Each opens its post page. */
@Component({
  selector: 'app-map-preview',
  imports: [DatePipe, RouterLink, TranslatePipe, NgIcon],
  viewProviders: [provideIcons({ lucideMapPin, lucideNavigation, lucideX })],
  templateUrl: './map-preview.html',
  styleUrl: './map-preview.scss',
})
export class MapPreview {
  readonly dateFormats = inject(DateFormatService).formats;

  readonly place = input.required<Place>();
  readonly closed = output<void>();

  readonly single = computed(() => {
    const posts = this.place().posts;
    return posts.length === 1 ? posts[0] : null;
  });
  readonly placeName = computed(() => placeLine(this.place().posts[0]));
  readonly directions = computed(() =>
    directionsUrl(
      this.place().coordinates,
      typeof navigator === 'undefined' ? '' : navigator.userAgent,
    ),
  );
}
