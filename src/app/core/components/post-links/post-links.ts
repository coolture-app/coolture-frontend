import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowUpRight, lucideLink } from '@ng-icons/lucide';
import { TranslatePipe } from '@ngx-translate/core';

import { linkName, PostLink } from '../../models/posts/post-link';

/** A post's links under its description, on cards and the post page. */
@Component({
  selector: 'app-post-links',
  imports: [NgIcon, TranslatePipe],
  viewProviders: [provideIcons({ lucideArrowUpRight, lucideLink })],
  templateUrl: './post-links.html',
  styleUrl: './post-links.scss',
})
export class PostLinks {
  readonly links = input.required<PostLink[]>();
  readonly name = linkName;
}
