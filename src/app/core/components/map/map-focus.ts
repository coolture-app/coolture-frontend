import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PostMark } from '../../models/posts/post-mark.model';
import { PostCard } from '../../models/posts/post-card.model';
import { PostDetail } from '../../models/posts/post-detail.model';

/**
 * A post to open on the home map, from the place on its card. It travels as its own mark, so the pin shows even when
 * the home's filters leave the post out.
 */
@Injectable({ providedIn: 'root' })
export class MapFocus {
  private router = inject(Router);
  /** Read by the home page: at its start when it's opened for this, or at once when it's already open. */
  readonly requested = signal<PostMark | null>(null);

  show(post: PostCard | PostDetail): void {
    const mark = toMark(post);
    if (!mark) {
      return;
    }
    this.requested.set(mark);
    // Anywhere but the home page, which reads `requested` itself.
    if (this.router.parseUrl(this.router.url).root.children['primary']) {
      void this.router.navigate(['/']);
    }
  }

  /** The post asked for, once. */
  take(): PostMark | null {
    const post = this.requested();
    this.requested.set(null);
    return post;
  }
}

/** The mini view clamps the description to its excerpt's 3 lines, so the whole one can stand in for it. */
export function toMark(post: PostCard | PostDetail): PostMark | null {
  const location = post.type === 'OFFLINE' ? post.location : undefined;
  if (!location?.coordinates) {
    return null;
  }
  return {
    id: post.id,
    title: post.title,
    startsAt: post.startsAt,
    endsAt: post.endsAt,
    coverMediaUrl: post.coverMedia?.url,
    excerpt: post.description || undefined,
    positiveReactionCount: post.positiveReactionCount,
    interestedCount: post.interestedCount,
    goingCount: post.goingCount,
    coordinates: location.coordinates,
    venueName: location.venueName,
    city: location.city,
    myReaction: post.myReaction,
    myParticipation: post.myParticipation,
  };
}
