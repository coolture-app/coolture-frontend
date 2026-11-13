import {
  afterNextRender,
  Component,
  computed,
  input,
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
  lucideEyeOff,
  lucideMessageCircle,
  lucideThumbsUp,
} from '@ng-icons/lucide';
import { catchError, concatMap, EMPTY, Observable, Subject, tap } from 'rxjs';
import { frameShape, Photo, toPhoto } from '../../models/media/photo';
import { PhotoViewerService } from '../../services/photo-viewer/photo-viewer.service';
import { appTicket } from '../../icons/ticket';
import { DatePipe } from '@angular/common';
import { InteractionsService } from '../../services/interactions/interactions.service';
import { AuthService } from '../../services/auth/auth.service';
import { ModalWindow } from '../modal/modal-window/modal-window';
import { Btn } from '../btn/btn';
import { PostService } from '../../services/post/post.service';
import { CommentsSheetService } from '../../services/comments-sheet/comments-sheet.service';
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

/** What a card had before its stance changed, for Cofnij. Kept by id, so it survives going to the post page and back. */
interface Undo {
  stance: ParticipationType | undefined;
  liked: boolean;
}
const undoable = new Map<string, Undo>();

/** "Nie dla mnie" isn't taking part, so it isn't counted. */
function counted(stance: ParticipationType | undefined): boolean {
  return !!stance && stance !== 'NOT_INTERESTED';
}

/**
 * Which cards fold into one line with Cofnij: on Dla Ciebie a post marked "Nie dla mnie", on Ukryte posty one
 * unmarked. Elsewhere a card stays as it is.
 */
export type PostFold = 'marked' | 'unmarked' | null;

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
      lucideEyeOff,
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
  /** The viewer's stance: one of three at a time, or none. */
  stance = signal<ParticipationType | undefined>(undefined);
  isInterested = computed(() => this.stance() === 'INTERESTED');
  isTakesPart = computed(() => this.stance() === 'TAKES_PART');
  isNotForMe = computed(() => this.stance() === 'NOT_INTERESTED');

  folds = input<PostFold>(null);
  folded = computed(() =>
    this.folds() === 'marked'
      ? this.isNotForMe()
      : this.folds() === 'unmarked' && !this.isNotForMe(),
  );

  /** One request at a time, in order, so a quick Cofnij can't reach the server before what it undoes. */
  private requests = new Subject<Observable<unknown>>();

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
  private commentsSheet = inject(CommentsSheetService);
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
    this.requests
      .pipe(
        concatMap((request) => request),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  ngOnInit(): void {
    if (this.data) {
      this.isExpanded.set(expandedPosts.has(this.data.id));
      this.isLiked.set(this.data.myReaction === 'LIKE');
      this.stance.set(this.data.myParticipation);
      this.isMyPost.set(this.authService.currentUser()?.id === this.data.author.id ? true : false);
    }
  }

  isParticipating(): boolean {
    return counted(this.stance());
  }

  /** A badge stays small. The exact number is in the button's name and tooltip. */
  shownCount(count: number): string {
    return count > 99 ? '99+' : String(count);
  }

  /** Live while this post's comments are open, since the card can stay in view beside them. */
  commentCount(): number {
    const open = this.commentsSheet.post();
    return open?.id === this.data.id ? this.commentsSheet.count() : (this.data.commentsCount ?? 0);
  }

  /** The sheet over the list. On the post page, the comments are already there, under the post. */
  openComments(): void {
    if (this.isFullView) {
      this.host.ownerDocument
        .getElementById('comments')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.commentsSheet.show(this.data);
    }
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

  /** A like takes back "Nie dla mnie", on the server too. */
  likePost(): void {
    if (!this.signedIn()) {
      return;
    }
    const liked = !this.isLiked();
    const wasMarked = liked && this.isNotForMe();
    if (wasMarked) {
      undoable.set(this.data.id, { stance: 'NOT_INTERESTED', liked: false });
      this.applyParticipation(undefined);
    }
    this.applyReaction(liked);
    this.send(
      liked
        ? this.interactions.setReaction(this.data.id, { type: 'LIKE' })
        : this.interactions.removeReaction(this.data.id),
      () => {
        this.applyReaction(!liked);
        if (wasMarked) {
          this.applyParticipation('NOT_INTERESTED');
        }
      },
    );
  }

  setInterested(): void {
    this.toggleParticipation('INTERESTED');
  }

  setTakesPart(): void {
    this.toggleParticipation('TAKES_PART');
  }

  setNotForMe(): void {
    this.toggleParticipation('NOT_INTERESTED');
  }

  /** Cofnij on a folded card: back to the stance and like from before the fold. */
  undoFold(): void {
    const undo = undoable.get(this.data.id);
    if (!undo || !this.signedIn()) {
      return;
    }
    undoable.delete(this.data.id);
    const now: Undo = { stance: this.data.myParticipation, liked: this.isLiked() };
    const revert = () => {
      this.applyParticipation(now.stance);
      this.applyReaction(now.liked);
    };
    this.applyParticipation(undo.stance);
    this.send(
      undo.stance
        ? this.interactions.setParticipation(this.data.id, { type: undo.stance })
        : this.interactions.removeParticipation(this.data.id),
      revert,
    );
    if (undo.liked) {
      this.applyReaction(true);
      this.send(this.interactions.setReaction(this.data.id, { type: 'LIKE' }), revert);
    }
  }

  /** A guest's tap signs in, and comes back to this page. */
  private signedIn(): boolean {
    if (this.authService.isAuthenticated()) {
      return true;
    }
    void this.authService.login(this.router.url);
    return false;
  }

  private send(request: Observable<unknown>, revert: () => void, done?: () => void): void {
    this.requests.next(
      request.pipe(
        tap({ next: () => done?.(), error: revert }),
        catchError(() => EMPTY),
      ),
    );
  }

  // `data` is what a card shows again after coming back to the list, so it has to stay in step.
  private applyReaction(liked: boolean): void {
    if (this.isLiked() === liked) {
      return;
    }
    this.data.positiveReactionCount += liked ? 1 : -1;
    this.data.myReaction = liked ? 'LIKE' : undefined;
    this.isLiked.set(liked);
  }

  /** "Nie dla mnie" takes back the like, on the server too. */
  private toggleParticipation(type: ParticipationType): void {
    if (!this.signedIn()) {
      return;
    }
    const previous = this.data.myParticipation;
    const next = previous === type ? undefined : type;
    const takesLike = next === 'NOT_INTERESTED' && this.isLiked();
    undoable.set(this.data.id, { stance: previous, liked: this.isLiked() });
    this.applyParticipation(next);
    if (takesLike) {
      this.applyReaction(false);
    }
    this.send(
      next
        ? this.interactions.setParticipation(this.data.id, { type: next })
        : this.interactions.removeParticipation(this.data.id),
      () => {
        this.applyParticipation(previous);
        if (takesLike) {
          this.applyReaction(true);
        }
      },
      // The post leaves the feed on its next refresh, and this says where it went.
      counted(next)
        ? () => this.toast.show(this.translate.instant('POST.saved-to-plans'))
        : undefined,
    );
  }

  private applyParticipation(type: ParticipationType | undefined): void {
    this.data.participantCount +=
      (counted(type) ? 1 : 0) - (counted(this.data.myParticipation) ? 1 : 0);
    this.data.myParticipation = type;
    this.stance.set(type);
  }

  editPost(): void {
    this.router.navigate(['/posts', this.data.id, 'edit']);
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
    if (!this.isFullView) {
      this.router.navigate(['/posts', this.data.id]);
    }
  }

  goToUserProfile(): void {
    this.router.navigate(['/users', this.data.author.username]);
  }
}
