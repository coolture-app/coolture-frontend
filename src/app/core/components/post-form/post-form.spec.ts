import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FormPhoto, PostForm } from './post-form';
import { PostFormData } from '../../models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../models/posts/post-detail.model';
import { MediaService } from '../../services/media/media.service';
import { ToastService } from '../../services/toast/toast.service';

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

function saved(id: string, position: number): PostMedia {
  return { media: { id, url: `http://x/${id}.png` }, position };
}

describe('PostForm photos', () => {
  let component: PostForm;
  let fixture: ComponentFixture<PostForm>;
  let media: jasmine.SpyObj<MediaService>;

  function keys(): string[] {
    return component.photos.map((photo) => photo.key);
  }

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  function tile(key: string): HTMLElement {
    return element().querySelector<HTMLElement>(`[data-photo-key="${key}"]`)!;
  }

  function control(key: string, name: string): HTMLButtonElement {
    return tile(key).querySelector<HTMLButtonElement>(`[data-control="${name}"]`)!;
  }

  function showSaved(...photos: PostMedia[]): void {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialData', post(SUMMER_START));
    fixture.componentRef.setInput('existingMedia', photos);
    fixture.detectChanges();
  }

  function submit(): PostFormData {
    let emitted: PostFormData | undefined;
    component.formSubmit.subscribe((data) => (emitted = data));
    component.onSubmit();
    return emitted!;
  }

  beforeEach(async () => {
    media = jasmine.createSpyObj<MediaService>('MediaService', [
      'initUpload',
      'uploadToS3',
      'completeUpload',
      'deleteMedia',
    ]);
    media.deleteMedia.and.returnValue(of(undefined));
    await TestBed.configureTestingModule({
      imports: [PostForm],
      providers: [{ provide: MediaService, useValue: media }],
    }).compileComponents();
    fixture = TestBed.createComponent(PostForm);
    component = fixture.componentInstance;
  });

  it('shows saved photos in their order, whatever order they arrive in', () => {
    showSaved(saved('b', 1), saved('a', 0), saved('c', 2));

    expect(keys()).toEqual(['a', 'b', 'c']);
  });

  it('marks only the first photo as the cover', () => {
    showSaved(saved('a', 0), saved('b', 1));

    expect(tile('a').querySelector('.post-form__tile-cover')).not.toBeNull();
    expect(tile('a').querySelector('.post-form__tile-set-cover')).toBeNull();
    expect(tile('b').querySelector('.post-form__tile-cover')).toBeNull();
    expect(tile('b').querySelector('.post-form__tile-set-cover')).not.toBeNull();
  });

  it('sends the photos in the order they were arranged, with no separate cover', () => {
    showSaved(saved('a', 0), saved('b', 1), saved('c', 2));

    component.movePhoto(2, -1);
    const data = submit();

    expect(data.mediaIds).toEqual(['a', 'c', 'b']);
    expect('coverMediaId' in data).toBeFalse();
  });

  it('makes a photo the cover by moving it to the front, and the others keep their order', () => {
    showSaved(saved('a', 0), saved('b', 1), saved('c', 2), saved('d', 3));

    component.setAsCover(2);

    expect(keys()).toEqual(['c', 'a', 'b', 'd']);
    expect(component.photoStatus).toContain('POST_FORM.status-cover');
  });

  it('reorders a dragged photo', () => {
    showSaved(saved('a', 0), saved('b', 1), saved('c', 2));

    component.onPhotoDropped({ previousIndex: 0, currentIndex: 2 } as CdkDragDrop<FormPhoto[]>);

    expect(keys()).toEqual(['b', 'c', 'a']);
    expect(component.photoStatus).toContain('POST_FORM.status-cover');
  });

  it('says nothing for a photo dropped where it was', () => {
    showSaved(saved('a', 0), saved('b', 1));

    component.onPhotoDropped({ previousIndex: 1, currentIndex: 1 } as CdkDragDrop<FormPhoto[]>);

    expect(keys()).toEqual(['a', 'b']);
    expect(component.photoStatus).toBe('');
  });

  it('does nothing at the ends of the row, and those buttons keep the focus', () => {
    showSaved(saved('a', 0), saved('b', 1));

    component.movePhoto(0, -1);
    component.movePhoto(1, 1);

    expect(keys()).toEqual(['a', 'b']);
    expect(control('a', 'earlier').getAttribute('aria-disabled')).toBe('true');
    expect(control('a', 'earlier').disabled).toBeFalse();
    expect(control('b', 'later').getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps the focus on the arrow after a move', () => {
    document.body.appendChild(fixture.nativeElement);
    showSaved(saved('a', 0), saved('b', 1), saved('c', 2));

    control('c', 'earlier').click();
    fixture.detectChanges();

    expect(keys()).toEqual(['a', 'c', 'b']);
    expect(document.activeElement).toBe(control('c', 'earlier'));
    fixture.nativeElement.remove();
  });

  it('moves the focus to the next photo after removing one', () => {
    document.body.appendChild(fixture.nativeElement);
    showSaved(saved('a', 0), saved('b', 1), saved('c', 2));

    control('b', 'remove').click();
    fixture.detectChanges();

    expect(keys()).toEqual(['a', 'c']);
    expect(document.activeElement).toBe(control('c', 'remove'));
    fixture.nativeElement.remove();
  });

  it('makes the next photo the cover when the cover is removed, and says so', () => {
    showSaved(saved('a', 0), saved('b', 1));

    component.removePhoto(0);

    expect(keys()).toEqual(['b']);
    expect(component.photoStatus).toContain('POST_FORM.status-cover-removed');
  });

  it('removes a saved photo only on save', () => {
    showSaved(saved('a', 0), saved('b', 1));

    component.removePhoto(0);

    expect(media.deleteMedia).not.toHaveBeenCalled();
    const data = submit();
    expect(data.mediaIds).toEqual(['b']);
    expect(data.removedMediaIds).toEqual(['a']);
  });

  it('adds new photos after the saved ones', async () => {
    media.initUpload.and.returnValue(
      of({ mediaId: 'n1', uploadUrl: 'http://s', requiredHeaders: {} }) as never,
    );
    media.uploadToS3.and.returnValue(of(undefined) as never);
    media.completeUpload.and.returnValue(of({ id: 'n1' }) as never);
    showSaved(saved('a', 0));

    await component.onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);

    expect(submit().mediaIds).toEqual(['a', 'n1']);
  });

  it('deletes at once an upload this form made and the post never held', async () => {
    media.initUpload.and.returnValue(
      of({ mediaId: 'n1', uploadUrl: 'http://s', requiredHeaders: {} }) as never,
    );
    media.uploadToS3.and.returnValue(of(undefined) as never);
    media.completeUpload.and.returnValue(of({ id: 'n1' }) as never);
    showSaved(saved('a', 0));
    await component.onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);

    component.removePhoto(1);

    expect(media.deleteMedia).toHaveBeenCalledOnceWith('n1');
    expect(submit().removedMediaIds).toEqual([]);
  });

  it('takes a photo whose upload fails off the list and says so', async () => {
    media.initUpload.and.returnValue(throwError(() => new Error('nope')));
    spyOn(console, 'error');
    const toast = spyOn(TestBed.inject(ToastService), 'show');
    showSaved(saved('a', 0));

    await component.onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);

    expect(keys()).toEqual(['a']);
    expect(toast).toHaveBeenCalled();
  });

  it('has no gallery with no photos', () => {
    showSaved();

    expect(element().querySelector('.post-form__photos')).toBeNull();
  });
});

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
