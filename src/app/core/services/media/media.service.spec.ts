import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { MediaService } from './media.service';
import { ApiUrlService } from '../api-url.service';

describe('MediaService', () => {
  it('uploads in three steps, and leaves out the headers S3 refuses from the browser', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const api = TestBed.inject(ApiUrlService);
    const file = new File(['x'], 'a.txt', { type: 'text/plain' });

    const uploading = TestBed.inject(MediaService).upload(file, 'EVENT_MEDIA');

    await new Promise((resolve) => setTimeout(resolve));
    const init = http.expectOne(api.path('/media/uploads/init'));
    expect(init.request.body).toEqual({
      purpose: 'EVENT_MEDIA',
      mimeType: 'text/plain',
      sizeBytes: 1,
      fileName: 'a.txt',
    });
    init.flush({
      mediaId: 'm1',
      uploadUrl: 'https://s3/put',
      requiredHeaders: { 'Content-Type': 'text/plain', Host: 's3', 'Content-Length': '1' },
    });

    await new Promise((resolve) => setTimeout(resolve));
    const put = http.expectOne('https://s3/put');
    expect(put.request.body).toBe(file);
    expect(put.request.headers.keys()).toEqual(['Content-Type']);
    put.flush('');

    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne(api.path('/media/uploads/m1/complete')).flush({ id: 'm1' });

    expect(await uploading).toEqual(jasmine.objectContaining({ id: 'm1' }));
    http.verify();
  });
});
