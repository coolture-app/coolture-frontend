import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject } from 'rxjs';

import { PlaceSearch } from './place-search';
import { PlaceOption, PlaceResults } from '../../models/common/place-suggestion.model';
import { GeocodingService } from '../../services/geocoding/geocoding.service';

const place = (name: string): PlaceOption => ({
  name,
  coordinates: { latitude: 54.5, longitude: 18.5 },
});

describe('PlaceSearch', () => {
  let fixture: ComponentFixture<PlaceSearch>;
  let answers: Subject<PlaceResults<PlaceOption>>;

  const input = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const options = () =>
    Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('li')).map((li) =>
      li.textContent!.trim(),
    );

  function type(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    answers = new Subject();
    TestBed.configureTestingModule({
      imports: [PlaceSearch, TranslateModule.forRoot()],
      providers: [{ provide: GeocodingService, useValue: { searchPlaces: () => answers } }],
    });
    fixture = TestBed.createComponent(PlaceSearch);
    fixture.componentRef.setInput('kind', 'area');
    fixture.componentRef.setInput('near', { latitude: 54.4, longitude: 18.6 });
    fixture.componentRef.setInput('label', 'Miejsce');
    fixture.detectChanges();
  });

  it('drops the list of an older text while the answer for the new one is on its way', () => {
    type('Gdy');
    answers.next({ text: 'Gdy', places: [place('Gdynia')], unavailable: false });
    fixture.detectChanges();
    expect(options()).toEqual(jasmine.arrayContaining([jasmine.stringContaining('Gdynia')]));

    type('Gdyn');

    expect(options()).toEqual([]);
  });
});
