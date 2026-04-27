import { Component, Input, signal, inject, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-post-component',
  imports: [NgIcon, TranslatePipe, DatePipe],
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

  ngOnInit(): void {
    if (this.data) {
      this.isLiked.set(this.data.myReaction === 'like');
      this.isParticipating.set(
        this.data.myParticipation === 'interested' || this.data.myParticipation === 'takes_part',
      );
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

  @Input() data!: PostCard | PostDetail;
  @Input() isFullView!: boolean;

  get photos() {
    if (this.isFullView && this.data && 'media' in this.data && Array.isArray(this.data.media)) {
      return this.data.media.map((m) => m.media.url);
    }
    if (this.data?.coverMedia?.url) {
      return [this.data.coverMedia.url];
    }
    return [];
  }

  // get avatar() {
  //   const url = this.data.author.avatar?.url;
  //   return url;
  // }

  formatNumber(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'mln';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'tyś';
    }
    return value.toString();
  }

  likePost(): void {
    if (!this.isLiked()) {
      this.data.positiveReactionCount++;
      this.isLiked.set(true);
      this.interactions.setReaction(this.data.id, { type: 'like' }).subscribe({
        error: () => {
          // Revert on error
          this.data.positiveReactionCount--;
          this.isLiked.set(false);
        },
      });
    } else {
      this.data.positiveReactionCount--;
      this.isLiked.set(false);
      this.interactions.removeReaction(this.data.id).subscribe({
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
      this.interactions.setParticipation(this.data.id, { type: 'interested' }).subscribe({
        error: () => {
          // Revert on error
          this.data.participantCount--;
          this.isParticipating.set(false);
        },
      });
    } else {
      this.data.participantCount--;
      this.isParticipating.set(false);
      this.interactions.removeParticipation(this.data.id).subscribe({
        error: () => {
          // Revert on error
          this.data.participantCount++;
          this.isParticipating.set(true);
        },
      });
    }
  }
}
