import { Component, Input, signal, inject } from '@angular/core';
import { PostModel } from '../../models/posts/post.model';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  heroHandThumbUp,
  heroChatBubbleLeftEllipsis,
  heroStar,
  heroShare,
} from '@ng-icons/heroicons/outline';
import { PostService } from '../../services/post/post.service';

@Component({
  selector: 'app-post-component',
  imports: [NgIcon, TranslatePipe],
  viewProviders: [
    provideIcons({ heroHandThumbUp, heroChatBubbleLeftEllipsis, heroStar, heroShare }),
  ],
  templateUrl: './post-component.html',
  styleUrl: './post-component.scss',
})
export class PostComponent {
  isExpanded = signal(false);
  maxLengthOfShortDesc = 150;

  //THIS WILL HAVE TO BE FETCHED FROM API TO CHECK IF USER ALREADY LIKED A POST
  isLiked = signal(false);
  isParticipating = signal(false);

  private router = inject(Router);
  private postState = inject(PostService);

  viewPostPage(isScrolling: boolean): void {
    this.postState.setActivePost(this.data);
    this.router.navigate(['/post', this.data.id], {
      queryParams: { scrollToComments: isScrolling },
    });
  }

  toggleExpanded(): void {
    this.isExpanded.update((v) => !v);
  }

  @Input() data!: PostModel;
  @Input() isFullView!: boolean;

  get photos() {
    return this.data?.photos || [];
  }

  // get avatar() {
  //   const uuid = this.data.user.avatarUrl;
  //   return this.apiUrl.path(`/images/avatars/${uuid}`);
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
      //HERE SEND POST TO API
      this.data.likesCount++;
      this.isLiked.set(true);
    } else {
      //HERE SEND PATCH TO API
      this.data.likesCount--;
      this.isLiked.set(false);
    }
  }

  participatePost(): void {
    if (!this.isParticipating()) {
      //HERE SEND POST TO API
      this.data.participatingCount++;
      this.isParticipating.set(true);
    } else {
      //HERE SEND PATCH TO API
      this.data.participatingCount--;
      this.isParticipating.set(false);
    }
  }
}
