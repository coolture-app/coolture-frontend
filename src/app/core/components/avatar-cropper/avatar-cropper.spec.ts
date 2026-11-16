import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';

import { AvatarCropper } from './avatar-cropper';

/** A real image file, so the browser can load and draw it. */
async function photo(width: number, height: number): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.fillRect(0, 0, width, height);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
  return new File([blob], 'photo.png', { type: 'image/png' });
}

describe('AvatarCropper', () => {
  let fixture: ComponentFixture<AvatarCropper>;
  let element: HTMLElement;

  async function open(file: File) {
    TestBed.configureTestingModule({ imports: [AvatarCropper, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(AvatarCropper);
    fixture.componentRef.setInput('file', file);
    fixture.detectChanges();
    element = fixture.nativeElement;
    const image = element.querySelector('img')!;
    if (!image.complete) {
      await new Promise((resolve) => image.addEventListener('load', resolve, { once: true }));
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => element.querySelector('dialog')?.close());

  it('opens as a modal dialog with the photo centred', async () => {
    await open(await photo(520, 260));

    expect(element.querySelector('dialog')!.open).toBeTrue();
    expect(fixture.componentInstance.view()).toEqual({ x: -130, y: 0, scale: 1 });
  });

  it('moves the photo with the arrow keys, within its edges', async () => {
    await open(await photo(520, 260));
    const frame = element.querySelector<HTMLElement>('.cropper__frame')!;

    frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(fixture.componentInstance.view()!.x).toBe(-120);

    for (let i = 0; i < 20; i++) {
      frame.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    }
    expect(fixture.componentInstance.view()!.x).toBe(0);
  });

  it('zooms with the slider', async () => {
    await open(await photo(260, 260));

    fixture.componentInstance.setZoom(2);
    expect(fixture.componentInstance.zoom()).toBe(2);
    expect(fixture.componentInstance.view()).toEqual({ x: -130, y: -130, scale: 2 });
  });

  it('saves a square JPEG of what the circle shows', async () => {
    await open(await photo(520, 260));
    const saved = new Promise<Blob>((resolve) =>
      fixture.componentInstance.saved.subscribe((blob) => resolve(blob)),
    );

    fixture.componentInstance.save();
    const blob = await saved;

    expect(blob.type).toBe('image/jpeg');
    const bitmap = await createImageBitmap(blob);
    expect([bitmap.width, bitmap.height]).toEqual([512, 512]);
  });

  it('says so when the file isn’t an image it can open', async () => {
    TestBed.configureTestingModule({ imports: [AvatarCropper, TranslateModule.forRoot()] });
    fixture = TestBed.createComponent(AvatarCropper);
    fixture.componentRef.setInput(
      'file',
      new File(['not an image'], 'x.png', { type: 'image/png' }),
    );
    fixture.detectChanges();
    element = fixture.nativeElement;
    await new Promise((resolve) =>
      element.querySelector('img')!.addEventListener('error', resolve, { once: true }),
    );
    fixture.detectChanges();

    expect(element.querySelector('.cropper__error')).not.toBeNull();
  });

  it('emits cancel on Anuluj', async () => {
    await open(await photo(100, 100));
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);

    element.querySelector<HTMLButtonElement>('.cropper__buttons button')!.click();

    expect(cancelled).toHaveBeenCalled();
    expect(element.querySelector('dialog')!.open).toBeFalse();
  });
});
