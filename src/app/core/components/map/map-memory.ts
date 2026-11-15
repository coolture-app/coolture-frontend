import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PostMark } from '../../models/posts/post-mark.model';
import { PostCard } from '../../models/posts/post-card.model';

/** Where the home map was and which pin was open, for Back from a post. Memory only, for this visit. */
export interface MapView {
  center: [number, number];
  zoom: number;
  selected: string | null;
  /** The post opened from the selected place's list. */
  opened: string | null;
}

@Injectable({ providedIn: 'root' })
export class MapMemory {
  view: MapView | null = null;
}

/**
 * A post to open on the home map, from the place on its card. It travels as its own mark, so the pin shows even when
 * the home's filters leave the post out.
 */
@Injectable({ providedIn: 'root' })
export class MapFocus {
  private router = inject(Router);
  /** Read by the home page: at its start when it's opened for this, or at once when it's already open. */
  readonly requested = signal<PostMark | null>(null);

  show(post: PostCard): void {
    const mark = toMark(post);
    if (!mark) {
      return;
    }
    this.requested.set(mark);
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

function toMark(post: PostCard): PostMark | null {
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
    excerpt: excerpt(post.description),
    positiveReactionCount: post.positiveReactionCount,
    coordinates: location.coordinates,
    venueName: location.venueName,
    city: location.city,
  };
}

/** As the server cuts it for `/posts/map`, so a post opened from its card reads the same. */
function excerpt(description: string | undefined): string | undefined {
  const text = (description ?? '').replace(/\s+/g, ' ').trim().slice(0, EXCERPT_CHARS);
  return text || undefined;
}

const EXCERPT_CHARS = 200;

/**
 * Directions to a point in the phone's map app. Apple Maps on Apple devices, where Google's link opens a web page
 * unless its app is installed; Google Maps elsewhere, where Android hands the link to whichever map app is set.
 */
export function directionsUrl(
  point: { latitude: number; longitude: number },
  userAgent: string,
): string {
  const at = `${point.latitude},${point.longitude}`;
  return /iPhone|iPad|Macintosh/.test(userAgent)
    ? `https://maps.apple.com/?daddr=${at}`
    : `https://www.google.com/maps/dir/?api=1&destination=${at}`;
}
