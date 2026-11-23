import { InitialsPipe } from '../../pipes/initials.pipe';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { PostCard } from '../../models/posts/post-card.model';
import { PostDetail } from '../../models/posts/post-detail.model';
import { MapFocus } from '../map/map-focus';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { heroCalendar, heroGlobeAlt, heroMapPin } from '@ng-icons/heroicons/outline';
import {
  lucideBookmark,
  lucideChevronLeft,
  lucideChevronRight,
  lucideEyeOff,
  lucideMessageCircle,
  lucideThumbsUp,
} from '@ng-icons/lucide';
import { frameShape, Photo, toPhoto } from '../../models/media/photo';
import { PhotoViewerService } from '../../services/photo-viewer/photo-viewer.service';
import { appTicket } from '../../icons/ticket';
import { kindIcon } from '../../icons/kind-icons';
import { PostLinks } from '../post-links/post-links';
import { kindParams } from '../../../features/main-page/home-url';
import { KindsService } from '../../services/interests/kinds.service';
import { FriendsLine } from '../friends-line/friends-line';
import { AuthService } from '../../services/auth/auth.service';
import { PostOwnerMenu } from '../post-owner-menu/post-owner-menu';
import { Btn } from '../btn/btn';
import { CommentsSheetService } from '../../services/comments-sheet/comments-sheet.service';
import { EventWhenService } from '../../services/event-when/event-when.service';
import { postPlace } from '../../models/posts/post-place';
import { hasEnded } from '../../utils/event-time';
import { formatDistance } from '../../models/common/distance';
import { LocationService } from '../../services/location/location.service';
import { ParticipationType } from '../../models/common/enums';
import { Tooltip } from '../../directives/tooltip';
import { CountedIcon } from './counted-icon';
import { viewerState, ViewerState } from '../../models/posts/viewer-state';
import { ShownPost, ViewerStates } from '../../services/viewer-states/viewer-states';

/**
 * Ids of posts whose text someone expanded, so a card keeps its height when the list comes back,
 * including the card replaced by the post page's copy, and the saved scroll position still fits.
 */
const expandedPosts = new Set<string>();

/** What a card had before its stance changed, for Cofnij. Kept by id, so it survives going to the post page and back. */
interface Undo {
  stance: ParticipationType | undefined;
  liked: boolean;
}
const undoable = new Map<string, Undo>();

/**
 * Which cards fold into one line with Cofnij: on Dla Ciebie a post marked "Nie dla mnie", on Ukryte posty one
 * unmarked. Elsewhere a card stays as it is.
 */
export type PostFold = 'marked' | 'unmarked' | null;

@Component({
  selector: 'app-post-component',
  imports: [
    InitialsPipe,
    NgIcon,
    CountedIcon,
    TranslatePipe,
    PostOwnerMenu,
    Btn,
    Tooltip,
    FriendsLine,
    RouterLink,
    PostLinks,
  ],
  viewProviders: [
    provideIcons({
      appTicket,
      heroCalendar,
      heroGlobeAlt,
      heroMapPin,
      lucideBookmark,
      lucideChevronLeft,
      lucideChevronRight,
      lucideEyeOff,
      lucideMessageCircle,
      lucideThumbsUp,
    }),
  ],
  templateUrl: './post-component.html',
  styleUrl: './post-component.scss',
})
export class PostComponent {
  readonly data = input.required<PostCard | PostDetail>();
  readonly isFullView = input(false);
  readonly folds = input<PostFold>(null);
  readonly deleteRequest = output<string>();

  readonly isExpanded = linkedSignal(() => expandedPosts.has(this.data().id));
  /** Whether the clamped text has more than it shows, which only the browser's layout can tell. */
  overflows = signal(false);
  loadedPhotos = signal<ReadonlySet<string>>(new Set());
  slide = signal(0);

  /** The viewer's like and stance, from the data, then from their taps until the data changes. */
  readonly state = linkedSignal(() => viewerState(this.data()));
  readonly isLiked = computed(() => this.state().myReaction === 'LIKE');
  /** The viewer's stance: one of three at a time, or none. */
  readonly stance = computed(() => this.state().myParticipation);
  isInterested = computed(() => this.stance() === 'INTERESTED');
  isTakesPart = computed(() => this.stance() === 'TAKES_PART');
  isNotForMe = computed(() => this.stance() === 'NOT_INTERESTED');

  folded = computed(() =>
    this.folds() === 'marked'
      ? this.isNotForMe()
      : this.folds() === 'unmarked' && !this.isNotForMe(),
  );

  private router = inject(Router);
  private authService = inject(AuthService);
  readonly isMyPost = computed(() => this.authService.currentUser()?.id === this.data().author.id);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private host: HTMLElement = inject(ElementRef).nativeElement;
  private descText = viewChild<ElementRef<HTMLElement>>('descText');
  private slides = viewChild<ElementRef<HTMLElement>>('slides');
  private photoViewer = inject(PhotoViewerService);
  private commentsSheet = inject(CommentsSheetService);
  private translate = inject(TranslateService);
  private location = inject(LocationService);
  private mapFocus = inject(MapFocus);
  private viewerStates = inject(ViewerStates);

  readonly when = inject(EventWhenService);
  private kinds = inject(KindsService);

  /** Read on each check, so a card left open turns ended without a reload. */
  get ended(): boolean {
    return hasEnded(this.data(), new Date());
  }

  /**
   * The post page's kinds, best first, each a link to Wszystkie filtered by it: a post that turns up under a second
   * kind says so here. Cards don't show them.
   */
  shownKinds(): { key: string; name: string }[] {
    const data = this.data();
    const keys = 'kinds' in data ? (data.kinds ?? []) : [];
    return keys.flatMap((key) => {
      const name = this.kinds.eventName(key);
      return name ? [{ key, name }] : [];
    });
  }

  readonly kindIcon = kindIcon;
  readonly kindParams = kindParams;

  get stanceNote(): string | null {
    return this.viewerStates.stanceNote(this.ended);
  }

  constructor() {
    afterNextRender(() => this.watchDescription());
  }

  /** A counted button's name, with the exact number the badge may cut. */
  withCount(word: string, count: number): string {
    return count ? `${word} (${count})` : word;
  }

  /** Live while this post's comments are open, since the card can stay in view beside them. */
  commentCount(): number {
    const open = this.commentsSheet.commentsOf();
    const data = this.data();
    return open?.id === data.id ? this.commentsSheet.count() : (data.commentsCount ?? 0);
  }

  /** The sheet over the list. On the post page, the comments are already there, under the post. */
  openComments(): void {
    if (this.isFullView()) {
      this.host.ownerDocument
        .getElementById('comments')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.commentsSheet.show(this.data());
    }
  }

  /** Also on the post page, where the comments under the post leave the panel free for this. */
  openFriends(): void {
    this.commentsSheet.showFriends(this.data());
  }

  toggleExpanded(): void {
    const expanded = !this.isExpanded();
    this.isExpanded.set(expanded);
    if (expanded) {
      expandedPosts.add(this.data().id);
    } else {
      expandedPosts.delete(this.data().id);
      // Collapsing a long text can leave the card above the view, with the reader lost in the list.
      afterNextRender(
        () => this.host.querySelector('.post')?.scrollIntoView({ block: 'nearest' }),
        {
          injector: this.injector,
        },
      );
    }
  }

  photoLoaded(url: string): void {
    this.loadedPhotos.update((loaded) => new Set(loaded).add(url));
  }

  openPhoto(index: number): void {
    this.photoViewer.show(this.photos(), index);
  }

  onSlidesScroll(): void {
    const slides = this.slides()?.nativeElement;
    if (slides && slides.clientWidth > 0) {
      this.slide.set(Math.round(slides.scrollLeft / slides.clientWidth));
    }
  }

  goToSlide(index: number): void {
    const slides = this.slides()?.nativeElement;
    slides?.scrollTo({ left: index * slides.clientWidth, behavior: 'smooth' });
  }

  /** Measures again whenever the width changes, as a text that fits on a desktop may not on a phone. */
  private watchDescription(): void {
    const text = this.descText()?.nativeElement;
    if (!text || this.isFullView()) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!this.isExpanded()) {
        this.overflows.set(text.scrollHeight > text.clientHeight + 1);
      }
    });
    observer.observe(text);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  /** The place opens this post's pin on the home map. Directions are one tap further, in the pin's preview. */
  showOnMap(event: Event): void {
    event.stopPropagation();
    this.mapFocus.show(this.data());
  }

  readonly place = computed(() => postPlace(this.data(), this.isFullView()));

  /** How far the event is from the user, when their position is known and the post has a place. */
  readonly distance = computed(() => {
    const data = this.data();
    const point = data.type === 'OFFLINE' ? data.location?.coordinates : undefined;
    const meters = point ? this.location.metersTo(point) : null;
    return meters === null ? null : formatDistance(meters, this.translate.currentLang || 'pl');
  });

  /** Paragraphs stay, and a run of blank lines between them becomes one. */
  readonly description = computed(() =>
    (this.data().description ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );

  /** Every photo, in their order with the cover first, in a carousel: the post page's own list, or the card's. */
  readonly photos = computed(() => {
    const data = this.data();
    const media =
      this.isFullView() && 'media' in data
        ? data.media.map((m) => m.media)
        : ('photos' in data && data.photos) || [];
    const all = media.length > 0 ? media : [data.coverMedia];
    return all.map(toPhoto).filter((photo): photo is Photo => !!photo);
  });

  readonly frameShape = computed(() => frameShape(this.photos()[0]));

  /** A like takes back "Nie dla mnie", on the server too, and Cofnij brings it back. */
  likePost(): void {
    const marked = this.isNotForMe();
    if (this.viewerStates.like(this.shown(), this.apply) && marked) {
      undoable.set(this.data().id, { stance: 'NOT_INTERESTED', liked: false });
    }
  }

  setInterested(): void {
    this.toggleStance('INTERESTED');
  }

  setTakesPart(): void {
    this.toggleStance('TAKES_PART');
  }

  setNotForMe(): void {
    this.toggleStance('NOT_INTERESTED');
  }

  /** Cofnij on a folded card: back to the stance and like from before the fold. */
  undoFold(): void {
    const id = this.data().id;
    const undo = undoable.get(id);
    if (undo && this.viewerStates.restore(this.shown(), undo.stance, undo.liked, this.apply)) {
      undoable.delete(id);
    }
  }

  private toggleStance(type: ParticipationType): void {
    const before: Undo = { stance: this.stance(), liked: this.isLiked() };
    if (this.viewerStates.stance(this.shown(), type, this.apply)) {
      undoable.set(this.data().id, before);
    }
  }

  private shown(): ShownPost {
    return { ...this.state(), id: this.data().id };
  }

  /** `data` is what a card shows again after coming back to the list, so it changes in place. */
  private readonly apply = (state: ViewerState) => {
    Object.assign(this.data(), state);
    this.state.set(state);
  };

  goToFullPost(): void {
    if (!this.isFullView()) {
      this.router.navigate(['/posts', this.data().id]);
    }
  }

  goToUserProfile(): void {
    this.router.navigate(['/users', this.data().author.username]);
  }
}
