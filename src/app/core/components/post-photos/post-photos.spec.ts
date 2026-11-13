import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { FormPhoto, PostPhotos } from './post-photos';
import { PostMedia } from '../../models/posts/post-detail.model';
import { MediaService } from '../../services/media/media.service';
import { ToastService } from '../../services/toast/toast.service';

function saved(id: string, position: number): PostMedia {
  return { media: { id, url: `http://x/${id}.png` }, position };
}

describe('PostPhotos', () => {
  let gallery: PostPhotos;
  let fixture: ComponentFixture<PostPhotos>;
  let media: jasmine.SpyObj<MediaService>;

  function keys(): string[] {
    return gallery.photos.map((photo) => photo.key);
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
    fixture.componentRef.setInput('editing', true);
    fixture.componentRef.setInput('saved', photos);
    fixture.detectChanges();
  }

  function uploadsSucceed(): void {
    media.initUpload.and.returnValue(
      of({ mediaId: 'n1', uploadUrl: 'http://s', requiredHeaders: {} }) as never,
    );
    media.uploadToS3.and.returnValue(of(undefined) as never);
    media.completeUpload.and.returnValue(of({ id: 'n1' }) as never);
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
      imports: [PostPhotos],
      providers: [{ provide: MediaService, useValue: media }],
    }).compileComponents();
    fixture = TestBed.createComponent(PostPhotos);
    gallery = fixture.componentInstance;
  });

  it('shows saved photos in their order, whatever order they arrive in', () => {
    showSaved(saved('b', 1), saved('a', 0), saved('c', 2));

    expect(keys()).toEqual(['a', 'b', 'c']);
  });

  it('marks only the first photo as the cover', () => {
    showSaved(saved('a', 0), saved('b', 1));

    expect(tile('a').querySelector('.post-photos__tile-cover')).not.toBeNull();
    expect(tile('a').querySelector('.post-photos__tile-set-cover')).toBeNull();
    expect(tile('b').querySelector('.post-photos__tile-cover')).toBeNull();
    expect(tile('b').querySelector('.post-photos__tile-set-cover')).not.toBeNull();
  });

  it('makes a photo the cover by moving it to the front, and the others keep their order', () => {
    showSaved(saved('a', 0), saved('b', 1), saved('c', 2), saved('d', 3));

    gallery.setAsCover(2);

    expect(keys()).toEqual(['c', 'a', 'b', 'd']);
    expect(gallery.photoStatus).toContain('POST_FORM.status-cover');
  });

  it('reorders a dragged photo', () => {
    showSaved(saved('a', 0), saved('b', 1), saved('c', 2));

    gallery.onPhotoDropped({ previousIndex: 0, currentIndex: 2 } as CdkDragDrop<FormPhoto[]>);

    expect(keys()).toEqual(['b', 'c', 'a']);
    expect(gallery.photoStatus).toContain('POST_FORM.status-cover');
  });

  it('says nothing for a photo dropped where it was', () => {
    showSaved(saved('a', 0), saved('b', 1));

    gallery.onPhotoDropped({ previousIndex: 1, currentIndex: 1 } as CdkDragDrop<FormPhoto[]>);

    expect(keys()).toEqual(['a', 'b']);
    expect(gallery.photoStatus).toBe('');
  });

  it('does nothing at the ends of the row, and those buttons keep the focus', () => {
    showSaved(saved('a', 0), saved('b', 1));

    gallery.movePhoto(0, -1);
    gallery.movePhoto(1, 1);

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

    gallery.removePhoto(0);

    expect(keys()).toEqual(['b']);
    expect(gallery.photoStatus).toContain('POST_FORM.status-cover-removed');
  });

  it('leaves a removed saved photo for the save to remove', () => {
    showSaved(saved('a', 0), saved('b', 1));

    gallery.removePhoto(0);

    expect(media.deleteMedia).not.toHaveBeenCalled();
    expect(gallery.mediaIds()).toEqual(['b']);
    expect(gallery.removedMediaIds).toEqual(['a']);
  });

  it('adds new photos after the saved ones', async () => {
    uploadsSucceed();
    showSaved(saved('a', 0));

    await gallery.onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);

    expect(gallery.mediaIds()).toEqual(['a', 'n1']);
  });

  it('deletes at once an upload this form made and the post never held', async () => {
    uploadsSucceed();
    showSaved(saved('a', 0));
    await gallery.onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);

    gallery.removePhoto(1);

    expect(media.deleteMedia).toHaveBeenCalledOnceWith('n1');
    expect(gallery.removedMediaIds).toEqual([]);
  });

  it('takes a photo whose upload fails off the list and says so', async () => {
    media.initUpload.and.returnValue(throwError(() => new Error('nope')));
    spyOn(console, 'error');
    const toast = spyOn(TestBed.inject(ToastService), 'show');
    showSaved(saved('a', 0));

    await gallery.onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);

    expect(keys()).toEqual(['a']);
    expect(toast).toHaveBeenCalled();
  });

  it('stops uploading the other chosen photos once left', async () => {
    const finishing = new Subject<unknown>();
    media.initUpload.and.returnValue(
      of({ mediaId: 'n1', uploadUrl: 'http://s', requiredHeaders: {} }) as never,
    );
    media.uploadToS3.and.returnValue(finishing as never);
    media.completeUpload.and.returnValue(of({ id: 'n1' }) as never);
    showSaved();
    const uploading = gallery.onFilesSelected([
      new File(['x'], 'a.png', { type: 'image/png' }),
      new File(['y'], 'b.png', { type: 'image/png' }),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    fixture.destroy();
    finishing.next(undefined);
    finishing.complete();
    await uploading;

    expect(media.initUpload).toHaveBeenCalledTimes(1);
  });

  it('shows nothing about a failed upload once left', async () => {
    const finishing = new Subject<unknown>();
    spyOn(console, 'error');
    const toast = spyOn(TestBed.inject(ToastService), 'show');
    media.initUpload.and.returnValue(
      of({ mediaId: 'n1', uploadUrl: 'http://s', requiredHeaders: {} }) as never,
    );
    media.uploadToS3.and.returnValue(finishing as never);
    showSaved();
    const uploading = gallery.onFilesSelected([new File(['x'], 'a.png', { type: 'image/png' })]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    fixture.destroy();
    finishing.error(new Error('nope'));
    await uploading;

    expect(toast).not.toHaveBeenCalled();
  });

  it('deletes an upload that finishes after the form was left', async () => {
    const finishing = new Subject<unknown>();
    media.initUpload.and.returnValue(
      of({ mediaId: 'n1', uploadUrl: 'http://s', requiredHeaders: {} }) as never,
    );
    media.uploadToS3.and.returnValue(finishing as never);
    media.completeUpload.and.returnValue(of({ id: 'n1' }) as never);
    showSaved();
    const uploading = gallery.onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);
    await new Promise((resolve) => setTimeout(resolve, 50));

    fixture.destroy();
    expect(media.deleteMedia).not.toHaveBeenCalled();
    finishing.next(undefined);
    finishing.complete();
    await uploading;

    expect(media.deleteMedia).toHaveBeenCalledOnceWith('n1');
  });

  it('discards only what this form uploaded', async () => {
    uploadsSucceed();
    showSaved(saved('a', 0));
    await gallery.onFilesSelected([new File(['x'], 'n.png', { type: 'image/png' })]);

    gallery.discardUploads();

    expect(media.deleteMedia).toHaveBeenCalledOnceWith('n1');
  });

  it('has no gallery with no photos', () => {
    showSaved();

    expect(element().querySelector('.post-photos__photos')).toBeNull();
  });
});
