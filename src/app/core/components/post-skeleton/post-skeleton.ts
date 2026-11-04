import { Component } from '@angular/core';

/** Holds a post card's place while it loads, so that a fast scroll sees a card taking shape. */
@Component({
  selector: 'app-post-skeleton',
  template: `
    <div class="skeleton" aria-hidden="true">
      <div class="skeleton__line skeleton__line--title"></div>
      <div class="skeleton__author">
        <div class="skeleton__avatar"></div>
        <div class="skeleton__lines">
          <div class="skeleton__line skeleton__line--short"></div>
          <div class="skeleton__line skeleton__line--short"></div>
        </div>
      </div>
      <div class="skeleton__line"></div>
      <div class="skeleton__line"></div>
      <div class="skeleton__line skeleton__line--medium"></div>
    </div>
  `,
  styleUrl: './post-skeleton.scss',
})
export class PostSkeleton {}
