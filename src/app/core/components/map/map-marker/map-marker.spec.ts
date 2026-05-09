import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapMarker } from './map-marker';

describe('MapMarker', () => {
  let component: MapMarker;
  let fixture: ComponentFixture<MapMarker>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapMarker],
    }).compileComponents();

    fixture = TestBed.createComponent(MapMarker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
