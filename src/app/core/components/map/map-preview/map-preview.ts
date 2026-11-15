import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBookmark,
  lucideChevronLeft,
  lucideMapPin,
  lucideNavigation,
  lucideThumbsUp,
  lucideX,
} from '@ng-icons/lucide';
import { appTicket } from '../../../icons/ticket';
import { DateFormatService } from '../../../services/date-format/date-format.service';
import { placeLine } from '../../../models/posts/post-place';
import { PostMark } from '../../../models/posts/post-mark.model';
import { Place } from '../map-pins';
import { directionsUrl } from '../map-memory';
import { Tooltip } from '../../../directives/tooltip';

/**
 * What a pin opens: a mini view of its post, or the posts at its place, soonest first. A row opens its post's mini
 * view in the card; with a mouse, hovering a row shows it beside the list. Only "Zobacz wydarzenie" leaves the map.
 */
@Component({
  selector: 'app-map-preview',
  imports: [DatePipe, NgTemplateOutlet, RouterLink, TranslatePipe, NgIcon, Tooltip],
  viewProviders: [
    provideIcons({
      appTicket,
      lucideBookmark,
      lucideChevronLeft,
      lucideMapPin,
      lucideNavigation,
      lucideThumbsUp,
      lucideX,
    }),
  ],
  templateUrl: './map-preview.html',
  styleUrl: './map-preview.scss',
})
export class MapPreview {
  readonly dateFormats = inject(DateFormatService).formats;
  readonly hoverable = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  readonly place = input.required<Place>();
  readonly closed = output<void>();

  /** The post opened from a place's list. */
  readonly opened = signal<PostMark | null>(null);
  /** The row under the mouse, shown beside the list. */
  readonly peek = signal<PostMark | null>(null);
  /** The peek goes on the side with room for it. */
  readonly peekLeft = signal(false);

  readonly many = computed(() => this.place().posts.length > 1);
  /** The post the card shows whole: a single pin's, or one opened from the list. */
  readonly shown = computed(() => (this.many() ? this.opened() : this.place().posts[0]));
  readonly placeName = computed(() => placeLine(this.place().posts[0]));
  readonly directions = computed(() =>
    directionsUrl(
      this.place().coordinates,
      typeof navigator === 'undefined' ? '' : navigator.userAgent,
    ),
  );

  constructor() {
    effect(() => {
      this.place();
      untracked(() => {
        this.opened.set(null);
        this.peek.set(null);
      });
    });
  }

  open(post: PostMark): void {
    this.peek.set(null);
    this.opened.set(post);
  }

  onRowEnter(post: PostMark, event: MouseEvent): void {
    if (!this.hoverable) {
      return;
    }
    const card = (event.currentTarget as HTMLElement).closest('.preview')?.getBoundingClientRect();
    this.peekLeft.set(!!card && card.right + PEEK_WIDTH_PX > window.innerWidth);
    this.peek.set(post);
  }
}

/** The peek's width with its gap, as in the styles. */
const PEEK_WIDTH_PX = 340;
