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
  maxLength = 150;

  private router = inject(Router);

  viewPostPage() {
    this.router.navigate(['/post', this.data.id], {
      state: { postData: this.data },
    });
  }

  toggleExpanded() {
    this.isExpanded.update((v) => !v);
  }

  @Input() data!: PostModel;
  @Input() isFullView!: boolean;

  get photos() {
    return this.data.photos || [];
  }

  formatNumber(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'mln';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'tyś';
    }
    return value.toString();
  }
}
