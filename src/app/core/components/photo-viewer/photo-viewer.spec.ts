import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhotoViewer } from './photo-viewer';
import { PhotoViewerService } from '../../services/photo-viewer/photo-viewer.service';
import { until } from '../../testing/until.testing';

const WIDE_PHOTO =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"/>');

describe('PhotoViewer', () => {
  let fixture: ComponentFixture<PhotoViewer>;
  let service: PhotoViewerService;
  const photos = [{ url: 'http://x/1.png' }, { url: 'http://x/2.png' }, { url: 'http://x/3.png' }];

  function element(): HTMLElement {
    return fixture.nativeElement;
  }

  async function openAt(index: number): Promise<void> {
    service.show(photos, index);
    await fixture.whenStable();
  }

  /** Back, then the frames the viewer waits for the router's scroll. */
  async function closing(): Promise<void> {
    await until(() => service.open() === null, 'the viewer to close');
    await fixture.whenStable();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(PhotoViewer);
    service = TestBed.inject(PhotoViewerService);
    fixture.detectChanges();
  });

  afterEach(async () => {
    if (service.open()) {
      fixture.componentInstance.close();
      await closing();
    }
    document.documentElement.style.overflow = '';
  });

  it('shows every photo whole, with a count, and keeps the page from scrolling', async () => {
    await openAt(1);

    expect(element().querySelectorAll('.viewer__photo').length).toBe(3);
    expect(element().querySelector('.viewer__count')?.textContent?.trim()).toBe('2 / 3');
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('adds a history entry, so the browser’s Back closes it', async () => {
    await openAt(0);

    expect(history.state.photoViewer).toBeTrue();
    history.back();
    await closing();

    expect(service.open()).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('closes on Escape', async () => {
    await openAt(0);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await closing();

    expect(service.open()).toBeNull();
  });

  it('closes on a click on the dark bars beside the photo, but not on the photo', async () => {
    service.show([{ url: WIDE_PHOTO }], 0);
    await fixture.whenStable();
    const image = element().querySelector('.viewer__photo') as HTMLImageElement;
    await image.decode();
    const box = image.getBoundingClientRect();
    const clickAt = (y: number) =>
      image.dispatchEvent(
        new MouseEvent('click', { bubbles: true, clientX: box.left + box.width / 2, clientY: y }),
      );

    clickAt(box.top + box.height / 2);
    expect(service.open()).not.toBeNull();

    clickAt(box.top + 2);
    await closing();
    expect(service.open()).toBeNull();
  });

  it('puts the page back where it was', async () => {
    document.body.style.height = '5000px';
    window.scrollTo(0, 900);
    await openAt(0);

    window.scrollTo(0, 0);
    fixture.componentInstance.close();
    await closing();

    expect(window.scrollY).toBe(900);
    document.body.style.height = '';
    window.scrollTo(0, 0);
  });

  it('closes with its button', async () => {
    await openAt(0);

    (element().querySelector('.viewer__close') as HTMLButtonElement).click();
    await closing();

    expect(service.open()).toBeNull();
  });
});
