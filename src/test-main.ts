import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NgModule, provideZonelessChangeDetection } from '@angular/core';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

// The app runs without zone.js (app.config.ts), so the tests have to as well. The rest is what almost
// every component needs, with HTTP mocked so that no spec can reach a real API.
@NgModule({
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
    provideTranslateService(),
  ],
})
class TestDefaultsModule {}

getTestBed().initTestEnvironment(
  [BrowserTestingModule, TestDefaultsModule],
  platformBrowserTesting(),
  { errorOnUnknownElements: true, errorOnUnknownProperties: true },
);
