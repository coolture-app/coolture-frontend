import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ProfileEvents } from './profile-events';
import {
  UserProfile,
  ProfileEvents as Counts,
} from '../../../core/models/users/user-profile.model';
import { PostCard } from '../../../core/models/posts/post-card.model';

function user(events: Counts): UserProfile {
  return {
    id: 'jan-1',
    username: 'jan',
    isFollowing: true,
    isBlocked: false,
    followsYou: true,
    events,
  };
}

function post(id: string): PostCard {
  return {
    id,
    author: { id: 'jan-1', username: 'jan', followersCount: 0, followingCount: 0 },
    title: `Koncert ${id}`,
    startsAt: '2030-12-01T18:00:00Z',
    openEnded: false,
    positiveReactionCount: 0,
    participantCount: 0,
    interestedCount: 0,
    goingCount: 0,
    commentsCount: 0,
    type: 'ONLINE',
    status: 'ACTIVE',
    createdAt: '2026-11-01T00:00:00Z',
  };
}

describe('ProfileEvents', () => {
  let fixture: ComponentFixture<ProfileEvents>;
  let http: HttpTestingController;
  const element = () => fixture.nativeElement as HTMLElement;
  const tabs = () =>
    [...element().querySelectorAll('[role="tab"]')].map((t) => t.textContent?.trim());

  async function render(counts: Counts, own = false) {
    fixture = TestBed.createComponent(ProfileEvents);
    fixture.componentRef.setInput('user', user(counts));
    fixture.componentRef.setInput('own', own);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function answer(items: PostCard[], hasMore = false): TestRequest {
    const request = http.expectOne((r) => r.url.endsWith('/posts'));
    request.flush({
      items,
      page: { limit: 20, hasMore, nextCursor: hasMore ? 'next' : undefined },
    });
    fixture.detectChanges();
    return request;
  }

  it('shows a friend only the tabs with something in them', async () => {
    await render({ posts: 0, upcomingPosts: 0, takesPart: 2, interested: 0 });

    expect(tabs()).toEqual([]);
    const request = answer([post('a')]);
    expect(request.request.params.get('participantId')).toBe('jan-1');
    expect(request.request.params.getAll('participationTypes')).toEqual(['TAKES_PART']);
    expect(element().querySelector('.events__title')?.textContent).toContain(
      'PROFILE_EVENTS.posts',
    );
  });

  it('asks for the stances of the tab picked', async () => {
    await render({ posts: 3, upcomingPosts: 1, takesPart: 2, interested: 1 });
    expect(tabs()).toEqual([
      'PROFILE_EVENTS.posts',
      'PROFILE_EVENTS.going',
      'PROFILE_EVENTS.interested',
    ]);
    expect(answer([]).request.params.get('authorId')).toBe('jan-1');

    await TestBed.inject(Router).navigate([], { queryParams: { tab: 'interested' } });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(answer([]).request.params.getAll('participationTypes')).toEqual(['INTERESTED']);
  });

  it('opens on Minione for someone with no upcoming posts, and switches back', async () => {
    await render({ posts: 2, upcomingPosts: 0 });
    expect(answer([post('a')]).request.params.get('sortBy')).toBe('PAST');

    element().querySelector<HTMLButtonElement>('.events__switch-option')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(answer([]).request.params.get('sortBy')).toBe('UPCOMING');
  });

  it('gives your own profile one list, and Dodaj wydarzenie when it is empty', async () => {
    await render({ posts: 0, upcomingPosts: 0 }, true);
    answer([]);

    expect(tabs()).toEqual([]);
    expect(element().querySelector('.events__add')).not.toBeNull();
  });

  it('offers the search once the list has more than a page', async () => {
    await render({ posts: 40, upcomingPosts: 40 });
    answer([post('a')], true);

    expect(element().querySelector('.events__search')).not.toBeNull();
  });

  it('shows nothing for someone with nothing to show', async () => {
    await render({ posts: 0, upcomingPosts: 0 });
    http.match(() => true);

    expect(element().querySelector('.events')).toBeNull();
  });
});
