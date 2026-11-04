import {
  Component,
  Input,
  signal,
  inject,
  OnInit,
  ViewChild,
  Output,
  EventEmitter,
  DestroyRef,
} from '@angular/core';
import { PostCard } from '../../models/posts/post-card.model';
import { PostDetail } from '../../models/posts/post-detail.model';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  heroHandThumbUp,
  heroChatBubbleLeftEllipsis,
  heroGlobeAlt,
  heroMapPin,
  heroStar,
  heroShare,
} from '@ng-icons/heroicons/outline';
import { heroStarSolid } from '@ng-icons/heroicons/solid';
import { DatePipe } from '@angular/common';
import { InteractionsService } from '../../services/interactions/interactions.service';
import { AuthService } from '../../services/auth/auth.service';
import { ModalWindow } from '../modal/modal-window/modal-window';
import { Btn } from '../btn/btn';
import { PostService } from '../../services/post/post.service';
import { DateFormatService } from '../../services/date-format/date-format.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { postPlace } from '../../models/posts/post-place';
import { ParticipationType } from '../../models/common/enums';

@Component({
  selector: 'app-post-component',
  imports: [NgIcon, TranslatePipe, DatePipe, ModalWindow, Btn],
  viewProviders: [
    provideIcons({
      heroHandThumbUp,
      heroChatBubbleLeftEllipsis,
      heroGlobeAlt,
      heroMapPin,
      heroStar,
      heroStarSolid,
      heroShare,
    }),
  ],
  templateUrl: './post-component.html',
  styleUrl: './post-component.scss',
})
export class PostComponent implements OnInit {
  isExpanded = signal(false);
  maxLengthOfShortDesc = 150;

  isLiked = signal(false);
  isInterested = signal(false);
  isTakesPart = signal(false);

  private router = inject(Router);
  private interactions = inject(InteractionsService);
  private authService = inject(AuthService);
  private postService = inject(PostService);
  private destroyRef = inject(DestroyRef);
  private dateFormatService = inject(DateFormatService);

  isMyPost = signal<boolean>(false);
  readonly dateFormats = this.dateFormatService.formats;

  @Input() data!: PostCard | PostDetail;
  @Input() isFullView!: boolean;
  @Input() counter?: number;

  @Output() deleteRequest = new EventEmitter<string>();

  @ViewChild('myModal') myModal?: ModalWindow;

  ngOnInit(): void {
    if (this.data) {
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
    this.isExpanded.update((v) => !v);
  }

  get place(): string {
    return postPlace(this.data, this.isFullView);
  }

  get description(): string {
    return this.data.description ?? '';
  }

  get photos() {
    if (this.isFullView && this.data && 'media' in this.data && Array.isArray(this.data.media)) {
      return this.data.media.map((m) => m.media.url);
    }
    if (this.data?.coverMedia?.url) {
      return [this.data.coverMedia.url];
    }
    return [];
  }

  formatNumber(value: number, suffixK: string, suffixM: string): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + suffixM;
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + suffixK;
    }
    return value.toString();
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
        .subscribe({ error: () => this.applyParticipation(previous) });
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
