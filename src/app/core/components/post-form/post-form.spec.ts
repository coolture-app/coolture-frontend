import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PostForm } from './post-form';
import { PostFormData } from '../../models/posts/post-form-data.model';
import { PostDetail } from '../../models/posts/post-detail.model';

const SUMMER_START = '2026-07-10T17:00:00Z';
const SUMMER_END = '2026-07-10T19:30:00Z';
const WINTER_START = '2026-12-10T18:00:00Z';

function post(startsAt: string, endsAt?: string): PostDetail {
  return {
    id: 'p1',
    author: { id: 'u1', username: 'ola', followersCount: 0, followingCount: 0 },
    title: 'Koncert',
    description: 'Opis',
    startsAt,
    endsAt,
    tags: [],
    positiveReactionCount: 0,
    negativeReactionCount: 0,
    participantCount: 0,
    commentsCount: 0,
    type: 'ONLINE',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    createdAt: '2026-01-01T00:00:00Z',
    media: [],
  };
}

/** What a person in this time zone reads on a clock at that moment, in `datetime-local` format. */
function localClock(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

describe('PostForm editing an existing post', () => {
  let component: PostForm;
  let fixture: ComponentFixture<PostForm>;

  function load(data: PostDetail): void {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialData', data);
    fixture.detectChanges();
  }

  function submit(): PostFormData {
    let emitted: PostFormData | undefined;
    component.formSubmit.subscribe((data) => (emitted = data));
    component.onSubmit();
    return emitted!;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PostForm] }).compileComponents();
    fixture = TestBed.createComponent(PostForm);
    component = fixture.componentInstance;
  });

  it('shows the start and end in local time, not UTC', () => {
    load(post(SUMMER_START, SUMMER_END));

    expect(component.startsAtControl.value).toBe(localClock(SUMMER_START));
    expect(component.endsAtControl.value).toBe(localClock(SUMMER_END));
  });

  it('saves the same moment when nothing was changed, in summer and in winter', () => {
    for (const startsAt of [SUMMER_START, WINTER_START]) {
      load(post(startsAt, SUMMER_END));

      const saved = submit();

      expect(new Date(saved.startsAt).getTime()).toBe(new Date(startsAt).getTime());
      expect(new Date(saved.endsAt!).getTime()).toBe(new Date(SUMMER_END).getTime());
      component.resetSubmitting();
    }
  });

  it('keeps the time when the same post is saved twice', () => {
    load(post(SUMMER_START));

    const firstSave = submit();
    component.resetSubmitting();
    load(post(firstSave.startsAt));
    const secondSave = submit();

    expect(new Date(secondSave.startsAt).getTime()).toBe(new Date(SUMMER_START).getTime());
  });

  it('leaves the end empty for a post without one', () => {
    load(post(SUMMER_START));

    expect(component.endsAtControl.value).toBe('');
    expect(submit().endsAt).toBeNull();
  });
});
