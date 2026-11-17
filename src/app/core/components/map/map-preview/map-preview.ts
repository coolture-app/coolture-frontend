import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
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
import { placeLine } from '../../../models/posts/post-place';
import { PostMark } from '../../../models/posts/post-mark.model';
import { Place } from '../map-pins';
import { EventWhenService } from '../../../services/event-when/event-when.service';
import { directionsUrl } from './directions';
import { Tooltip } from '../../../directives/tooltip';
import { PickStar } from '../pick-star/pick-star';
import { MapReactions } from '../map-reactions';
import { PhotoViewerService } from '../../../services/photo-viewer/photo-viewer.service';
import { mediaQuery } from '../../../services/media-query/media-query';
import { FriendsLine } from '../../friends-line/friends-line';
import { AuthService } from '../../../services/auth/auth.service';
import { CommentsSheetService } from '../../../services/comments-sheet/comments-sheet.service';

/**
 * What a pin opens: a mini view of its post, or the posts at its place, soonest first. A row opens its post's mini
 * view in the card; with a mouse, hovering a row shows it beside the list. Only "Zobacz wydarzenie" leaves the map.
 */
@Component({
  selector: 'app-map-preview',
  imports: [NgTemplateOutlet, RouterLink, TranslatePipe, NgIcon, Tooltip, PickStar, FriendsLine],
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
  private eventWhen = inject(EventWhenService);
  private photoViewer = inject(PhotoViewerService);
  readonly reactions = inject(MapReactions);
  private auth = inject(AuthService);
  readonly sheet = inject(CommentsSheetService);
  readonly sharesStances = computed(() => this.auth.isAuthenticated() && this.auth.shareStances());
  readonly hoverable = mediaQuery('(hover: hover)');

  readonly place = input.required<Place>();
  /** The feed's top picks, starred as on the pins. */
  readonly picks = input<ReadonlySet<string> | null>(null);
  readonly closed = output<void>();

  /** The post opened from a place's list. The map keeps it, so Back from that post opens it again. */
  readonly opened = model<string | null>(null);
  /** The row under the mouse, shown beside the list. */
  readonly peek = signal<PostMark | null>(null);
  /** The peek goes on the side with room for it. */
  readonly peekLeft = signal(false);

  readonly many = computed(() => this.place().posts.length > 1);
  /** A fetch rebuilds the place; only another place's pin closes the peek. */
  private readonly placeId = computed(() => this.place().id);
  /** The post the card shows whole: a single pin's, or one opened from the list. */
  readonly shown = computed(() => {
    const { posts } = this.place();
    return this.many() ? (posts.find((post) => post.id === this.opened()) ?? null) : posts[0];
  });
  readonly placeName = computed(() => placeLine(this.place().posts[0]));
  readonly directions = computed(() =>
    directionsUrl(
      this.place().coordinates,
      typeof navigator === 'undefined' ? '' : navigator.userAgent,
    ),
  );

  constructor() {
    effect(() => {
      this.placeId();
      untracked(() => this.peek.set(null));
    });
  }

  /** The cover is all the map has of a post's photos. */
  enlarge(post: PostMark): void {
    if (post.coverMediaUrl) {
      this.photoViewer.show([{ url: post.coverMediaUrl }], 0);
    }
  }

  isPick(post: PostMark): boolean {
    return !!this.picks()?.has(post.id);
  }

  when(post: PostMark): string {
    return this.eventWhen.card(post);
  }

  open(post: PostMark): void {
    this.peek.set(null);
    this.opened.set(post.id);
  }

  onRowEnter(post: PostMark, event: MouseEvent): void {
    if (!this.hoverable()) {
      return;
    }
    const card = (event.currentTarget as HTMLElement).closest('.preview')?.getBoundingClientRect();
    this.peekLeft.set(!!card && card.right + PEEK_WIDTH_PX > window.innerWidth);
    this.peek.set(post);
  }
}

/** The peek's width with its gap, as in the styles. */
const PEEK_WIDTH_PX = 340;
