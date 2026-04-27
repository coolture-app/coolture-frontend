import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MapCallendarView } from './map-callendar-view';

describe('MapCallendarView', () => {
  let component: MapCallendarView;
  let fixture: ComponentFixture<MapCallendarView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapCallendarView],
    }).compileComponents();

    fixture = TestBed.createComponent(MapCallendarView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
