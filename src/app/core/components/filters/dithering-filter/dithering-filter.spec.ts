import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DitheringFilter } from './dithering-filter';

describe('DitheringFilter', () => {
  let component: DitheringFilter;
  let fixture: ComponentFixture<DitheringFilter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DitheringFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DitheringFilter);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
