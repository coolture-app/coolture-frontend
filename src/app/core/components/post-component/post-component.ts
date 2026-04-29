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
  heroStar,
  heroShare,
} from '@ng-icons/heroicons/outline';
import { DatePipe } from '@angular/common';
import { InteractionsService } from '../../services/interactions/interactions.service';
import { AuthService } from '../../services/auth/auth.service';
import { ModalWindow } from '../modal/modal-window/modal-window';
import { PostService } from '../../services/post/post.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-post-component',
  imports: [NgIcon, TranslatePipe, DatePipe, ModalWindow],
  viewProviders: [
    provideIcons({ heroHandThumbUp, heroChatBubbleLeftEllipsis, heroStar, heroShare }),
  ],
  templateUrl: './post-component.html',
  styleUrl: './post-component.scss',
})
export class PostComponent implements OnInit {
  isExpanded = signal(false);
  maxLengthOfShortDesc = 150;

  isLiked = signal(false);
  isParticipating = signal(false);

  private router = inject(Router);
  private interactions = inject(InteractionsService);
  private authService = inject(AuthService);
  private postService = inject(PostService);
  private destroyRef = inject(DestroyRef);

  isMyPost = signal<boolean>(false);

  @Input() data!: PostCard | PostDetail;
  @Input() isFullView!: boolean;
  @Input() counter?: number;

  @Output() deleteRequest = new EventEmitter<string>();

  @ViewChild('myModal') myModal?: ModalWindow;

  ngOnInit(): void {
    if (this.data) {
      this.isLiked.set(this.data.myReaction === 'like');
      this.isParticipating.set(
        this.data.myParticipation === 'interested' || this.data.myParticipation === 'takes_part',
      );
      this.isMyPost.set(this.authService.currentUser()?.id === this.data.author.id ? true : false);
    }
  }

  viewPostPage(isScrolling: boolean): void {
    this.router.navigate(['/post', this.data.id], {
      queryParams: { scrollToComments: isScrolling },
    });
  }

  toggleExpanded(): void {
    this.isExpanded.update((v) => !v);
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
      this.data.positiveReactionCount++;
      this.isLiked.set(true);
      this.interactions
        .setReaction(this.data.id, { type: 'like' })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => {
            // Revert on error
            this.data.positiveReactionCount--;
            this.isLiked.set(false);
          },
        });
    } else {
      this.data.positiveReactionCount--;
      this.isLiked.set(false);
      this.interactions
        .removeReaction(this.data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => {
            // Revert on error
            this.data.positiveReactionCount++;
            this.isLiked.set(true);
          },
        });
    }
  }

  participatePost(): void {
    if (!this.isParticipating()) {
      this.data.participantCount++;
      this.isParticipating.set(true);
      this.interactions
        .setParticipation(this.data.id, { type: 'interested' })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => {
            // Revert on error
            this.data.participantCount--;
            this.isParticipating.set(false);
          },
        });
    } else {
      this.data.participantCount--;
      this.isParticipating.set(false);
      this.interactions
        .removeParticipation(this.data.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => {
            // Revert on error
            this.data.participantCount++;
            this.isParticipating.set(true);
          },
        });
    }
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
