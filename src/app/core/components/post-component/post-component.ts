import {
  afterNextRender,
  Component,
  ElementRef,
  Injector,
  Input,
  signal,
  inject,
  OnInit,
  ViewChild,
  viewChild,
  Output,
  EventEmitter,
  DestroyRef,
} from '@angular/core';
import { PostCard } from '../../models/posts/post-card.model';
import { PostDetail } from '../../models/posts/post-detail.model';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  heroCalendar,
  heroGlobeAlt,
  heroMapPin,
  heroPencilSquare,
  heroTrash,
} from '@ng-icons/heroicons/outline';
import {
  lucideBookmark,
  lucideChevronLeft,
  lucideChevronRight,
  lucideMessageCircle,
  lucideThumbsUp,
} from '@ng-icons/lucide';
import { frameShape, Photo, toPhoto } from '../../models/media/photo';
import { PhotoViewerService } from '../../services/photo-viewer/photo-viewer.service';
import { appTicket } from '../../icons/ticket';
import { DatePipe } from '@angular/common';
import { InteractionsService } from '../../services/interactions/interactions.service';
import { AuthService } from '../../services/auth/auth.service';
import { ModalWindow } from '../modal/modal-window/modal-window';
import { Btn } from '../btn/btn';
import { PostService } from '../../services/post/post.service';
import { DateFormatService } from '../../services/date-format/date-format.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { postPlace } from '../../models/posts/post-place';
import { formatDistance } from '../../models/common/distance';
import { LocationService } from '../../services/location/location.service';
import { ParticipationType } from '../../models/common/enums';
import { Tooltip } from '../../directives/tooltip';
import { ToastService } from '../../services/toast/toast.service';

/**
 * Ids of posts whose text someone expanded, so a card keeps its height when the list comes back,
 * including the card replaced by the post page's copy, and the saved scroll position still fits.
 */
const expandedPosts = new Set<string>();

@Component({
  selector: 'app-post-component',
  imports: [NgIcon, TranslatePipe, DatePipe, ModalWindow, Btn, Tooltip],
  viewProviders: [
    provideIcons({
      appTicket,
      heroCalendar,
      heroGlobeAlt,
      heroMapPin,
      heroPencilSquare,
      heroTrash,
      lucideBookmark,
      lucideChevronLeft,
      lucideChevronRight,
      lucideMessageCircle,
      lucideThumbsUp,
    }),
  ],
  templateUrl: './post-component.html',
  styleUrl: './post-component.scss',
})
export class PostComponent implements OnInit {
  isExpanded = signal(false);
  /** Whether the clamped text has more than it shows, which only the browser's layout can tell. */
  overflows = signal(false);
  loadedPhotos = signal<ReadonlySet<string>>(new Set());
  /** The photo the carousel shows. */
  slide = signal(0);

  isLiked = signal(false);
  isInterested = signal(false);
  isTakesPart = signal(false);

  private router = inject(Router);
  private interactions = inject(InteractionsService);
  private authService = inject(AuthService);
  private postService = inject(PostService);
  private destroyRef = inject(DestroyRef);
  private injector = inject(Injector);
  private host: HTMLElement = inject(ElementRef).nativeElement;
  private descText = viewChild<ElementRef<HTMLElement>>('descText');
  private slides = viewChild<ElementRef<HTMLElement>>('slides');
  private photoViewer = inject(PhotoViewerService);
  private dateFormatService = inject(DateFormatService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private location = inject(LocationService);

  isMyPost = signal<boolean>(false);
  readonly dateFormats = this.dateFormatService.formats;

  @Input() data!: PostCard | PostDetail;
  @Input() isFullView!: boolean;

  @Output() deleteRequest = new EventEmitter<string>();

  @ViewChild('myModal') myModal?: ModalWindow;

  constructor() {
    afterNextRender(() => this.watchDescription());
  }

  ngOnInit(): void {
    if (this.data) {
      this.isExpanded.set(expandedPosts.has(this.data.id));
      this.isLiked.set(this.data.myReaction === 'LIKE');
      this.isInterested.set(this.data.myParticipation === 'INTERESTED');
      this.isTakesPart.set(this.data.myParticipation === 'TAKES_PART');
      this.isMyPost.set(this.authService.currentUser()?.id === this.data.author.id ? true : false);
    }
  }

  isParticipating(): boolean {
    return this.isInterested() || this.isTakesPart();
  }

  viewPostPage(isScrolling: boolean): void {
    this.router.navigate(['/post', this.data.id], {
      queryParams: { scrollToComments: isScrolling },
    });
  }

  toggleExpanded(): void {
    const expanded = !this.isExpanded();
    this.isExpanded.set(expanded);
    if (expanded) {
      expandedPosts.add(this.data.id);
    } else {
      expandedPosts.delete(this.data.id);
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
    this.photoViewer.show(this.photos, index);
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
    if (!text || this.isFullView) {
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

  get place(): string {
    return postPlace(this.data, this.isFullView);
  }

  /** How far the event is from the user, when their position is known and the post has a place. */
  get distance(): string | null {
    const point = this.data.type === 'OFFLINE' ? this.data.location?.coordinates : undefined;
    const meters = point ? this.location.metersTo(point) : null;
    return meters === null ? null : formatDistance(meters, this.translate.currentLang || 'pl');
  }

  /** Paragraphs stay, and a run of blank lines between them becomes one. */
  get description(): string {
    return (this.data.description ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Every photo, in their order with the cover first, in a carousel: the post page's own list, or the card's. */
  get photos(): Photo[] {
    const media =
      this.isFullView && 'media' in this.data
        ? this.data.media.map((m) => m.media)
        : ('photos' in this.data && this.data.photos) || [];
    const all = media.length > 0 ? media : [this.data.coverMedia];
    return all.map(toPhoto).filter((photo): photo is Photo => !!photo);
  }

  get frameShape(): number {
    return frameShape(this.photos[0]);
  }

  likePost(): void {
    if (!this.isLiked()) {
      this.applyReaction(true);
      this.interactions
        .setReaction(this.data.id, { type: 'LIKE' })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => this.applyReaction(false) });
    } else {
      this.applyReaction(false);
      this.interactions
        .removeReaction(this.data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => this.applyReaction(true) });
    }
  }

  setInterested(): void {
    this.toggleParticipation('INTERESTED');
  }

  setTakesPart(): void {
    this.toggleParticipation('TAKES_PART');
  }

  // `data` is what a card shows again after coming back to the list, so it has to stay in step.
  private applyReaction(liked: boolean): void {
    this.data.positiveReactionCount += liked ? 1 : -1;
    this.data.myReaction = liked ? 'LIKE' : undefined;
    this.isLiked.set(liked);
  }

  private toggleParticipation(type: ParticipationType): void {
    const previous = this.data.myParticipation;
    if (previous === type) {
      this.applyParticipation(undefined);
      this.interactions
        .removeParticipation(this.data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => this.applyParticipation(previous) });
    } else {
      this.applyParticipation(type);
      this.interactions
        .setParticipation(this.data.id, { type })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          // The post leaves the feed on its next refresh, and this says where it went.
          next: () => this.toast.show(this.translate.instant('POST.saved-to-plans')),
          error: () => this.applyParticipation(previous),
        });
    }
  }

  private applyParticipation(type: ParticipationType | undefined): void {
    this.data.participantCount += (type ? 1 : 0) - (this.data.myParticipation ? 1 : 0);
    this.data.myParticipation = type;
    this.isInterested.set(type === 'INTERESTED');
    this.isTakesPart.set(type === 'TAKES_PART');
  }

  editPost(): void {
    this.router.navigate(['/editPost', this.data.id]);
  }

  deletePost(): void {
    this.postService
      .deletePost(this.data.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteRequest.emit(this.data.id);
        },
        error: (err) => {
          console.error('Error while deleting post.', err);
        },
      });
  }

  handleModalResponse(action: string): void {
    if (action === 'YES') {
      this.deletePost();
    }
  }

  openModal(): void {
    this.myModal?.open();
  }

  goToFullPost(): void {
    const currentUrl = this.router.url;
    const regex = /^\/post\/[a-zA-Z0-9_-]+$/;
    if (!regex.test(currentUrl)) {
      this.router.navigate([`/post/${this.data.id}`]);
    }
  }

  goToUserProfile(): void {
    this.router.navigate([`/u/${this.data.author.username}`]);
  }
}
