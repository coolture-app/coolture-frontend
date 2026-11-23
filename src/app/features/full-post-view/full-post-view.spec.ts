import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { FullPostView } from './full-post-view';
import { BackService } from '../../core/services/back/back.service';
import { PostService } from '../../core/services/post/post.service';
import { PostDetail } from '../../core/models/posts/post-detail.model';

describe('FullPostView', () => {
  let fixture: ComponentFixture<FullPostView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FullPostView],
    }).compileComponents();

    fixture = TestBed.createComponent(FullPostView);
    fixture.detectChanges();
  });

  it('links back to the home page when the tab came straight here', () => {
    expect(fixture.nativeElement.querySelector('app-back-link a')?.getAttribute('href')).toBe('/');
  });

  it('gives the back link its title, for the pages opened from it', () => {
    TestBed.inject(PostService).setActivePost({
      id: 'p1',
      title: 'Koncert',
      author: { id: 'u1', username: 'anna' },
    } as PostDetail);
    TestBed.tick();

    expect(TestBed.inject(BackService).target('/posts/p1').label).toEqual({ text: 'Koncert' });
  });
});

describe('FullPostView of a post that isn’t there', () => {
  async function openAndAnswer(status: number) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'posts/:id', component: FullPostView }])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/posts/p9');
    TestBed.inject(HttpTestingController)
      .expectOne((r) => r.url.endsWith('/posts/p9'))
      .flush({ error: 'gone' }, { status, statusText: 'Error' });
    harness.detectChanges();
    return harness.routeNativeElement!;
  }

  it('shows the not-found page and keeps the address, for a deleted post or across a block', async () => {
    const element = await openAndAnswer(404);

    expect(element.querySelector('app-not-found-view')).not.toBeNull();
    expect(element.querySelector('app-back-link')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/posts/p9');
  });

  it('doesn’t call another error a missing post', async () => {
    spyOn(console, 'error');
    const element = await openAndAnswer(500);

    expect(element.querySelector('app-not-found-view')).toBeNull();
    expect(element.querySelector('app-load-state')).not.toBeNull();
  });
});
