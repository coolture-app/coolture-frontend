import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { PostForm } from './post-form';
import { PlacePicker } from '../place-picker/place-picker';
import { WITHOUT_MAPLIBRE } from '../map/map-stubs.testing';
import { PostFormData } from '../../models/posts/post-form-data.model';
import { PostDetail, PostMedia } from '../../models/posts/post-detail.model';
import { MediaService } from '../../services/media/media.service';

const SUMMER_START = '2026-07-10T17:00:00Z';
const SUMMER_END = '2026-07-10T19:30:00Z';
const WINTER_START = '2026-12-10T18:00:00Z';
const WINTER_END = '2026-12-10T21:00:00Z';

function post(startsAt: string, endsAt?: string): PostDetail {
  return {
    id: 'p1',
    author: { id: 'u1', username: 'ola', followersCount: 0, followingCount: 0 },
    title: 'Koncert',
    description: 'Opis',
    startsAt,
    endsAt,
    openEnded: false,
    positiveReactionCount: 0,
    participantCount: 0,
    interestedCount: 0,
    goingCount: 0,
    commentsCount: 0,
    type: 'ONLINE',
    status: 'ACTIVE',
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

  async function addPhoto(): Promise<void> {
    media.initUpload.and.returnValue(
      of({ mediaId: 'n1', uploadUrl: 'http://s', requiredHeaders: {} }) as never,
    );
    media.uploadToS3.and.returnValue(of(undefined) as never);
    media.completeUpload.and.returnValue(of({ id: 'n1' }) as never);
    await component.photos().onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);
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
    })
      .overrideComponent(PlacePicker, WITHOUT_MAPLIBRE)
      .compileComponents();
    fixture = TestBed.createComponent(PostForm);
    component = fixture.componentInstance;
  });

  it('sends the photos in the order they were arranged, with no separate cover', () => {
    showSaved(saved('a', 0), saved('b', 1), saved('c', 2));

    component.photos().movePhoto(2, -1);
    component.photos().removePhoto(0);
    const data = submit();

    expect(data.mediaIds).toEqual(['c', 'b']);
    expect(data.removedMediaIds).toEqual(['a']);
    expect('coverMediaId' in data).toBeFalse();
  });

  it('deletes what it uploaded when left without publishing, and never a saved photo', async () => {
    showSaved(saved('a', 0), saved('b', 1));
    await addPhoto();
    component.photos().removePhoto(0);

    fixture.destroy();

    expect(media.deleteMedia).toHaveBeenCalledOnceWith('n1');
  });

  it('keeps its uploads when left while saving, because the post may hold them', async () => {
    showSaved(saved('a', 0));
    await addPhoto();
    submit();

    fixture.destroy();

    expect(media.deleteMedia).not.toHaveBeenCalled();
  });

  it('deletes after publishing nothing it just cleared', async () => {
    showSaved();
    await addPhoto();
    submit();
    component.resetForm();

    fixture.destroy();

    expect(media.deleteMedia).not.toHaveBeenCalled();
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
    await TestBed.configureTestingModule({ imports: [PostForm] })
      .overrideComponent(PlacePicker, WITHOUT_MAPLIBRE)
      .compileComponents();
    fixture = TestBed.createComponent(PostForm);
    component = fixture.componentInstance;
  });

  it('shows the start and end in local time, not UTC', () => {
    load(post(SUMMER_START, SUMMER_END));

    expect(component.startsAtControl.value).toBe(localClock(SUMMER_START));
    expect(component.endsAtControl.value).toBe(localClock(SUMMER_END));
  });

  it('saves the same moment when nothing was changed, in summer and in winter', () => {
    for (const [startsAt, endsAt] of [
      [SUMMER_START, SUMMER_END],
      [WINTER_START, WINTER_END],
    ]) {
      load(post(startsAt, endsAt));

      const saved = submit();

      expect(new Date(saved.startsAt).getTime()).toBe(new Date(startsAt).getTime());
      expect(new Date(saved.endsAt!).getTime()).toBe(new Date(endsAt).getTime());
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

  it('keeps a start that has passed, but refuses moving it to another past time', () => {
    load(post(SUMMER_START, SUMMER_END));

    expect(component.startsAtControl.hasError('past')).toBeFalse();

    component.startsAtControl.setValue('2026-07-11T19:00');
    fixture.detectChanges();

    expect(component.startsAtControl.hasError('past')).toBeTrue();
    expect(submit()).toBeUndefined();

    component.startsAtControl.setValue(localClock(SUMMER_START));

    expect(component.startsAtControl.hasError('past')).toBeFalse();
  });

  it('shows the saved links, and sends an empty list once they are removed', () => {
    load({
      ...post('2030-05-01T17:00:00Z'),
      links: [{ url: 'https://a.example', label: 'Bilety' }],
    });

    expect(component.links.getRawValue()).toEqual([{ url: 'https://a.example', label: 'Bilety' }]);
    component.removeLink(0);
    expect(submit().links).toEqual([]);
  });

  it('leaves the end empty for a post without one', () => {
    load(post(SUMMER_START));

    expect(component.endsAtControl.value).toBe('');
    expect(submit()).toEqual(jasmine.objectContaining({ endsAt: null, openEnded: false }));
  });

  it('keeps a post with no end date so, and an end once it is unticked and given', () => {
    load({ ...post(SUMMER_START), openEnded: true });

    expect(component.openEnded).toBeTrue();
    expect(submit()).toEqual(jasmine.objectContaining({ endsAt: null, openEnded: true }));

    component.resetSubmitting();
    component.setOpenEnded(false);
    component.addEnd();
    component.endsAtControl.setValue('2026-07-10T23:00');

    expect(submit()).toEqual(
      jasmine.objectContaining({
        endsAt: new Date('2026-07-10T23:00').toISOString(),
        openEnded: false,
      }),
    );
  });
});

describe('PostForm fields', () => {
  let component: PostForm;
  let fixture: ComponentFixture<PostForm>;

  function submit(): PostFormData | undefined {
    let emitted: PostFormData | undefined;
    component.formSubmit.subscribe((data) => (emitted = data));
    component.onSubmit();
    return emitted;
  }

  function fillEventFields(): void {
    component.postForm.patchValue({
      title: 'Koncert',
      startsAt: '2030-05-01T19:00',
      description: 'Opis',
    });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PostForm] })
      .overrideComponent(PlacePicker, WITHOUT_MAPLIBRE)
      .compileComponents();
    fixture = TestBed.createComponent(PostForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts in person, with the end hidden and no errors shown', () => {
    expect(component.isOffline).toBeTrue();
    expect(component.showEnd).toBeFalse();
    expect(fixture.nativeElement.querySelectorAll('.has-error').length).toBe(0);
  });

  it('needs a place in person, and a pin with a city is enough', () => {
    fillEventFields();

    expect(submit()).toBeUndefined();

    component.locationGroup.patchValue({
      city: 'Gdańsk',
      coordinates: { latitude: 54.35, longitude: 18.65 },
    });
    const data = submit()!;

    expect(data.location).toEqual({
      countryCode: null,
      venueName: null,
      street: null,
      buildingNum: null,
      postalCode: null,
      city: 'Gdańsk',
      coordinates: { latitude: 54.35, longitude: 18.65 },
    });
  });

  it('marks what is missing after a failed save', () => {
    submit();
    fixture.detectChanges();

    expect(component.titleControl.touched).toBeTrue();
    expect(fixture.nativeElement.querySelectorAll('.has-error').length).toBeGreaterThan(0);
  });

  it('sends no place online, and keeps the typed one for a switch back', () => {
    fillEventFields();
    component.locationGroup.patchValue({ city: 'Gdańsk' });

    component.postForm.controls.type.setValue('ONLINE');

    expect(submit()!.location).toBeNull();
    expect(component.locationGroup.controls.city.value).toBe('Gdańsk');
  });

  it('refuses an end before the start', () => {
    fillEventFields();
    component.postForm.controls.type.setValue('ONLINE');
    component.addEnd();
    component.endsAtControl.setValue('2030-05-01T18:00');

    expect(submit()).toBeUndefined();
    expect(component.endsAtControl.hasError('afterStart')).toBeTrue();

    component.endsAtControl.setValue('2030-05-01T22:00');

    expect(submit()!.endsAt).toBe(new Date('2030-05-01T22:00').toISOString());
  });

  it('hides the link and the end with "Bez daty końcowej", clears the end, and brings the link back', () => {
    fillEventFields();
    component.postForm.controls.type.setValue('ONLINE');
    component.addEnd();
    component.endsAtControl.setValue('2030-05-01T22:00');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const checkbox = element.querySelector<HTMLInputElement>('.post-form__no-end input')!;

    checkbox.click();
    fixture.detectChanges();

    expect(element.querySelector('#endsAt')).toBeNull();
    expect(element.querySelector('.post-form__end-options .post-form__add')).toBeNull();
    expect(submit()).toEqual(jasmine.objectContaining({ endsAt: null, openEnded: true }));

    component.resetSubmitting();
    checkbox.click();
    fixture.detectChanges();

    expect(element.querySelector('.post-form__end-options .post-form__add')).not.toBeNull();
    expect(element.querySelector('#endsAt')).toBeNull();
    expect(submit()!.openEnded).toBeFalse();
  });

  it('refuses a start in the past at once, under the field, with Zapisz off', () => {
    fillEventFields();
    component.postForm.controls.type.setValue('ONLINE');
    component.startsAtControl.setValue('2020-05-01T19:00');
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('#startsAt')?.closest('app-form-input');
    expect(error?.textContent).toContain('POST_FORM.starts-at-past');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
    expect(submit()).toBeUndefined();

    component.startsAtControl.setValue('2030-05-01T19:00');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeFalse();
    expect(submit()).toBeDefined();
  });

  it('sends no end once it is removed', () => {
    fillEventFields();
    component.postForm.controls.type.setValue('ONLINE');
    component.addEnd();
    component.endsAtControl.setValue('2030-05-01T22:00');

    component.removeEnd();

    expect(submit()!.endsAt).toBeNull();
  });

  it('adds up to three links, with an address needed and a name not', () => {
    fillEventFields();
    component.postForm.controls.type.setValue('ONLINE');
    fixture.detectChanges();
    const adds = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll('.post-form__add') as NodeListOf<HTMLElement>,
      ).map((button) => button.textContent!.trim());

    component.addLink();
    component.addLink();
    component.addLink();
    component.addLink();
    fixture.detectChanges();

    expect(component.links.length).toBe(3);
    expect(adds()).not.toContain('+ POST_FORM.add-link');
    expect(submit()).toBeUndefined();

    component.links.at(0).setValue({ url: 'bilety.pl/koncert', label: ' Bilety ' });
    component.links.at(1).setValue({ url: 'https://fb.com/events/1', label: '   ' });
    component.removeLink(2);

    expect(submit()!.links).toEqual([
      { url: 'https://bilety.pl/koncert', label: 'Bilety' },
      { url: 'https://fb.com/events/1' },
    ]);
  });

  it('refuses an address that is not one', () => {
    component.addLink();
    const url = component.links.at(0).controls.url;

    for (const typed of ['bilety', 'bilety pl', 'javascript:alert(1)']) {
      url.setValue(typed);
      expect(url.valid).withContext(typed).toBeFalse();
    }
    url.setValue('www.bilety.pl');
    expect(url.valid).toBeTrue();
  });
});
