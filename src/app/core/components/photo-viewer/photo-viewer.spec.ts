import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PhotoViewer } from './photo-viewer';
import { PhotoViewerService } from '../../services/photo-viewer/photo-viewer.service';

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
    await new Promise((resolve) => setTimeout(resolve, 150));
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

  it('closes on a click beside the photo, but not on the photo', async () => {
    await openAt(0);

    (element().querySelector('.viewer__photo') as HTMLElement).click();
    expect(service.open()).not.toBeNull();

    (element().querySelector('.viewer__slide') as HTMLElement).click();
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
