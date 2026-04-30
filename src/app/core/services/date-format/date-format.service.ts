import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface DateFormats {
  short: string;
  mediumDate: string;
  eventCard: string;
}

@Injectable({
  providedIn: 'root',
})
export class DateFormatService {
  private translate = inject(TranslateService);

  readonly formats = signal<DateFormats>({
    short: 'dd.MM.yyyy, HH:mm',
    mediumDate: 'd MMMM yyyy',
    eventCard: 'd MMM, HH:mm',
  });

  constructor() {
    this.translate.onLangChange.subscribe((_event) => {
      this.loadFormats();
    });

    this.loadFormats();
  }

  private loadFormats() {
    this.translate.get('DATE_FORMATS').subscribe((formats: DateFormats) => {
      if (formats) {
        this.formats.set(formats);
      }
    });
  }

  getShortFormat(): string {
    return this.formats().short;
  }

  getMediumDateFormat(): string {
    return this.formats().mediumDate;
  }

  getEventCardFormat(): string {
    return this.formats().eventCard;
  }
}
